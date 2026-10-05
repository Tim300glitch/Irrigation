"use client";
/**
 * CRM application store: in-memory dataset + optimistic mutations that persist
 * through the repository (IndexedDB locally, Supabase in production). Domain
 * actions encode the business workflow and write the activity timeline.
 */
import { create } from "zustand";
import type {
  ActivityLog,
  ChangeOrder,
  CollectionName,
  CrmCollections,
  CrmData,
  CrmSettings,
  Customer,
  Estimate,
  Invoice,
  Job,
  JobItem,
  JobStatus,
  Lead,
  LeadStage,
  LineItem,
  Message,
  Notification,
  Payment,
  Property,
  Signature,
  TimeEntry,
  TimeType,
  IrrigationSystem,
  Zone,
} from "@/lib/crm/types";
import { emptyData } from "@/lib/crm/types";
import { crmRepo, localRepo, supabaseConfigured } from "@/lib/crm/repository";
import { defaultSettings, estimateToJob, jobToInvoice, depositInvoice, uid, checklistFor, schematicMap } from "@/lib/crm/workflows";
import { generateSeed } from "@/lib/crm/seed";
import { estimateTotal, invoiceTotals, lineTotals, r2 } from "@/lib/crm/calc";
import { evaluateAutomations } from "@/lib/crm/automations";
import { providers, renderTemplate, emitActivity } from "@/lib/crm/integrations";
import { demoSession, getSession, setSession, type Session } from "@/lib/crm/auth";
import { customerName, fullName, money, time } from "@/lib/crm/format";
import { REPAIR_TYPES, statusLabel, JOB_STATUSES } from "@/lib/crm/constants";
import { toast } from "@/lib/crm/toast";
import { importDesign, matchProperty } from "@/lib/crm/designBridge";

type E<K extends CollectionName> = CrmCollections[K];

export interface CrmState {
  ready: boolean;
  error?: string;
  data: CrmData;
  settings: CrmSettings;
  session: Session | null;
  now: number;
  init: () => Promise<void>;
  tick: () => void;

  insert: <K extends CollectionName>(name: K, rows: E<K> | E<K>[]) => void;
  update: <K extends CollectionName>(name: K, id: string, patch: Partial<E<K>> | ((e: E<K>) => E<K>)) => void;
  remove: <K extends CollectionName>(name: K, ids: string | string[]) => void;
  saveSettings: (patch: Partial<CrmSettings>) => void;
  log: (a: Omit<ActivityLog, "id" | "at"> & { at?: string }) => void;
  notify: (n: Omit<Notification, "id" | "createdAt">) => void;
  markRead: (ids?: string[]) => void;
  nextNumber: (kind: keyof CrmSettings["nextNumbers"]) => number;

  signInAs: (employeeId: string) => void;
  signOut: () => void;

  createLead: (l: Partial<Lead> & Pick<Lead, "firstName" | "lastName">) => Lead;
  moveLead: (id: string, stage: LeadStage, beforeId?: string) => void;
  convertLead: (id: string) => { customerId: string; propertyId: string };
  createCustomer: (c: Partial<Customer> & Pick<Customer, "firstName" | "lastName">, property?: Partial<Property>) => { customer: Customer; property?: Property };
  createProperty: (p: Partial<Property> & Pick<Property, "customerId">) => Property;
  ensureMap: (systemId: string) => void;

  createEstimate: (e: Partial<Estimate> & Pick<Estimate, "customerId" | "propertyId">) => Estimate;
  sendEstimate: (id: string) => void;
  markEstimateViewed: (id: string) => void;
  approveEstimate: (id: string, optionId?: string, signature?: Signature) => string | undefined;
  declineEstimate: (id: string, reason?: string) => void;
  convertEstimateToJob: (id: string) => string;
  duplicateEstimate: (id: string) => Estimate;

  createJob: (j: Partial<Job> & Pick<Job, "customerId" | "propertyId" | "title">) => Job;
  scheduleJob: (id: string, start: string | undefined, assignedTo?: string, durationHrs?: number) => void;
  setJobStatus: (id: string, status: JobStatus, opts?: { notifyCustomer?: boolean; by?: string }) => void;
  addJobItem: (jobId: string, line: LineItem, opts?: { field?: boolean; used?: boolean }) => void;
  createChangeOrder: (jobId: string, co: Pick<ChangeOrder, "title" | "description" | "items">) => ChangeOrder;
  decideChangeOrder: (id: string, approved: boolean, signature?: Signature) => void;

  createInvoiceFromJob: (jobId: string, opts?: { send?: boolean }) => string | undefined;
  sendInvoice: (id: string) => void;
  recordPayment: (p: Omit<Payment, "id" | "receivedAt"> & { receivedAt?: string }) => Payment;

  startTimer: (employeeId: string, type: TimeType, jobId?: string) => void;
  stopTimers: (employeeId: string, types?: TimeType[]) => void;
  sendMessage: (m: Omit<Message, "id" | "at" | "status"> & { status?: Message["status"] }) => void;
  runAutomations: () => number;
  linkDesigns: () => Promise<void>;
  resetDemo: () => Promise<void>;
  startFresh: () => Promise<void>;
}

const nowIso = () => new Date().toISOString();
let initPromise: Promise<void> | null = null;

function persist<K extends CollectionName>(name: K, changed: E<K>[], all: E<K>[]) {
  crmRepo.upsert(name, changed as CrmData[K], all as CrmData[K]).catch((e) => {
    console.error(e);
    toast(`Couldn't save ${name}: ${(e as Error).message}`, "error");
  });
}

export const useCrm = create<CrmState>((set, get) => ({
  ready: false,
  data: emptyData(),
  settings: defaultSettings(),
  session: null,
  now: Date.now(),

  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        let snap = await crmRepo.load();
        // first run only: an emptied CRM ("Start empty") must stay empty
        if (!snap && crmRepo.kind === "local") {
          const seed = generateSeed();
          await localRepo.replaceAll(seed);
          snap = seed;
          set({ data: seed.data, settings: seed.settings });
          await get().linkDesigns();
          set((s) => ({ data: { ...s.data } }));
          snap = { data: get().data, settings: get().settings };
        }
        const settings = { ...defaultSettings(), ...(snap?.settings ?? {}) };
        let session = getSession();
        if (!supabaseConfigured() && (!session || !snap!.data.employees.some((e) => e.id === session!.employeeId))) {
          const owner = snap!.data.employees.find((e) => e.role === "owner") ?? snap!.data.employees[0];
          session = owner ? demoSession(owner.id, owner.role, owner.email) : null;
          setSession(session);
        }
        set({ data: snap?.data ?? emptyData(), settings, session, ready: true, now: Date.now() });
        get().runAutomations();
      } catch (e) {
        console.error(e);
        set({ error: (e as Error).message, ready: true });
      }
    })();
    return initPromise;
  },
  tick: () => {
    set({ now: Date.now() });
  },

  /* ───────── generic CRUD ───────── */
  insert: (name, rows) => {
    const arr = (Array.isArray(rows) ? rows : [rows]) as E<typeof name>[];
    const all = [...arr, ...(get().data[name] as E<typeof name>[])];
    set((s) => ({ data: { ...s.data, [name]: all } }));
    persist(name, arr, all);
  },
  update: (name, id, patch) => {
    let changed: E<typeof name> | undefined;
    const all = (get().data[name] as E<typeof name>[]).map((e) => {
      if ((e as { id: string }).id !== id) return e;
      changed = typeof patch === "function" ? patch(e) : ({ ...e, ...patch } as E<typeof name>);
      return changed;
    });
    if (!changed) return;
    set((s) => ({ data: { ...s.data, [name]: all } }));
    persist(name, [changed], all);
  },
  remove: (name, ids) => {
    const set_ = new Set(Array.isArray(ids) ? ids : [ids]);
    const all = (get().data[name] as E<typeof name>[]).filter((e) => !set_.has((e as { id: string }).id));
    set((s) => ({ data: { ...s.data, [name]: all } }));
    crmRepo.remove(name, [...set_], all as CrmData[typeof name]).catch((e) => toast(`Delete failed: ${(e as Error).message}`, "error"));
  },
  saveSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    crmRepo.saveSettings(settings).catch((e) => toast(`Couldn't save settings: ${(e as Error).message}`, "error"));
  },
  log: (a) => {
    const entry: ActivityLog = { id: uid("act"), at: a.at ?? nowIso(), by: a.by ?? get().session?.employeeId, ...a };
    get().insert("activity", entry);
    void emitActivity(entry);
  },
  notify: (n) => {
    if (n.key && get().data.notifications.some((x) => x.key === n.key)) return;
    if (get().settings.notificationPrefs[n.type] === false) return;
    get().insert("notifications", { id: uid("ntf"), createdAt: nowIso(), ...n });
  },
  markRead: (ids) => {
    const t = nowIso();
    const target = new Set(ids ?? get().data.notifications.filter((n) => !n.readAt).map((n) => n.id));
    const changed: Notification[] = [];
    const all = get().data.notifications.map((n) => (target.has(n.id) && !n.readAt ? (changed.push({ ...n, readAt: t }), { ...n, readAt: t }) : n));
    set((s) => ({ data: { ...s.data, notifications: all } }));
    persist("notifications", changed, all);
  },
  nextNumber: (kind) => {
    const nn = { ...get().settings.nextNumbers };
    const n = nn[kind];
    nn[kind] = n + 1;
    get().saveSettings({ nextNumbers: nn });
    return n;
  },

  /* ───────── session ───────── */
  signInAs: (employeeId) => {
    const e = get().data.employees.find((x) => x.id === employeeId);
    if (!e) return;
    const s = demoSession(e.id, e.role, e.email);
    setSession(s);
    set({ session: s });
    toast(`Viewing as ${fullName(e)} (${e.role.replace("_", " ")})`);
  },
  signOut: () => {
    setSession(null);
    set({ session: null });
  },

  /* ───────── leads & customers ───────── */
  createLead: (l) => {
    const lead: Lead = { id: uid("led"), phone: "", email: "", address: { street: "", city: "", state: "CA", zip: "" }, serviceType: "sprinkler_repair", description: "", source: "other", stage: "new", urgency: "normal", estimatedValue: 0, preferredDates: "", notes: "", photoIds: [], sort: 0, createdAt: nowIso(), ...l };
    get().insert("leads", lead);
    get().log({ type: "lead", message: `Lead created from ${lead.source.replace(/_/g, " ")}`, entityType: "lead", entityId: lead.id, customerId: lead.customerId });
    get().notify({ type: "new_lead", title: `New lead — ${fullName(lead)}`, body: `${lead.serviceType.replace(/_/g, " ")} · ${lead.source.replace(/_/g, " ")}`, link: `/leads?open=${lead.id}`, key: `lead:${lead.id}` });
    return lead;
  },
  moveLead: (id, stage, beforeId) => {
    const lead = get().data.leads.find((l) => l.id === id);
    if (!lead) return;
    const col = get().data.leads.filter((l) => l.stage === stage && l.id !== id).sort((a, b) => a.sort - b.sort);
    const idx = beforeId ? col.findIndex((l) => l.id === beforeId) : col.length;
    const prev = col[idx - 1]?.sort ?? (col[0]?.sort ?? 0) - 1;
    const next = col[idx]?.sort ?? prev + 2;
    get().update("leads", id, { stage, sort: (prev + next) / 2, lastContactAt: stage !== lead.stage && stage === "contacted" ? nowIso() : lead.lastContactAt });
    if (stage !== lead.stage) {
      get().log({ type: "status", message: `Lead moved to ${stage.replace(/_/g, " ")}`, entityType: "lead", entityId: id, customerId: lead.customerId });
      if (stage === "approved" && !lead.customerId) get().convertLead(id);
    }
  },
  convertLead: (id) => {
    const lead = get().data.leads.find((l) => l.id === id)!;
    if (lead.customerId && lead.propertyId) return { customerId: lead.customerId, propertyId: lead.propertyId };
    const { customer, property } = get().createCustomer({ firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, billingAddress: lead.address, leadSource: lead.source, campaignId: lead.campaignId, notes: lead.notes }, { address: lead.address });
    get().update("leads", id, { customerId: customer.id, propertyId: property!.id, convertedAt: nowIso(), stage: lead.stage === "new" ? "contacted" : lead.stage });
    // the lead's history (created, calls, notes) becomes part of the customer's timeline
    const changed: ActivityLog[] = [];
    const all = get().data.activity.map((a) => (a.entityType === "lead" && a.entityId === id && !a.customerId ? (changed.push({ ...a, customerId: customer.id }), { ...a, customerId: customer.id }) : a));
    if (changed.length) {
      set((s) => ({ data: { ...s.data, activity: all } }));
      persist("activity", changed, all);
    }
    get().log({ type: "lead", message: `Lead converted to customer`, entityType: "customer", entityId: customer.id, customerId: customer.id });
    return { customerId: customer.id, propertyId: property!.id };
  },
  createCustomer: (c, p) => {
    const customer: Customer = { id: uid("cus"), type: "residential", phone: "", email: "", billingAddress: { street: "", city: "", state: "CA", zip: "" }, leadSource: "other", tags: [], notes: "", preferredContact: "text", portalEnabled: true, createdAt: nowIso(), ...c };
    get().insert("customers", customer);
    get().log({ type: "note", message: `Customer record created`, entityType: "customer", entityId: customer.id, customerId: customer.id });
    const property = p ? get().createProperty({ customerId: customer.id, address: customer.billingAddress, ...p }) : undefined;
    return { customer, property };
  },
  createProperty: (p) => {
    const property: Property = { id: uid("prp"), name: "Home", address: { street: "", city: "", state: "CA", zip: "" }, lotNotes: "", gateCode: "", accessNotes: "", pets: "", landscapeNotes: "", waterSource: "municipal", meterSize: "3/4\"", serviceLineSize: "1\"", mainLineSize: "1\"", mainLineMaterial: "PVC SCH 40", backflow: { type: "pvb", make: "", size: "1\"", location: "", serial: "" }, controllerLocation: "", valveLocations: "", recommendedUpgrades: [], createdAt: nowIso(), ...p };
    const sys: IrrigationSystem = { id: uid("sys"), propertyId: property.id, name: "Main system", notes: "", mapWidth: 1000, mapHeight: 700, mapFtPerUnit: 0.15, installedYear: property.systemInstalledYear };
    get().insert("properties", property);
    get().insert("systems", sys);
    get().log({ type: "system", message: `Property added — ${property.address.street}`, entityType: "property", entityId: property.id, customerId: property.customerId });
    return property;
  },
  ensureMap: (systemId) => {
    const d = get().data;
    if (d.components.some((c) => c.systemId === systemId)) return;
    const sys = d.systems.find((s) => s.id === systemId);
    if (!sys) return;
    const zones = d.zones.filter((z) => z.systemId === systemId);
    const ctrl = d.controllers.find((c) => c.systemId === systemId);
    get().insert("components", schematicMap(sys, zones.length ? zones : [{ id: "", systemId, number: 1, name: "Zone 1", area: "lawn", headCount: 6, statuses: ["working"] } as unknown as Zone], ctrl).map((c) => (c.zoneId === "" ? { ...c, zoneId: undefined } : c)));
  },

  /* ───────── estimates ───────── */
  createEstimate: (e) => {
    const s = get().settings;
    const est: Estimate = { id: uid("est"), number: get().nextNumber("estimate"), title: "Irrigation estimate", serviceType: "sprinkler_repair", status: "draft", options: [{ id: uid("opt"), name: "Option 1", description: "", items: [] }], taxPct: s.taxPct, discount: { type: "amount", value: 0 }, tripCharge: s.tripCharge, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "", terms: s.estimateTerms, createdBy: get().session?.employeeId, createdAt: nowIso(), validUntil: new Date(Date.now() + s.estimateValidDays * 86400000).toISOString().slice(0, 10), ...e };
    get().insert("estimates", est);
    get().log({ type: "estimate", message: `Estimate #${est.number} created`, entityType: "estimate", entityId: est.id, customerId: est.customerId });
    if (est.leadId) get().update("leads", est.leadId, { estimateId: est.id });
    return est;
  },
  sendEstimate: (id) => {
    const e = get().data.estimates.find((x) => x.id === id)!;
    get().update("estimates", id, { status: e.status === "draft" ? "sent" : e.status, sentAt: nowIso() });
    const c = get().data.customers.find((x) => x.id === e.customerId);
    const tpl = get().data.messageTemplates.find((t) => t.id === "msg_est_ready");
    if (c && tpl) get().sendMessage({ customerId: c.id, channel: "email", direction: "out", subject: renderTemplate(tpl.subject, { company: get().settings.businessName }), body: renderTemplate(tpl.body, { first_name: c.firstName, company: get().settings.businessName, link: `${typeof location !== "undefined" ? location.origin : ""}/portal?c=${c.id}&estimate=${id}` }), templateId: tpl.id });
    get().log({ type: "estimate", message: `Estimate #${e.number} sent — ${money(estimateTotal(e))}`, entityType: "estimate", entityId: id, customerId: e.customerId, amount: estimateTotal(e) });
    const lead = get().data.leads.find((l) => l.estimateId === id || (l.customerId === e.customerId && !["approved", "lost"].includes(l.stage)));
    if (lead && !["approved", "lost", "follow_up"].includes(lead.stage)) get().update("leads", lead.id, { stage: "estimate_sent", estimateId: id, estimatedValue: estimateTotal(e), lastContactAt: nowIso() });
    toast(`Estimate #${e.number} sent to ${customerName(c)}`, "success");
  },
  markEstimateViewed: (id) => {
    const e = get().data.estimates.find((x) => x.id === id);
    if (!e || e.viewedAt || e.status !== "sent") return;
    get().update("estimates", id, { status: "viewed", viewedAt: nowIso() });
    get().log({ type: "estimate", message: `Customer viewed estimate #${e.number}`, entityType: "estimate", entityId: id, customerId: e.customerId });
  },
  approveEstimate: (id, optionId, signature) => {
    const e = get().data.estimates.find((x) => x.id === id)!;
    const selectedOptionId = optionId ?? e.selectedOptionId ?? (e.options.length === 1 ? e.options[0].id : e.options[0]?.id);
    get().update("estimates", id, { status: "approved", approvedAt: nowIso(), selectedOptionId, signature: signature ?? e.signature });
    const fresh = get().data.estimates.find((x) => x.id === id)!;
    get().log({ type: "estimate", message: `Estimate #${e.number} approved — ${money(estimateTotal(fresh))}`, entityType: "estimate", entityId: id, customerId: e.customerId, amount: estimateTotal(fresh) });
    get().notify({ type: "estimate_approved", title: `Estimate approved — ${customerName(get().data.customers.find((c) => c.id === e.customerId))}`, body: `#${e.number} · ${e.title} · ${money(estimateTotal(fresh))}`, link: `/estimates/${id}` });
    const lead = get().data.leads.find((l) => l.estimateId === id);
    if (lead) get().update("leads", lead.id, { stage: "approved", convertedAt: nowIso() });
    if (fresh.depositPct > 0 && !get().data.invoices.some((i) => i.estimateId === id && i.kind === "deposit")) {
      const inv = depositInvoice(fresh, get().nextNumber("invoice"), get().settings);
      if (inv) {
        get().insert("invoices", inv);
        get().log({ type: "invoice", message: `Deposit invoice INV-${inv.number} created — ${money(invoiceTotals(inv, []).total)}`, entityType: "invoice", entityId: inv.id, customerId: inv.customerId, amount: invoiceTotals(inv, []).total });
      }
    }
    if (fresh.installId) get().update("installs", fresh.installId, (p) => ({ ...p, stage: p.stage === "estimate" || p.stage === "approval" ? "permit" : p.stage, stageDates: { ...p.stageDates, approval: nowIso() } }));
    return fresh.jobId ?? get().convertEstimateToJob(id);
  },
  declineEstimate: (id, reason) => {
    const e = get().data.estimates.find((x) => x.id === id)!;
    get().update("estimates", id, { status: "declined", declinedAt: nowIso(), internalNotes: reason ? `${e.internalNotes}\nDeclined: ${reason}`.trim() : e.internalNotes });
    get().log({ type: "estimate", message: `Estimate #${e.number} declined${reason ? ` — ${reason}` : ""}`, entityType: "estimate", entityId: id, customerId: e.customerId });
    const lead = get().data.leads.find((l) => l.estimateId === id);
    if (lead) get().update("leads", lead.id, { stage: "lost", lostReason: reason });
  },
  convertEstimateToJob: (id) => {
    const e = get().data.estimates.find((x) => x.id === id)!;
    if (e.jobId && get().data.jobs.some((j) => j.id === e.jobId)) return e.jobId;
    const job = estimateToJob(e, get().nextNumber("job"), { checklists: get().data.checklistTemplates, settings: get().settings });
    get().insert("jobs", job);
    get().update("estimates", id, { jobId: job.id });
    if (e.installId) get().update("installs", e.installId, { jobId: job.id });
    get().log({ type: "job", message: `Job #${job.number} created from estimate #${e.number}`, entityType: "job", entityId: job.id, customerId: job.customerId, jobId: job.id });
    return job.id;
  },
  duplicateEstimate: (id) => {
    const e = get().data.estimates.find((x) => x.id === id)!;
    return get().createEstimate({ ...e, id: uid("est"), number: undefined as unknown as number, status: "draft", options: e.options.map((o) => ({ ...o, id: uid("opt"), items: o.items.map((i) => ({ ...i, id: uid("li") })) })), selectedOptionId: undefined, sentAt: undefined, viewedAt: undefined, approvedAt: undefined, declinedAt: undefined, signature: undefined, jobId: undefined, title: `${e.title} (copy)`, createdAt: nowIso() } as Estimate);
  },

  /* ───────── jobs ───────── */
  createJob: (j) => {
    const chk = checklistFor(j.serviceType ?? "sprinkler_repair", get().data.checklistTemplates);
    const items = j.items ?? [];
    const lt = lineTotals(items);
    const job: Job = { id: uid("job"), number: get().nextNumber("job"), serviceType: "sprinkler_repair", status: "unscheduled", priority: "normal", crew: [], durationHrs: 2, arrivalWindow: "8:00 – 10:00 AM", scope: "", items, equipment: "", internalNotes: "", customerNotes: "", checklist: chk.items, checklistTemplateId: chk.templateId, estimatedLaborHours: lt.laborHours, estimated: { revenue: lt.subtotal, materialCost: lt.materialCost, laborCost: lt.laborCost, equipmentCost: lt.equipmentCost }, otherCosts: [], zoneIds: [], componentIds: [], createdAt: nowIso(), ...j };
    if (job.scheduledStart && job.status === "unscheduled") job.status = "scheduled";
    get().insert("jobs", job);
    get().log({ type: "job", message: `Job #${job.number} created — ${job.title}`, entityType: "job", entityId: job.id, customerId: job.customerId, jobId: job.id });
    return job;
  },
  scheduleJob: (id, start, assignedTo, durationHrs) => {
    const j = get().data.jobs.find((x) => x.id === id)!;
    const status: JobStatus = start ? (j.status === "unscheduled" ? "scheduled" : j.status) : "unscheduled";
    const h = start ? new Date(start).getHours() : 8;
    get().update("jobs", id, { scheduledStart: start, assignedTo: assignedTo === undefined ? j.assignedTo : assignedTo || undefined, durationHrs: durationHrs ?? j.durationHrs, status, arrivalWindow: start ? `${time(start)} – ${time(new Date(start).getTime() + 2 * 3600000)}` : j.arrivalWindow });
    const tech = get().data.employees.find((e) => e.id === (assignedTo ?? j.assignedTo));
    if (start) get().log({ type: "job", message: `Job #${j.number} scheduled ${new Date(start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${time(start)}${tech ? ` — ${tech.firstName}` : ""}`, entityType: "job", entityId: id, customerId: j.customerId, jobId: id });
    void h;
    if (j.installId && start) get().update("installs", j.installId, (p) => ({ ...p, stageDates: { ...p.stageDates, material_order: p.stageDates.material_order ?? nowIso() } }));
  },
  setJobStatus: (id, status, opts = {}) => {
    const j = get().data.jobs.find((x) => x.id === id)!;
    if (j.status === status) return;
    const people = [j.assignedTo, ...j.crew].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
    const patch: Partial<Job> = { status };
    const st = get();
    if (status === "en_route") {
      for (const p of people) st.startTimer(p, "travel", id);
      if (opts.notifyCustomer !== false) {
        const c = st.data.customers.find((x) => x.id === j.customerId);
        const tpl = st.data.messageTemplates.find((t) => t.id === "msg_omw");
        const tech = st.data.employees.find((e) => e.id === j.assignedTo);
        if (c && tpl) st.sendMessage({ customerId: c.id, jobId: id, channel: "sms", direction: "out", body: renderTemplate(tpl.body, { first_name: c.firstName, tech_name: tech?.firstName ?? "your technician", company: st.settings.businessName, eta: 20 }), templateId: tpl.id });
      }
    }
    if (status === "arrived") for (const p of people) st.stopTimers(p, ["travel"]);
    if (status === "in_progress") {
      for (const p of people) st.startTimer(p, "job", id);
      if (!j.startedAt) patch.startedAt = nowIso();
    }
    if (["paused", "waiting_parts", "needs_follow_up", "callback", "cancelled", "scheduled", "unscheduled"].includes(status)) for (const p of people) st.stopTimers(p, ["travel", "job"]);
    if (status === "completed") {
      for (const p of people) st.stopTimers(p, ["travel", "job"]);
      patch.completedAt = nowIso();
      patch.items = j.items.map((i) => (i.kind === "material" && i.usedQty === undefined ? { ...i, usedQty: i.qty } : i));
    }
    st.update("jobs", id, patch);
    st.log({ type: "status", message: `Job #${j.number} → ${statusLabel(JOB_STATUSES, status)}`, entityType: "job", entityId: id, customerId: j.customerId, jobId: id, by: opts.by });
    if (status === "completed") {
      const done = get().data.jobs.find((x) => x.id === id)!;
      postInventory(done);
      // warranty for valves / controllers / backflow / installs
      const s = get().settings;
      const warrantItems = done.items.filter((i) => i.kind === "material" && /valve|controller|hydrawise|esp-tm2|rachio|pvb|backflow|reduced pressure/i.test(i.name) && !/box|adapter|diaphragm|solenoid/i.test(i.name));
      for (const w of warrantItems) {
        const item = get().data.items.find((x) => x.id === w.itemId);
        get().insert("warranties", { id: uid("war"), jobId: id, customerId: done.customerId, propertyId: done.propertyId, item: w.name, manufacturer: item?.manufacturer ?? "", installedDate: nowIso().slice(0, 10), laborMonths: s.laborWarrantyMonths, manufacturerMonths: /controller|hydrawise|esp|rachio/i.test(w.name) ? 24 : /valve/i.test(w.name) ? 24 : 12, notes: "" });
      }
      // zones touched get a repair date
      for (const z of done.zoneIds) get().update("zones", z, { lastRepairDate: nowIso().slice(0, 10) });
      // service plan: roll next visit
      if (done.planSubscriptionId) {
        const sub = get().data.planSubscriptions.find((x) => x.id === done.planSubscriptionId);
        const plan = sub && get().data.servicePlans.find((p) => p.id === sub.planId);
        if (sub && plan) {
          const next = new Date();
          next.setDate(next.getDate() + Math.round(365 / Math.max(1, plan.visitsPerYear)));
          get().update("planSubscriptions", sub.id, { lastVisitDate: nowIso().slice(0, 10), nextVisitDate: next.toISOString().slice(0, 10) });
        }
      }
      if (done.installId) get().update("installs", done.installId, (p) => ({ ...p, stage: "walkthrough", stageDates: { ...p.stageDates, installation: nowIso(), final_pressure_test: nowIso(), coverage_test: nowIso(), programming: nowIso() } }));
      get().runAutomations();
    }
  },
  addJobItem: (jobId, line, opts = {}) => {
    const item: JobItem = { ...line, id: uid("ji"), addedInField: opts.field, usedQty: opts.used ? line.qty : undefined };
    get().update("jobs", jobId, (j) => ({ ...j, items: [...j.items, item] }));
    const j = get().data.jobs.find((x) => x.id === jobId)!;
    if (opts.field) get().log({ type: "job", message: `${opts.used ? "Material used" : "Item added"}: ${line.qty} ${line.unit} ${line.name}`, entityType: "job", entityId: jobId, customerId: j.customerId, jobId });
    if (j.status === "completed" && line.kind === "material") postInventory({ ...j, items: [item] }, true);
  },
  createChangeOrder: (jobId, co) => {
    const j = get().data.jobs.find((x) => x.id === jobId)!;
    const c: ChangeOrder = { id: uid("co"), jobId, number: get().nextNumber("changeOrder"), status: "pending", createdBy: get().session?.employeeId, createdAt: nowIso(), ...co };
    get().insert("changeOrders", c);
    get().log({ type: "job", message: `Change order #${c.number} created — ${c.title} (${money(lineTotals(c.items).subtotal)})`, entityType: "job", entityId: jobId, customerId: j.customerId, jobId, amount: lineTotals(c.items).subtotal });
    get().notify({ type: "change_order", title: "Change order awaiting approval", body: `Job #${j.number} — ${c.title}`, link: `/jobs/${jobId}?tab=changes` });
    return c;
  },
  decideChangeOrder: (id, approved, signature) => {
    const c = get().data.changeOrders.find((x) => x.id === id)!;
    get().update("changeOrders", id, { status: approved ? "approved" : "declined", decidedAt: nowIso(), signature });
    const j = get().data.jobs.find((x) => x.id === c.jobId)!;
    if (approved) get().update("jobs", c.jobId, (job) => ({ ...job, items: [...job.items, ...c.items.map((i) => ({ ...i, id: uid("ji"), changeOrderId: id, addedInField: true }))], estimatedLaborHours: r2(job.estimatedLaborHours + lineTotals(c.items).laborHours) }));
    get().log({ type: "job", message: `Change order #${c.number} ${approved ? "approved" : "declined"} by customer${signature ? ` (signed: ${signature.name})` : ""}`, entityType: "job", entityId: c.jobId, customerId: j.customerId, jobId: c.jobId, amount: lineTotals(c.items).subtotal });
  },

  /* ───────── billing ───────── */
  createInvoiceFromJob: (jobId, opts = {}) => {
    const d = get().data;
    const job = d.jobs.find((x) => x.id === jobId)!;
    const existing = d.invoices.find((i) => i.jobId === jobId && i.kind !== "deposit" && i.status !== "void");
    if (existing) return existing.id;
    const depositInvs = d.invoices.filter((i) => i.estimateId && i.estimateId === job.estimateId && i.kind === "deposit");
    const depositCredit = r2(d.payments.filter((p) => depositInvs.some((i) => i.id === p.invoiceId)).reduce((s, p) => s + p.amount, 0));
    const co = d.changeOrders.filter((c) => c.jobId === jobId && c.status === "approved").flatMap((c) => c.items);
    const inv = jobToInvoice(job, get().nextNumber("invoice"), { settings: get().settings, depositCredit, approvedChangeOrderLines: co });
    get().insert("invoices", inv);
    get().update("jobs", jobId, { invoiceId: inv.id });
    get().log({ type: "invoice", message: `Invoice INV-${inv.number} created — ${money(invoiceTotals(inv, []).total)}`, entityType: "invoice", entityId: inv.id, customerId: inv.customerId, jobId, amount: invoiceTotals(inv, []).total });
    if (opts.send) get().sendInvoice(inv.id);
    return inv.id;
  },
  sendInvoice: (id) => {
    const inv = get().data.invoices.find((x) => x.id === id)!;
    get().update("invoices", id, { status: inv.status === "draft" ? "sent" : inv.status, sentAt: nowIso() });
    const c = get().data.customers.find((x) => x.id === inv.customerId);
    const tpl = get().data.messageTemplates.find((t) => t.id === "msg_inv");
    const t = invoiceTotals(inv, get().data.payments);
    if (c && tpl) get().sendMessage({ customerId: c.id, channel: "email", direction: "out", subject: renderTemplate(tpl.subject, { invoice_number: `INV-${inv.number}`, company: get().settings.businessName }), body: renderTemplate(tpl.body, { first_name: c.firstName, amount: money(t.balance), link: `${typeof location !== "undefined" ? location.origin : ""}/portal?c=${c.id}&invoice=${id}` }), templateId: tpl.id });
    get().log({ type: "invoice", message: `Invoice INV-${inv.number} sent — ${money(t.total)}`, entityType: "invoice", entityId: id, customerId: inv.customerId, jobId: inv.jobId, amount: t.total });
    toast(`INV-${inv.number} sent to ${customerName(c)}`, "success");
  },
  recordPayment: (p) => {
    const pay: Payment = { id: uid("pay"), receivedAt: nowIso(), ...p };
    get().insert("payments", pay);
    if (pay.invoiceId) {
      const inv = get().data.invoices.find((i) => i.id === pay.invoiceId)!;
      const t = invoiceTotals(inv, get().data.payments);
      get().update("invoices", inv.id, { status: t.balance <= 0.005 ? "paid" : "partial", paidAt: t.balance <= 0.005 ? pay.receivedAt : undefined, sentAt: inv.sentAt ?? pay.receivedAt });
    }
    const c = get().data.customers.find((x) => x.id === pay.customerId);
    get().log({ type: "payment", message: `${pay.isDeposit ? "Deposit paid" : "Payment received"} — ${money(pay.amount)} (${pay.method})`, entityType: pay.invoiceId ? "invoice" : "customer", entityId: pay.invoiceId ?? pay.customerId, customerId: pay.customerId, amount: pay.amount });
    get().notify({ type: "payment_received", title: `Payment received — ${money(pay.amount)}`, body: `${customerName(c)} · ${pay.method.toUpperCase()}`, link: pay.invoiceId ? `/invoices/${pay.invoiceId}` : "/payments" });
    return pay;
  },

  /* ───────── time ───────── */
  startTimer: (employeeId, type, jobId) => {
    get().stopTimers(employeeId, type === "shift" ? ["shift"] : ["travel", "job", "break", "shop", "material_pickup"]);
    const t: TimeEntry = { id: uid("tim"), employeeId, jobId, type, start: nowIso(), notes: "" };
    get().insert("timeEntries", t);
    if (type !== "shift" && !get().data.timeEntries.some((x) => x.employeeId === employeeId && x.type === "shift" && !x.end)) get().insert("timeEntries", { id: uid("tim"), employeeId, type: "shift", start: nowIso(), notes: "Auto clock-in" });
  },
  stopTimers: (employeeId, types) => {
    const t = nowIso();
    const changed: TimeEntry[] = [];
    const all = get().data.timeEntries.map((e) => (e.employeeId === employeeId && !e.end && (!types || types.includes(e.type)) ? (changed.push({ ...e, end: t }), { ...e, end: t }) : e));
    if (!changed.length) return;
    set((s) => ({ data: { ...s.data, timeEntries: all } }));
    persist("timeEntries", changed, all);
  },

  sendMessage: (m) => {
    const msg: Message = { id: uid("msg"), at: nowIso(), status: m.status ?? (m.direction === "out" && (m.channel === "sms" || m.channel === "email") ? "queued" : "logged"), by: get().session?.employeeId, ...m };
    get().insert("messages", msg);
    if (msg.status === "queued") {
      const c = get().data.customers.find((x) => x.id === msg.customerId);
      providers.messaging
        .send({ channel: msg.channel as "sms" | "email", to: msg.channel === "sms" ? (c?.phone ?? "") : (c?.email ?? ""), subject: msg.subject, body: msg.body })
        .then((r) => get().update("messages", msg.id, { status: r.status === "failed" ? "failed" : "sent" }));
    }
  },

  runAutomations: () => {
    const st = get();
    const due = evaluateAutomations(st.data, st.settings, Date.now());
    if (!due.length) return 0;
    for (const a of due) {
      if (a.type === "message") {
        st.sendMessage({ customerId: a.customerId, jobId: a.jobId, channel: a.channel, direction: "out", subject: a.subject, body: a.body, templateId: a.automation.templateId, automationId: a.automation.id });
        if (a.touch) st.update(a.touch.collection, a.touch.id, { [a.touch.field]: nowIso() } as never);
        st.log({ type: "automation", message: `Automation: ${a.automation.name}`, entityType: a.touch?.collection === "estimates" ? "estimate" : a.touch?.collection === "invoices" ? "invoice" : a.jobId ? "job" : "customer", entityId: a.touch?.id ?? a.jobId ?? a.customerId, customerId: a.customerId, jobId: a.jobId });
      } else if (a.type === "invoice") {
        const invId = st.createInvoiceFromJob(a.entityId);
        if (invId) st.log({ type: "automation", message: `Automation: draft invoice generated on job completion`, entityType: "invoice", entityId: invId, jobId: a.entityId });
      } else {
        st.notify({ ...a.notification });
      }
    }
    st.insert(
      "automationRuns",
      due.map((a) => ({ id: uid("run"), automationId: a.automation.id, entityId: a.entityId, at: nowIso(), result: a.type })),
    );
    return due.length;
  },

  linkDesigns: async () => {
    try {
      const { repo } = await import("@/lib/storage/repository");
      const { ensureSeeded } = await import("@/lib/storage/seed");
      await ensureSeeded();
      const summaries = await repo.listSummaries();
      for (const s of summaries) {
        const d = get().data;
        const p = matchProperty(s.client, s.address, d.properties, d.customers);
        if (!p || p.designProjectId) continue;
        const project = await repo.getProject(s.id);
        if (!project) continue;
        get().update("properties", p.id, { designProjectId: s.id });
        const sys = d.systems.find((x) => x.propertyId === p.id);
        if (!sys) continue;
        const r = importDesign(project, sys, d.zones.filter((z) => z.systemId === sys.id));
        get().remove("components", d.components.filter((c) => c.systemId === sys.id).map((c) => c.id));
        get().insert("components", r.components);
        get().update("systems", sys.id, { mapWidth: r.mapWidth, mapHeight: r.mapHeight, mapFtPerUnit: r.mapFtPerUnit });
      }
    } catch (e) {
      console.warn("Design link skipped", e);
    }
  },

  resetDemo: async () => {
    const seed = generateSeed();
    await localRepo.replaceAll(seed);
    set({ data: seed.data, settings: seed.settings });
    await get().linkDesigns();
    get().runAutomations();
    toast("Demo data restored", "success");
  },

  startFresh: async () => {
    const { data, settings, session } = get();
    const me = data.employees.find((e) => e.id === session?.employeeId) ?? data.employees.find((e) => e.role === "owner");
    const next = emptyData();
    // keep the setup a business reuses; clear every customer, job and transaction
    for (const c of KEEP_ON_FRESH_START) (next as Record<string, unknown>)[c] = data[c];
    if (me) next.employees = [{ ...me, truckId: undefined }];
    await crmRepo.replaceAll({ data: next, settings });
    set({ data: next });
    toast("All records cleared", "success");
  },
}));

/** Reference data kept by "Start empty": price book, templates, automation rules, plan offerings. */
const KEEP_ON_FRESH_START = ["items", "estimateTemplates", "checklistTemplates", "messageTemplates", "automations", "servicePlans"] as const;

/** Deduct materials used on a completed job from the tech's truck (or the warehouse). */
function postInventory(job: Job, force = false) {
  const st = useCrm.getState();
  if (!force && st.data.inventoryTxns.some((t) => t.jobId === job.id && t.reason === "used")) return;
  const truckId = st.data.employees.find((e) => e.id === job.assignedTo)?.truckId;
  for (const i of job.items) {
    if (i.kind !== "material" || !i.itemId) continue;
    const item = st.data.items.find((x) => x.id === i.itemId);
    if (!item?.stocked) continue;
    const qty = i.usedQty ?? i.qty;
    const ts = truckId ? st.data.truckStock.find((t) => t.truckId === truckId && t.itemId === i.itemId) : undefined;
    if (ts && ts.qty >= qty) {
      st.update("truckStock", ts.id, { qty: r2(ts.qty - qty) });
      st.insert("inventoryTxns", { id: uid("txn"), itemId: i.itemId, location: truckId!, qty: -qty, reason: "used", jobId: job.id, employeeId: job.assignedTo, note: `Job #${job.number}`, at: nowIso() });
    } else {
      st.update("items", item.id, { warehouseQty: r2(item.warehouseQty - qty) });
      st.insert("inventoryTxns", { id: uid("txn"), itemId: i.itemId, location: "warehouse", qty: -qty, reason: "used", jobId: job.id, employeeId: job.assignedTo, note: `Job #${job.number}`, at: nowIso() });
    }
  }
}

/* ───────── selectors ───────── */

const mapCache = new WeakMap<object, Map<string, unknown>>();
export function byId<T extends { id: string }>(arr: T[]): Map<string, T> {
  let m = mapCache.get(arr) as Map<string, T> | undefined;
  if (!m) {
    m = new Map(arr.map((x) => [x.id, x]));
    mapCache.set(arr, m);
  }
  return m;
}
export const useData = <K extends CollectionName>(name: K) => useCrm((s) => s.data[name]);
export const useEntity = <K extends CollectionName>(name: K, id: string | undefined) => useCrm((s) => (id ? byId(s.data[name] as unknown as { id: string }[]).get(id) : undefined) as E<K> | undefined);

export const isRepairJob = (j: Job) => REPAIR_TYPES.includes(j.serviceType);
export type { Invoice };

"use client";
/** Quick-create modals behind the "+" button, the New menu and the command palette. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { Filter, UserPlus, FileText, Wrench, Receipt, House, ClipboardCheck, X } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import type { LeadSource, ServiceType, CustomerType } from "@/lib/crm/types";
import { LEAD_SOURCES, SERVICE_TYPES, CUSTOMER_TYPES } from "@/lib/crm/constants";
import { optionsFromTemplate } from "@/lib/crm/workflows";
import { customerName, money } from "@/lib/crm/format";
import { lineTotals } from "@/lib/crm/calc";
import { Button, Modal, Field, Input, Select, Textarea, cn } from "./ui";
import { CustomerPicker, PropertyPicker, EmployeePicker, Combo } from "./pickers";
import { toast } from "@/lib/crm/toast";

export type QuickKind = "lead" | "customer" | "estimate" | "job" | "invoice" | "property" | "audit";
export const QUICK_ACTIONS: { kind: QuickKind; label: string; icon: typeof Filter; key?: string }[] = [
  { kind: "lead", label: "New Lead", icon: Filter, key: "N" },
  { kind: "customer", label: "New Customer", icon: UserPlus },
  { kind: "estimate", label: "New Estimate", icon: FileText },
  { kind: "job", label: "New Job", icon: Wrench },
  { kind: "invoice", label: "New Invoice", icon: Receipt },
  { kind: "property", label: "New Property", icon: House },
  { kind: "audit", label: "New Audit", icon: ClipboardCheck },
];

interface QCState {
  kind: QuickKind | null;
  ctx: { customerId?: string; propertyId?: string; leadId?: string; start?: string; assignedTo?: string };
  menu: boolean;
  open: (k: QuickKind, ctx?: QCState["ctx"]) => void;
  close: () => void;
  setMenu: (v: boolean) => void;
}
export const useQuickCreate = create<QCState>((set) => ({ kind: null, ctx: {}, menu: false, open: (kind, ctx = {}) => set({ kind, ctx, menu: false }), close: () => set({ kind: null, ctx: {} }), setMenu: (menu) => set({ menu }) }));

const serviceOptions = SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label }));
const sourceOptions = LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label }));

export function QuickCreateHost() {
  const { kind, close, menu, setMenu, open } = useQuickCreate();
  return (
    <>
      {menu && (
        <div className="fixed inset-0 z-40" onClick={() => setMenu(false)}>
          <div className="animate-in absolute bottom-20 right-5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl md:bottom-[84px] md:right-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quick actions</span>
              <button onClick={() => setMenu(false)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X size={13} />
              </button>
            </div>
            {QUICK_ACTIONS.map((a) => (
              <button key={a.kind} onClick={() => open(a.kind)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-slate-800 hover:bg-slate-100">
                <a.icon size={16} className="text-brand-600" />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {kind === "lead" && <LeadForm onClose={close} />}
      {kind === "customer" && <CustomerForm onClose={close} />}
      {kind === "estimate" && <EstimateForm onClose={close} />}
      {kind === "job" && <JobForm onClose={close} />}
      {kind === "invoice" && <InvoiceForm onClose={close} />}
      {kind === "property" && <PropertyForm onClose={close} />}
      {kind === "audit" && <AuditForm onClose={close} />}
    </>
  );
}

function AddressFields({ v, set }: { v: { street: string; city: string; state: string; zip: string }; set: (a: typeof v) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      <Field label="Street" className="col-span-6">
        <Input value={v.street} onChange={(e) => set({ ...v, street: e.target.value })} placeholder="1842 Vista Grande Dr" />
      </Field>
      <Field label="City" className="col-span-3">
        <Input value={v.city} onChange={(e) => set({ ...v, city: e.target.value })} />
      </Field>
      <Field label="State" className="col-span-1">
        <Input value={v.state} onChange={(e) => set({ ...v, state: e.target.value })} />
      </Field>
      <Field label="ZIP" className="col-span-2">
        <Input value={v.zip} onChange={(e) => set({ ...v, zip: e.target.value })} inputMode="numeric" />
      </Field>
    </div>
  );
}

function LeadForm({ onClose }: { onClose: () => void }) {
  const createLead = useCrm((s) => s.createLead);
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", address: { street: "", city: "", state: "CA", zip: "" }, serviceType: "sprinkler_repair" as ServiceType, source: "google" as LeadSource, urgency: "normal" as const, estimatedValue: 0, description: "" });
  const ok = f.firstName.trim() && (f.phone.trim() || f.email.trim());
  return (
    <Modal
      open
      onClose={onClose}
      title="New lead"
      subtitle="Capture the call while you're on it — it lands in the New Lead column."
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              const l = createLead({ ...f, urgency: f.urgency as "normal" });
              onClose();
              toast("Lead created", "success", { label: "Open", href: `/leads?open=${l.id}` });
              router.push(`/leads?open=${l.id}`);
            }}
          >
            Create lead
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name" required>
            <Input autoFocus value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="(951) 555-0100" />
          </Field>
          <Field label="Email">
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" />
          </Field>
        </div>
        <AddressFields v={f.address} set={(address) => setF({ ...f, address })} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Service" className="col-span-2">
            <Select value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value as ServiceType })} options={serviceOptions} />
          </Field>
          <Field label="Source">
            <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })} options={sourceOptions} />
          </Field>
          <Field label="Urgency">
            <Select value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value as "normal" })} options={["low", "normal", "high", "emergency"].map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }))} />
          </Field>
        </div>
        <Field label="What do they need?">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Valve stuck on in front yard, water running all night…" />
        </Field>
      </div>
    </Modal>
  );
}

function CustomerForm({ onClose }: { onClose: () => void }) {
  const createCustomer = useCrm((s) => s.createCustomer);
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", company: "", type: "residential" as CustomerType, phone: "", email: "", billingAddress: { street: "", city: "", state: "CA", zip: "" }, leadSource: "google" as LeadSource, notes: "", gateCode: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="New customer"
      subtitle="Creates the customer, their first property and an empty irrigation system record."
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!f.firstName.trim()}
            onClick={() => {
              const { customer } = createCustomer({ ...f }, { address: f.billingAddress, gateCode: f.gateCode, name: f.type === "residential" ? "Home" : f.company || "Site" });
              onClose();
              router.push(`/customers/${customer.id}`);
            }}
          >
            Create customer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name" required>
            <Input autoFocus value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomerType })} options={CUSTOMER_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
          <Field label="Company">
            <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="HOA / business name" />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" />
          </Field>
        </div>
        <AddressFields v={f.billingAddress} set={(billingAddress) => setF({ ...f, billingAddress })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lead source">
            <Select value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value as LeadSource })} options={sourceOptions} />
          </Field>
          <Field label="Gate code">
            <Input value={f.gateCode} onChange={(e) => setF({ ...f, gateCode: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function EstimateForm({ onClose }: { onClose: () => void }) {
  const ctx = useQuickCreate((s) => s.ctx);
  const { createEstimate, data } = useCrm();
  const router = useRouter();
  const [customerId, setCustomerId] = useState(ctx.customerId);
  const [propertyId, setPropertyId] = useState(ctx.propertyId);
  const [tpl, setTpl] = useState<string>("");
  const [title, setTitle] = useState("");
  const template = data.estimateTemplates.find((t) => t.id === tpl);
  const itemMap = new Map(data.items.map((i) => [i.id, i]));
  return (
    <Modal
      open
      onClose={onClose}
      title="New estimate"
      subtitle="Start from a template — every line can be edited in the builder."
      width={680}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!customerId || !propertyId}
            onClick={() => {
              const e = createEstimate({ customerId: customerId!, propertyId: propertyId!, leadId: ctx.leadId, title: title || template?.name || "Irrigation estimate", serviceType: template?.serviceType ?? "sprinkler_repair", ...(template ? { options: optionsFromTemplate(template, itemMap) } : {}), depositPct: template?.serviceType === "new_install" || template?.serviceType === "drip_conversion" ? 50 : 0 });
              onClose();
              router.push(`/estimates/${e.id}`);
            }}
          >
            Open builder
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Customer" required>
            <CustomerPicker value={customerId} onChange={setCustomerId} autoFocus={!customerId} />
          </Field>
          <Field label="Property" required>
            <PropertyPicker customerId={customerId} value={propertyId} onChange={setPropertyId} />
          </Field>
        </div>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={template?.name ?? "e.g. Valve replacement — zone 3"} />
        </Field>
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Template</div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            <button onClick={() => setTpl("")} className={cn("rounded-lg border px-2.5 py-2 text-left text-[12.5px]", !tpl ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300")}>
              <div className="font-medium text-slate-900">Blank estimate</div>
              <div className="text-[11.5px] text-slate-500">Build from scratch</div>
            </button>
            {data.estimateTemplates.map((t) => {
              const o = optionsFromTemplate(t, itemMap);
              const total = Math.max(...o.map((x) => lineTotals(x.items).subtotal));
              return (
                <button key={t.id} onClick={() => setTpl(t.id)} className={cn("rounded-lg border px-2.5 py-2 text-left text-[12.5px]", tpl === t.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300")}>
                  <div className="truncate font-medium text-slate-900">{t.name}</div>
                  <div className="text-[11.5px] text-slate-500">
                    {o.length > 1 ? `${o.length} options · up to ` : ""}
                    {money(total)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function JobForm({ onClose }: { onClose: () => void }) {
  const ctx = useQuickCreate((s) => s.ctx);
  const createJob = useCrm((s) => s.createJob);
  const router = useRouter();
  const [f, setF] = useState({ customerId: ctx.customerId, propertyId: ctx.propertyId, title: "", serviceType: "sprinkler_repair" as ServiceType, date: ctx.start?.slice(0, 10) ?? "", time: ctx.start ? new Date(ctx.start).toTimeString().slice(0, 5) : "08:00", durationHrs: 2, assignedTo: ctx.assignedTo ?? "", priority: "normal", scope: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="New job"
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!f.customerId || !f.propertyId || !f.title.trim()}
            onClick={() => {
              const start = f.date ? new Date(`${f.date}T${f.time || "08:00"}`).toISOString() : undefined;
              const j = createJob({ customerId: f.customerId!, propertyId: f.propertyId!, title: f.title, serviceType: f.serviceType, scheduledStart: start, durationHrs: f.durationHrs, assignedTo: f.assignedTo || undefined, priority: f.priority as "normal", scope: f.scope });
              onClose();
              router.push(`/jobs/${j.id}`);
            }}
          >
            Create job
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Customer" required>
            <CustomerPicker value={f.customerId} onChange={(customerId) => setF({ ...f, customerId })} autoFocus={!f.customerId} />
          </Field>
          <Field label="Property" required>
            <PropertyPicker customerId={f.customerId} value={f.propertyId} onChange={(propertyId) => setF((x) => ({ ...x, propertyId }))} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Title" required className="col-span-3 sm:col-span-2">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Valve stuck on — zone 3" />
          </Field>
          <Field label="Priority" className="col-span-3 sm:col-span-1">
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={["low", "normal", "high", "urgent"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
          </Field>
          <Field label="Service type" className="col-span-3">
            <Select value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value as ServiceType })} options={serviceOptions} />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Start">
            <Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
          <Field label="Hours">
            <Input type="number" min={0.5} step={0.5} value={f.durationHrs} onChange={(e) => setF({ ...f, durationHrs: Number(e.target.value) })} />
          </Field>
          <Field label="Technician" className="col-span-3">
            <EmployeePicker value={f.assignedTo} onChange={(assignedTo) => setF({ ...f, assignedTo })} roles={["technician", "crew_lead", "estimator", "owner"]} />
          </Field>
        </div>
        <Field label="Scope of work">
          <Textarea value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const { data, createInvoiceFromJob } = useCrm();
  const router = useRouter();
  const ready = data.jobs.filter((j) => j.completedAt && !data.invoices.some((i) => i.jobId === j.id && i.kind !== "deposit"));
  const cust = new Map(data.customers.map((c) => [c.id, c]));
  const [jobId, setJobId] = useState<string | undefined>(ready[0]?.id);
  return (
    <Modal
      open
      onClose={onClose}
      title="New invoice"
      subtitle="Invoices are generated from completed jobs (labor, materials used, approved change orders and deposits)."
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!jobId}
            onClick={() => {
              const id = createInvoiceFromJob(jobId!);
              onClose();
              if (id) router.push(`/invoices/${id}`);
            }}
          >
            Generate invoice
          </Button>
        </>
      }
    >
      {ready.length ? (
        <Field label="Completed job">
          <Combo value={jobId} onChange={setJobId} options={ready.map((j) => ({ value: j.id, label: `#${j.number} ${j.title}`, sub: `${customerName(cust.get(j.customerId))} · ${money(lineTotals(j.items).subtotal)}` }))} />
        </Field>
      ) : (
        <p className="text-[13px] text-slate-600">Every completed job already has an invoice. 🎉</p>
      )}
    </Modal>
  );
}

function PropertyForm({ onClose }: { onClose: () => void }) {
  const ctx = useQuickCreate((s) => s.ctx);
  const createProperty = useCrm((s) => s.createProperty);
  const router = useRouter();
  const [customerId, setCustomerId] = useState(ctx.customerId);
  const [name, setName] = useState("Home");
  const [address, setAddress] = useState({ street: "", city: "", state: "CA", zip: "" });
  const [gateCode, setGate] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="New property"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!customerId || !address.street}
            onClick={() => {
              const p = createProperty({ customerId: customerId!, name, address, gateCode });
              onClose();
              router.push(`/properties/${p.id}`);
            }}
          >
            Create property
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Customer" required>
          <CustomerPicker value={customerId} onChange={setCustomerId} autoFocus={!customerId} />
        </Field>
        <Field label="Property name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home / Clubhouse / North entry" />
        </Field>
        <AddressFields v={address} set={setAddress} />
        <Field label="Gate code">
          <Input value={gateCode} onChange={(e) => setGate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function AuditForm({ onClose }: { onClose: () => void }) {
  const ctx = useQuickCreate((s) => s.ctx);
  const { data, insert, session } = useCrm();
  const router = useRouter();
  const [customerId, setCustomerId] = useState(ctx.customerId);
  const [propertyId, setPropertyId] = useState(ctx.propertyId);
  return (
    <Modal
      open
      onClose={onClose}
      title="New irrigation audit"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!propertyId}
            onClick={() => {
              const sys = data.systems.find((s) => s.propertyId === propertyId)!;
              const p = data.properties.find((x) => x.id === propertyId)!;
              const zones = data.zones.filter((z) => z.systemId === sys.id);
              const id = `aud_${Date.now().toString(36)}`;
              insert("audits", { id, propertyId: propertyId!, systemId: sys.id, technicianId: session?.employeeId, date: new Date().toISOString().slice(0, 10), status: "draft", staticPsi: p.staticPsi, dynamicPsi: p.dynamicPsi, flowGpm: p.availableGpm, headSpacingOk: true, nozzleMatch: true, brokenHeads: 0, leaks: 0, overspray: 0, runoff: 0, lowHeads: 0, tiltedHeads: 0, pressureProblems: "", valveIssues: "", controllerSettings: "", wateringSchedule: "", soilType: "loam", sunExposure: "full", slopePct: 0, plantType: "", zoneFindings: zones.map((z) => ({ zoneId: z.id, issues: [], note: "" })), notes: "", createdAt: new Date().toISOString() });
              onClose();
              router.push(`/audits/${id}`);
            }}
          >
            Start audit
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Customer">
          <CustomerPicker value={customerId} onChange={setCustomerId} autoFocus={!customerId} />
        </Field>
        <Field label="Property">
          <PropertyPicker customerId={customerId} value={propertyId} onChange={setPropertyId} />
        </Field>
      </div>
    </Modal>
  );
}

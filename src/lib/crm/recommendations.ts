/**
 * Smart operational suggestions. Each rule is a small, explainable heuristic
 * over CRM data (no black box), so the office can trust and act on it.
 */
import type { CrmData, CrmSettings } from "./types";
import { crmIndex } from "./metrics";
import { REPAIR_TYPES, OPEN_JOB } from "./constants";
import { customerName, money0, time } from "./format";
import { estimateTotal, invoiceTotals } from "./calc";

export interface Recommendation {
  id: string;
  kind: "upsell" | "sales" | "profit" | "schedule" | "billing" | "maintenance" | "system";
  severity: "info" | "warn" | "high";
  title: string;
  detail: string;
  link: string;
  customerId?: string;
  propertyId?: string;
  value?: number;
}

const DAY = 86400000;

export function recommendations(data: CrmData, settings: CrmSettings, now = Date.now(), opts: { customerId?: string; propertyId?: string } = {}): Recommendation[] {
  const out: Recommendation[] = [];
  const idx = crmIndex(data, settings);
  const cust = new Map(data.customers.map((c) => [c.id, c]));
  const prop = new Map(data.properties.map((p) => [p.id, p]));
  const emp = new Map(data.employees.map((e) => [e.id, e]));
  const scoped = (cId?: string, pId?: string) => (!opts.customerId || opts.customerId === cId) && (!opts.propertyId || opts.propertyId === pId);
  const yearAgo = now - 365 * DAY;
  const recentlyActive = new Set(data.jobs.filter((j) => !j.archived && new Date(j.createdAt).getTime() > now - 240 * DAY).map((j) => j.propertyId));

  // 1. repeat repairs → rebuild
  const repairs = new Map<string, number>();
  for (const j of data.jobs) if (REPAIR_TYPES.includes(j.serviceType) && j.completedAt && new Date(j.completedAt).getTime() > yearAgo && !j.callbackOfJobId) repairs.set(j.propertyId, (repairs.get(j.propertyId) ?? 0) + 1);
  for (const [pid, n] of repairs) {
    if (n < 3) continue;
    const p = prop.get(pid);
    if (!p || !scoped(p.customerId, pid)) continue;
    const hasOpenEst = data.estimates.some((e) => e.propertyId === pid && ["draft", "sent", "viewed"].includes(e.status) && ["upgrade", "new_install", "zone_addition"].includes(e.serviceType));
    out.push({ id: `rebuild:${pid}`, kind: "upsell", severity: hasOpenEst ? "info" : "warn", title: `${customerName(cust.get(p.customerId))} has had ${n} repairs in 12 months`, detail: hasOpenEst ? "A rebuild estimate is already in progress — follow up." : "Consider recommending a zone rebuild or system upgrade.", link: `/properties/${pid}`, customerId: p.customerId, propertyId: pid });
  }

  // 2. old controllers → smart upgrade
  const sysById = new Map(data.systems.map((s) => [s.id, s]));
  for (const c of data.controllers) {
    if (c.smart) continue;
    const s = sysById.get(c.systemId);
    if (!s || !recentlyActive.has(s.propertyId)) continue;
    const p = prop.get(s.propertyId);
    if (!p || !scoped(p.customerId, p.id)) continue;
    const year = c.installedDate ? Number(c.installedDate.slice(0, 4)) : p.systemInstalledYear;
    if (!year) continue;
    const age = new Date(now).getFullYear() - year;
    if (age < 12) continue;
    out.push({ id: `ctrl:${c.id}`, kind: "upsell", severity: "info", title: `${age}-year-old ${c.manufacturer} ${c.model} at ${p.address.street}`, detail: "Recommend a smart controller upgrade (water district rebates often cover most of the cost).", link: `/properties/${p.id}?tab=system`, customerId: p.customerId, propertyId: p.id, value: 520 });
  }

  // 3. estimates without follow-up
  for (const e of data.estimates) {
    if (!["sent", "viewed"].includes(e.status) || !e.sentAt || !scoped(e.customerId, e.propertyId)) continue;
    const last = new Date(e.lastFollowUpAt ?? e.sentAt).getTime();
    const days = Math.floor((now - last) / DAY);
    if (days < 4 || now - new Date(e.sentAt).getTime() > 45 * DAY) continue;
    out.push({ id: `fu:${e.id}`, kind: "sales", severity: days > 7 ? "high" : "warn", title: `Estimate #${e.number} not followed up in ${days} days`, detail: `${customerName(cust.get(e.customerId))} · ${e.title} · ${money0(estimateTotal(e))}${e.status === "viewed" ? " · customer viewed it" : ""}`, link: `/estimates/${e.id}`, customerId: e.customerId, value: estimateTotal(e) });
  }

  // 4. material overrun
  for (const j of data.jobs) {
    if (!j.completedAt || now - new Date(j.completedAt).getTime() > 30 * DAY || !scoped(j.customerId, j.propertyId)) continue;
    const c = idx.costing(j);
    if (c.est.materialCost > 50 && c.materialCost > c.est.materialCost * 1.15) {
      const pct = Math.round((c.materialCost / c.est.materialCost - 1) * 100);
      out.push({ id: `mat:${j.id}`, kind: "profit", severity: pct > 30 ? "high" : "warn", title: `Material cost on job #${j.number} is ${pct}% higher than estimate`, detail: `${money0(c.materialCost)} actual vs ${money0(c.est.materialCost)} estimated — review the template or capture a change order next time.`, link: `/jobs/${j.id}?tab=costing`, customerId: j.customerId });
    }
    if (c.est.laborHours > 0 && c.laborHours + c.travelHours > c.est.laborHours * 1.4 && c.laborHours + c.travelHours - c.est.laborHours >= 1.5) {
      out.push({ id: `lab:${j.id}`, kind: "profit", severity: "warn", title: `Job #${j.number} ran ${(c.laborHours + c.travelHours - c.est.laborHours).toFixed(1)} labor hours over`, detail: `Estimated margin ${Math.round(c.est.margin * 100)}% → actual ${Math.round(c.margin * 100)}%.`, link: `/jobs/${j.id}?tab=costing`, customerId: j.customerId });
    }
  }

  // 5. schedule gaps today
  if (!opts.customerId && !opts.propertyId) {
    const today = new Date(now).toDateString();
    for (const e of data.employees.filter((x) => x.active && ["technician", "crew_lead"].includes(x.role))) {
      const jobs = data.jobs.filter((j) => !j.archived && j.assignedTo === e.id && j.scheduledStart && new Date(j.scheduledStart).toDateString() === today && j.status !== "cancelled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
      for (let i = 0; i < jobs.length - 1; i++) {
        const end = new Date(jobs[i].scheduledStart!).getTime() + jobs[i].durationHrs * 3600000;
        const next = new Date(jobs[i + 1].scheduledStart!).getTime();
        const gap = (next - end) / 60000;
        if (gap >= 90 && next > now) out.push({ id: `gap:${e.id}:${i}`, kind: "schedule", severity: "info", title: `${e.firstName} has ${Math.round(gap)} minutes open between jobs`, detail: `${time(end)} – ${time(next)}. Fill with an unscheduled job or a maintenance visit nearby.`, link: `/dispatch` });
      }
      const late = jobs.find((j) => j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now);
      if (late) out.push({ id: `late:${late.id}`, kind: "schedule", severity: "high", title: `${e.firstName} is running late for job #${late.number}`, detail: `Scheduled ${time(late.scheduledStart)} at ${customerName(cust.get(late.customerId))}. Send an updated ETA.`, link: `/jobs/${late.id}` });
    }
    // unassigned work today / urgent unscheduled
    for (const j of data.jobs.filter((x) => !x.archived && x.status === "unscheduled" && (x.priority === "urgent" || x.priority === "high"))) out.push({ id: `urg:${j.id}`, kind: "schedule", severity: j.priority === "urgent" ? "high" : "warn", title: `${j.priority === "urgent" ? "Urgent" : "High-priority"} job #${j.number} is not scheduled`, detail: `${customerName(cust.get(j.customerId))} · ${j.title}`, link: `/dispatch` });
  }

  // 6. approved estimates not scheduled
  for (const e of data.estimates) {
    if (e.status !== "approved" || !e.approvedAt || !scoped(e.customerId, e.propertyId)) continue;
    const job = e.jobId ? idx.jobById.get(e.jobId) : undefined;
    if (job && job.status !== "unscheduled") continue;
    const days = Math.floor((now - new Date(e.approvedAt).getTime()) / DAY);
    if (days < 1) continue;
    out.push({ id: `sched:${e.id}`, kind: "schedule", severity: days > 5 ? "high" : "warn", title: `Approved estimate #${e.number} not scheduled (${days}d)`, detail: `${customerName(cust.get(e.customerId))} · ${e.title} · ${money0(estimateTotal(e))}`, link: job ? `/jobs/${job.id}` : `/estimates/${e.id}`, customerId: e.customerId, value: estimateTotal(e) });
  }

  // 7. overdue invoices > 30 days
  for (const i of data.invoices) {
    if (i.status === "void" || i.status === "draft" || !scoped(i.customerId, i.propertyId)) continue;
    const t = invoiceTotals(i, idx.paymentsByInvoice.get(i.id) ?? [], now);
    if (t.daysOverdue >= 30) out.push({ id: `od:${i.id}`, kind: "billing", severity: "high", title: `INV-${i.number} is ${t.daysOverdue} days overdue`, detail: `${customerName(cust.get(i.customerId))} owes ${money0(t.balance)}.`, link: `/invoices/${i.id}`, customerId: i.customerId, value: t.balance });
  }

  // 8. maintenance due, not scheduled
  for (const s of data.planSubscriptions) {
    if (s.status !== "active" || !scoped(s.customerId, s.propertyId)) continue;
    const due = new Date(s.nextVisitDate + "T12:00:00").getTime();
    if (due - now > 7 * DAY) continue;
    const scheduled = data.jobs.some((j) => j.planSubscriptionId === s.id && OPEN_JOB.includes(j.status) && j.status !== "unscheduled");
    if (scheduled) continue;
    const plan = data.servicePlans.find((p) => p.id === s.planId);
    out.push({ id: `plan:${s.id}`, kind: "maintenance", severity: due < now ? "warn" : "info", title: `${plan?.name ?? "Maintenance"} ${due < now ? "overdue" : "due"} — ${customerName(cust.get(s.customerId))}`, detail: `Visit ${due < now ? "was due" : "due"} ${new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Create & schedule the visit.`, link: `/service-plans`, customerId: s.customerId, propertyId: s.propertyId });
  }

  // 9. high pressure without regulation (properties seen recently)
  for (const p of data.properties) {
    if (!scoped(p.customerId, p.id) || !recentlyActive.has(p.id)) continue;
    if ((p.staticPsi ?? 0) > 80 && !p.recommendedUpgrades.some((u) => /regulat/i.test(u) && /installed/i.test(u))) {
      if (opts.propertyId || opts.customerId) out.push({ id: `psi:${p.id}`, kind: "system", severity: "info", title: `Static pressure ${p.staticPsi} psi at ${p.address.street}`, detail: "Above 80 psi causes misting and premature valve failure. Recommend a pressure regulator or PRS heads.", link: `/properties/${p.id}?tab=system`, customerId: p.customerId, propertyId: p.id });
    }
  }

  // 10. technician-specific: callbacks
  if (!opts.customerId) {
    const openCallbacks = data.jobs.filter((j) => !j.archived && j.status === "callback");
    for (const j of openCallbacks) out.push({ id: `cb:${j.id}`, kind: "schedule", severity: "warn", title: `Open callback: job #${j.number}`, detail: `${customerName(cust.get(j.customerId))} · original tech ${emp.get(idx.jobById.get(j.callbackOfJobId ?? "")?.assignedTo ?? "")?.firstName ?? "—"}`, link: `/jobs/${j.id}`, customerId: j.customerId });
  }

  const sev = { high: 0, warn: 1, info: 2 };
  out.sort((a, b) => sev[a.severity] - sev[b.severity] || (b.value ?? 0) - (a.value ?? 0));
  if (opts.customerId || opts.propertyId) return out;
  // global view: interleave kinds (round-robin within each severity) and cap each kind
  const CAP = 8;
  const result: Recommendation[] = [];
  for (const level of ["high", "warn", "info"] as const) {
    const byKind = new Map<string, Recommendation[]>();
    for (const r of out.filter((x) => x.severity === level)) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
    const used = new Map<string, number>(result.map((r) => [r.kind, 0]));
    for (const r of result) used.set(r.kind, (used.get(r.kind) ?? 0) + 1);
    let added = true;
    while (added) {
      added = false;
      for (const [k, list] of byKind) {
        if (!list.length || (used.get(k) ?? 0) >= CAP) continue;
        result.push(list.shift()!);
        used.set(k, (used.get(k) ?? 0) + 1);
        added = true;
      }
    }
  }
  return result;
}

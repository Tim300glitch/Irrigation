/**
 * Automation engine. `evaluateAutomations` is pure: it inspects the data and
 * returns the actions that are due (each rule fires once per record — tracked
 * in automation_runs). The store applies the actions (send message through the
 * messaging provider, create invoice, raise notification) and logs activity.
 * In production the same function runs on a schedule in a Supabase Edge
 * Function (cron) so automations fire even when nobody has the app open.
 */
import type { Automation, CrmData, CrmSettings, Customer, Notification } from "./types";
import { estimateTotal, invoiceTotals } from "./calc";
import { REPAIR_TYPES } from "./constants";
import { renderTemplate } from "./integrations";
import { customerName, date, money } from "./format";

export type DueAction =
  | { type: "message"; automation: Automation; entityId: string; customerId: string; jobId?: string; channel: "sms" | "email"; subject: string; body: string; touch?: { collection: "estimates" | "invoices"; id: string; field: "lastFollowUpAt" | "lastReminderAt" } }
  | { type: "invoice"; automation: Automation; entityId: string }
  | { type: "notify"; automation: Automation; entityId: string; notification: Omit<Notification, "id" | "createdAt"> };

const DAY = 86400000;

export function evaluateAutomations(data: CrmData, settings: CrmSettings, now = Date.now()): DueAction[] {
  const ran = new Set(data.automationRuns.map((r) => `${r.automationId}:${r.entityId}`));
  const cust = new Map(data.customers.map((c) => [c.id, c]));
  const tpl = new Map(data.messageTemplates.map((t) => [t.id, t]));
  const out: DueAction[] = [];
  const vars = (c: Customer | undefined, extra: Record<string, string> = {}) => ({ first_name: c?.firstName ?? "", company: settings.businessName, link: "", review_link: "g.page/r/deltaline/review", ...extra });

  const msg = (a: Automation, entityId: string, c: Customer | undefined, extra: Record<string, string>, more: Partial<Extract<DueAction, { type: "message" }>> = {}) => {
    const t = a.templateId ? tpl.get(a.templateId) : undefined;
    if (!t || !c) return;
    out.push({ type: "message", automation: a, entityId, customerId: c.id, channel: t.channel, subject: renderTemplate(t.subject, vars(c, extra)), body: renderTemplate(t.body, vars(c, extra)), ...more });
  };

  for (const a of data.automations) {
    if (!a.enabled) continue;
    const due = (start: string | undefined, maxAgeDays: number) => {
      if (!start) return false;
      const t = new Date(start).getTime();
      return now >= t + a.delayDays * DAY && now - t <= maxAgeDays * DAY;
    };
    const fresh = (entityId: string) => !ran.has(`${a.id}:${entityId}`);

    switch (a.trigger) {
      case "estimate_sent":
        for (const e of data.estimates) {
          if (!["sent", "viewed"].includes(e.status) || !due(e.sentAt, 30) || !fresh(e.id)) continue;
          msg(a, e.id, cust.get(e.customerId), { estimate_total: money(estimateTotal(e)), estimate_number: String(e.number) }, { touch: { collection: "estimates", id: e.id, field: "lastFollowUpAt" } });
        }
        break;
      case "job_completed":
        if (a.action === "create_invoice")
          for (const j of data.jobs) {
            if (!j.completedAt || j.invoiceId || !j.items.length || !due(j.completedAt, 30) || !fresh(j.id)) continue;
            if (data.invoices.some((i) => i.jobId === j.id)) continue;
            out.push({ type: "invoice", automation: a, entityId: j.id });
          }
        break;
      case "invoice_sent":
        for (const i of data.invoices) {
          if (!["sent", "viewed", "partial", "overdue"].includes(i.status) || !due(i.sentAt, 120) || !fresh(i.id)) continue;
          const t = invoiceTotals(i, data.payments, now);
          if (t.balance <= 0) continue;
          msg(a, i.id, cust.get(i.customerId), { invoice_number: `INV-${i.number}`, balance: money(t.balance), amount: money(t.total) }, { touch: { collection: "invoices", id: i.id, field: "lastReminderAt" } });
        }
        break;
      case "repair_completed":
        for (const j of data.jobs) {
          if (!REPAIR_TYPES.includes(j.serviceType) || !due(j.completedAt, 10) || !fresh(j.id)) continue;
          msg(a, j.id, cust.get(j.customerId), {}, { jobId: j.id });
        }
        break;
      case "lead_created":
        for (const l of data.leads) {
          if (l.stage !== "new" || !due(l.createdAt, 3) || !fresh(l.id)) continue;
          out.push({ type: "notify", automation: a, entityId: l.id, notification: { type: "new_lead", title: `New lead — ${l.firstName} ${l.lastName}`, body: `${l.serviceType.replace(/_/g, " ")} · ${l.source.replace(/_/g, " ")}`, link: `/leads?open=${l.id}`, key: `lead:${l.id}` } });
        }
        break;
      case "appointment_tomorrow": {
        const tomorrow = new Date(now + DAY).toDateString();
        for (const j of data.jobs) {
          if (j.status !== "scheduled" || !j.scheduledStart || new Date(j.scheduledStart).toDateString() !== tomorrow || !fresh(j.id)) continue;
          msg(a, j.id, cust.get(j.customerId), { date: date(j.scheduledStart), window: j.arrivalWindow }, { jobId: j.id });
        }
        break;
      }
      case "plan_visit_due":
        for (const s of data.planSubscriptions) {
          if (s.status !== "active") continue;
          const t = new Date(s.nextVisitDate + "T12:00:00").getTime();
          const key = `${s.id}:${s.nextVisitDate}`;
          if (t - now > 7 * DAY || t < now - 30 * DAY || !fresh(key)) continue;
          msg(a, key, cust.get(s.customerId), { plan_name: data.servicePlans.find((p) => p.id === s.planId)?.name ?? "maintenance" });
        }
        break;
      case "audit_due": {
        for (const s of data.planSubscriptions) {
          if (s.status !== "active" || s.planId !== "pln_audit") continue;
          const t = new Date(s.nextVisitDate + "T12:00:00").getTime();
          const key = `${s.id}:${s.nextVisitDate}`;
          if (t - now > 14 * DAY || !fresh(key)) continue;
          const c = cust.get(s.customerId);
          out.push({ type: "notify", automation: a, entityId: key, notification: { type: "maintenance_due", title: `Annual audit due — ${customerName(c)}`, body: `Due ${date(s.nextVisitDate)}. Schedule the audit visit.`, link: `/service-plans`, key: `audit:${key}` } });
        }
        break;
      }
      case "inventory_low": {
        const low = data.items.filter((i) => i.stocked && i.active && i.warehouseQty <= i.minQty);
        const week = Math.floor(now / (7 * DAY));
        const key = `low:${week}:${low.map((i) => i.id).join(",")}`;
        if (low.length && fresh(key)) out.push({ type: "notify", automation: a, entityId: key, notification: { type: "low_inventory", title: `${low.length} item${low.length > 1 ? "s" : ""} below minimum stock`, body: low.slice(0, 4).map((i) => i.name).join(", ") + (low.length > 4 ? "…" : ""), link: `/inventory?tab=reorder`, key } });
        break;
      }
      case "backflow_test_due": {
        const recent = new Set(data.jobs.filter((j) => new Date(j.createdAt).getTime() > now - 400 * DAY).map((j) => j.propertyId));
        const dueList = data.properties.filter((p) => p.backflow.type !== "none" && p.backflow.lastTestDate && recent.has(p.id) && now - new Date(p.backflow.lastTestDate).getTime() > 335 * DAY);
        const month = new Date(now).toISOString().slice(0, 7);
        const key = `bf:${month}`;
        if (dueList.length && fresh(key)) out.push({ type: "notify", automation: a, entityId: key, notification: { type: "maintenance_due", title: `${dueList.length} backflow tests due`, body: "Annual certification due for active customers — offer testing on their next visit.", link: `/properties?filter=backflow_due`, key } });
        break;
      }
    }
  }
  return out;
}

/**
 * End-to-end business workflow through the real CRM store (local repository,
 * in-memory in Node): lead → customer → estimate → approval & deposit → job →
 * technician status flow with time tracking → materials → completion →
 * invoice → payment → warranty → maintenance plan rollover.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { useCrm } from "@/store/crmStore";
import { invoiceTotals, optionTotals, estimateTotal } from "../crm/calc";
import { optionsFromTemplate } from "../crm/workflows";

const s = () => useCrm.getState();

describe("CRM workflow", () => {
  beforeAll(async () => {
    await s().init();
  }, 60000);

  it("seeds data and links Design Studio plans to properties", () => {
    expect(s().ready).toBe(true);
    expect(s().data.customers.length).toBeGreaterThan(100);
    expect(s().data.properties.some((p) => p.designProjectId)).toBe(true);
  });

  let leadId = "", customerId = "", propertyId = "", estimateId = "", jobId = "";

  it("captures a lead and converts it to a customer with a property", () => {
    const lead = s().createLead({ firstName: "Dana", lastName: "Whitfield", phone: "(951) 555-7788", email: "dana@example.com", address: { street: "77 Juniper Hill Rd", city: "Riverside", state: "CA", zip: "92506" }, serviceType: "valve_repair", source: "google_ads" });
    leadId = lead.id;
    expect(s().data.notifications.some((n) => n.key === `lead:${lead.id}`)).toBe(true);
    const r = s().convertLead(lead.id);
    customerId = r.customerId;
    propertyId = r.propertyId;
    expect(s().data.properties.find((p) => p.id === propertyId)?.address.street).toBe("77 Juniper Hill Rd");
    expect(s().data.systems.some((x) => x.propertyId === propertyId)).toBe(true);
  });

  it("builds an estimate from a template, sends it, and approval creates job + deposit", () => {
    const tpl = s().data.estimateTemplates.find((t) => t.id === "tpl_controller")!;
    const items = new Map(s().data.items.map((i) => [i.id, i]));
    const e = s().createEstimate({ customerId, propertyId, leadId, title: "Smart controller", serviceType: "smart_controller", options: optionsFromTemplate(tpl, items), depositPct: 50 });
    estimateId = e.id;
    expect(e.options).toHaveLength(3);
    s().sendEstimate(e.id);
    expect(s().data.estimates.find((x) => x.id === e.id)?.status).toBe("sent");
    expect(s().data.leads.find((l) => l.id === leadId)?.stage).toBe("estimate_sent");
    const better = e.options[1].id;
    jobId = s().approveEstimate(e.id, better, { name: "Dana Whitfield", dataUrl: "", signedAt: new Date().toISOString() })!;
    const est = s().data.estimates.find((x) => x.id === e.id)!;
    expect(est.status).toBe("approved");
    expect(est.selectedOptionId).toBe(better);
    expect(s().data.leads.find((l) => l.id === leadId)?.stage).toBe("approved");
    const job = s().data.jobs.find((j) => j.id === jobId)!;
    expect(job.status).toBe("unscheduled");
    expect(job.estimated.revenue).toBeCloseTo(optionTotals(est, est.options[1]).revenue, 2);
    const dep = s().data.invoices.find((i) => i.estimateId === e.id && i.kind === "deposit")!;
    expect(invoiceTotals(dep, []).total).toBeCloseTo(estimateTotal(est) / 2, 1);
    s().recordPayment({ invoiceId: dep.id, customerId, amount: invoiceTotals(dep, []).total, method: "card", reference: "", isDeposit: true, note: "" });
    expect(s().data.invoices.find((i) => i.id === dep.id)?.status).toBe("paid");
  });

  it("schedules and runs the technician status flow with automatic time tracking", () => {
    const start = new Date(Date.now() + 3600000).toISOString();
    s().scheduleJob(jobId, start, "emp_tyler");
    expect(s().data.jobs.find((j) => j.id === jobId)?.status).toBe("scheduled");
    s().setJobStatus(jobId, "en_route");
    expect(s().data.timeEntries.some((t) => t.jobId === jobId && t.type === "travel" && !t.end)).toBe(true);
    expect(s().data.messages.some((m) => m.jobId === jobId && m.templateId === "msg_omw")).toBe(true);
    s().setJobStatus(jobId, "arrived");
    expect(s().data.timeEntries.some((t) => t.jobId === jobId && t.type === "travel" && !t.end)).toBe(false);
    s().setJobStatus(jobId, "in_progress");
    expect(s().data.timeEntries.some((t) => t.jobId === jobId && t.type === "job" && !t.end)).toBe(true);
  });

  it("change order approved in the field is added to the job", () => {
    const co = s().createChangeOrder(jobId, { title: "Additional broken valve discovered", description: "", items: [{ id: "x1", kind: "material", name: "Hunter PGV-101G 1\" Valve", description: "", qty: 1, unit: "ea", unitCost: 22.5, unitPrice: 50, taxable: true }, { id: "x2", kind: "labor", name: "Labor", description: "", qty: 1.5, unit: "hr", unitCost: 38, unitPrice: 95, taxable: false }] });
    s().decideChangeOrder(co.id, true, { name: "Dana Whitfield", dataUrl: "", signedAt: new Date().toISOString() });
    expect(s().data.jobs.find((j) => j.id === jobId)!.items.some((i) => i.changeOrderId === co.id)).toBe(true);
  });

  it("completing deducts truck stock, starts warranties and generates the invoice", () => {
    const truck = s().data.employees.find((e) => e.id === "emp_tyler")!.truckId!;
    const before = s().data.inventoryTxns.length;
    s().setJobStatus(jobId, "completed");
    const job = s().data.jobs.find((j) => j.id === jobId)!;
    expect(job.completedAt).toBeTruthy();
    expect(s().data.timeEntries.some((t) => t.jobId === jobId && !t.end)).toBe(false);
    const used = s().data.inventoryTxns.slice(0, s().data.inventoryTxns.length - before + 5).filter((t) => t.jobId === jobId && t.reason === "used");
    expect(used.length).toBeGreaterThan(0);
    expect(used.some((t) => t.location === truck || t.location === "warehouse")).toBe(true);
    expect(s().data.warranties.some((w) => w.jobId === jobId && /controller|valve/i.test(w.item))).toBe(true);
    const inv = s().data.invoices.find((i) => i.jobId === jobId && i.kind !== "deposit")!;
    expect(inv).toBeTruthy();
    expect(inv.depositCredit).toBeGreaterThan(0);
    expect(inv.items.some((i) => i.name.includes("PGV"))).toBe(true);
    // pay the balance
    const t = invoiceTotals(inv, s().data.payments);
    s().sendInvoice(inv.id);
    s().recordPayment({ invoiceId: inv.id, customerId, amount: t.balance, method: "check", reference: "Check #1042", isDeposit: false, note: "" });
    expect(invoiceTotals(s().data.invoices.find((i) => i.id === inv.id)!, s().data.payments).status).toBe("paid");
  });

  it("rolls a maintenance plan visit forward when its job completes", () => {
    const sub = { id: "sub_test", planId: "pln_quarterly", customerId, propertyId, startDate: "2026-01-01", nextVisitDate: new Date().toISOString().slice(0, 10), autoRenew: true, status: "active" as const };
    s().insert("planSubscriptions", sub);
    const job = s().createJob({ customerId, propertyId, title: "Quarterly check", serviceType: "maintenance", planSubscriptionId: sub.id, assignedTo: "emp_luis", scheduledStart: new Date().toISOString() });
    s().setJobStatus(job.id, "in_progress");
    s().setJobStatus(job.id, "completed");
    const after = s().data.planSubscriptions.find((x) => x.id === sub.id)!;
    expect(after.nextVisitDate > sub.nextVisitDate).toBe(true);
    expect(after.lastVisitDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it("writes an activity timeline for the customer", () => {
    const log = s().data.activity.filter((a) => a.customerId === customerId).map((a) => a.message).join(" | ");
    for (const k of ["Lead created", "Estimate #", "approved", "Deposit paid", "scheduled", "Completed", "Invoice INV-", "Payment received"]) expect(log).toContain(k);
  });
});

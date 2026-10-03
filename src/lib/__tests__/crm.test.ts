import { describe, expect, it } from "vitest";
import { priceFromRule, lineTotals, optionTotals, invoiceTotals, discountAmount, jobCosting, auditScore, warrantyStatus, addMonths, estimateTotal } from "../crm/calc";
import { generateSeed } from "../crm/seed";
import { search } from "../crm/search";
import { recommendations } from "../crm/recommendations";
import { evaluateAutomations } from "../crm/automations";
import { generateTakeoff, estimateToJob, jobToInvoice, defaultSettings, depositInvoice } from "../crm/workflows";
import { priceBook } from "../crm/catalog";
import { financials, revenueSeries, rangePreset } from "../crm/metrics";
import { toRow, fromRow } from "../crm/rowMapping";
import type { AuditReport, Estimate, Invoice, Job, LineItem } from "../crm/types";

const li = (p: Partial<LineItem>): LineItem => ({ id: Math.random().toString(36), kind: "material", name: "x", description: "", qty: 1, unit: "ea", unitCost: 0, unitPrice: 0, taxable: true, ...p });
const NOW = new Date("2026-10-03T11:00:00").getTime();

describe("pricing rules", () => {
  it("multiplier, markup, margin and flat", () => {
    expect(priceFromRule(13, { type: "multiplier", value: 2.5 })).toBe(32.5);
    expect(priceFromRule(100, { type: "markup", value: 60 })).toBe(160);
    expect(priceFromRule(65, { type: "margin", value: 35 })).toBe(100);
    expect(priceFromRule(12, { type: "flat", value: 95 })).toBe(95);
  });
});

describe("estimate math", () => {
  const items = [li({ name: "Hunter PGP Rotor", qty: 8, unitCost: 13, unitPrice: 32 }), li({ name: '1" PVC', qty: 80, unit: "ft", unitCost: 0.92, unitPrice: 2.02 }), li({ kind: "labor", name: "Labor", qty: 6, unit: "hr", unitCost: 38, unitPrice: 95, taxable: false })];
  it("splits cost and price by kind and counts labor hours", () => {
    const t = lineTotals(items);
    expect(t.materialCost).toBeCloseTo(104 + 73.6);
    expect(t.laborCost).toBe(228);
    expect(t.cost).toBeCloseTo(405.6);
    expect(t.subtotal).toBeCloseTo(256 + 161.6 + 570);
    expect(t.taxable).toBeCloseTo(417.6);
    expect(t.laborHours).toBe(6);
  });
  it("applies discount, fees, tax on taxable share, margin and deposit", () => {
    const e = { taxPct: 7.75, discount: { type: "pct" as const, value: 10 }, tripCharge: 25, diagnosticFee: 0, depositPct: 50 };
    const t = optionTotals(e, { items });
    expect(t.discount).toBeCloseTo(98.76);
    expect(t.tax).toBeCloseTo(417.6 * 0.9 * 0.0775, 2);
    expect(t.revenue).toBeCloseTo(987.6 - 98.76 + 25, 2);
    expect(t.grossProfit).toBeCloseTo(t.revenue - 405.6, 2);
    expect(t.marginPct).toBeCloseTo(t.grossProfit / t.revenue, 5);
    expect(t.deposit).toBeCloseTo(t.total / 2, 1);
  });
  it("never discounts more than the subtotal", () => {
    expect(discountAmount({ type: "amount", value: 500 }, 200)).toBe(200);
  });
});

describe("invoices", () => {
  const inv: Invoice = { id: "i1", number: 1, customerId: "c", kind: "standard", status: "sent", issueDate: "2026-09-01", dueDate: "2026-09-16", items: [li({ qty: 2, unitPrice: 100 }), li({ kind: "labor", qty: 1, unitPrice: 95, taxable: false })], taxPct: 10, discount: { type: "amount", value: 0 }, depositCredit: 50, notes: "", terms: "", createdAt: "" };
  it("credits deposits and payments; derives overdue / partial / paid", () => {
    const t = invoiceTotals(inv, [], NOW);
    expect(t.total).toBe(315);
    expect(t.balance).toBe(265);
    expect(t.status).toBe("overdue");
    expect(invoiceTotals(inv, [{ id: "p", invoiceId: "i1", customerId: "c", amount: 265, method: "card", reference: "", receivedAt: "", isDeposit: false, note: "" }], NOW).status).toBe("paid");
  });
});

describe("job costing", () => {
  it("compares estimated vs actual and explains the variance", () => {
    const job = { id: "j", items: [li({ qty: 10, unitCost: 10, unitPrice: 25, usedQty: 12 } as Partial<LineItem>), li({ kind: "labor", qty: 4, unit: "hr", unitCost: 38, unitPrice: 95, taxable: false })], estimated: { revenue: 630, materialCost: 100, laborCost: 152, equipmentCost: 0 }, estimatedLaborHours: 4, otherCosts: [] } as unknown as Job;
    const start = "2026-10-01T08:00:00.000Z";
    const end = "2026-10-01T14:30:00.000Z";
    const c = jobCosting(job, { timeEntries: [{ id: "t", employeeId: "e", jobId: "j", type: "job", start, end, notes: "" }], employees: [{ id: "e", payType: "hourly", payRate: 30 } as never], invoices: [], changeOrders: [], settings: { laborBurdenPct: 25 } }, NOW);
    expect(c.materialCost).toBe(120);
    expect(c.laborHours).toBe(6.5);
    expect(c.laborCost).toBeCloseTo(6.5 * 37.5);
    expect(c.margin).toBeLessThan(c.est.margin);
    expect(c.reasons.join(" ")).toMatch(/Extra 2.5 labor hours/);
  });
});

describe("audits & warranties", () => {
  it("scores a poor system lower and recommends fixes", () => {
    const base = { headSpacingOk: true, nozzleMatch: true, brokenHeads: 0, leaks: 0, overspray: 0, runoff: 0, lowHeads: 0, tiltedHeads: 0, pressureProblems: "", valveIssues: "", controllerSettings: "Hydrawise smart", wateringSchedule: "", soilType: "loam", sunExposure: "full", slopePct: 0, plantType: "lawn", zoneFindings: [], notes: "", distributionUniformity: 0.78, dynamicPsi: 45 } as unknown as AuditReport;
    const good = auditScore(base);
    const bad = auditScore({ ...base, brokenHeads: 4, leaks: 2, nozzleMatch: false, distributionUniformity: 0.5, dynamicPsi: 72, controllerSettings: "old dial timer", irrigatedSqft: 5000, precipRate: 1.5, minutesPerWeek: 120 });
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(bad.repairs[0].priority).toBe(1);
    expect(bad.upgrades.some((u) => /regulation/.test(u.text))).toBe(true);
    expect(bad.savingsGallonsYr).toBeGreaterThan(0);
  });
  it("computes labor and manufacturer expirations", () => {
    expect(addMonths("2026-01-04", 12)).toBe("2027-01-04");
    const w = warrantyStatus({ id: "w", customerId: "c", propertyId: "p", item: "Valve", manufacturer: "Hunter", installedDate: "2026-01-04", laborMonths: 12, manufacturerMonths: 60, notes: "" }, NOW);
    expect(w.laborActive && w.mfrActive).toBe(true);
    expect(w.mfrExpires).toBe("2031-01-04");
  });
});

describe("workflows", () => {
  const settings = defaultSettings();
  it("estimate → job → invoice carries items, deposit credit and used quantities", () => {
    const e: Estimate = { id: "e", number: 1001, customerId: "c", propertyId: "p", title: "Valve", serviceType: "valve_repair", status: "approved", options: [{ id: "o", name: "o", description: "", items: [li({ qty: 1, unitCost: 22.5, unitPrice: 50 }), li({ kind: "labor", qty: 1.5, unit: "hr", unitCost: 38, unitPrice: 95, taxable: false })] }], selectedOptionId: "o", taxPct: 7.75, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 50, customerNotes: "", internalNotes: "", terms: "", createdAt: "" };
    const job = estimateToJob(e, 2001, { checklists: [], settings });
    expect(job.estimatedLaborHours).toBe(1.5);
    expect(job.estimated.revenue).toBeCloseTo(192.5);
    const dep = depositInvoice(e, 3001, settings)!;
    expect(invoiceTotals(dep, []).total).toBeCloseTo(estimateTotal(e) / 2, 1);
    job.items[0].usedQty = 2;
    const inv = jobToInvoice(job, 3002, { settings, depositCredit: 100, approvedChangeOrderLines: [] });
    expect(inv.items[0].qty).toBe(2);
    expect(inv.depositCredit).toBe(100);
  });
  it("material takeoff covers heads, pipe, valves, wire and labor", () => {
    const lines = generateTakeoff({ meterSize: '1"', serviceLineSize: '1"', mainLineSize: '1"', pipeSize: '3/4"', valveSize: '1"', controllerStations: 6, zones: [{ id: "a", name: "Front", area: "lawn", heads: 8 }, { id: "b", name: "Beds", area: "beds", heads: 12 }, { id: "c", name: "Drip", area: "drip", heads: 0, lateralFt: 150 }] }, priceBook());
    const names = lines.map((l) => l.name).join("|");
    for (const k of ["PGP Ultra", "MP Rotator", "PVC SCH 40", "PGV", "XCZ", "Control Wire", "Trenching", "Installation Crew"]) expect(names).toContain(k);
    expect(lines.find((l) => l.itemId === "itm_pgpu")!.qty).toBe(8);
  });
});

describe("seed dataset, search, recommendations, automations, metrics", () => {
  const { data, settings } = generateSeed(NOW);
  it("is internally consistent", () => {
    const ids = new Set(data.customers.map((c) => c.id));
    expect(data.properties.every((p) => ids.has(p.customerId))).toBe(true);
    expect(data.jobs.every((j) => ids.has(j.customerId))).toBe(true);
    expect(data.invoices.every((i) => ids.has(i.customerId))).toBe(true);
    expect(new Set(data.jobs.map((j) => j.number)).size).toBe(data.jobs.length);
    expect(data.jobs.some((j) => j.status === "in_progress")).toBe(true);
  });
  it("finds every property with a Rain Bird 5000 installed", () => {
    const r = search(data, "Rain Bird 5000");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.kind === "equipment" || /5000/.test(x.title))).toBe(true);
  });
  it("finds customers by phone digits", () => {
    expect(search(data, "9515550124")[0]?.title).toBe("Greg Patterson");
  });
  it("suggests a rebuild for repeat repairs", () => {
    const recs = recommendations(data, settings, NOW);
    expect(recs.some((r) => /3 repairs in 12 months/.test(r.title))).toBe(true);
  });
  it("fires estimate follow-ups once per estimate", () => {
    const due = evaluateAutomations(data, settings, NOW);
    expect(due.some((a) => a.automation.id === "aut_fu1")).toBe(true);
    const runs = due.map((a, i) => ({ id: String(i), automationId: a.automation.id, entityId: a.entityId, at: "", result: "" }));
    expect(evaluateAutomations({ ...data, automationRuns: runs }, settings, NOW).length).toBe(0);
  });
  it("produces year revenue and margins in a realistic range", () => {
    const f = financials(data, settings, rangePreset("last365", NOW));
    expect(f.revenue).toBeGreaterThan(150000);
    expect(f.grossMargin).toBeGreaterThan(0.3);
    expect(f.grossMargin).toBeLessThan(0.8);
    expect(revenueSeries(data, rangePreset("last365", NOW), "month").length).toBeGreaterThanOrEqual(12);
  });
});

describe("Supabase row mapping", () => {
  const { data } = generateSeed(NOW);
  it.each(["properties", "estimates", "jobs", "invoices", "items", "inventoryTxns", "appointments", "timeEntries"] as const)("round-trips %s", (name) => {
    const e = (data[name] as unknown as Record<string, unknown>[])[0];
    if (!e) return;
    const row = toRow(name, e, "org_1");
    expect(row.org_id).toBe("org_1");
    const back = fromRow(name, { ...row });
    for (const k of Object.keys(e).filter((k) => !["options", "items", "checklist", "otherCosts", "crew", "zoneIds", "componentIds", "employeeIds", "invoiceId"].includes(k))) {
      if (e[k] === undefined) continue;
      expect(back[k], `${name}.${k}`).toEqual(e[k]);
    }
  });
});

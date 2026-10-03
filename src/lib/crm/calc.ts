/**
 * Pure business calculations shared by the UI, automations and reports.
 * Everything here is deterministic and unit-tested (src/lib/__tests__/crm.test.ts).
 *
 *   price (rule)    multiplier: cost × v   markup: cost × (1 + v%)   margin: cost ÷ (1 − v%)   flat: v
 *   subtotal        Σ qty × unit price (all line kinds)
 *   discount        pct of subtotal, or fixed amount (never more than subtotal)
 *   tax             tax% × taxable lines × (1 − discount share)   (CA: materials taxable, labor not)
 *   total           subtotal − discount + trip charge + diagnostic fee + tax
 *   gross profit    (total − tax) − Σ qty × unit cost
 *   margin %        gross profit ÷ (total − tax)
 *   markup %        gross profit ÷ cost
 */
import type {
  AuditReport,
  ChangeOrder,
  CrmSettings,
  Discount,
  Employee,
  Estimate,
  EstimateOption,
  Invoice,
  Job,
  LineItem,
  Payment,
  PricingRule,
  TimeEntry,
  Warranty,
} from "./types";

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const DAY = 86400000;

/* ───────────────────────── Pricing ───────────────────────── */

export function priceFromRule(cost: number, rule: PricingRule): number {
  switch (rule.type) {
    case "multiplier":
      return r2(cost * rule.value);
    case "markup":
      return r2(cost * (1 + rule.value / 100));
    case "margin":
      return rule.value >= 100 ? r2(cost) : r2(cost / (1 - rule.value / 100));
    case "flat":
      return r2(rule.value);
  }
}

export function describeRule(rule: PricingRule): string {
  switch (rule.type) {
    case "multiplier":
      return `Cost × ${rule.value}`;
    case "markup":
      return `${rule.value}% markup`;
    case "margin":
      return `${rule.value}% margin`;
    case "flat":
      return "Flat price";
  }
}

export const marginOf = (price: number, cost: number) => (price > 0 ? (price - cost) / price : 0);

/* ───────────────────────── Line items ───────────────────────── */

export interface LineTotals {
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  otherCost: number;
  cost: number;
  materialPrice: number;
  laborPrice: number;
  equipmentPrice: number;
  feePrice: number;
  otherPrice: number;
  subtotal: number;
  taxable: number;
  laborHours: number;
}

export function lineTotals(items: LineItem[], qtyOf: (i: LineItem) => number = (i) => i.qty): LineTotals {
  const t: LineTotals = { materialCost: 0, laborCost: 0, equipmentCost: 0, otherCost: 0, cost: 0, materialPrice: 0, laborPrice: 0, equipmentPrice: 0, feePrice: 0, otherPrice: 0, subtotal: 0, taxable: 0, laborHours: 0 };
  for (const i of items) {
    const q = qtyOf(i);
    const c = q * i.unitCost;
    const p = q * i.unitPrice;
    if (i.kind === "material") {
      t.materialCost += c;
      t.materialPrice += p;
    } else if (i.kind === "labor") {
      t.laborCost += c;
      t.laborPrice += p;
      t.laborHours += /^h/i.test(i.unit) ? q : 0;
    } else if (i.kind === "equipment") {
      t.equipmentCost += c;
      t.equipmentPrice += p;
    } else if (i.kind === "fee") {
      t.otherCost += c;
      t.feePrice += p;
    } else {
      t.otherCost += c;
      t.otherPrice += p;
    }
    t.cost += c;
    t.subtotal += p;
    if (i.taxable) t.taxable += p;
  }
  for (const k of Object.keys(t) as (keyof LineTotals)[]) t[k] = r2(t[k]);
  return t;
}

export function discountAmount(d: Discount | undefined, subtotal: number): number {
  if (!d || !d.value) return 0;
  const v = d.type === "pct" ? (subtotal * d.value) / 100 : d.value;
  return r2(Math.min(Math.max(0, v), subtotal));
}

/* ───────────────────────── Estimates ───────────────────────── */

export interface OptionTotals extends LineTotals {
  discount: number;
  fees: number;
  tax: number;
  total: number;
  revenue: number; // total excluding tax
  grossProfit: number;
  marginPct: number;
  markupPct: number;
  deposit: number;
}

export function optionTotals(e: Pick<Estimate, "taxPct" | "discount" | "tripCharge" | "diagnosticFee" | "depositPct">, opt: Pick<EstimateOption, "items">): OptionTotals {
  const lt = lineTotals(opt.items);
  const discount = discountAmount(e.discount, lt.subtotal);
  const share = lt.subtotal > 0 ? 1 - discount / lt.subtotal : 1;
  const tax = r2(lt.taxable * share * (e.taxPct / 100));
  const fees = r2((e.tripCharge || 0) + (e.diagnosticFee || 0));
  const revenue = r2(lt.subtotal - discount + fees);
  const total = r2(revenue + tax);
  const grossProfit = r2(revenue - lt.cost);
  return {
    ...lt,
    discount,
    fees,
    tax,
    total,
    revenue,
    grossProfit,
    marginPct: revenue > 0 ? grossProfit / revenue : 0,
    markupPct: lt.cost > 0 ? grossProfit / lt.cost : 0,
    deposit: r2((total * (e.depositPct || 0)) / 100),
  };
}

/** Option the estimate value is based on: the approved/selected one, else the middle ("better") or the only option. */
export function primaryOption(e: Estimate): EstimateOption | undefined {
  if (e.selectedOptionId) {
    const o = e.options.find((x) => x.id === e.selectedOptionId);
    if (o) return o;
  }
  return e.options.find((o) => o.tier === "better") ?? e.options[0];
}

export function estimateTotal(e: Estimate): number {
  const o = primaryOption(e);
  return o ? optionTotals(e, o).total : 0;
}

/* ───────────────────────── Invoices ───────────────────────── */

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  depositCredit: number;
  paid: number;
  balance: number;
  status: Invoice["status"];
  daysOverdue: number;
}

export function invoiceTotals(inv: Invoice, payments: Payment[], now = Date.now()): InvoiceTotals {
  const lt = lineTotals(inv.items);
  const discount = discountAmount(inv.discount, lt.subtotal);
  const share = lt.subtotal > 0 ? 1 - discount / lt.subtotal : 1;
  const tax = r2(lt.taxable * share * (inv.taxPct / 100));
  const total = r2(lt.subtotal - discount + tax);
  const paid = r2(payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0));
  const balance = r2(Math.max(0, total - inv.depositCredit - paid));
  const due = new Date(inv.dueDate + "T23:59:59").getTime();
  const daysOverdue = balance > 0 && now > due ? Math.floor((now - due) / DAY) + 1 : 0;
  let status = inv.status;
  if (status !== "void" && status !== "draft") {
    if (balance <= 0.005 && total > 0) status = "paid";
    else if (daysOverdue > 0) status = "overdue";
    else if (paid > 0) status = "partial";
  }
  return { subtotal: lt.subtotal, discount, tax, total, depositCredit: inv.depositCredit, paid, balance, status, daysOverdue };
}

/* ───────────────────────── Time & labor ───────────────────────── */

export const entryHours = (t: TimeEntry, now = Date.now()) => Math.max(0, ((t.end ? new Date(t.end).getTime() : now) - new Date(t.start).getTime()) / 3600000);

export function burdenedRate(e: Employee | undefined, s: Pick<CrmSettings, "laborBurdenPct">): number {
  if (!e) return 0;
  const wage = e.payType === "salary" ? e.payRate / 2080 : e.payRate;
  return wage * (1 + s.laborBurdenPct / 100);
}

/* ───────────────────────── Job costing ───────────────────────── */

export interface JobCosting {
  revenue: number;
  materialCost: number;
  laborHours: number;
  travelHours: number;
  laborCost: number;
  equipmentCost: number;
  subcontractCost: number;
  otherCost: number;
  totalCost: number;
  grossProfit: number;
  margin: number;
  est: { revenue: number; materialCost: number; laborCost: number; equipmentCost: number; laborHours: number; grossProfit: number; margin: number };
  laborVarianceHrs: number;
  reasons: string[];
}

export function jobCosting(
  job: Job,
  ctx: { timeEntries: TimeEntry[]; employees: Employee[]; invoices: Invoice[]; changeOrders: ChangeOrder[]; settings: Pick<CrmSettings, "laborBurdenPct"> },
  now = Date.now(),
): JobCosting {
  const emp = new Map(ctx.employees.map((e) => [e.id, e]));
  const entries = ctx.timeEntries.filter((t) => t.jobId === job.id && (t.type === "job" || t.type === "travel"));
  let laborHours = 0,
    travelHours = 0,
    laborCost = 0;
  for (const t of entries) {
    const h = entryHours(t, now);
    if (t.type === "travel") travelHours += h;
    else laborHours += h;
    laborCost += h * burdenedRate(emp.get(t.employeeId), ctx.settings);
  }
  const used = lineTotals(
    job.items.filter((i) => i.kind === "material"),
    (i) => (i as Job["items"][number]).usedQty ?? i.qty,
  );
  const extra = job.otherCosts ?? [];
  const sum = (k: string[]) => r2(extra.filter((c) => k.includes(c.kind)).reduce((s, c) => s + c.amount, 0));
  const equipmentCost = r2(sum(["equipment"]) + lineTotals(job.items.filter((i) => i.kind === "equipment")).equipmentCost);
  const subcontractCost = sum(["subcontract"]);
  const otherCost = sum(["other", "dump", "permit"]);
  const invoiced = ctx.invoices.filter((i) => i.jobId === job.id && i.status !== "void" && i.kind !== "deposit");
  const approvedCO = ctx.changeOrders.filter((c) => c.jobId === job.id && c.status === "approved");
  const jobPrice = lineTotals(job.items).subtotal;
  const revenue = invoiced.length
    ? r2(invoiced.reduce((s, i) => {
        const lt = lineTotals(i.items);
        return s + lt.subtotal - discountAmount(i.discount, lt.subtotal);
      }, 0))
    : r2(jobPrice || job.estimated.revenue + approvedCO.reduce((s, c) => s + lineTotals(c.items).subtotal, 0));
  const materialCost = used.materialCost;
  laborCost = r2(laborCost);
  const totalCost = r2(materialCost + laborCost + equipmentCost + subcontractCost + otherCost);
  const grossProfit = r2(revenue - totalCost);
  const estCost = job.estimated.materialCost + job.estimated.laborCost + job.estimated.equipmentCost;
  const estGP = r2(job.estimated.revenue - estCost);
  const est = {
    ...job.estimated,
    laborHours: job.estimatedLaborHours,
    grossProfit: estGP,
    margin: job.estimated.revenue > 0 ? estGP / job.estimated.revenue : 0,
  };
  const actualHrs = laborHours + travelHours;
  const laborVarianceHrs = r2(actualHrs - job.estimatedLaborHours);
  const reasons: string[] = [];
  if (entries.length && Math.abs(laborVarianceHrs) >= 0.5) reasons.push(`${laborVarianceHrs > 0 ? "Extra" : "Saved"} ${Math.abs(laborVarianceHrs).toFixed(1)} labor hours`);
  const matDiff = materialCost - job.estimated.materialCost;
  if (job.estimated.materialCost > 0 && Math.abs(matDiff) / job.estimated.materialCost >= 0.1) reasons.push(`Materials ${matDiff > 0 ? "over" : "under"} estimate by $${Math.abs(matDiff).toFixed(0)} (${Math.round((matDiff / job.estimated.materialCost) * 100)}%)`);
  if (approvedCO.length) reasons.push(`${approvedCO.length} approved change order${approvedCO.length > 1 ? "s" : ""}`);
  if (subcontractCost + otherCost > 0) reasons.push(`Unplanned costs $${(subcontractCost + otherCost).toFixed(0)}`);
  return { revenue, materialCost, laborHours: r2(laborHours), travelHours: r2(travelHours), laborCost, equipmentCost, subcontractCost, otherCost, totalCost, grossProfit, margin: revenue > 0 ? grossProfit / revenue : 0, est, laborVarianceHrs, reasons };
}

/* ───────────────────────── Audits ───────────────────────── */

export interface AuditResult {
  overall: number; // 0..100
  efficiency: number; // 0..100
  grade: "A" | "B" | "C" | "D" | "F";
  repairs: { text: string; priority: 1 | 2 | 3; estCost?: number }[];
  upgrades: { text: string; priority: 1 | 2 | 3; savingsPct: number }[];
  savingsPct: number;
  savingsGallonsYr: number;
}

/**
 * Scoring model (documented assumptions):
 *  - overall starts at 100; each broken head −4, leak −6, low/tilted head −1.5,
 *    overspray/runoff location −2, bad spacing −8, mismatched nozzles −6,
 *    pressure outside 30–65 psi dynamic −8, valve issues −5.
 *  - efficiency is driven by DU (lower-quarter): DU ≥ .75 excellent, .55 poor;
 *    plus runoff/overspray and pressure penalties.
 *  - water use: gallons/yr = sqft × 0.623 gal/in × in/wk × 52 using
 *    in/wk = precip rate × minutes/60 (if both known).
 */
export function auditScore(a: AuditReport): AuditResult {
  const repairs: AuditResult["repairs"] = [];
  const upgrades: AuditResult["upgrades"] = [];
  let s = 100;
  s -= a.brokenHeads * 4 + a.leaks * 6 + (a.lowHeads + a.tiltedHeads) * 1.5 + (a.overspray + a.runoff) * 2;
  if (!a.headSpacingOk) s -= 8;
  if (!a.nozzleMatch) s -= 6;
  const dyn = a.dynamicPsi ?? a.staticPsi;
  const pressureBad = dyn !== undefined && (dyn < 30 || dyn > 65);
  if (pressureBad) s -= 8;
  if (a.valveIssues.trim()) s -= 5;
  const overall = Math.max(0, Math.min(100, Math.round(s)));

  const du = a.distributionUniformity;
  let eff = du !== undefined ? Math.min(100, Math.max(0, ((du - 0.4) / 0.4) * 100)) : 70;
  eff -= (a.overspray + a.runoff) * 3 + a.leaks * 4;
  if (pressureBad) eff -= 10;
  if (!a.nozzleMatch) eff -= 8;
  const efficiency = Math.max(0, Math.min(100, Math.round(eff)));

  if (a.leaks) repairs.push({ text: `Repair ${a.leaks} leak${a.leaks > 1 ? "s" : ""} (water loss and soft spots)`, priority: 1, estCost: a.leaks * 185 });
  if (a.brokenHeads) repairs.push({ text: `Replace ${a.brokenHeads} broken head${a.brokenHeads > 1 ? "s" : ""}`, priority: 1, estCost: a.brokenHeads * 45 });
  if (a.valveIssues.trim()) repairs.push({ text: `Valve service: ${a.valveIssues.trim()}`, priority: 1, estCost: 225 });
  if (a.lowHeads + a.tiltedHeads) repairs.push({ text: `Raise / straighten ${a.lowHeads + a.tiltedHeads} low or tilted heads`, priority: 2, estCost: (a.lowHeads + a.tiltedHeads) * 22 });
  if (a.overspray + a.runoff) repairs.push({ text: `Adjust arcs/radius at ${a.overspray + a.runoff} overspray or runoff locations`, priority: 2, estCost: 95 });
  if (!a.headSpacingOk) repairs.push({ text: "Correct head spacing to achieve head-to-head coverage", priority: 2 });
  if (pressureBad && dyn! > 65) upgrades.push({ text: `Install pressure regulation (${dyn} psi dynamic — misting and wasted water)`, priority: 1, savingsPct: 8 });
  if (pressureBad && dyn! < 30) repairs.push({ text: `Investigate low pressure (${dyn} psi) — reduce zone size or check mainline / backflow`, priority: 1 });
  if (!a.nozzleMatch) upgrades.push({ text: "Match precipitation nozzles within each zone (e.g. Hunter MP Rotator / Rain Bird R-VAN)", priority: 2, savingsPct: 12 });
  if (du !== undefined && du < 0.6) upgrades.push({ text: `Improve uniformity (DU ${Math.round(du * 100)}%) — nozzle retrofit and spacing correction`, priority: 1, savingsPct: 15 });
  if (/timer|manual|clock|old|dial/i.test(a.controllerSettings) || !/smart|hydrawise|rachio|et|weather/i.test(a.controllerSettings)) upgrades.push({ text: "Upgrade to a weather-based smart controller (Hunter Hydrawise / Rain Bird ESP-TM2 w/ LNK2)", priority: 2, savingsPct: 20 });
  if (a.slopePct > 10 && a.runoff > 0) upgrades.push({ text: "Use cycle-and-soak programming and low-precip nozzles on slopes", priority: 2, savingsPct: 6 });
  if (/turf|lawn/i.test(a.plantType) && a.sunExposure === "shade") upgrades.push({ text: "Convert shaded turf areas to drip-irrigated planting", priority: 3, savingsPct: 5 });

  const savingsPct = Math.min(45, upgrades.reduce((sum, u) => sum + u.savingsPct, 0) + (a.leaks ? 4 : 0));
  let savingsGallonsYr = 0;
  if (a.irrigatedSqft && a.precipRate && a.minutesPerWeek) {
    const inchesPerWeek = (a.precipRate * a.minutesPerWeek) / 60;
    const annual = a.irrigatedSqft * 0.623 * inchesPerWeek * 40; // ~40 irrigation weeks / yr
    savingsGallonsYr = Math.round((annual * savingsPct) / 100);
  }
  const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F";
  repairs.sort((x, y) => x.priority - y.priority);
  upgrades.sort((x, y) => x.priority - y.priority);
  return { overall, efficiency, grade, repairs, upgrades, savingsPct, savingsGallonsYr };
}

/* ───────────────────────── Warranty ───────────────────────── */

export function addMonths(date: string, months: number): string {
  const d = new Date(date + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function warrantyStatus(w: Warranty, now = Date.now()) {
  const labor = addMonths(w.installedDate, w.laborMonths);
  const mfr = w.manufacturerMonths ? addMonths(w.installedDate, w.manufacturerMonths) : undefined;
  const t = (d: string) => new Date(d + "T23:59:59").getTime();
  const laborActive = now <= t(labor);
  const mfrActive = !!mfr && now <= t(mfr);
  const nextExpiry = [labor, mfr].filter((d): d is string => !!d && now <= t(d)).sort()[0];
  return { laborExpires: labor, mfrExpires: mfr, laborActive, mfrActive, active: laborActive || mfrActive, nextExpiry, expiringSoon: !!nextExpiry && t(nextExpiry) - now < 45 * DAY };
}

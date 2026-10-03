/**
 * Aggregations for the dashboard, reports and financials. Revenue is
 * recognized on the issue date of standard / progress / plan invoices
 * (pre-tax, after discount). Deposit invoices are prepayments credited on the
 * final invoice, so they count toward collections but not revenue.
 */
import type { CrmData, CrmSettings, Invoice, Job, LeadSource, ServiceType } from "./types";
import { discountAmount, invoiceTotals, jobCosting, lineTotals, type JobCosting, entryHours, estimateTotal, burdenedRate } from "./calc";
import { isoDate } from "./format";
import { REPAIR_TYPES } from "./constants";

export type Granularity = "day" | "week" | "month" | "quarter" | "year";
export interface Range {
  from: number;
  to: number;
}

export function bucketKey(t: number, g: Granularity): string {
  const d = new Date(t);
  if (g === "day") return isoDate(d);
  if (g === "week") {
    const s = new Date(d);
    s.setDate(d.getDate() - d.getDay());
    return isoDate(s);
  }
  if (g === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (g === "quarter") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return String(d.getFullYear());
}

export function buckets(r: Range, g: Granularity): string[] {
  const out: string[] = [];
  const d = new Date(r.from);
  d.setHours(12, 0, 0, 0);
  while (d.getTime() <= r.to) {
    const k = bucketKey(d.getTime(), g);
    if (out[out.length - 1] !== k) out.push(k);
    if (g === "day") d.setDate(d.getDate() + 1);
    else if (g === "week") d.setDate(d.getDate() + 7);
    else if (g === "month") d.setMonth(d.getMonth() + 1, 1);
    else if (g === "quarter") d.setMonth(d.getMonth() + 3, 1);
    else d.setFullYear(d.getFullYear() + 1, 0, 1);
  }
  const last = bucketKey(r.to, g);
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function bucketLabel(k: string, g: Granularity) {
  if (g === "month") {
    const [y, m] = k.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" }) + (m === 1 ? ` ’${String(y).slice(2)}` : "");
  }
  if (g === "day" || g === "week") {
    const d = new Date(k + "T12:00:00");
    return d.toLocaleString("en-US", { month: "short", day: "numeric" });
  }
  return k;
}

export const invoiceRevenue = (i: Invoice) => {
  const lt = lineTotals(i.items);
  return lt.subtotal - discountAmount(i.discount, lt.subtotal);
};
export const isRevenueInvoice = (i: Invoice) => i.kind !== "deposit" && i.status !== "void" && i.status !== "draft";
const tOf = (s?: string) => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).getTime() : NaN);
const inRange = (t: number, r: Range) => t >= r.from && t <= r.to;

/* ───────────────────────── Indexes ───────────────────────── */

export interface CrmIndex {
  jobById: Map<string, Job>;
  timeByJob: Map<string, CrmData["timeEntries"]>;
  costing: (job: Job) => JobCosting;
  invoiceByJob: Map<string, Invoice[]>;
  paymentsByInvoice: Map<string, CrmData["payments"]>;
}

const indexCache = new WeakMap<object, CrmIndex>();

export function crmIndex(data: CrmData, settings: CrmSettings): CrmIndex {
  const hit = indexCache.get(data);
  if (hit) return hit;
  const group = <T, K>(arr: T[], key: (x: T) => K | undefined) => {
    const m = new Map<K, T[]>();
    for (const x of arr) {
      const k = key(x);
      if (k === undefined) continue;
      const a = m.get(k);
      if (a) a.push(x);
      else m.set(k, [x]);
    }
    return m;
  };
  const timeByJob = group(data.timeEntries, (t) => t.jobId);
  const invoiceByJob = group(data.invoices, (i) => i.jobId);
  const coByJob = group(data.changeOrders, (c) => c.jobId);
  const paymentsByInvoice = group(data.payments, (p) => p.invoiceId);
  const costCache = new Map<string, JobCosting>();
  const idx: CrmIndex = {
    jobById: new Map(data.jobs.map((j) => [j.id, j])),
    timeByJob,
    invoiceByJob,
    paymentsByInvoice,
    costing: (job) => {
      let c = costCache.get(job.id);
      if (!c) {
        c = jobCosting(job, { timeEntries: timeByJob.get(job.id) ?? [], employees: data.employees, invoices: invoiceByJob.get(job.id) ?? [], changeOrders: coByJob.get(job.id) ?? [], settings });
        costCache.set(job.id, c);
      }
      return c;
    },
  };
  indexCache.set(data, idx);
  return idx;
}

/* ───────────────────────── Series ───────────────────────── */

export function revenueSeries(data: CrmData, r: Range, g: Granularity) {
  const keys = buckets(r, g);
  const rev = new Map(keys.map((k) => [k, 0]));
  const col = new Map(keys.map((k) => [k, 0]));
  for (const i of data.invoices) {
    if (!isRevenueInvoice(i)) continue;
    const t = tOf(i.issueDate);
    if (!inRange(t, r)) continue;
    const k = bucketKey(t, g);
    rev.set(k, (rev.get(k) ?? 0) + invoiceRevenue(i));
  }
  for (const p of data.payments) {
    const t = tOf(p.receivedAt);
    if (!inRange(t, r)) continue;
    const k = bucketKey(t, g);
    col.set(k, (col.get(k) ?? 0) + p.amount);
  }
  return keys.map((k) => ({ key: k, label: bucketLabel(k, g), revenue: Math.round(rev.get(k) ?? 0), collected: Math.round(col.get(k) ?? 0) }));
}

export function completedJobs(data: CrmData, r: Range) {
  return data.jobs.filter((j) => j.completedAt && inRange(tOf(j.completedAt), r));
}

export function jobsSeries(data: CrmData, r: Range, g: Granularity) {
  const keys = buckets(r, g);
  const m = new Map(keys.map((k) => [k, { jobs: 0, value: 0 }]));
  for (const j of completedJobs(data, r)) {
    const e = m.get(bucketKey(tOf(j.completedAt), g));
    if (!e) continue;
    e.jobs++;
    e.value += lineTotals(j.items).subtotal;
  }
  return keys.map((k) => ({ key: k, label: bucketLabel(k, g), jobs: m.get(k)!.jobs, avg: m.get(k)!.jobs ? Math.round(m.get(k)!.value / m.get(k)!.jobs) : 0 }));
}

export function conversionSeries(data: CrmData, r: Range, g: Granularity) {
  const keys = buckets(r, g);
  const leads = new Map(keys.map((k) => [k, { won: 0, lost: 0, total: 0 }]));
  for (const l of data.leads) {
    const e = leads.get(bucketKey(tOf(l.createdAt), g));
    if (!e || !inRange(tOf(l.createdAt), r)) continue;
    e.total++;
    if (l.stage === "approved") e.won++;
    if (l.stage === "lost") e.lost++;
  }
  const est = new Map(keys.map((k) => [k, { approved: 0, declined: 0 }]));
  for (const e of data.estimates) {
    if (!e.sentAt) continue;
    const b = est.get(bucketKey(tOf(e.sentAt), g));
    if (!b || !inRange(tOf(e.sentAt), r)) continue;
    if (e.status === "approved") b.approved++;
    if (e.status === "declined" || e.status === "expired") b.declined++;
  }
  return keys.map((k) => {
    const l = leads.get(k)!;
    const e = est.get(k)!;
    return { key: k, label: bucketLabel(k, g), leads: l.total, leadRate: l.won + l.lost ? l.won / (l.won + l.lost) : 0, estimateRate: e.approved + e.declined ? e.approved / (e.approved + e.declined) : 0 };
  });
}

/* ───────────────────────── Breakdowns ───────────────────────── */

export function revenueByServiceType(data: CrmData, r: Range) {
  const jobById = new Map(data.jobs.map((j) => [j.id, j]));
  const m = new Map<ServiceType, number>();
  for (const i of data.invoices) {
    if (!isRevenueInvoice(i) || !inRange(tOf(i.issueDate), r)) continue;
    const st = (i.jobId && jobById.get(i.jobId)?.serviceType) || "maintenance";
    m.set(st, (m.get(st) ?? 0) + invoiceRevenue(i));
  }
  return [...m].map(([type, revenue]) => ({ type, revenue: Math.round(revenue) })).sort((a, b) => b.revenue - a.revenue);
}

export function employeeStats(data: CrmData, settings: CrmSettings, r: Range) {
  const idx = crmIndex(data, settings);
  return data.employees.map((e) => {
    const jobs = completedJobs(data, r).filter((j) => j.assignedTo === e.id);
    const revenue = jobs.reduce((s, j) => s + idx.costing(j).revenue, 0);
    const profit = jobs.reduce((s, j) => s + idx.costing(j).grossProfit, 0);
    const hours = data.timeEntries.filter((t) => t.employeeId === e.id && t.type !== "shift" && t.type !== "break" && inRange(tOf(t.start), r)).reduce((s, t) => s + entryHours(t), 0);
    const callbacks = data.jobs.filter((j) => j.callbackOfJobId && idx.jobById.get(j.callbackOfJobId)?.assignedTo === e.id && j.createdAt && inRange(tOf(j.createdAt), r)).length;
    const photos = data.photos.filter((p) => p.takenBy === e.id && inRange(tOf(p.takenAt), r)).length;
    return { employee: e, jobs: jobs.length, revenue: Math.round(revenue), profit: Math.round(profit), hours, revPerHour: hours ? revenue / hours : 0, avgTicket: jobs.length ? revenue / jobs.length : 0, callbacks, callbackRate: jobs.length ? callbacks / jobs.length : 0, photos, laborCost: hours * burdenedRate(e, settings) };
  });
}

export function leadSourceStats(data: CrmData, r: Range) {
  const revByCustomer = new Map<string, number>();
  for (const i of data.invoices) if (isRevenueInvoice(i) && inRange(tOf(i.issueDate), r)) revByCustomer.set(i.customerId, (revByCustomer.get(i.customerId) ?? 0) + invoiceRevenue(i));
  const m = new Map<LeadSource, { leads: number; won: number; lost: number; revenue: number; spend: number; jobs: number }>();
  const get = (s: LeadSource) => m.get(s) ?? (m.set(s, { leads: 0, won: 0, lost: 0, revenue: 0, spend: 0, jobs: 0 }), m.get(s)!);
  for (const l of data.leads) {
    if (!inRange(tOf(l.createdAt), r)) continue;
    const e = get(l.source);
    e.leads++;
    if (l.stage === "approved") e.won++;
    if (l.stage === "lost") e.lost++;
  }
  for (const c of data.customers) {
    const rev = revByCustomer.get(c.id);
    if (rev) get(c.leadSource).revenue += rev;
  }
  for (const j of completedJobs(data, r)) {
    const c = data.customers.find((x) => x.id === j.customerId);
    if (c) get(c.leadSource).jobs++;
  }
  for (const c of data.campaigns) {
    const s = c.source === "seo" ? "google" : c.source;
    get(s as LeadSource).spend += prorate(c, r);
  }
  return [...m].map(([source, v]) => ({ source, ...v, revenue: Math.round(v.revenue), closeRate: v.won + v.lost ? v.won / (v.won + v.lost) : 0, cpl: v.leads ? v.spend / v.leads : 0, roi: v.spend ? (v.revenue - v.spend) / v.spend : 0 })).sort((a, b) => b.revenue - a.revenue);
}

/** campaign spend falling inside the range (linear proration over the campaign's life) */
export function prorate(c: CrmData["campaigns"][number], r: Range) {
  const s = tOf(c.startDate);
  const e = c.endDate ? tOf(c.endDate) : Date.now();
  const total = Math.max(1, e - s);
  const overlap = Math.max(0, Math.min(e, r.to) - Math.max(s, r.from));
  return (c.spend * overlap) / total;
}

export function campaignStats(data: CrmData) {
  const revByCustomer = new Map<string, number>();
  for (const i of data.invoices) if (isRevenueInvoice(i)) revByCustomer.set(i.customerId, (revByCustomer.get(i.customerId) ?? 0) + invoiceRevenue(i));
  return data.campaigns.map((c) => {
    const leads = data.leads.filter((l) => l.campaignId === c.id);
    const customers = new Set(leads.filter((l) => l.customerId && l.stage === "approved").map((l) => l.customerId!));
    for (const cu of data.customers) if (cu.campaignId === c.id) customers.add(cu.id);
    const booked = data.jobs.filter((j) => customers.has(j.customerId) && j.status !== "cancelled").length;
    const revenue = [...customers].reduce((s, id) => s + (revByCustomer.get(id) ?? 0), 0);
    return { campaign: c, leads: leads.length, booked, revenue: Math.round(revenue), cpl: leads.length ? c.spend / leads.length : 0, cpb: booked ? c.spend / booked : 0, roi: c.spend ? (revenue - c.spend) / c.spend : 0 };
  });
}

/* ───────────────────────── Financial summary ───────────────────────── */

export function financials(data: CrmData, settings: CrmSettings, r: Range) {
  const idx = crmIndex(data, settings);
  const revInv = data.invoices.filter((i) => isRevenueInvoice(i) && inRange(tOf(i.issueDate), r));
  const revenue = revInv.reduce((s, i) => s + invoiceRevenue(i), 0);
  const collected = data.payments.filter((p) => inRange(tOf(p.receivedAt), r)).reduce((s, p) => s + p.amount, 0);
  let outstanding = 0;
  let overdue = 0;
  for (const i of data.invoices) {
    if (i.status === "void" || i.status === "draft") continue;
    const t = invoiceTotals(i, idx.paymentsByInvoice.get(i.id) ?? []);
    outstanding += t.balance;
    if (t.status === "overdue") overdue += t.balance;
  }
  const jobs = completedJobs(data, r);
  let material = 0,
    labor = 0,
    other = 0,
    laborHours = 0,
    jobRevenue = 0,
    estProfit = 0,
    actProfit = 0;
  for (const j of jobs) {
    const c = idx.costing(j);
    material += c.materialCost;
    labor += c.laborCost;
    other += c.equipmentCost + c.subcontractCost + c.otherCost;
    laborHours += c.laborHours + c.travelHours;
    jobRevenue += c.revenue;
    estProfit += c.est.grossProfit;
    actProfit += c.grossProfit;
  }
  const grossProfit = revenue - material - labor - other;
  const marketing = data.campaigns.reduce((s, c) => s + prorate(c, r), 0);
  const newCustomers = data.customers.filter((c) => inRange(tOf(c.createdAt), r) && data.jobs.some((j) => j.customerId === c.id)).length;
  const sentEst = data.estimates.filter((e) => e.sentAt && inRange(tOf(e.sentAt), r));
  const decided = sentEst.filter((e) => ["approved", "declined", "expired"].includes(e.status));
  const techs = new Set(jobs.map((j) => j.assignedTo).filter(Boolean));
  return {
    revenue,
    collected,
    outstanding,
    overdue,
    materialCost: material,
    laborCost: labor,
    otherCost: other,
    grossProfit,
    grossMargin: revenue ? grossProfit / revenue : 0,
    jobs: jobs.length,
    avgTicket: jobs.length ? jobRevenue / jobs.length : 0,
    laborHours,
    revenuePerLaborHour: laborHours ? jobRevenue / laborHours : 0,
    revenuePerTech: techs.size ? jobRevenue / techs.size : 0,
    closeRate: decided.length ? decided.filter((e) => e.status === "approved").length / decided.length : 0,
    estimateValueSent: sentEst.reduce((s, e) => s + estimateTotal(e), 0),
    marketing,
    cac: newCustomers ? marketing / newCustomers : 0,
    newCustomers,
    estProfit,
    actProfit,
  };
}

export function profitByJobType(data: CrmData, settings: CrmSettings, r: Range) {
  const idx = crmIndex(data, settings);
  const m = new Map<ServiceType, { revenue: number; cost: number; jobs: number }>();
  for (const j of completedJobs(data, r)) {
    const c = idx.costing(j);
    const e = m.get(j.serviceType) ?? { revenue: 0, cost: 0, jobs: 0 };
    e.revenue += c.revenue;
    e.cost += c.totalCost;
    e.jobs++;
    m.set(j.serviceType, e);
  }
  return [...m].map(([type, v]) => ({ type, ...v, profit: v.revenue - v.cost, margin: v.revenue ? (v.revenue - v.cost) / v.revenue : 0 })).sort((a, b) => b.profit - a.profit);
}

export function costSeries(data: CrmData, settings: CrmSettings, r: Range, g: Granularity) {
  const idx = crmIndex(data, settings);
  const keys = buckets(r, g);
  const m = new Map(keys.map((k) => [k, { revenue: 0, expenses: 0 }]));
  for (const i of data.invoices) {
    if (!isRevenueInvoice(i) || !inRange(tOf(i.issueDate), r)) continue;
    const e = m.get(bucketKey(tOf(i.issueDate), g));
    if (e) e.revenue += invoiceRevenue(i);
  }
  for (const j of completedJobs(data, r)) {
    const c = idx.costing(j);
    const e = m.get(bucketKey(tOf(j.completedAt), g));
    if (e) e.expenses += c.totalCost;
  }
  for (const c of data.campaigns) {
    for (const k of keys) {
      const [from, to] = bucketBounds(k, g);
      m.get(k)!.expenses += prorate(c, { from: Math.max(from, r.from), to: Math.min(to, r.to) });
    }
  }
  return keys.map((k) => ({ key: k, label: bucketLabel(k, g), revenue: Math.round(m.get(k)!.revenue), expenses: Math.round(m.get(k)!.expenses), profit: Math.round(m.get(k)!.revenue - m.get(k)!.expenses) }));
}

function bucketBounds(k: string, g: Granularity): [number, number] {
  if (g === "day") {
    const s = new Date(k + "T00:00:00").getTime();
    return [s, s + 86400000 - 1];
  }
  if (g === "week") {
    const s = new Date(k + "T00:00:00").getTime();
    return [s, s + 7 * 86400000 - 1];
  }
  if (g === "month") {
    const [y, m] = k.split("-").map(Number);
    return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime() - 1];
  }
  if (g === "quarter") {
    const [y, q] = k.split("-Q").map(Number);
    return [new Date(y, (q - 1) * 3, 1).getTime(), new Date(y, q * 3, 1).getTime() - 1];
  }
  const y = Number(k);
  return [new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime() - 1];
}

export const isRepair = (st: ServiceType) => REPAIR_TYPES.includes(st);

export function rangePreset(p: "today" | "week" | "month" | "quarter" | "year" | "last30" | "last90" | "last365" | "ytd", now = Date.now()): Range {
  const d = new Date(now);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  switch (p) {
    case "today":
      return { from: start.getTime(), to: end.getTime() };
    case "week":
      start.setDate(start.getDate() - start.getDay());
      return { from: start.getTime(), to: end.getTime() };
    case "month":
      start.setDate(1);
      return { from: start.getTime(), to: end.getTime() };
    case "quarter":
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
      return { from: start.getTime(), to: end.getTime() };
    case "year":
    case "ytd":
      start.setMonth(0, 1);
      return { from: start.getTime(), to: end.getTime() };
    case "last30":
      return { from: start.getTime() - 29 * 86400000, to: end.getTime() };
    case "last90":
      return { from: start.getTime() - 89 * 86400000, to: end.getTime() };
    case "last365":
      return { from: start.getTime() - 364 * 86400000, to: end.getTime() };
  }
}

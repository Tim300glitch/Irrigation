"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Pencil, TrendingUp } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Campaign, CrmData, LeadSource, ServiceType } from "@/lib/crm/types";
import { LEAD_SOURCES, SERVICE_TYPES, serviceLabel, sourceLabel, REPAIR_TYPES } from "@/lib/crm/constants";
import { customerName, date, money, money0, moneyK, pct, fullName, hours, isoDate } from "@/lib/crm/format";
import { revenueSeries, jobsSeries, conversionSeries, revenueByServiceType, employeeStats, leadSourceStats, financials, costSeries, profitByJobType, campaignStats, crmIndex, isRevenueInvoice, invoiceRevenue, type Granularity, type Range, rangePreset } from "@/lib/crm/metrics";
import { estimateTotal, invoiceTotals, lineTotals } from "@/lib/crm/calc";
import { uid } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Button, Badge, Tabs, Select, Field, Input, Textarea, SlideOver, cn, useQuery, setQueryParam, StatTile, Segmented, Check, NumberInput, Avatar } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { LineChart, BarChart, RankBars, SERIES } from "../charts";
import { Timeline } from "../widgets";
import { EmployeePicker, CustomerPicker } from "../pickers";

type Preset = "today" | "week" | "month" | "quarter" | "year" | "last30" | "last90" | "last365" | "custom";
const PRESETS: { id: Preset; label: string; g: Granularity }[] = [
  { id: "today", label: "Daily", g: "day" },
  { id: "week", label: "Weekly", g: "day" },
  { id: "month", label: "Monthly", g: "day" },
  { id: "quarter", label: "Quarterly", g: "week" },
  { id: "year", label: "Yearly", g: "month" },
  { id: "last90", label: "Last 90 days", g: "week" },
  { id: "last365", label: "Last 12 months", g: "month" },
  { id: "custom", label: "Custom", g: "week" },
];

interface Filters {
  employee: string;
  serviceType: string;
  customer: string;
  source: string;
}

/** Apply report filters (employee, job/service type, customer, lead source) to a dataset view. */
function filterData(d: CrmData, f: Filters): CrmData {
  if (!f.employee && !f.serviceType && !f.customer && !f.source) return d;
  const custOk = new Set(d.customers.filter((c) => (!f.customer || c.id === f.customer) && (!f.source || c.leadSource === f.source)).map((c) => c.id));
  const jobs = d.jobs.filter((j) => custOk.has(j.customerId) && (!f.employee || j.assignedTo === f.employee) && (!f.serviceType || j.serviceType === f.serviceType));
  const jobIds = new Set(jobs.map((j) => j.id));
  const jobFiltered = !!(f.employee || f.serviceType);
  const invoices = d.invoices.filter((i) => custOk.has(i.customerId) && (!jobFiltered || (i.jobId && jobIds.has(i.jobId))));
  const invIds = new Set(invoices.map((i) => i.id));
  return {
    ...d,
    jobs,
    invoices,
    payments: d.payments.filter((p) => custOk.has(p.customerId) && (!jobFiltered || (p.invoiceId && invIds.has(p.invoiceId)))),
    estimates: d.estimates.filter((e) => custOk.has(e.customerId) && (!f.serviceType || e.serviceType === f.serviceType) && (!f.employee || e.createdBy === f.employee)),
    leads: d.leads.filter((l) => (!f.source || l.source === f.source) && (!f.serviceType || l.serviceType === f.serviceType) && (!f.customer || l.customerId === f.customer)),
    customers: d.customers.filter((c) => custOk.has(c.id)),
    timeEntries: f.employee ? d.timeEntries.filter((t) => t.employeeId === f.employee) : d.timeEntries.filter((t) => !t.jobId || jobIds.has(t.jobId) || !jobFiltered),
    campaigns: f.source ? d.campaigns.filter((c) => c.source === f.source || (f.source === "google" && c.source === "seo")) : d.campaigns,
  };
}

export function ReportsPage() {
  const raw = useCrm((s) => s.data);
  const settings = useCrm((s) => s.settings);
  const now = useCrm((s) => s.now);
  const q = useQuery();
  const tab = q.get("tab") ?? "financials";
  const [preset, setPreset] = useState<Preset>("last365");
  const [from, setFrom] = useState(isoDate(now - 90 * 86400000));
  const [to, setTo] = useState(isoDate(now));
  const [f, setF] = useState<Filters>({ employee: "", serviceType: "", customer: "", source: "" });
  const range: Range = preset === "custom" ? { from: new Date(from + "T00:00:00").getTime(), to: new Date(to + "T23:59:59").getTime() } : rangePreset(preset === "today" ? "today" : preset, now);
  const g = PRESETS.find((p) => p.id === preset)!.g;
  const data = useMemo(() => filterData(raw, f), [raw, f]);
  const fin = useMemo(() => financials(data, settings, range), [data, settings, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [
    { id: "financials", label: "Owner financials" },
    { id: "revenue", label: "Revenue" },
    { id: "profit", label: "Profit & job costing" },
    { id: "jobs", label: "Jobs & callbacks" },
    { id: "estimates", label: "Estimates" },
    { id: "leads", label: "Lead sources" },
    { id: "customers", label: "Customers" },
    { id: "employees", label: "Employees" },
    { id: "materials", label: "Materials & inventory" },
    { id: "activity", label: "Activity log" },
  ];
  return (
    <Page wide>
      <PageHeader title="Reports" subtitle={`${date(range.from)} – ${date(range.to)}${f.employee || f.serviceType || f.customer || f.source ? " · filtered" : ""}`} />
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Field label="Period"><Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} className="w-40" /></Field>
        {preset === "custom" && (<><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" /></Field></>)}
        <Field label="Employee"><div className="w-44"><EmployeePicker value={f.employee} onChange={(employee) => setF({ ...f, employee })} placeholder="All employees" /></div></Field>
        <Field label="Job / service type"><Select value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value })} options={[{ value: "", label: "All types" }, ...SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label }))]} className="w-48" /></Field>
        <Field label="Lead source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={[{ value: "", label: "All sources" }, ...LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label }))]} className="w-40" /></Field>
        <Field label="Customer"><div className="w-56"><CustomerPicker value={f.customer} onChange={(customer) => setF({ ...f, customer })} /></div></Field>
        {(f.employee || f.serviceType || f.customer || f.source) && <Button size="sm" variant="ghost" onClick={() => setF({ employee: "", serviceType: "", customer: "", source: "" })}>Clear filters</Button>}
      </div>
      <Tabs className="mb-3" value={tab} onChange={(t) => setQueryParam("tab", t)} tabs={tabs} />
      {tab === "financials" && <Financials data={data} fin={fin} range={range} g={g} />}
      {tab === "revenue" && <RevenueReport data={data} range={range} g={g} />}
      {tab === "profit" && <ProfitReport data={data} range={range} g={g} />}
      {tab === "jobs" && <JobsReport data={data} range={range} g={g} />}
      {tab === "estimates" && <EstimatesReport data={data} range={range} g={g} />}
      {tab === "leads" && <LeadsReport data={data} range={range} g={g} />}
      {tab === "customers" && <CustomersReport data={data} range={range} />}
      {tab === "employees" && <EmployeesReport data={data} range={range} />}
      {tab === "materials" && <MaterialsReport data={data} range={range} />}
      {tab === "activity" && <Card><Timeline entries={data.activity.filter((a) => new Date(a.at).getTime() >= range.from && new Date(a.at).getTime() <= range.to)} limit={150} /></Card>}
    </Page>
  );
}

const inR = (s: string | undefined, r: Range) => !!s && new Date(s.length === 10 ? s + "T12:00:00" : s).getTime() >= r.from && new Date(s.length === 10 ? s + "T12:00:00" : s).getTime() <= r.to;

function ExportBtn<T>({ name, rows, cols }: { name: string; rows: T[]; cols: { header: string; value: (r: T) => string | number | undefined }[] }) {
  return <Button size="sm" variant="ghost" onClick={() => downloadText(`${name}.csv`, toCsv(rows, cols))}><Download size={13} /> CSV</Button>;
}

function Financials({ data, fin, range, g }: { data: CrmData; fin: ReturnType<typeof financials>; range: Range; g: Granularity }) {
  const settings = useCrm((s) => s.settings);
  const cost = useMemo(() => costSeries(data, settings, range, g), [data, settings, range, g]);
  const byType = useMemo(() => profitByJobType(data, settings, range), [data, settings, range]);
  const emps = useMemo(() => employeeStats(data, settings, range).filter((e) => e.jobs), [data, settings, range]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Revenue" value={moneyK(fin.revenue)} sub={`${fin.jobs} jobs`} />
        <StatTile label="Collected" value={moneyK(fin.collected)} />
        <StatTile label="Outstanding invoices" value={money0(fin.outstanding)} sub={fin.overdue ? <span className="text-red-600">{money0(fin.overdue)} overdue</span> : undefined} />
        <StatTile label="Gross profit" value={moneyK(fin.grossProfit)} sub={`${pct(fin.grossMargin)} margin`} />
        <StatTile label="Average ticket" value={money0(fin.avgTicket)} />
        <StatTile label="Revenue / labor hour" value={money0(fin.revenuePerLaborHour)} sub={`${Math.round(fin.laborHours)} labor hrs`} />
        <StatTile label="Estimate close rate" value={pct(fin.closeRate)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Material cost" value={moneyK(fin.materialCost)} sub={fin.revenue ? `${pct(fin.materialCost / fin.revenue)} of revenue` : undefined} />
        <StatTile label="Labor cost" value={moneyK(fin.laborCost)} sub={fin.revenue ? `${pct(fin.laborCost / fin.revenue)} of revenue` : undefined} />
        <StatTile label="Other job costs" value={moneyK(fin.otherCost)} />
        <StatTile label="Marketing spend" value={moneyK(fin.marketing)} />
        <StatTile label="Revenue / technician" value={moneyK(fin.revenuePerTech)} />
        <StatTile label="Customer acquisition cost" value={fin.cac ? money0(fin.cac) : "—"} sub={`${fin.newCustomers} new customers`} />
        <StatTile label="Est. vs actual profit" value={pct(fin.estProfit ? fin.actProfit / fin.estProfit - 1 : 0)} sub={`${moneyK(fin.actProfit)} actual`} />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Revenue, expenses & profit" className="xl:col-span-2"><BarChart data={cost} x="label" series={[{ key: "revenue", label: "Revenue" }, { key: "expenses", label: "Expenses" }]} format={moneyK} height={240} /></Card>
        <Card title="Profit by job type"><RankBars rows={byType.slice(0, 9).map((r) => ({ key: r.type, label: serviceLabel(r.type), value: Math.round(r.profit), sub: pct(r.margin), color: SERIES[2] }))} format={moneyK} /></Card>
      </div>
      <Card title="Revenue per technician" pad={false}>
        <DataTable rows={emps.map((e) => ({ ...e, id: e.employee.id }))} columns={[{ key: "n", header: "Technician", mobile: true, cell: (e) => <span className="flex items-center gap-2"><Avatar e={e.employee} size={22} />{fullName(e.employee)}</span> }, { key: "r", header: "Revenue", align: "right", mobile: true, sort: (e) => e.revenue, cell: (e) => money0(e.revenue) }, { key: "p", header: "Gross profit", align: "right", sort: (e) => e.profit, cell: (e) => money0(e.profit) }, { key: "m", header: "Margin", align: "right", cell: (e) => pct(e.revenue ? e.profit / e.revenue : 0) }, { key: "h", header: "Rev / hr", align: "right", cell: (e) => money0(e.revPerHour) }, { key: "c", header: "Labor cost", align: "right", cell: (e) => money0(e.laborCost) }]} />
      </Card>
    </div>
  );
}

function RevenueReport({ data, range, g }: { data: CrmData; range: Range; g: Granularity }) {
  const rev = useMemo(() => revenueSeries(data, range, g), [data, range, g]);
  const byType = useMemo(() => revenueByServiceType(data, range), [data, range]);
  const cust = byId(data.customers);
  const inv = data.invoices.filter((i) => isRevenueInvoice(i) && inR(i.issueDate, range));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Invoiced vs collected" className="xl:col-span-2"><LineChart data={rev} x="label" series={[{ key: "revenue", label: "Invoiced" }, { key: "collected", label: "Collected" }]} format={moneyK} area height={260} /></Card>
        <Card title="By service type"><RankBars rows={byType.map((r) => ({ key: r.type, label: serviceLabel(r.type), value: r.revenue }))} format={moneyK} /></Card>
      </div>
      <Card title="Invoices in period" pad={false} actions={<ExportBtn name="revenue" rows={inv} cols={[{ header: "Invoice", value: (i) => `INV-${i.number}` }, { header: "Date", value: (i) => i.issueDate }, { header: "Customer", value: (i) => customerName(cust.get(i.customerId)) }, { header: "Revenue", value: (i) => invoiceRevenue(i).toFixed(2) }]} />}>
        <DataTable rows={inv} initialSort={{ key: "d", dir: "desc" }} columns={[{ key: "n", header: "Invoice", mobile: true, cell: (i) => <Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand-700">INV-{i.number}</Link> }, { key: "c", header: "Customer", mobile: true, cell: (i) => customerName(cust.get(i.customerId)) }, { key: "d", header: "Date", sort: (i) => i.issueDate, cell: (i) => date(i.issueDate) }, { key: "r", header: "Revenue", align: "right", mobile: true, sort: (i) => invoiceRevenue(i), cell: (i) => money(invoiceRevenue(i)) }]} />
      </Card>
    </div>
  );
}

function ProfitReport({ data, range }: { data: CrmData; range: Range; g: Granularity }) {
  const settings = useCrm((s) => s.settings);
  const idx = crmIndex(data, settings);
  const cust = byId(data.customers);
  const jobs = data.jobs.filter((j) => inR(j.completedAt, range)).map((j) => ({ ...j, c: idx.costing(j) }));
  const tot = jobs.reduce((s, j) => ({ rev: s.rev + j.c.revenue, cost: s.cost + j.c.totalCost, est: s.est + j.c.est.grossProfit }), { rev: 0, cost: 0, est: 0 });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Job revenue" value={moneyK(tot.rev)} />
        <StatTile label="Job cost" value={moneyK(tot.cost)} />
        <StatTile label="Actual gross profit" value={moneyK(tot.rev - tot.cost)} sub={pct(tot.rev ? (tot.rev - tot.cost) / tot.rev : 0)} />
        <StatTile label="Estimated gross profit" value={moneyK(tot.est)} />
      </div>
      <Card title="Profit by job" pad={false} actions={<ExportBtn name="job-costing" rows={jobs} cols={[{ header: "Job", value: (j) => j.number }, { header: "Customer", value: (j) => customerName(cust.get(j.customerId)) }, { header: "Type", value: (j) => serviceLabel(j.serviceType) }, { header: "Revenue", value: (j) => j.c.revenue.toFixed(2) }, { header: "Materials", value: (j) => j.c.materialCost.toFixed(2) }, { header: "Labor", value: (j) => j.c.laborCost.toFixed(2) }, { header: "Other", value: (j) => (j.c.equipmentCost + j.c.subcontractCost + j.c.otherCost).toFixed(2) }, { header: "Profit", value: (j) => j.c.grossProfit.toFixed(2) }, { header: "Est margin", value: (j) => (j.c.est.margin * 100).toFixed(1) }, { header: "Actual margin", value: (j) => (j.c.margin * 100).toFixed(1) }]} />}>
        <DataTable
          rows={jobs}
          initialSort={{ key: "p", dir: "asc" }}
          columns={[
            { key: "j", header: "Job", mobile: true, cell: (j) => <Link href={`/jobs/${j.id}?tab=costing`} className="font-medium hover:text-brand-700">#{j.number} {serviceLabel(j.serviceType)}<div className="text-[11.5px] font-normal text-slate-500">{customerName(cust.get(j.customerId))}</div></Link> },
            { key: "r", header: "Revenue", align: "right", sort: (j) => j.c.revenue, cell: (j) => money0(j.c.revenue) },
            { key: "m", header: "Materials", align: "right", hideBelow: "md", cell: (j) => money0(j.c.materialCost) },
            { key: "l", header: "Labor", align: "right", hideBelow: "md", cell: (j) => money0(j.c.laborCost) },
            { key: "p", header: "Profit", align: "right", mobile: true, sort: (j) => j.c.grossProfit, cell: (j) => <span className={cn("font-medium", j.c.grossProfit < 0 && "text-red-600")}>{money0(j.c.grossProfit)}</span> },
            { key: "mg", header: "Est → actual", align: "right", sort: (j) => j.c.margin - j.c.est.margin, cell: (j) => <span>{j.c.est.revenue ? pct(j.c.est.margin) : "—"} → <b className={cn(j.c.margin < j.c.est.margin - 0.05 ? "text-red-600" : "text-emerald-700")}>{pct(j.c.margin)}</b></span> },
            { key: "w", header: "Why", hideBelow: "lg", cell: (j) => <span className="text-[11.5px] text-slate-500">{j.c.reasons[0] ?? ""}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function JobsReport({ data, range, g }: { data: CrmData; range: Range; g: Granularity }) {
  const series = useMemo(() => jobsSeries(data, range, g), [data, range, g]);
  const done = data.jobs.filter((j) => inR(j.completedAt, range));
  const callbacks = data.jobs.filter((j) => j.callbackOfJobId && inR(j.createdAt, range));
  const byType = SERVICE_TYPES.map((s) => ({ s, n: done.filter((j) => j.serviceType === s.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const repairs = done.filter((j) => REPAIR_TYPES.includes(j.serviceType));
  const emp = byId(data.employees);
  const jobById = byId(data.jobs);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Jobs completed" value={done.length} />
        <StatTile label="Repairs" value={repairs.length} />
        <StatTile label="Callbacks" value={callbacks.length} sub={`${pct(callbacks.length / Math.max(1, repairs.length), 1)} of repairs`} tone={callbacks.length / Math.max(1, repairs.length) > 0.05 ? "warn" : "default"} />
        <StatTile label="Avg job value" value={money0(done.reduce((s, j) => s + lineTotals(j.items).subtotal, 0) / Math.max(1, done.length))} />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Jobs completed" className="xl:col-span-2"><BarChart data={series} x="label" series={[{ key: "jobs", label: "Jobs" }]} height={240} /></Card>
        <Card title="By service type"><RankBars rows={byType.map((x) => ({ key: x.s.id, label: x.s.label, value: x.n, color: SERIES[1] }))} /></Card>
      </div>
      <Card title="Callbacks" pad={false}>
        <DataTable rows={callbacks} columns={[{ key: "j", header: "Callback", mobile: true, cell: (j) => <Link href={`/jobs/${j.id}`} className="font-medium hover:text-brand-700">#{j.number} {j.title}</Link> }, { key: "o", header: "Original job", cell: (j) => <Link href={`/jobs/${j.callbackOfJobId}`} className="text-brand-700 hover:underline">#{jobById.get(j.callbackOfJobId ?? "")?.number}</Link> }, { key: "t", header: "Original tech", mobile: true, cell: (j) => fullName(emp.get(jobById.get(j.callbackOfJobId ?? "")?.assignedTo ?? "")) }, { key: "d", header: "Date", cell: (j) => date(j.createdAt) }]} />
      </Card>
    </div>
  );
}

function EstimatesReport({ data, range, g }: { data: CrmData; range: Range; g: Granularity }) {
  const conv = useMemo(() => conversionSeries(data, range, g), [data, range, g]);
  const sent = data.estimates.filter((e) => inR(e.sentAt, range));
  const approved = sent.filter((e) => e.status === "approved");
  const declined = sent.filter((e) => e.status === "declined" || e.status === "expired");
  const multi = sent.filter((e) => e.options.length > 1 && e.status === "approved");
  const tierWins = ["good", "better", "best"].map((t) => ({ t, n: multi.filter((e) => e.options.find((o) => o.id === e.selectedOptionId)?.tier === t).length }));
  const cust = byId(data.customers);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Estimates sent" value={sent.length} sub={money0(sent.reduce((s, e) => s + estimateTotal(e), 0))} />
        <StatTile label="Approved" value={approved.length} sub={money0(approved.reduce((s, e) => s + estimateTotal(e), 0))} />
        <StatTile label="Close rate" value={pct(approved.length / Math.max(1, approved.length + declined.length))} />
        <StatTile label="Avg approved value" value={money0(approved.reduce((s, e) => s + estimateTotal(e), 0) / Math.max(1, approved.length))} />
        <StatTile label="Open pipeline" value={money0(data.estimates.filter((e) => ["sent", "viewed"].includes(e.status)).reduce((s, e) => s + estimateTotal(e), 0))} />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Estimate approval rate" className="xl:col-span-2"><LineChart data={conv.map((c) => ({ ...c, rate: Math.round(c.estimateRate * 100) }))} x="label" series={[{ key: "rate", label: "Approval rate" }]} format={(v) => `${v}%`} height={240} /></Card>
        <Card title="Good / Better / Best — which option wins"><RankBars rows={tierWins.map((t) => ({ key: t.t, label: t.t[0].toUpperCase() + t.t.slice(1), value: t.n, color: SERIES[3] }))} /><p className="mt-3 text-[11.5px] text-slate-500">{multi.length} approved multi-option estimates</p></Card>
      </div>
      <Card title="Declined & expired" pad={false}>
        <DataTable rows={declined} columns={[{ key: "n", header: "Estimate", mobile: true, cell: (e) => <Link href={`/estimates/${e.id}`} className="font-medium hover:text-brand-700">#{e.number} {e.title}</Link> }, { key: "c", header: "Customer", mobile: true, cell: (e) => customerName(cust.get(e.customerId)) }, { key: "t", header: "Value", align: "right", cell: (e) => money0(estimateTotal(e)) }, { key: "r", header: "Reason", hideBelow: "md", cell: (e) => <span className="text-slate-500">{data.leads.find((l) => l.estimateId === e.id)?.lostReason ?? "—"}</span> }]} />
      </Card>
    </div>
  );
}

function LeadsReport({ data, range, g }: { data: CrmData; range: Range; g: Granularity }) {
  const stats = useMemo(() => leadSourceStats(data, range), [data, range]);
  const conv = useMemo(() => conversionSeries(data, range, g), [data, range, g]);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="Lead volume & conversion"><BarChart data={conv} x="label" series={[{ key: "leads", label: "Leads" }]} height={220} /></Card>
        <Card title="Revenue by lead source"><RankBars rows={stats.map((s) => ({ key: s.source, label: sourceLabel(s.source), value: s.revenue, sub: pct(s.closeRate) }))} format={moneyK} /></Card>
      </div>
      <Card title="Source performance" pad={false} actions={<ExportBtn name="lead-sources" rows={stats} cols={[{ header: "Source", value: (s) => sourceLabel(s.source) }, { header: "Leads", value: (s) => s.leads }, { header: "Won", value: (s) => s.won }, { header: "Close rate", value: (s) => (s.closeRate * 100).toFixed(1) }, { header: "Revenue", value: (s) => s.revenue }, { header: "Spend", value: (s) => s.spend.toFixed(0) }]} />}>
        <DataTable rows={stats.map((s) => ({ ...s, id: s.source }))} columns={[{ key: "s", header: "Source", mobile: true, cell: (s) => <span className="font-medium">{sourceLabel(s.source)}</span> }, { key: "l", header: "Leads", align: "right", sort: (s) => s.leads, cell: (s) => s.leads }, { key: "w", header: "Won", align: "right", cell: (s) => s.won }, { key: "c", header: "Close rate", align: "right", mobile: true, sort: (s) => s.closeRate, cell: (s) => pct(s.closeRate) }, { key: "r", header: "Revenue", align: "right", sort: (s) => s.revenue, cell: (s) => money0(s.revenue) }, { key: "sp", header: "Spend", align: "right", cell: (s) => (s.spend ? money0(s.spend) : "—") }, { key: "cpl", header: "Cost / lead", align: "right", cell: (s) => (s.spend ? money0(s.cpl) : "—") }, { key: "roi", header: "ROI", align: "right", cell: (s) => (s.spend ? `${s.roi.toFixed(1)}×` : "—") }]} />
      </Card>
    </div>
  );
}

function CustomersReport({ data, range }: { data: CrmData; range: Range }) {
  const rev = new Map<string, number>();
  for (const i of data.invoices) if (isRevenueInvoice(i) && inR(i.issueDate, range)) rev.set(i.customerId, (rev.get(i.customerId) ?? 0) + invoiceRevenue(i));
  const rows = data.customers.map((c) => ({ ...c, rev: rev.get(c.id) ?? 0, jobs: data.jobs.filter((j) => j.customerId === c.id && inR(j.completedAt, range)).length })).filter((c) => c.rev > 0);
  const newC = data.customers.filter((c) => inR(c.createdAt, range)).length;
  const repeat = rows.filter((c) => data.jobs.filter((j) => j.customerId === c.id && j.completedAt).length > 1).length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Customers served" value={rows.length} />
        <StatTile label="New customers" value={newC} />
        <StatTile label="Repeat customers" value={pct(repeat / Math.max(1, rows.length))} />
        <StatTile label="Revenue / customer" value={money0([...rev.values()].reduce((s, v) => s + v, 0) / Math.max(1, rows.length))} />
      </div>
      <Card title="Top customers" pad={false} actions={<ExportBtn name="customers" rows={rows} cols={[{ header: "Customer", value: (c) => customerName(c) }, { header: "Revenue", value: (c) => c.rev.toFixed(2) }, { header: "Jobs", value: (c) => c.jobs }, { header: "Source", value: (c) => sourceLabel(c.leadSource) }]} />}>
        <DataTable rows={rows} initialSort={{ key: "r", dir: "desc" }} columns={[{ key: "n", header: "Customer", mobile: true, cell: (c) => <Link href={`/customers/${c.id}`} className="font-medium hover:text-brand-700">{customerName(c)}</Link> }, { key: "r", header: "Revenue", align: "right", mobile: true, sort: (c) => c.rev, cell: (c) => money0(c.rev) }, { key: "j", header: "Jobs", align: "right", sort: (c) => c.jobs, cell: (c) => c.jobs }, { key: "s", header: "Source", hideBelow: "md", cell: (c) => sourceLabel(c.leadSource) }, { key: "t", header: "Type", hideBelow: "md", cell: (c) => c.type }]} />
      </Card>
    </div>
  );
}

function EmployeesReport({ data, range }: { data: CrmData; range: Range }) {
  const settings = useCrm((s) => s.settings);
  const rows = useMemo(() => employeeStats(data, settings, range), [data, settings, range]);
  return (
    <Card pad={false} title="Employee performance" actions={<ExportBtn name="employees" rows={rows} cols={[{ header: "Employee", value: (r) => fullName(r.employee) }, { header: "Jobs", value: (r) => r.jobs }, { header: "Revenue", value: (r) => r.revenue }, { header: "Hours", value: (r) => r.hours.toFixed(1) }, { header: "Callbacks", value: (r) => r.callbacks }]} />}>
      <DataTable rows={rows.map((r) => ({ ...r, id: r.employee.id }))} columns={[{ key: "n", header: "Employee", mobile: true, cell: (r) => <span className="flex items-center gap-2"><Avatar e={r.employee} size={22} />{fullName(r.employee)}</span> }, { key: "j", header: "Jobs", align: "right", sort: (r) => r.jobs, cell: (r) => r.jobs }, { key: "r", header: "Revenue", align: "right", mobile: true, sort: (r) => r.revenue, cell: (r) => money0(r.revenue) }, { key: "p", header: "Profit", align: "right", cell: (r) => money0(r.profit) }, { key: "h", header: "Hours", align: "right", cell: (r) => hours(r.hours) }, { key: "rph", header: "Rev/hr", align: "right", cell: (r) => (r.hours ? money0(r.revPerHour) : "—") }, { key: "t", header: "Avg ticket", align: "right", cell: (r) => (r.jobs ? money0(r.avgTicket) : "—") }, { key: "c", header: "Callback rate", align: "right", cell: (r) => pct(r.callbackRate, 1) }, { key: "ph", header: "Photos", align: "right", cell: (r) => r.photos }]} />
    </Card>
  );
}

function MaterialsReport({ data, range }: { data: CrmData; range: Range }) {
  const used = new Map<string, { name: string; qty: number; cost: number; price: number; unit: string }>();
  for (const j of data.jobs.filter((x) => inR(x.completedAt, range))) for (const i of j.items.filter((x) => x.kind === "material")) {
    const k = i.itemId ?? i.name;
    const e = used.get(k) ?? { name: i.name, qty: 0, cost: 0, price: 0, unit: i.unit };
    const q = i.usedQty ?? i.qty;
    e.qty += q;
    e.cost += q * i.unitCost;
    e.price += q * i.unitPrice;
    used.set(k, e);
  }
  const rows = [...used].map(([id, v]) => ({ id, ...v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Material cost" value={money0(rows.reduce((s, r) => s + r.cost, 0))} />
        <StatTile label="Material revenue" value={money0(rows.reduce((s, r) => s + r.price, 0))} />
        <StatTile label="Material margin" value={pct(1 - rows.reduce((s, r) => s + r.cost, 0) / Math.max(1, rows.reduce((s, r) => s + r.price, 0)))} />
        <StatTile label="Inventory value" value={money0(data.items.filter((i) => i.stocked).reduce((s, i) => s + i.cost * i.warehouseQty, 0))} />
      </div>
      <Card title="Materials used on jobs" pad={false} actions={<ExportBtn name="materials" rows={rows} cols={[{ header: "Item", value: (r) => r.name }, { header: "Qty", value: (r) => r.qty }, { header: "Unit", value: (r) => r.unit }, { header: "Cost", value: (r) => r.cost.toFixed(2) }, { header: "Billed", value: (r) => r.price.toFixed(2) }]} />}>
        <DataTable rows={rows} initialSort={{ key: "c", dir: "desc" }} columns={[{ key: "n", header: "Item", mobile: true, cell: (r) => <span className="font-medium">{r.name}</span> }, { key: "q", header: "Qty used", align: "right", mobile: true, sort: (r) => r.qty, cell: (r) => `${Math.round(r.qty)} ${r.unit}` }, { key: "c", header: "Cost", align: "right", sort: (r) => r.cost, cell: (r) => money0(r.cost) }, { key: "p", header: "Billed", align: "right", sort: (r) => r.price, cell: (r) => money0(r.price) }, { key: "m", header: "Margin", align: "right", cell: (r) => pct(r.price ? 1 - r.cost / r.price : 0) }]} />
      </Card>
    </div>
  );
}

/* ───────────────────────── Marketing ───────────────────────── */

export function MarketingPage() {
  const st = useCrm();
  const { data } = st;
  const [edit, setEdit] = useState<Campaign | null>(null);
  const stats = useMemo(() => campaignStats(data), [data]);
  const tot = stats.reduce((s, c) => ({ spend: s.spend + c.campaign.spend, leads: s.leads + c.leads, rev: s.rev + c.revenue, booked: s.booked + c.booked }), { spend: 0, leads: 0, rev: 0, booked: 0 });
  return (
    <Page>
      <PageHeader title="Marketing" subtitle="Campaign spend, leads, booked jobs and ROI" actions={<Button variant="primary" onClick={() => setEdit({ id: uid("cmp"), name: "", source: "google_ads", startDate: isoDate(), spend: 0, notes: "", active: true })}><Plus size={15} /> New campaign</Button>} />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Total spend" value={money0(tot.spend)} />
        <StatTile label="Leads" value={tot.leads} />
        <StatTile label="Cost per lead" value={money0(tot.spend / Math.max(1, tot.leads))} />
        <StatTile label="Attributed revenue" value={moneyK(tot.rev)} />
        <StatTile label="Blended ROI" value={`${((tot.rev - tot.spend) / Math.max(1, tot.spend)).toFixed(1)}×`} />
      </div>
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Card title="ROI by campaign"><RankBars rows={stats.slice().sort((a, b) => b.roi - a.roi).map((s) => ({ key: s.campaign.id, label: s.campaign.name, value: Math.round(s.roi * 10) / 10, sub: money0(s.revenue), color: s.roi >= 0 ? SERIES[2] : SERIES[7] }))} format={(v) => `${v}×`} /></Card>
        <Card title="Cost per booked job"><RankBars rows={stats.filter((s) => s.booked).sort((a, b) => a.cpb - b.cpb).map((s) => ({ key: s.campaign.id, label: s.campaign.name, value: Math.round(s.cpb), sub: `${s.booked} jobs` }))} format={money0} /></Card>
      </div>
      <Card pad={false}>
        <DataTable
          rows={stats.map((s) => ({ ...s, id: s.campaign.id }))}
          onRowClick={(s) => setEdit(s.campaign)}
          initialSort={{ key: "roi", dir: "desc" }}
          columns={[
            { key: "n", header: "Campaign", mobile: true, cell: (s) => <div><div className="font-medium text-slate-900">{s.campaign.name}</div><div className="text-[11.5px] text-slate-500">{sourceLabel(s.campaign.source)} · since {date(s.campaign.startDate)}{s.campaign.endDate ? ` – ${date(s.campaign.endDate)}` : ""}</div></div> },
            { key: "st", header: "Status", cell: (s) => <Badge tone={s.campaign.active ? "green" : "slate"} dot>{s.campaign.active ? "Active" : "Ended"}</Badge> },
            { key: "sp", header: "Ad cost", align: "right", sort: (s) => s.campaign.spend, cell: (s) => money0(s.campaign.spend) },
            { key: "l", header: "Leads", align: "right", mobile: true, sort: (s) => s.leads, cell: (s) => s.leads },
            { key: "b", header: "Booked jobs", align: "right", sort: (s) => s.booked, cell: (s) => s.booked },
            { key: "r", header: "Revenue", align: "right", sort: (s) => s.revenue, cell: (s) => money0(s.revenue) },
            { key: "cpl", header: "Cost / lead", align: "right", hideBelow: "md", cell: (s) => (s.leads ? money0(s.cpl) : "—") },
            { key: "cpb", header: "Cost / booked job", align: "right", hideBelow: "md", cell: (s) => (s.booked ? money0(s.cpb) : "—") },
            { key: "roi", header: "ROI", align: "right", mobile: true, sort: (s) => s.roi, cell: (s) => <span className={cn("font-semibold", s.roi >= 0 ? "text-emerald-700" : "text-red-600")}>{s.roi.toFixed(1)}×</span> },
          ]}
        />
      </Card>
      {edit && (
        <SlideOver open onClose={() => setEdit(null)} title={edit.name || "New campaign"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!edit.name} onClick={() => { if (data.campaigns.some((c) => c.id === edit.id)) st.update("campaigns", edit.id, edit); else st.insert("campaigns", edit); setEdit(null); }}>Save</Button></>}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name" className="col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Channel"><Select value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value as Campaign["source"] })} options={[...LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label })), { value: "seo", label: "SEO" }]} /></Field>
            <Field label="Total spend"><NumberInput value={edit.spend} onChange={(v) => setEdit({ ...edit, spend: v })} /></Field>
            <Field label="Start"><Input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={edit.endDate ?? ""} onChange={(e) => setEdit({ ...edit, endDate: e.target.value || undefined })} /></Field>
            <Field label="Notes" className="col-span-2"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <Check label="Active" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
          </div>
        </SlideOver>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500"><TrendingUp size={12} /> Attribution: leads tagged with the campaign + customers created from them; revenue is lifetime invoiced revenue of those customers.</p>
    </Page>
  );
}


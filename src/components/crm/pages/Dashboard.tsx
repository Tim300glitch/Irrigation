"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, AlertTriangle, FileText, Filter, Receipt, Repeat, Package, PhoneCall, Wrench, ArrowRight, DollarSign, Sparkles } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import { Page, Card, StatTile, Avatar, StatusBadge, Badge, cn, Segmented, useLocalState } from "../ui";
import { LineChart, BarChart, RankBars, SERIES } from "../charts";
import { Recommendations, Timeline } from "../widgets";
import { revenueSeries, jobsSeries, conversionSeries, revenueByServiceType, employeeStats, leadSourceStats, financials, costSeries, rangePreset, crmIndex, type Range } from "@/lib/crm/metrics";
import { estimateTotal, invoiceTotals, lineTotals } from "@/lib/crm/calc";
import { JOB_STATUSES, serviceLabel, serviceShort, serviceColor, sourceLabel, OPEN_JOB } from "@/lib/crm/constants";
import { money0, moneyK, pct, time, customerName, date, relative, addressLine, isoDate, fullName } from "@/lib/crm/format";

export function Dashboard() {
  const data = useCrm((s) => s.data);
  const settings = useCrm((s) => s.settings);
  const now = useCrm((s) => s.now);
  const session = useCrm((s) => s.session);
  const router = useRouter();
  const [chartRange, setChartRange] = useLocalState<"last90" | "last365">("dash-range", "last365");
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const emp = byId(data.employees);
  const me = session?.employeeId ? emp.get(session.employeeId) : undefined;

  const m = useMemo(() => {
    const week = financials(data, settings, rangePreset("week", now));
    const month = financials(data, settings, rangePreset("month", now));
    const year = financials(data, settings, rangePreset("year", now));
    const last30 = financials(data, settings, rangePreset("last30", now));
    const prev30 = financials(data, settings, { from: now - 59 * 86400000, to: now - 30 * 86400000 });
    const today = new Date(now).toDateString();
    const todays = data.jobs.filter((j) => j.scheduledStart && new Date(j.scheduledStart).toDateString() === today && j.status !== "cancelled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
    const upcoming = data.jobs.filter((j) => j.scheduledStart && new Date(j.scheduledStart).getTime() > new Date(today).getTime() + 86400000 && OPEN_JOB.includes(j.status)).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
    const unscheduled = data.jobs.filter((j) => j.status === "unscheduled");
    const newLeads = data.leads.filter((l) => l.stage === "new");
    const awaiting = data.estimates.filter((e) => e.status === "sent" || e.status === "viewed");
    const approvedNotScheduled = data.estimates.filter((e) => e.status === "approved" && (!e.jobId || data.jobs.find((j) => j.id === e.jobId)?.status === "unscheduled"));
    const idx = crmIndex(data, settings);
    const outstanding = data.invoices.filter((i) => !["void", "draft", "paid"].includes(i.status)).map((i) => ({ i, t: invoiceTotals(i, idx.paymentsByInvoice.get(i.id) ?? [], now) })).filter((x) => x.t.balance > 0);
    const callbacks = data.jobs.filter((j) => j.status === "callback" || (j.callbackOfJobId && OPEN_JOB.includes(j.status)));
    const maintDue = data.planSubscriptions.filter((s) => s.status === "active" && new Date(s.nextVisitDate + "T12:00:00").getTime() - now < 14 * 86400000).sort((a, b) => a.nextVisitDate.localeCompare(b.nextVisitDate));
    const lowStock = data.items.filter((i) => i.stocked && i.active && i.warehouseQty <= i.minQty);
    const pays30 = data.payments.filter((p) => new Date(p.receivedAt).getTime() > now - 30 * 86400000);
    return { week, month, year, last30, prev30, todays, upcoming, unscheduled, newLeads, awaiting, approvedNotScheduled, outstanding, callbacks, maintDue, lowStock, pays30 };
  }, [data, settings, now]);

  const charts = useMemo(() => {
    const r: Range = rangePreset(chartRange, now);
    const g = chartRange === "last90" ? "week" : "month";
    return {
      rev: revenueSeries(data, r, g),
      jobs: jobsSeries(data, r, g),
      conv: conversionSeries(data, r, g),
      cost: costSeries(data, settings, r, g),
      byType: revenueByServiceType(data, r),
      emps: employeeStats(data, settings, r).filter((e) => e.jobs > 0),
      sources: leadSourceStats(data, r),
      jobTypes: Object.entries(
        data.jobs
          .filter((j) => j.completedAt && new Date(j.completedAt).getTime() >= r.from)
          .reduce<Record<string, number>>((a, j) => ((a[j.serviceType] = (a[j.serviceType] ?? 0) + 1), a), {}),
      ).sort((a, b) => b[1] - a[1]),
      recentJobs: data.jobs
        .filter((j) => j.completedAt)
        .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
        .slice(0, 8)
        .map((j) => ({ j, c: crmIndex(data, settings).costing(j) })),
    };
  }, [data, settings, now, chartRange]);

  const h = new Date(now).getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const queue = [
    { label: "New leads", n: m.newLeads.length, href: "/leads", icon: Filter, tone: m.newLeads.length ? "text-brand-600" : "" },
    { label: "Unscheduled jobs", n: m.unscheduled.length, href: "/dispatch", icon: Wrench, tone: m.unscheduled.some((j) => j.priority === "urgent") ? "text-red-600" : "" },
    { label: "Estimates awaiting approval", n: m.awaiting.length, href: "/estimates?status=open", icon: FileText, sub: money0(m.awaiting.reduce((s, e) => s + estimateTotal(e), 0)) },
    { label: "Approved, not scheduled", n: m.approvedNotScheduled.length, href: "/estimates?status=approved_unscheduled", icon: CalendarClock, tone: m.approvedNotScheduled.length ? "text-amber-600" : "" },
    { label: "Invoices outstanding", n: m.outstanding.length, href: "/invoices?status=open", icon: Receipt, sub: money0(m.outstanding.reduce((s, x) => s + x.t.balance, 0)) },
    { label: "Open callbacks", n: m.callbacks.length, href: "/jobs?status=callback", icon: PhoneCall, tone: m.callbacks.length ? "text-red-600" : "" },
    { label: "Maintenance due (14d)", n: m.maintDue.length, href: "/service-plans", icon: Repeat },
    { label: "Low inventory", n: m.lowStock.length, href: "/inventory?tab=reorder", icon: Package, tone: m.lowStock.length ? "text-amber-600" : "" },
  ];
  const trend = (a: number, b: number) => (b ? { value: (a - b) / b } : undefined);

  return (
    <Page>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-slate-900">
            {greet}
            {me ? `, ${me.firstName}` : ""}
          </h1>
          <p className="text-[12.5px] text-slate-500">
            {new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {m.todays.length} jobs today · {m.todays.filter((j) => j.status === "completed").length} completed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Revenue this week" value={money0(m.week.revenue)} href="/reports?tab=revenue" sub={`${m.week.jobs} jobs`} />
        <StatTile label="Revenue this month" value={money0(m.month.revenue)} href="/reports?tab=revenue" sub={`${m.month.jobs} jobs`} />
        <StatTile label="Revenue this year" value={moneyK(m.year.revenue)} href="/reports?tab=financials" sub={`${pct(m.year.grossMargin)} gross margin`} />
        <StatTile label="Payments (30d)" value={money0(m.last30.collected)} href="/payments" trend={trend(m.last30.collected, m.prev30.collected)} />
        <StatTile label="Outstanding" value={money0(m.last30.outstanding)} href="/invoices?status=open" sub={m.last30.overdue ? <span className="text-red-600">{money0(m.last30.overdue)} overdue</span> : "none overdue"} tone={m.last30.overdue > 2000 ? "warn" : "default"} />
        <StatTile label="Average ticket" value={money0(m.last30.avgTicket)} trend={trend(m.last30.avgTicket, m.prev30.avgTicket)} sub="30d" />
        <StatTile label="Close rate" value={pct(m.last30.closeRate)} trend={trend(m.last30.closeRate, m.prev30.closeRate)} sub="estimates, 30d" href="/reports?tab=estimates" />
        <StatTile label="New leads" value={m.newLeads.length} href="/leads" sub={`${data.leads.filter((l) => new Date(l.createdAt).getTime() > now - 7 * 86400000).length} this week`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Card
          title="Today's jobs"
          sub={`${m.todays.length} scheduled`}
          pad={false}
          actions={
            <Link href="/dispatch" className="text-[12px] font-medium text-brand-700 hover:underline">
              Dispatch board
            </Link>
          }
        >
          <div className="divide-y divide-slate-100">
            {m.todays.map((j) => {
              const c = cust.get(j.customerId);
              const p = prop.get(j.propertyId);
              const late = j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now;
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                  <div className="w-[68px] shrink-0 text-right">
                    <div className="tabular whitespace-nowrap text-[12.5px] font-medium text-slate-900">{time(j.scheduledStart)}</div>
                    <div className="text-[11px] text-slate-400">{j.durationHrs}h</div>
                  </div>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: serviceColor(j.serviceType) }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-slate-900">{customerName(c)}</div>
                    <div className="truncate text-[12px] text-slate-500">
                      {j.title} · {addressLine(p?.address)}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="tabular text-[12.5px] text-slate-700">{money0(lineTotals(j.items).subtotal)}</div>
                  </div>
                  <Avatar e={emp.get(j.assignedTo ?? "")} size={24} />
                  <div className="w-[104px] shrink-0 text-right">{late ? <Badge tone="red" dot>Late</Badge> : <StatusBadge list={JOB_STATUSES} value={j.status} />}</div>
                </Link>
              );
            })}
            {!m.todays.length && <div className="px-4 py-8 text-center text-[13px] text-slate-500">No jobs scheduled today.</div>}
          </div>
        </Card>
        <div className="grid gap-3">
          <Card title="Needs attention" pad={false}>
            <div className="grid grid-cols-2">
              {queue.map((q, i) => (
                <Link key={q.label} href={q.href} className={cn("flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50", i % 2 === 0 && "border-r border-slate-100", i < queue.length - 2 && "border-b border-slate-100")}>
                  <q.icon size={15} className={cn("shrink-0 text-slate-400", q.tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-slate-500">{q.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("tabular text-[16px] font-semibold text-slate-900", q.tone)}>{q.n}</span>
                      {q.sub && <span className="truncate text-[11.5px] text-slate-500">{q.sub}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
          <Card title="Smart suggestions" icon={<Sparkles size={14} />}>
            <Recommendations limit={4} />
          </Card>
        </div>
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-800">Performance</h2>
        <Segmented
          size="sm"
          value={chartRange}
          onChange={setChartRange}
          options={[
            { id: "last90", label: "90 days" },
            { id: "last365", label: "12 months" },
          ]}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Revenue over time" className="xl:col-span-2">
          <LineChart data={charts.rev} x="label" series={[{ key: "revenue", label: "Invoiced revenue" }, { key: "collected", label: "Collected" }]} format={moneyK} area height={230} />
        </Card>
        <Card title="Revenue by service type">
          <RankBars rows={charts.byType.slice(0, 7).map((r) => ({ key: r.type, label: serviceLabel(r.type), value: r.revenue, color: SERIES[0] }))} format={moneyK} onClick={(k) => router.push(`/jobs?type=${k}`)} />
        </Card>
        <Card title="Jobs completed">
          <BarChart data={charts.jobs} x="label" series={[{ key: "jobs", label: "Jobs" }]} height={200} />
        </Card>
        <Card title="Lead conversion & estimate approval">
          <LineChart data={charts.conv.map((c) => ({ ...c, leadRate: Math.round(c.leadRate * 100), estimateRate: Math.round(c.estimateRate * 100) }))} x="label" series={[{ key: "leadRate", label: "Lead conversion" }, { key: "estimateRate", label: "Estimate approval" }]} format={(v) => `${v}%`} height={200} />
        </Card>
        <Card title="Average job value">
          <LineChart data={charts.jobs} x="label" series={[{ key: "avg", label: "Avg job value", color: SERIES[2] }]} format={money0} height={200} />
        </Card>
        <Card title="Expenses vs revenue" sub="materials + labor + other + marketing" className="xl:col-span-2">
          <BarChart data={charts.cost} x="label" series={[{ key: "revenue", label: "Revenue" }, { key: "expenses", label: "Expenses" }]} format={moneyK} height={220} />
        </Card>
        <Card title="Revenue by technician">
          <RankBars rows={charts.emps.sort((a, b) => b.revenue - a.revenue).map((e) => ({ key: e.employee.id, label: fullName(e.employee), value: e.revenue, sub: `${e.jobs} jobs`, color: e.employee.color }))} format={moneyK} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card title="Profit by job" sub="recently completed" pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="px-2 font-medium">Tech</th>
                  <th className="px-2 text-right font-medium">Revenue</th>
                  <th className="px-2 text-right font-medium">Cost</th>
                  <th className="px-2 text-right font-medium">Profit</th>
                  <th className="px-4 text-right font-medium">Est → Actual margin</th>
                </tr>
              </thead>
              <tbody>
                {charts.recentJobs.map(({ j, c }) => (
                  <tr key={j.id} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50" onClick={() => router.push(`/jobs/${j.id}?tab=costing`)}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">
                        #{j.number} {serviceShort(j.serviceType)}
                      </div>
                      <div className="truncate text-[11.5px] text-slate-500">{customerName(cust.get(j.customerId))}</div>
                    </td>
                    <td className="px-2">
                      <Avatar e={emp.get(j.assignedTo ?? "")} size={22} />
                    </td>
                    <td className="tabular px-2 text-right">{money0(c.revenue)}</td>
                    <td className="tabular px-2 text-right text-slate-500">{money0(c.totalCost)}</td>
                    <td className={cn("tabular px-2 text-right font-medium", c.grossProfit < 0 ? "text-red-600" : "text-slate-900")}>{money0(c.grossProfit)}</td>
                    <td className="tabular px-4 text-right">
                      <span className="text-slate-500">{c.est.revenue ? pct(c.est.margin) : "—"}</span> → <span className={cn("font-medium", c.margin < c.est.margin - 0.05 ? "text-red-600" : "text-emerald-700")}>{pct(c.margin)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Jobs by type">
          <RankBars rows={charts.jobTypes.slice(0, 8).map(([k, v]) => ({ key: k, label: serviceLabel(k), value: v, color: SERIES[1] }))} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card title="Lead source performance" pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-2 text-right font-medium">Leads</th>
                  <th className="px-2 text-right font-medium">Won</th>
                  <th className="px-2 text-right font-medium">Close rate</th>
                  <th className="px-2 text-right font-medium">Revenue</th>
                  <th className="px-2 text-right font-medium">Spend</th>
                  <th className="px-4 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {charts.sources.map((s) => (
                  <tr key={s.source} className="border-b border-slate-50">
                    <td className="px-4 py-1.5 font-medium text-slate-800">{sourceLabel(s.source)}</td>
                    <td className="tabular px-2 text-right">{s.leads}</td>
                    <td className="tabular px-2 text-right">{s.won}</td>
                    <td className="tabular px-2 text-right">{pct(s.closeRate)}</td>
                    <td className="tabular px-2 text-right">{moneyK(s.revenue)}</td>
                    <td className="tabular px-2 text-right text-slate-500">{s.spend ? moneyK(s.spend) : "—"}</td>
                    <td className={cn("tabular px-4 text-right font-medium", s.roi > 0 ? "text-emerald-700" : s.spend ? "text-red-600" : "text-slate-400")}>{s.spend ? `${s.roi.toFixed(1)}×` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Employee productivity" pad={false}>
          <div className="divide-y divide-slate-100">
            {charts.emps
              .sort((a, b) => b.revenue - a.revenue)
              .map((e) => (
                <Link key={e.employee.id} href={`/employees?open=${e.employee.id}`} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                  <Avatar e={e.employee} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-slate-900">{fullName(e.employee)}</div>
                    <div className="text-[11.5px] text-slate-500">
                      {e.jobs} jobs · {Math.round(e.hours)}h · {e.callbacks} callbacks
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-[12.5px] font-medium text-slate-900">{money0(e.revPerHour)}/h</div>
                    <div className="tabular text-[11px] text-slate-500">{money0(e.avgTicket)} avg</div>
                  </div>
                </Link>
              ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <Card title="Upcoming jobs" pad={false}>
          <div className="divide-y divide-slate-100">
            {m.upcoming.slice(0, 7).map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50">
                <div className="w-14 shrink-0">
                  <div className="text-[11.5px] font-medium text-slate-700">{date(j.scheduledStart)}</div>
                  <div className="tabular text-[11px] text-slate-400">{time(j.scheduledStart)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-slate-900">{customerName(cust.get(j.customerId))}</div>
                  <div className="truncate text-[11.5px] text-slate-500">{j.title}</div>
                </div>
                <Avatar e={emp.get(j.assignedTo ?? "")} size={20} />
              </Link>
            ))}
          </div>
        </Card>
        <Card title="Recurring maintenance due" pad={false}>
          <div className="divide-y divide-slate-100">
            {m.maintDue.slice(0, 7).map((s) => {
              const overdue = s.nextVisitDate < isoDate(now);
              return (
                <Link key={s.id} href="/service-plans" className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50">
                  <Repeat size={14} className={overdue ? "text-red-500" : "text-slate-400"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] text-slate-900">{customerName(cust.get(s.customerId))}</div>
                    <div className="truncate text-[11.5px] text-slate-500">{data.servicePlans.find((p) => p.id === s.planId)?.name}</div>
                  </div>
                  <span className={cn("text-[11.5px]", overdue ? "font-medium text-red-600" : "text-slate-500")}>{relative(s.nextVisitDate + "T09:00:00", now)}</span>
                </Link>
              );
            })}
            {!m.maintDue.length && <div className="px-4 py-6 text-center text-[12.5px] text-slate-500">Nothing due in the next 2 weeks.</div>}
          </div>
        </Card>
        <Card title="Low inventory alerts" pad={false}>
          <div className="divide-y divide-slate-100">
            {m.lowStock.slice(0, 7).map((i) => (
              <Link key={i.id} href={`/inventory?item=${i.id}`} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50">
                <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-900">{i.name}</span>
                <span className="tabular text-[11.5px] text-slate-500">
                  {i.warehouseQty} / min {i.minQty}
                </span>
              </Link>
            ))}
            {!m.lowStock.length && <div className="px-4 py-6 text-center text-[12.5px] text-slate-500">All stock above minimum.</div>}
          </div>
        </Card>
        <Card
          title="Recent activity"
          actions={
            <Link href="/reports?tab=activity" className="text-slate-400 hover:text-slate-700" aria-label="All activity">
              <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="max-h-[300px] overflow-y-auto">
            <Timeline entries={data.activity.slice(0, 60)} limit={12} />
          </div>
        </Card>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-slate-400">
        <DollarSign size={12} /> Revenue = invoiced (pre-tax) on issue date; deposits count as collections. Payments received last 30 days: {m.pays30.length}.
      </div>
    </Page>
  );
}

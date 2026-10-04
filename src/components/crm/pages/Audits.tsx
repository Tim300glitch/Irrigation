"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Printer, CheckCircle2, Droplets, Gauge, AlertTriangle, Lightbulb, Wrench, FileText } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { AuditReport, ZoneStatus } from "@/lib/crm/types";
import { ZONE_STATUSES } from "@/lib/crm/constants";
import { addressFull, customerName, date, money0, num, fullName } from "@/lib/crm/format";
import { auditScore, type AuditResult } from "@/lib/crm/calc";
import { customLine } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Button, Badge, Field, Input, Select, Textarea, cn, Empty, Check, StatTile, SearchBox, Tabs, NumberInput } from "../ui";
import { DataTable } from "../DataTable";
import { saveFile } from "@/lib/saveFile";
import { auditPdf, pdfName } from "@/lib/pdf/crmPdf";
import { useQuickCreate } from "../QuickCreate";
import { ZoneStatusBadges, ZoneMiniTable } from "./Customers";

const gradeTone = (g: string) => (g === "A" || g === "B" ? "green" : g === "C" ? "amber" : "red");

export function AuditsPage() {
  const data = useCrm((s) => s.data);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const prop = byId(data.properties);
  const cust = byId(data.customers);
  const rows = data.audits.map((a) => ({ ...a, r: auditScore(a) }));
  const avg = rows.length ? rows.reduce((s, a) => s + a.r.overall, 0) / rows.length : 0;
  return (
    <Page>
      <PageHeader title="Inspections & audits" subtitle="Pressure, flow, distribution uniformity and a prioritized repair plan for every property" actions={<Button variant="primary" onClick={() => openQuick("audit")}><Plus size={15} /> New audit</Button>} />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Audits" value={rows.length} sub={`${rows.filter((a) => a.status === "draft").length} in progress`} />
        <StatTile label="Average system score" value={Math.round(avg)} />
        <StatTile label="Recommended repairs" value={money0(rows.reduce((s, a) => s + a.r.repairs.reduce((x, r) => x + (r.estCost ?? 0), 0), 0))} />
        <StatTile label="Est. water savings" value={`${num(rows.reduce((s, a) => s + a.r.savingsGallonsYr, 0) / 1000)}k gal/yr`} />
      </div>
      <Card pad={false}>
        <DataTable
          rows={rows}
          onRowClick={(a) => router.push(`/audits/${a.id}`)}
          initialSort={{ key: "date", dir: "desc" }}
          empty={<Empty title="No audits yet" />}
          columns={[
            { key: "prop", header: "Property", mobile: true, cell: (a) => <div><div className="font-medium text-slate-900">{prop.get(a.propertyId)?.address.street}</div><div className="text-[11.5px] text-slate-500">{customerName(cust.get(prop.get(a.propertyId)?.customerId ?? ""))}</div></div> },
            { key: "score", header: "Score", mobile: true, sort: (a) => a.r.overall, cell: (a) => <span className="flex items-center gap-1.5"><Badge tone={gradeTone(a.r.grade)}>{a.r.grade}</Badge><b className="tabular">{a.r.overall}</b></span> },
            { key: "eff", header: "Efficiency", sort: (a) => a.r.efficiency, cell: (a) => a.r.efficiency },
            { key: "du", header: "DU", hideBelow: "md", cell: (a) => (a.distributionUniformity ? `${Math.round(a.distributionUniformity * 100)}%` : "—") },
            { key: "rep", header: "Repairs", hideBelow: "md", cell: (a) => a.r.repairs.length },
            { key: "status", header: "Status", cell: (a) => <Badge tone={a.status === "complete" ? "green" : "amber"} dot>{a.status}</Badge> },
            { key: "date", header: "Date", mobile: true, sort: (a) => a.date, cell: (a) => date(a.date) },
          ]}
        />
      </Card>
    </Page>
  );
}

function ScoreRing({ value, label, size = 96 }: { value: number; label: string; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const col = value >= 80 ? "#16a34a" : value >= 65 ? "#d97706" : "#dc2626";
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.28} fontWeight={700} fill="var(--color-slate-900)">{value}</text>
      </svg>
      <div className="mt-1 text-[11.5px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

export function AuditDetail({ id }: { id: string }) {
  const st = useCrm();
  const { data, update } = st;
  const router = useRouter();
  const [tab, setTab] = useState<"measure" | "zones" | "results">("measure");
  const a = data.audits.find((x) => x.id === id);
  const r = useMemo(() => (a ? auditScore(a) : null), [a]);
  if (!a || !r) return <Page><Empty title="Audit not found" /></Page>;
  const p = data.properties.find((x) => x.id === a.propertyId);
  const c = data.customers.find((x) => x.id === p?.customerId);
  const zones = data.zones.filter((z) => z.systemId === a.systemId).sort((x, y) => x.number - y.number);
  const set = (patch: Partial<AuditReport>) => update("audits", id, patch);
  const num_ = (k: keyof AuditReport, label: string, suffix?: string, step = 1) => (
    <Field label={label}><NumberInput value={a[k] as number | undefined} allowEmpty onChange={(v) => set({ [k]: Number.isNaN(v) ? undefined : v } as Partial<AuditReport>)} step={step} suffix={suffix} /></Field>
  );
  const counter = (k: "brokenHeads" | "leaks" | "overspray" | "runoff" | "lowHeads" | "tiltedHeads", label: string) => (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-[12.5px] text-slate-700">{label}</span>
      <span className="flex items-center gap-1.5">
        <button onClick={() => set({ [k]: Math.max(0, a[k] - 1) } as Partial<AuditReport>)} className="h-7 w-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">−</button>
        <span className="tabular w-6 text-center text-[14px] font-semibold">{a[k]}</span>
        <button onClick={() => set({ [k]: a[k] + 1 } as Partial<AuditReport>)} className="h-7 w-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">+</button>
      </span>
    </div>
  );
  return (
    <Page>
      <PageHeader
        back={{ href: "/audits", label: "Audits" }}
        title={<span className="flex items-center gap-2">Irrigation audit — {p?.address.street} <Badge tone={a.status === "complete" ? "green" : "amber"} dot>{a.status}</Badge></span>}
        subtitle={<span className="flex flex-wrap gap-x-3"><Link href={`/customers/${c?.id}`} className="font-medium text-slate-700 hover:text-brand-700">{customerName(c)}</Link><span>{date(a.date)}</span><span>Auditor: {fullName(data.employees.find((e) => e.id === a.technicianId))}</span></span>}
        actions={
          <>
            <Button onClick={() => saveFile(auditPdf(a, r, p, c, zones, st.settings), pdfName(`Irrigation audit ${p?.address.street ?? ""} ${a.date}`))}><Printer size={14} /> Download PDF report</Button>
            <Button
              onClick={() => {
                const e = st.createEstimate({ customerId: p!.customerId, propertyId: p!.id, title: `Audit repairs — ${p!.address.street}`, serviceType: "sprinkler_repair", options: [{ id: `opt_${Date.now()}`, name: "Recommended repairs", description: "From irrigation audit " + date(a.date), items: r.repairs.filter((x) => x.estCost).map((x) => customLine("other", x.text, 1, x.estCost!, x.estCost! * 0.45, "ea", false)) }] });
                router.push(`/estimates/${e.id}`);
              }}
            >
              <FileText size={14} /> Estimate from findings
            </Button>
            {a.status === "draft" && <Button variant="primary" onClick={() => { set({ status: "complete" }); update("systems", a.systemId, { lastAuditDate: a.date }); st.log({ type: "audit", message: `Audit completed — score ${r.overall} (${r.grade})`, entityType: "audit", entityId: id, customerId: p?.customerId }); }}><CheckCircle2 size={14} /> Complete audit</Button>}
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "measure", label: "Measurements" }, { id: "zones", label: "Zone findings", count: zones.length }, { id: "results", label: "Results & recommendations" }]} />
          {tab === "measure" && (
            <>
              <Card title="Pressure & flow" icon={<Gauge size={14} />}>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {num_("staticPsi", "Static PSI", "psi")}
                  {num_("dynamicPsi", "Dynamic PSI", "psi")}
                  {num_("flowGpm", "Flow rate", "gpm", 0.5)}
                  {num_("precipRate", "Precip. rate", "in/h", 0.05)}
                  <Field label="Distribution uniformity"><NumberInput value={a.distributionUniformity !== undefined ? Math.round(a.distributionUniformity * 100) : undefined} allowEmpty onChange={(v) => set({ distributionUniformity: Number.isNaN(v) ? undefined : v / 100 })} suffix="%" min={0} max={100} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <Check label="Head spacing OK (head-to-head)" checked={a.headSpacingOk} onChange={(v) => set({ headSpacingOk: v })} />
                  <Check label="Nozzles matched within zones" checked={a.nozzleMatch} onChange={(v) => set({ nozzleMatch: v })} />
                </div>
              </Card>
              <Card title="Field counts">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {counter("brokenHeads", "Broken heads")}
                  {counter("leaks", "Leaks")}
                  {counter("overspray", "Overspray locations")}
                  {counter("runoff", "Runoff locations")}
                  {counter("lowHeads", "Low / sunken heads")}
                  {counter("tiltedHeads", "Tilted heads")}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Field label="Pressure problems"><Input value={a.pressureProblems} onChange={(e) => set({ pressureProblems: e.target.value })} placeholder="Misting on slope zones…" /></Field>
                  <Field label="Valve issues"><Input value={a.valveIssues} onChange={(e) => set({ valveIssues: e.target.value })} placeholder="Zone 11 valve not closing fully" /></Field>
                </div>
              </Card>
              <Card title="Controller & site">
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Controller settings"><Input value={a.controllerSettings} onChange={(e) => set({ controllerSettings: e.target.value })} /></Field>
                  <Field label="Watering schedule"><Input value={a.wateringSchedule} onChange={(e) => set({ wateringSchedule: e.target.value })} placeholder="M/W/F 4:00 AM" /></Field>
                  {num_("minutesPerWeek", "Runtime per week", "min")}
                  {num_("irrigatedSqft", "Irrigated area", "sq ft", 100)}
                  <Field label="Soil type"><Select value={a.soilType} onChange={(e) => set({ soilType: e.target.value as AuditReport["soilType"] })} options={["sand", "sandy_loam", "loam", "clay_loam", "clay"].map((v) => ({ value: v, label: v.replace("_", " ") }))} /></Field>
                  <Field label="Sun exposure"><Select value={a.sunExposure} onChange={(e) => set({ sunExposure: e.target.value as AuditReport["sunExposure"] })} options={["full", "partial", "shade"].map((v) => ({ value: v, label: v }))} /></Field>
                  {num_("slopePct", "Slope", "%")}
                  <Field label="Plant type"><Input value={a.plantType} onChange={(e) => set({ plantType: e.target.value })} /></Field>
                </div>
                <Field label="Notes" className="mt-2"><Textarea value={a.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
              </Card>
            </>
          )}
          {tab === "zones" && (
            <Card pad={false} title="Zone-by-zone findings" sub="tap issues per zone — also updates the zone's condition record">
              <div className="divide-y divide-slate-100">
                {zones.map((z) => {
                  const f = a.zoneFindings.find((x) => x.zoneId === z.id) ?? { zoneId: z.id, issues: [] as ZoneStatus[], note: "" };
                  const setF = (nf: typeof f) => set({ zoneFindings: [...a.zoneFindings.filter((x) => x.zoneId !== z.id), nf] });
                  return (
                    <div key={z.id} className="px-4 py-3">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <div><span className="font-semibold text-slate-900">Zone {z.number} — {z.name}</span> <span className="text-[12px] text-slate-500">{z.sprinklerType} · {z.manufacturer} {z.model}</span></div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Precip</span><NumberInput value={f.precipRate} allowEmpty step={0.05} onChange={(v) => setF({ ...f, precipRate: Number.isNaN(v) ? undefined : v })} className="w-20" inputClassName="h-7" />
                          <span className="text-[11px] text-slate-500">DU %</span><NumberInput value={f.du !== undefined ? Math.round(f.du * 100) : undefined} allowEmpty onChange={(v) => setF({ ...f, du: Number.isNaN(v) ? undefined : v / 100 })} className="w-16" inputClassName="h-7" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ZONE_STATUSES.filter((s) => s.id !== "working").map((s) => (
                          <button key={s.id} onClick={() => { const issues = f.issues.includes(s.id) ? f.issues.filter((x) => x !== s.id) : [...f.issues, s.id]; setF({ ...f, issues }); update("zones", z.id, { statuses: issues.length ? issues : ["working"] }); }} className={cn("rounded-full border px-2 py-0.5 text-[11.5px]", f.issues.includes(s.id) ? "border-amber-400 bg-amber-50 font-medium text-amber-800" : "border-slate-200 text-slate-500 hover:border-slate-300")}>{s.label}</button>
                        ))}
                      </div>
                      <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Zone note" className="mt-1.5 h-7 text-[12px]" />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {tab === "results" && <Results r={r} />}
        </div>
        <div className="space-y-3">
          <Card title="Scores">
            <div className="flex justify-around">
              <ScoreRing value={r.overall} label="Overall system" />
              <ScoreRing value={r.efficiency} label="Water efficiency" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2"><Badge tone={gradeTone(r.grade)} className="px-2 py-0.5 text-[13px]">Grade {r.grade}</Badge></div>
          </Card>
          <Card title="Estimated water savings" icon={<Droplets size={14} />}>
            <div className="tabular text-[24px] font-semibold text-slate-900">{r.savingsPct}%</div>
            <div className="text-[12.5px] text-slate-600">{r.savingsGallonsYr ? `≈ ${num(r.savingsGallonsYr)} gallons per year` : "Enter precip rate, runtime and irrigated area to estimate gallons."}</div>
          </Card>
          <Card title="Top priorities">
            <ol className="space-y-1.5">
              {[...r.repairs, ...r.upgrades].filter((x) => x.priority === 1).slice(0, 5).map((x, i) => <li key={i} className="flex gap-2 text-[12.5px]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10.5px] font-semibold text-red-700">{i + 1}</span>{x.text}</li>)}
              {![...r.repairs, ...r.upgrades].some((x) => x.priority === 1) && <li className="text-[12.5px] text-slate-500">No urgent items.</li>}
            </ol>
          </Card>
          <Card title="Current zone conditions" pad={false}><ZoneMiniTable zones={zones.slice(0, 6)} /></Card>
        </div>
      </div>
    </Page>
  );
}

function Results({ r }: { r: AuditResult }) {
  return (
    <div className="space-y-3">
      <Card title="Repair recommendations" icon={<Wrench size={14} />}>
        <PriorityList items={r.repairs.map((x) => ({ text: x.text, priority: x.priority, right: x.estCost ? money0(x.estCost) : undefined }))} empty="No repairs needed." />
      </Card>
      <Card title="Upgrade recommendations" icon={<Lightbulb size={14} />}>
        <PriorityList items={r.upgrades.map((x) => ({ text: x.text, priority: x.priority, right: `~${x.savingsPct}% water` }))} empty="No upgrades recommended." />
      </Card>
    </div>
  );
}

function PriorityList({ items, empty }: { items: { text: string; priority: 1 | 2 | 3; right?: string }[]; empty: string }) {
  if (!items.length) return <p className="text-[12.5px] text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((x, i) => (
        <li key={i} className="flex items-center gap-3 py-2">
          <Badge tone={x.priority === 1 ? "red" : x.priority === 2 ? "amber" : "slate"}>P{x.priority}</Badge>
          <span className="flex-1 text-[13px] text-slate-800">{x.text}</span>
          {x.right && <span className="tabular text-[12px] text-slate-500">{x.right}</span>}
        </li>
      ))}
    </ul>
  );
}


/* ───────── Irrigation systems overview ───────── */

export function SystemsPage() {
  const data = useCrm((s) => s.data);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"systems" | "zones" | "controllers">("systems");
  const prop = byId(data.properties);
  const cust = byId(data.customers);
  const sysById = byId(data.systems);
  const zonesBySys = useMemo(() => {
    const m = new Map<string, typeof data.zones>();
    for (const z of data.zones) m.set(z.systemId, [...(m.get(z.systemId) ?? []), z]);
    return m;
  }, [data.zones]);
  const t = q.toLowerCase();
  const issueZones = data.zones.filter((z) => z.statuses.some((s) => s !== "working"));
  const smart = data.controllers.filter((c) => c.smart).length;
  const statusCounts = Object.fromEntries(ZONE_STATUSES.map((s) => [s.id, data.zones.filter((z) => z.statuses.includes(s.id)).length]));
  return (
    <Page>
      <PageHeader title="Irrigation systems" subtitle="Zone-level records for every property: valves, heads, nozzles, pipe, controllers and condition" actions={<Link href="/projects" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50">Design Studio</Link>} />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Systems" value={data.systems.length} />
        <StatTile label="Zones documented" value={data.zones.length} />
        <StatTile label="Zones with issues" value={issueZones.length} tone={issueZones.length ? "warn" : "default"} />
        <StatTile label="Smart controllers" value={`${Math.round((smart / Math.max(1, data.controllers.length)) * 100)}%`} sub={`${smart} of ${data.controllers.length}`} />
        <StatTile label="Mapped systems" value={new Set(data.components.map((c) => c.systemId)).size} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ZONE_STATUSES.filter((s) => s.id !== "working" && statusCounts[s.id]).map((s) => <Badge key={s.id} tone={s.tone}>{s.label}: {statusCounts[s.id]}</Badge>)}
      </div>
      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ id: "systems", label: "Systems" }, { id: "zones", label: "Zones needing attention", count: issueZones.length }, { id: "controllers", label: "Controllers" }]} />
      <Card pad={false}>
        <div className="border-b border-slate-100 p-3"><SearchBox value={q} onChange={setQ} placeholder='Address, model ("Rain Bird 5000", "PGV")…' className="w-full sm:w-80" /></div>
        {tab === "systems" && (
          <DataTable
            rows={data.systems.filter((s) => { const p = prop.get(s.propertyId); const zs = zonesBySys.get(s.id) ?? []; return !t || `${p?.address.street} ${p?.address.city} ${zs.map((z) => `${z.manufacturer} ${z.model} ${z.valveType}`).join(" ")}`.toLowerCase().includes(t); })}
            onRowClick={(s) => router.push(`/properties/${s.propertyId}?tab=system`)}
            columns={[
              { key: "p", header: "Property", mobile: true, cell: (s) => <div><div className="font-medium text-slate-900">{prop.get(s.propertyId)?.address.street}</div><div className="text-[11.5px] text-slate-500">{customerName(cust.get(prop.get(s.propertyId)?.customerId ?? ""))}</div></div> },
              { key: "z", header: "Zones", align: "right", mobile: true, sort: (s) => (zonesBySys.get(s.id) ?? []).length, cell: (s) => (zonesBySys.get(s.id) ?? []).length },
              { key: "h", header: "Heads", align: "right", hideBelow: "md", cell: (s) => (zonesBySys.get(s.id) ?? []).reduce((x, z) => x + z.headCount, 0) },
              { key: "e", header: "Primary equipment", hideBelow: "lg", cell: (s) => { const zs = zonesBySys.get(s.id) ?? []; const top = [...new Set(zs.map((z) => `${z.manufacturer} ${z.model}`))].slice(0, 2).join(", "); return <span className="text-slate-600">{top}</span>; } },
              { key: "i", header: "Issues", cell: (s) => { const n = (zonesBySys.get(s.id) ?? []).filter((z) => z.statuses.some((x) => x !== "working")).length; return n ? <Badge tone="amber">{n}</Badge> : <span className="text-slate-400">—</span>; } },
              { key: "a", header: "Last audit", hideBelow: "md", sort: (s) => s.lastAuditDate ?? "", cell: (s) => (s.lastAuditDate ? date(s.lastAuditDate) : "—") },
              { key: "y", header: "Age", align: "right", sort: (s) => s.installedYear ?? 9999, cell: (s) => (s.installedYear ? `${new Date().getFullYear() - s.installedYear}y` : "—") },
            ]}
          />
        )}
        {tab === "zones" && (
          <DataTable
            rows={issueZones.filter((z) => !t || `${z.name} ${z.manufacturer} ${z.model} ${prop.get(sysById.get(z.systemId)?.propertyId ?? "")?.address.street}`.toLowerCase().includes(t))}
            onRowClick={(z) => router.push(`/properties/${sysById.get(z.systemId)?.propertyId}?tab=system`)}
            columns={[
              { key: "p", header: "Property", mobile: true, cell: (z) => <span className="font-medium">{prop.get(sysById.get(z.systemId)?.propertyId ?? "")?.address.street}</span> },
              { key: "z", header: "Zone", mobile: true, cell: (z) => `${z.number}. ${z.name}` },
              { key: "s", header: "Condition", mobile: true, cell: (z) => <ZoneStatusBadges statuses={z.statuses} /> },
              { key: "pr", header: "Problems", hideBelow: "md", cell: (z) => <span className="text-slate-600">{z.problems || "—"}</span> },
              { key: "e", header: "Equipment", hideBelow: "lg", cell: (z) => `${z.manufacturer} ${z.model}` },
            ]}
          />
        )}
        {tab === "controllers" && (
          <DataTable
            rows={data.controllers.filter((c) => !t || `${c.manufacturer} ${c.model} ${prop.get(sysById.get(c.systemId)?.propertyId ?? "")?.address.street}`.toLowerCase().includes(t))}
            onRowClick={(c) => router.push(`/properties/${sysById.get(c.systemId)?.propertyId}?tab=system`)}
            columns={[
              { key: "m", header: "Controller", mobile: true, sort: (c) => `${c.manufacturer} ${c.model}`, cell: (c) => <span className="flex items-center gap-1.5 font-medium">{c.manufacturer} {c.model}{c.smart && <Badge tone="green">Smart</Badge>}</span> },
              { key: "p", header: "Property", mobile: true, cell: (c) => prop.get(sysById.get(c.systemId)?.propertyId ?? "")?.address.street },
              { key: "s", header: "Stations", align: "right", cell: (c) => c.stations },
              { key: "y", header: "Installed", sort: (c) => c.installedDate ?? "", cell: (c) => (c.installedDate ? <span className={cn(new Date().getFullYear() - Number(c.installedDate.slice(0, 4)) >= 12 && "font-medium text-amber-700")}>{c.installedDate.slice(0, 4)}</span> : "—") },
              { key: "l", header: "Location", hideBelow: "md", cell: (c) => <span className="text-slate-600">{c.location}</span> },
            ]}
          />
        )}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500"><AlertTriangle size={12} /> Tip: global search (⌘K) finds every property using a specific model, e.g. “Rain Bird 5000”.</p>
    </Page>
  );
}

"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, KeyRound, Dog, Droplets, Gauge, Cpu, Pencil, Navigation, FileText, Wrench, ClipboardCheck, PencilRuler, ShieldCheck, Trash2 } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Controller, Property, Zone, ZoneArea, ZoneStatus, WaterSource, BackflowType } from "@/lib/crm/types";
import { ZONE_AREAS, ZONE_STATUSES, ESTIMATE_STATUSES } from "@/lib/crm/constants";
import { addressFull, addressLine, customerName, date, mapsUrl, money, relative } from "@/lib/crm/format";
import { auditScore, estimateTotal, warrantyStatus } from "@/lib/crm/calc";
import { uid } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Tabs, Button, Badge, KV, SearchBox, Select, SlideOver, Field, Input, Textarea, Check, cn, useQuery, setQueryParam, StatusBadge, Empty } from "../ui";
import { DataTable } from "../DataTable";
import { Timeline, Recommendations } from "../widgets";
import { PhotoGallery, PhotoUploadButton } from "../Photos";
import { SystemMap } from "../SystemMap";
import { useQuickCreate } from "../QuickCreate";
import { JobRows, ZoneStatusBadges } from "./Customers";
import { DocumentsList, DocumentUpload } from "./Documents";
import { ask } from "@/components/AskHost";

export function PropertiesPage() {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(q.get("filter") ?? "");
  const cust = byId(data.customers);
  const rows = useMemo(() => {
    const sysByProp = new Map(data.systems.map((s) => [s.propertyId, s]));
    const zonesBySys = new Map<string, Zone[]>();
    for (const z of data.zones) zonesBySys.set(z.systemId, [...(zonesBySys.get(z.systemId) ?? []), z]);
    const ctrlBySys = new Map(data.controllers.map((c) => [c.systemId, c]));
    const t = search.toLowerCase();
    return data.properties
      .map((p) => {
        const sys = sysByProp.get(p.id);
        const zs = sys ? (zonesBySys.get(sys.id) ?? []) : [];
        return { ...p, zones: zs.length, issues: zs.filter((z) => z.statuses.some((s) => s !== "working")).length, ctrl: sys ? ctrlBySys.get(sys.id) : undefined, owner: customerName(cust.get(p.customerId)) };
      })
      .filter((p) => {
        if (t && !`${p.address.street} ${p.address.city} ${p.address.zip} ${p.owner} ${p.name} ${p.gateCode}`.toLowerCase().includes(t)) return false;
        if (filter === "issues" && !p.issues) return false;
        if (filter === "old" && !(p.systemInstalledYear && new Date().getFullYear() - p.systemInstalledYear >= 20)) return false;
        if (filter === "nosmart" && p.ctrl?.smart) return false;
        if (filter === "backflow_due" && !(p.backflow.type !== "none" && p.backflow.lastTestDate && now - new Date(p.backflow.lastTestDate).getTime() > 335 * 86400000)) return false;
        if (filter === "highpsi" && !((p.staticPsi ?? 0) > 80)) return false;
        return true;
      });
  }, [data, search, filter, cust, now]);
  return (
    <Page>
      <PageHeader title="Properties" subtitle={`${data.properties.length} properties · ${data.zones.length} zones documented`} actions={<Button variant="primary" onClick={() => openQuick("property")}><Plus size={15} /> New property</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Address, owner, gate code…" className="w-full sm:w-72" />
          <Select value={filter} onChange={(e) => { setFilter(e.target.value); setQueryParam("filter", e.target.value); }} options={[{ value: "", label: "All properties" }, { value: "issues", label: "Zones with open issues" }, { value: "old", label: "Systems 20+ years old" }, { value: "nosmart", label: "No smart controller" }, { value: "highpsi", label: "Static pressure > 80 psi" }, { value: "backflow_due", label: "Backflow test due" }]} className="w-56" />
          <span className="ml-auto text-[12px] text-slate-500">{rows.length} shown</span>
        </div>
        <DataTable
          rows={rows}
          onRowClick={(p) => router.push(`/properties/${p.id}`)}
          initialSort={{ key: "addr", dir: "asc" }}
          columns={[
            { key: "addr", header: "Address", mobile: true, sort: (p) => p.address.street, cell: (p) => <div><div className="font-medium text-slate-900">{p.address.street}</div><div className="text-[11.5px] text-slate-500">{p.address.city}{p.name !== "Home" ? ` · ${p.name}` : ""}</div></div> },
            { key: "issues", header: "Issues", mobile: true, align: "right", sort: (p) => p.issues, cell: (p) => (p.issues ? <Badge tone="amber">{p.issues} zones</Badge> : <span className="text-slate-400">—</span>) },
            { key: "owner", header: "Owner", mobile: true, sort: (p) => p.owner, cell: (p) => <span className="text-slate-700">{p.owner}</span> },
            { key: "zones", header: "Zones", align: "right", sort: (p) => p.zones, cell: (p) => p.zones },
            { key: "ctrl", header: "Controller", hideBelow: "lg", cell: (p) => (p.ctrl ? <span className="flex items-center gap-1.5 text-slate-600">{p.ctrl.manufacturer} {p.ctrl.model}{p.ctrl.smart && <Badge tone="green">Smart</Badge>}</span> : "—") },
            { key: "psi", header: "Static PSI", align: "right", hideBelow: "md", sort: (p) => p.staticPsi ?? 0, cell: (p) => <span className={cn((p.staticPsi ?? 0) > 80 && "font-medium text-amber-700")}>{p.staticPsi ?? "—"}</span> },
            { key: "age", header: "System age", align: "right", hideBelow: "md", sort: (p) => p.systemInstalledYear ?? 9999, cell: (p) => (p.systemInstalledYear ? `${new Date().getFullYear() - p.systemInstalledYear} yrs` : "—") },
            { key: "gate", header: "Gate", hideBelow: "xl", cell: (p) => p.gateCode || "—" },
          ]}
        />
      </Card>
    </Page>
  );
}

export function PropertyDetail({ id }: { id: string }) {
  const { data, now, update } = useCrm();
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const tab = q.get("tab") ?? "overview";
  const [editing, setEditing] = useState(false);
  const p = data.properties.find((x) => x.id === id);
  if (!p) return <Page><Empty title="Property not found" /></Page>;
  const c = data.customers.find((x) => x.id === p.customerId);
  const sys = data.systems.find((s) => s.propertyId === id);
  const zones = data.zones.filter((z) => z.systemId === sys?.id).sort((a, b) => a.number - b.number);
  const ctrl = data.controllers.find((x) => x.systemId === sys?.id);
  const jobs = data.jobs.filter((j) => j.propertyId === id).sort((a, b) => (b.scheduledStart ?? b.createdAt).localeCompare(a.scheduledStart ?? a.createdAt));
  const estimates = data.estimates.filter((e) => e.propertyId === id);
  const audits = data.audits.filter((a) => a.propertyId === id).sort((a, b) => b.date.localeCompare(a.date));
  const photos = data.photos.filter((ph) => ph.propertyId === id);
  const docs = data.documents.filter((d) => d.entityType === "property" && d.entityId === id);
  const warranties = data.warranties.filter((w) => w.propertyId === id);
  const age = p.systemInstalledYear ? new Date().getFullYear() - p.systemInstalledYear : undefined;
  const repairs = jobs.filter((j) => j.completedAt);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "system", label: "Irrigation system", count: zones.length },
    { id: "map", label: "System map" },
    { id: "jobs", label: "Jobs & repairs", count: jobs.length },
    { id: "estimates", label: "Estimates", count: estimates.length },
    { id: "audits", label: "Audits", count: audits.length },
    { id: "photos", label: "Photos", count: photos.length },
    { id: "documents", label: "Documents", count: docs.length },
    { id: "warranty", label: "Warranties", count: warranties.length },
    { id: "activity", label: "Activity" },
  ];
  return (
    <Page wide={tab === "map"}>
      <PageHeader
        back={{ href: c ? `/customers/${c.id}` : "/properties", label: customerName(c) }}
        title={p.address.street}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3">
            <span>{p.address.city}, {p.address.state} {p.address.zip}</span>
            {p.name !== "Home" && <span>{p.name}</span>}
            {age !== undefined && <span>System age {age} yrs</span>}
            <span>{zones.length} zones</span>
          </span>
        }
        actions={
          <>
            <a href={mapsUrl(p.address)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><Navigation size={13} /> Directions</a>
            <Button onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
            <Button onClick={() => openQuick("audit", { customerId: p.customerId, propertyId: id })}><ClipboardCheck size={14} /> Audit</Button>
            <Button variant="primary" onClick={() => openQuick("estimate", { customerId: p.customerId, propertyId: id })}><FileText size={14} /> Estimate</Button>
            <Button variant="primary" onClick={() => openQuick("job", { customerId: p.customerId, propertyId: id })}><Wrench size={14} /> Job</Button>
          </>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={(t) => setQueryParam("tab", t === "overview" ? null : t)} className="mb-4" />

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Access" icon={<KeyRound size={14} />}>
                <KV cols={2} items={[["Gate code", p.gateCode ? <span className="font-mono font-semibold">{p.gateCode}</span> : "—"], ["Pets", p.pets ? <span className="flex items-center gap-1"><Dog size={13} className="text-amber-600" />{p.pets}</span> : "None noted"], ["Access instructions", p.accessNotes], ["Lot size", p.lotSizeSqft ? `${p.lotSizeSqft.toLocaleString()} sq ft` : "—"]]} />
                {p.lotNotes && <p className="mt-2 text-[12.5px] text-slate-600">{p.lotNotes}</p>}
              </Card>
              <Card title="Water supply" icon={<Gauge size={14} />}>
                <KV cols={2} items={[["Water source", p.waterSource], ["Meter size", p.meterSize], ["Static PSI", p.staticPsi !== undefined ? <span className={cn((p.staticPsi ?? 0) > 80 && "font-semibold text-amber-700")}>{p.staticPsi} psi</span> : "—"], ["Dynamic PSI", p.dynamicPsi !== undefined ? `${p.dynamicPsi} psi` : "—"], ["Available flow", p.availableGpm ? `${p.availableGpm} GPM` : "—"], ["Service line", p.serviceLineSize], ["Main line", `${p.mainLineSize} ${p.mainLineMaterial}`]]} />
              </Card>
              <Card title="Backflow" icon={<ShieldCheck size={14} />}>
                <KV cols={2} items={[["Type", p.backflow.type.toUpperCase()], ["Make / size", `${p.backflow.make} ${p.backflow.size}`], ["Location", p.backflow.location], ["Serial", p.backflow.serial], ["Last test", p.backflow.lastTestDate ? <span className={cn(now - new Date(p.backflow.lastTestDate).getTime() > 365 * 86400000 && "font-medium text-red-600")}>{date(p.backflow.lastTestDate)}</span> : "Not recorded"]]} />
              </Card>
              <Card title="Controller & valves" icon={<Cpu size={14} />}>
                <KV cols={2} items={[["Controller", ctrl ? `${ctrl.manufacturer} ${ctrl.model}` : "—"], ["Stations", ctrl?.stations], ["Controller location", p.controllerLocation], ["Smart / Wi-Fi", ctrl ? (ctrl.smart ? "Yes" : "No") : "—"], ["Valve locations", p.valveLocations]]} />
              </Card>
            </div>
            <Card title="Landscape" icon={<Droplets size={14} />}>
              <p className="text-[13px] text-slate-700">{p.landscapeNotes || "—"}</p>
            </Card>
            <Card title="Zones at a glance" pad={false} actions={<Link href={`/properties/${id}?tab=system`} className="text-[12px] text-brand-700 hover:underline">Edit zones</Link>}>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
                {zones.map((z) => (
                  <div key={z.id} className="flex items-center justify-between gap-2 border-slate-100 px-4 py-2 sm:border-b">
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium text-slate-900">{z.number}. {z.name}</div>
                      <div className="truncate text-[11.5px] text-slate-500">{z.sprinklerType} · {z.manufacturer} {z.model}</div>
                    </div>
                    <ZoneStatusBadges statuses={z.statuses} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-3">
            <Card title="Recommended upgrades">
              {p.recommendedUpgrades.length ? (
                <ul className="space-y-1.5">
                  {p.recommendedUpgrades.map((u, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px]">
                      {u}
                      <button onClick={() => update("properties", id, { recommendedUpgrades: p.recommendedUpgrades.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-600" aria-label="Remove"><Trash2 size={12} /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-500">None recorded.</p>
              )}
              <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("u") as string; if (v) update("properties", id, { recommendedUpgrades: [...p.recommendedUpgrades, v] }); e.currentTarget.reset(); }}>
                <Input name="u" placeholder="Add upgrade…" className="h-7 text-[12px]" />
                <Button size="sm" type="submit">Add</Button>
              </form>
            </Card>
            <Card title="Suggestions"><Recommendations propertyId={id} limit={5} /></Card>
            <Card title="Previous repairs" pad={false}>
              <div className="divide-y divide-slate-100">
                {repairs.slice(0, 6).map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="block px-4 py-2 hover:bg-slate-50">
                    <div className="truncate text-[12.5px] text-slate-900">{j.title}</div>
                    <div className="text-[11.5px] text-slate-500">#{j.number} · {date(j.completedAt)}</div>
                  </Link>
                ))}
                {!repairs.length && <p className="px-4 py-4 text-[12.5px] text-slate-500">No completed work yet.</p>}
              </div>
            </Card>
            {p.designProjectId && (
              <Card title="Engineering plan">
                <Link href={`/design/${p.designProjectId}`} className="flex items-center gap-2 text-[13px] font-medium text-brand-700 hover:underline"><PencilRuler size={14} /> Open in Design Studio</Link>
                <p className="mt-1 text-[12px] text-slate-500">Hydraulics, coverage, material takeoff and installer plan set.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "system" && sys && <SystemEditor systemId={sys.id} property={p} />}
      {tab === "map" && sys && (
        <div>
          <SystemMap system={sys} property={p} height={680} />
          {!p.designProjectId && <DesignLink property={p} />}
        </div>
      )}
      {tab === "jobs" && <Card pad={false}><JobRows jobs={jobs} /></Card>}
      {tab === "estimates" && (
        <Card pad={false}>
          <DataTable rows={estimates} onRowClick={(e) => router.push(`/estimates/${e.id}`)} initialSort={{ key: "d", dir: "desc" }} empty={<Empty title="No estimates" />} columns={[{ key: "n", header: "Estimate", mobile: true, cell: (e) => <span className="font-medium">#{e.number} {e.title}</span> }, { key: "s", header: "Status", mobile: true, cell: (e) => <StatusBadge list={ESTIMATE_STATUSES} value={e.status} /> }, { key: "t", header: "Total", align: "right", cell: (e) => money(estimateTotal(e)) }, { key: "d", header: "Created", sort: (e) => e.createdAt, cell: (e) => date(e.createdAt) }]} />
        </Card>
      )}
      {tab === "audits" && (
        <Card pad={false} title="Audit reports" actions={<Button size="sm" onClick={() => openQuick("audit", { customerId: p.customerId, propertyId: id })}><Plus size={13} /> New audit</Button>}>
          <DataTable rows={audits} onRowClick={(a) => router.push(`/audits/${a.id}`)} empty={<Empty title="No audits yet" />} columns={[{ key: "d", header: "Date", mobile: true, cell: (a) => <span className="font-medium">{date(a.date)}</span> }, { key: "s", header: "Score", mobile: true, cell: (a) => { const r = auditScore(a); return <span><b>{r.overall}</b> ({r.grade}) · efficiency {r.efficiency}</span>; } }, { key: "st", header: "Status", cell: (a) => <Badge tone={a.status === "complete" ? "green" : "amber"}>{a.status}</Badge> }]} />
        </Card>
      )}
      {tab === "photos" && <Card><PhotoGallery photos={photos} upload={<PhotoUploadButton entityType="property" entityId={id} propertyId={id} customerId={p.customerId} />} /></Card>}
      {tab === "documents" && <Card title="Documents" pad={false} actions={<DocumentUpload entityType="property" entityId={id} customerId={p.customerId} />}><DocumentsList docs={docs} /></Card>}
      {tab === "warranty" && <WarrantyTable warranties={warranties} />}
      {tab === "activity" && <Card><Timeline entries={data.activity.filter((a) => a.entityId === id || jobs.some((j) => j.id === a.jobId))} limit={60} /></Card>}

      {editing && <EditProperty p={p} onClose={() => setEditing(false)} />}
    </Page>
  );
}

function DesignLink({ property }: { property: Property }) {
  const { update, data } = useCrm();
  const router = useRouter();
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3">
      <div className="text-[12.5px] text-slate-600">
        <b className="text-slate-800">Need a full engineering design?</b> Design Studio adds head-to-head layout, hydraulics, coverage analysis, material takeoff and installer-ready PDF plan sets.
      </div>
      <Button
        size="sm"
        onClick={async () => {
          const { createProject } = await import("@/lib/model/factory");
          const { persistProject } = await import("@/lib/storage/seed");
          const c = data.customers.find((x) => x.id === property.customerId);
          const proj = createProject({ name: `${customerName(c)} — ${property.address.street}`, client: customerName(c), address: addressFull(property.address), status: "design", projectType: "renovation" });
          await persistProject(proj);
          update("properties", property.id, { designProjectId: proj.id });
          router.push(`/design/${proj.id}`);
        }}
      >
        <PencilRuler size={13} /> Start design
      </Button>
    </div>
  );
}

export function WarrantyTable({ warranties }: { warranties: import("@/lib/crm/types").Warranty[] }) {
  const now = useCrm((s) => s.now);
  return (
    <Card pad={false}>
      <DataTable
        rows={warranties}
        initialSort={{ key: "i", dir: "desc" }}
        empty={<Empty icon={<ShieldCheck size={18} />} title="No warranties tracked" />}
        columns={[
          { key: "item", header: "Item", mobile: true, cell: (w) => <div><div className="font-medium text-slate-900">{w.item}</div><div className="text-[11.5px] text-slate-500">{w.manufacturer}</div></div> },
          { key: "st", header: "Status", mobile: true, cell: (w) => { const s = warrantyStatus(w, now); return s.active ? <Badge tone={s.expiringSoon ? "amber" : "green"} dot>{s.expiringSoon ? "Expiring soon" : "Active"}</Badge> : <Badge>Expired</Badge>; } },
          { key: "i", header: "Installed", sort: (w) => w.installedDate, cell: (w) => date(w.installedDate) },
          { key: "l", header: "Labor warranty", cell: (w) => { const s = warrantyStatus(w, now); return <span className={cn(!s.laborActive && "text-slate-400")}>{w.laborMonths} mo · until {date(s.laborExpires)}</span>; } },
          { key: "m", header: "Manufacturer", cell: (w) => { const s = warrantyStatus(w, now); return w.manufacturerMonths ? <span className={cn(!s.mfrActive && "text-slate-400")}>{w.manufacturerMonths / 12} yr · until {date(s.mfrExpires)}</span> : "—"; } },
          { key: "j", header: "Job", hideBelow: "md", cell: (w) => (w.jobId ? <Link href={`/jobs/${w.jobId}`} className="text-brand-700 hover:underline">View job</Link> : "—") },
        ]}
      />
    </Card>
  );
}

/* ───────── system editor: controller + zones ───────── */

function SystemEditor({ systemId, property }: { systemId: string; property: Property }) {
  const { data, update, insert, remove } = useCrm();
  const sys = data.systems.find((s) => s.id === systemId)!;
  const zones = data.zones.filter((z) => z.systemId === systemId).sort((a, b) => a.number - b.number);
  const ctrl = data.controllers.find((c) => c.systemId === systemId);
  const [zoneOpen, setZoneOpen] = useState<string | null>(null);
  const totalHeads = zones.reduce((s, z) => s + z.headCount, 0);
  const maxGpm = Math.max(0, ...zones.map((z) => z.flowGpm ?? 0));
  const addZone = () => {
    const n = (zones[zones.length - 1]?.number ?? 0) + 1;
    const z: Zone = { id: uid("zon"), systemId, number: n, name: `Zone ${n}`, area: "lawn", valveType: "Hunter PGV-101G", valveSize: '1"', valveLocation: property.valveLocations, pipeSize: '3/4"', pipeMaterial: "PVC SCH 40", sprinklerType: "Spray", nozzleType: "", headCount: 0, manufacturer: "", model: "", dripEmitterType: "", dripLineType: "", controllerStation: n, statuses: ["working"], problems: "", notes: "" };
    insert("zones", z);
    setZoneOpen(z.id);
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="System" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Installed year"><Input type="number" value={sys.installedYear ?? property.systemInstalledYear ?? ""} onChange={(e) => (update("systems", systemId, { installedYear: Number(e.target.value) || undefined }), update("properties", property.id, { systemInstalledYear: Number(e.target.value) || undefined }))} /></Field>
            <Field label="Installed by"><Input value={sys.installedBy ?? ""} onChange={(e) => update("systems", systemId, { installedBy: e.target.value })} /></Field>
            <Field label="Last audit"><Input type="date" value={sys.lastAuditDate ?? ""} onChange={(e) => update("systems", systemId, { lastAuditDate: e.target.value || undefined })} /></Field>
            <Field label="Totals"><div className="pt-1.5 text-[12.5px] text-slate-700">{zones.length} zones · {totalHeads} heads · max {maxGpm.toFixed(1)} GPM</div></Field>
          </div>
          <Field label="Notes" className="mt-2"><Textarea value={sys.notes} onChange={(e) => update("systems", systemId, { notes: e.target.value })} /></Field>
        </Card>
        <Card title="Controller" className="lg:col-span-2">
          {ctrl ? (
            <ControllerForm c={ctrl} />
          ) : (
            <Button onClick={() => insert("controllers", { id: uid("ctl"), systemId, manufacturer: "Hunter", model: "Pro-HC 12", stations: Math.max(6, zones.length), location: property.controllerLocation, smart: true, wifi: true, rainSensor: false, notes: "" } satisfies Controller)}><Plus size={13} /> Add controller</Button>
          )}
        </Card>
      </div>
      <Card title="Zones" sub="click a zone to edit every field, flag problems and attach photos" pad={false} actions={<Button size="sm" variant="primary" onClick={addZone}><Plus size={13} /> Add zone</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-2 font-medium">Zone</th>
                <th className="px-2 font-medium">Heads / emitters</th>
                <th className="px-2 font-medium">Nozzle</th>
                <th className="px-2 font-medium">Valve</th>
                <th className="px-2 font-medium">Pipe</th>
                <th className="px-2 text-right font-medium">GPM</th>
                <th className="px-2 text-right font-medium">PSI</th>
                <th className="px-2 text-right font-medium">Stn</th>
                <th className="px-4 font-medium">Condition</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} onClick={() => setZoneOpen(z.id)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-semibold text-slate-900">{z.number}</td>
                  <td className="px-2"><div className="font-medium text-slate-900">{z.name}</div><div className="text-[11.5px] text-slate-500">{ZONE_AREAS.find((a) => a.id === z.area)?.label}{z.lastRepairDate ? ` · repaired ${date(z.lastRepairDate)}` : ""}</div></td>
                  <td className="px-2 text-slate-700">{z.sprinklerType === "Drip" ? z.dripLineType || z.dripEmitterType : `${z.headCount} × ${z.manufacturer} ${z.model}`}{z.headSpacingFt ? <span className="text-slate-400"> @ {z.headSpacingFt}′</span> : null}</td>
                  <td className="px-2 text-slate-600">{z.nozzleType || "—"}</td>
                  <td className="px-2 text-slate-600">{z.valveType} {z.valveSize}</td>
                  <td className="px-2 text-slate-600">{z.pipeSize} {z.pipeMaterial}</td>
                  <td className="tabular px-2 text-right">{z.flowGpm ?? "—"}</td>
                  <td className="tabular px-2 text-right">{z.operatingPsi ?? "—"}</td>
                  <td className="tabular px-2 text-right">{z.controllerStation ?? "—"}</td>
                  <td className="px-4"><ZoneStatusBadges statuses={z.statuses} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!zones.length && <Empty title="No zones recorded" action={<Button size="sm" onClick={addZone}><Plus size={13} /> Add first zone</Button>}>Document each zone&apos;s valve, heads, nozzles, pipe and condition.</Empty>}
        </div>
      </Card>
      {zoneOpen && <ZoneEditor zone={zones.find((z) => z.id === zoneOpen)!} property={property} onClose={() => setZoneOpen(null)} onDelete={async () => { if (await ask.confirm("Delete this zone record?", true)) { remove("zones", zoneOpen); setZoneOpen(null); } }} />}
    </div>
  );
}

function ControllerForm({ c }: { c: Controller }) {
  const update = useCrm((s) => s.update);
  const set = (p: Partial<Controller>) => update("controllers", c.id, p);
  const age = c.installedDate ? new Date().getFullYear() - Number(c.installedDate.slice(0, 4)) : undefined;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Field label="Manufacturer"><Input value={c.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
      <Field label="Model"><Input value={c.model} onChange={(e) => set({ model: e.target.value })} /></Field>
      <Field label="Stations"><Input type="number" value={c.stations} onChange={(e) => set({ stations: Number(e.target.value) })} /></Field>
      <Field label="Installed" hint={age !== undefined ? `${age} years old` : undefined}><Input type="date" value={c.installedDate ?? ""} onChange={(e) => set({ installedDate: e.target.value || undefined })} /></Field>
      <Field label="Location" className="col-span-2"><Input value={c.location} onChange={(e) => set({ location: e.target.value })} /></Field>
      <div className="col-span-2 flex flex-wrap items-end gap-4 pb-1.5">
        <Check label="Smart / ET" checked={c.smart} onChange={(v) => set({ smart: v })} />
        <Check label="Wi-Fi" checked={c.wifi} onChange={(v) => set({ wifi: v })} />
        <Check label="Rain sensor" checked={c.rainSensor} onChange={(v) => set({ rainSensor: v })} />
      </div>
      <Field label="Notes" className="col-span-2 md:col-span-4"><Input value={c.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Program notes, Wi-Fi network, flow sensor…" /></Field>
    </div>
  );
}

function ZoneEditor({ zone, property, onClose, onDelete }: { zone: Zone; property: Property; onClose: () => void; onDelete: () => void }) {
  const { update, data } = useCrm();
  const set = (p: Partial<Zone>) => update("zones", zone.id, p);
  const toggle = (s: ZoneStatus) => {
    let next = zone.statuses.includes(s) ? zone.statuses.filter((x) => x !== s) : [...zone.statuses.filter((x) => s === "working" ? false : x !== "working"), s];
    if (!next.length) next = ["working"];
    set({ statuses: next });
  };
  const photos = data.photos.filter((p) => p.entityType === "zone" && p.entityId === zone.id);
  const drip = zone.area === "drip" || zone.area === "trees" || zone.sprinklerType === "Drip";
  return (
    <SlideOver open onClose={onClose} width={620} title={`Zone ${zone.number} — ${zone.name}`} subtitle={property.address.street} footer={<><Button variant="danger" onClick={onDelete}><Trash2 size={13} /></Button><span className="flex-1" /><Button variant="primary" onClick={onClose}>Done</Button></>}>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Condition (tap all that apply)</div>
          <div className="flex flex-wrap gap-1.5">
            {ZONE_STATUSES.map((s) => (
              <button key={s.id} onClick={() => toggle(s.id)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors", zone.statuses.includes(s.id) ? (s.id === "working" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : ["leaking", "broken"].includes(s.id) ? "border-red-400 bg-red-50 text-red-700" : "border-amber-400 bg-amber-50 text-amber-800") : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Zone #"><Input type="number" value={zone.number} onChange={(e) => set({ number: Number(e.target.value) })} /></Field>
          <Field label="Name" className="col-span-1 sm:col-span-2"><Input value={zone.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Area"><Select value={zone.area} onChange={(e) => set({ area: e.target.value as ZoneArea })} options={ZONE_AREAS.map((a) => ({ value: a.id, label: a.label }))} /></Field>
        </div>
        <SectionLabel>Valve</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Valve type" className="col-span-2"><Input value={zone.valveType} onChange={(e) => set({ valveType: e.target.value })} list="valve-models" /></Field>
          <Field label="Size"><Input value={zone.valveSize} onChange={(e) => set({ valveSize: e.target.value })} /></Field>
          <Field label="Controller station"><Input type="number" value={zone.controllerStation ?? ""} onChange={(e) => set({ controllerStation: Number(e.target.value) || undefined })} /></Field>
          <Field label="Valve location" className="col-span-2 sm:col-span-4"><Input value={zone.valveLocation} onChange={(e) => set({ valveLocation: e.target.value })} /></Field>
        </div>
        <SectionLabel>Pipe & hydraulics</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Pipe size"><Input value={zone.pipeSize} onChange={(e) => set({ pipeSize: e.target.value })} /></Field>
          <Field label="Pipe material"><Input value={zone.pipeMaterial} onChange={(e) => set({ pipeMaterial: e.target.value })} /></Field>
          <Field label="Flow (GPM)"><Input type="number" step={0.1} value={zone.flowGpm ?? ""} onChange={(e) => set({ flowGpm: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Operating PSI"><Input type="number" value={zone.operatingPsi ?? ""} onChange={(e) => set({ operatingPsi: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        </div>
        <SectionLabel>{drip ? "Drip" : "Sprinklers"}</SectionLabel>
        {drip ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Drip line type"><Input value={zone.dripLineType} onChange={(e) => set({ dripLineType: e.target.value })} /></Field>
            <Field label="Emitter type"><Input value={zone.dripEmitterType} onChange={(e) => set({ dripEmitterType: e.target.value })} /></Field>
            <Field label="Manufacturer"><Input value={zone.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
            <Field label="Model"><Input value={zone.model} onChange={(e) => set({ model: e.target.value })} /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Sprinkler type"><Select value={zone.sprinklerType} onChange={(e) => set({ sprinklerType: e.target.value })} options={["Rotor", "Spray", "MP Rotator", "Bubbler", "Drip", "Impact"].map((v) => ({ value: v, label: v }))} /></Field>
            <Field label="Manufacturer"><Input value={zone.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
            <Field label="Model"><Input value={zone.model} onChange={(e) => set({ model: e.target.value })} list="head-models" /></Field>
            <Field label="Nozzle"><Input value={zone.nozzleType} onChange={(e) => set({ nozzleType: e.target.value })} /></Field>
            <Field label="Head count"><Input type="number" value={zone.headCount} onChange={(e) => set({ headCount: Number(e.target.value) })} /></Field>
            <Field label="Head spacing (ft)"><Input type="number" value={zone.headSpacingFt ?? ""} onChange={(e) => set({ headSpacingFt: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Installed"><Input type="date" value={zone.installedDate ?? ""} onChange={(e) => set({ installedDate: e.target.value || undefined })} /></Field>
          <Field label="Last repair"><Input type="date" value={zone.lastRepairDate ?? ""} onChange={(e) => set({ lastRepairDate: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Problems"><Textarea value={zone.problems} onChange={(e) => set({ problems: e.target.value })} placeholder="What's wrong with this zone?" /></Field>
        <Field label="Notes"><Textarea value={zone.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <div>
          <div className="mb-2 flex items-center justify-between"><SectionLabel>Photos</SectionLabel><PhotoUploadButton entityType="zone" entityId={zone.id} propertyId={property.id} customerId={property.customerId} category="problem" label="Add" /></div>
          {photos.length > 0 && <PhotoGallery photos={photos} columns="grid-cols-3" />}
        </div>
      </div>
      <datalist id="valve-models">{["Hunter PGV-101G", "Hunter PGV-100JT-G", "Hunter ICV-101G", "Rain Bird 100-DV", "Rain Bird 100-DVF", "Rain Bird 100-PESB", "Rain Bird XCZ-100-PRB-COM", "Irritrol 2400", "Orbit Anti-Siphon"].map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="head-models">{["PGP Ultra", "I-20", "5000 Plus PC", "3504", "1804", "1806", "1812", "Pro-Spray PRS40", "MP2000 on PRS40", "MP1000", "MP3000"].map((v) => <option key={v} value={v} />)}</datalist>
    </SlideOver>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-slate-100 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>;
}

function EditProperty({ p, onClose }: { p: Property; onClose: () => void }) {
  const update = useCrm((s) => s.update);
  const [f, setF] = useState(p);
  return (
    <SlideOver open onClose={onClose} width={620} title="Edit property" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { update("properties", p.id, f); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Lot size (sq ft)"><Input type="number" value={f.lotSizeSqft ?? ""} onChange={(e) => setF({ ...f, lotSizeSqft: Number(e.target.value) || undefined })} /></Field>
          <Field label="Street" className="col-span-2"><Input value={f.address.street} onChange={(e) => setF({ ...f, address: { ...f.address, street: e.target.value } })} /></Field>
          <Field label="City"><Input value={f.address.city} onChange={(e) => setF({ ...f, address: { ...f.address, city: e.target.value } })} /></Field>
          <Field label="ZIP"><Input value={f.address.zip} onChange={(e) => setF({ ...f, address: { ...f.address, zip: e.target.value } })} /></Field>
          <Field label="Gate code"><Input value={f.gateCode} onChange={(e) => setF({ ...f, gateCode: e.target.value })} /></Field>
          <Field label="Pets"><Input value={f.pets} onChange={(e) => setF({ ...f, pets: e.target.value })} /></Field>
          <Field label="Access instructions" className="col-span-2"><Input value={f.accessNotes} onChange={(e) => setF({ ...f, accessNotes: e.target.value })} /></Field>
          <Field label="Parcel / lot notes" className="col-span-2"><Input value={f.lotNotes} onChange={(e) => setF({ ...f, lotNotes: e.target.value })} /></Field>
          <Field label="Landscape notes" className="col-span-2"><Textarea value={f.landscapeNotes} onChange={(e) => setF({ ...f, landscapeNotes: e.target.value })} /></Field>
        </div>
        <SectionLabel>Water supply</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Source"><Select value={f.waterSource} onChange={(e) => setF({ ...f, waterSource: e.target.value as WaterSource })} options={["municipal", "well", "reclaimed", "pump", "other"].map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="Meter size"><Input value={f.meterSize} onChange={(e) => setF({ ...f, meterSize: e.target.value })} /></Field>
          <Field label="Static PSI"><Input type="number" value={f.staticPsi ?? ""} onChange={(e) => setF({ ...f, staticPsi: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Dynamic PSI"><Input type="number" value={f.dynamicPsi ?? ""} onChange={(e) => setF({ ...f, dynamicPsi: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Available GPM"><Input type="number" value={f.availableGpm ?? ""} onChange={(e) => setF({ ...f, availableGpm: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Service line"><Input value={f.serviceLineSize} onChange={(e) => setF({ ...f, serviceLineSize: e.target.value })} /></Field>
          <Field label="Main line size"><Input value={f.mainLineSize} onChange={(e) => setF({ ...f, mainLineSize: e.target.value })} /></Field>
          <Field label="Main material"><Input value={f.mainLineMaterial} onChange={(e) => setF({ ...f, mainLineMaterial: e.target.value })} /></Field>
        </div>
        <SectionLabel>Backflow</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Type"><Select value={f.backflow.type} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, type: e.target.value as BackflowType } })} options={["none", "pvb", "rp", "dcva", "avb"].map((v) => ({ value: v, label: v.toUpperCase() }))} /></Field>
          <Field label="Make"><Input value={f.backflow.make} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, make: e.target.value } })} /></Field>
          <Field label="Size"><Input value={f.backflow.size} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, size: e.target.value } })} /></Field>
          <Field label="Location"><Input value={f.backflow.location} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, location: e.target.value } })} /></Field>
          <Field label="Serial"><Input value={f.backflow.serial} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, serial: e.target.value } })} /></Field>
          <Field label="Last test"><Input type="date" value={f.backflow.lastTestDate ?? ""} onChange={(e) => setF({ ...f, backflow: { ...f.backflow, lastTestDate: e.target.value || undefined } })} /></Field>
        </div>
        <SectionLabel>Controller & valves</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Controller location"><Input value={f.controllerLocation} onChange={(e) => setF({ ...f, controllerLocation: e.target.value })} /></Field>
          <Field label="System installed (year)"><Input type="number" value={f.systemInstalledYear ?? ""} onChange={(e) => setF({ ...f, systemInstalledYear: Number(e.target.value) || undefined })} /></Field>
          <Field label="Valve locations" className="col-span-2"><Textarea value={f.valveLocations} onChange={(e) => setF({ ...f, valveLocations: e.target.value })} /></Field>
        </div>
      </div>
    </SlideOver>
  );
}


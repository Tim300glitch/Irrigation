"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, Circle, Wand2, PencilRuler, FileText, Wrench, Trash2, Download, ShieldCheck } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { InstallProject, InstallStage, LineItem, ZoneArea } from "@/lib/crm/types";
import { INSTALL_STAGES, ZONE_AREAS, JOB_STATUSES, ESTIMATE_STATUSES } from "@/lib/crm/constants";
import { addressFull, customerName, date, money, money0, relative } from "@/lib/crm/format";
import { estimateTotal, lineTotals, priceFromRule, warrantyStatus } from "@/lib/crm/calc";
import { generateTakeoff, customLine, uid } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Button, Badge, Field, Input, Select, Textarea, Modal, cn, Empty, StatusBadge, NumberInput, Check, Progress, KV } from "../ui";
import { LineItemsEditor } from "../LineItems";
import { CustomerPicker, PropertyPicker } from "../pickers";
import { downloadText, toCsv } from "../DataTable";
import { toast } from "@/lib/crm/toast";

const stageIdx = (s: InstallStage) => INSTALL_STAGES.findIndex((x) => x.id === s);

export function InstallsPage() {
  const { data, now } = useCrm();
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const groups = [...new Set(INSTALL_STAGES.map((s) => s.group))];
  return (
    <Page wide>
      <PageHeader title="New install projects" subtitle="Full-system installs from site visit to warranty" actions={<Button variant="primary" onClick={() => setNewOpen(true)}><Plus size={15} /> New install project</Button>} />
      <div className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-3 sm:-mx-5 sm:px-5">
        {groups.map((g) => {
          const list = data.installs.filter((i) => INSTALL_STAGES.find((s) => s.id === i.stage)?.group === g);
          return (
            <div key={g} className="w-[290px] shrink-0 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between px-3 py-2.5"><span className="text-[12.5px] font-semibold text-slate-700">{g}</span><Badge>{list.length}</Badge></div>
              <div className="space-y-2 px-2 pb-2">
                {list.map((i) => {
                  const est = data.estimates.find((e) => e.id === i.estimateId);
                  const pct = (stageIdx(i.stage) + 1) / INSTALL_STAGES.length;
                  return (
                    <button key={i.id} onClick={() => router.push(`/installs/${i.id}`)} className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-slate-300">
                      <div className="text-[13px] font-semibold text-slate-900">{customerName(cust.get(i.customerId))}</div>
                      <div className="truncate text-[12px] text-slate-500">{prop.get(i.propertyId)?.address.street} · {i.design.zones.length} zones</div>
                      <div className="mt-2 flex items-center justify-between text-[11.5px]"><Badge tone="brand">{INSTALL_STAGES.find((s) => s.id === i.stage)?.label}</Badge><span className="tabular font-medium">{est ? money0(estimateTotal(est)) : money0(lineTotals(i.takeoff).subtotal)}</span></div>
                      <Progress value={pct} className="mt-2" />
                      <div className="mt-1 text-[11px] text-slate-400">updated {relative(Object.values(i.stageDates).sort().pop() ?? i.createdAt, now)}</div>
                    </button>
                  );
                })}
                {!list.length && <div className="rounded-lg border border-dashed border-slate-300 py-5 text-center text-[12px] text-slate-400">—</div>}
              </div>
            </div>
          );
        })}
      </div>
      {newOpen && <NewInstall onClose={() => setNewOpen(false)} />}
    </Page>
  );
}

function NewInstall({ onClose }: { onClose: () => void }) {
  const st = useCrm();
  const router = useRouter();
  const [customerId, setC] = useState<string>();
  const [propertyId, setP] = useState<string>();
  return (
    <Modal open onClose={onClose} title="New install project" width={520} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!propertyId} onClick={() => { const p = st.data.properties.find((x) => x.id === propertyId)!; const i: InstallProject = { id: uid("ins"), name: `${customerName(st.data.customers.find((x) => x.id === customerId))} — new irrigation system`, customerId: customerId!, propertyId: propertyId!, stage: "site_visit", stageDates: { lead: new Date().toISOString() }, design: { availableGpm: p.availableGpm, staticPsi: p.staticPsi, dynamicPsi: p.dynamicPsi, meterSize: p.meterSize, serviceLineSize: p.serviceLineSize, mainLineSize: p.mainLineSize || '1"', pipeSize: '3/4"', valveSize: '1"', zones: [{ id: uid("dz"), name: "Front lawn", area: "lawn", heads: 8 }, { id: uid("dz"), name: "Back lawn", area: "lawn", heads: 10 }, { id: uid("dz"), name: "Beds — drip", area: "drip", heads: 0, lateralFt: 150 }] }, takeoff: [], permitRequired: false, permitNumber: "", notes: "", createdAt: new Date().toISOString() }; st.insert("installs", i); st.log({ type: "job", message: "Install project created", entityType: "install", entityId: i.id, customerId }); onClose(); router.push(`/installs/${i.id}`); }}>Create</Button></>}>
      <div className="space-y-3">
        <Field label="Customer"><CustomerPicker value={customerId} onChange={setC} autoFocus /></Field>
        <Field label="Property"><PropertyPicker customerId={customerId} value={propertyId} onChange={setP} /></Field>
      </div>
    </Modal>
  );
}

export function InstallDetail({ id }: { id: string }) {
  const st = useCrm();
  const { data, now } = st;
  const router = useRouter();
  const i = data.installs.find((x) => x.id === id);
  if (!i) return <Page><Empty title="Install project not found" /></Page>;
  const c = data.customers.find((x) => x.id === i.customerId);
  const p = data.properties.find((x) => x.id === i.propertyId);
  const est = data.estimates.find((e) => e.id === i.estimateId);
  const job = data.jobs.find((j) => j.id === i.jobId);
  const set = (patch: Partial<InstallProject>) => st.update("installs", id, patch);
  const d = i.design;
  const setD = (patch: Partial<InstallProject["design"]>) => set({ design: { ...d, ...patch } });
  const cur = stageIdx(i.stage);
  const t = lineTotals(i.takeoff);
  const totalHeads = d.zones.reduce((s, z) => s + z.heads, 0);
  const totalGpm = Math.max(0, ...d.zones.map((z) => z.flowGpm ?? 0));
  const maxZone = d.availableGpm ? d.availableGpm * 0.75 : undefined;
  const warranties = data.warranties.filter((w) => w.jobId && w.jobId === i.jobId);
  const advance = (s: InstallStage) => {
    const stamp = new Date().toISOString();
    const dates = { ...i.stageDates };
    INSTALL_STAGES.slice(0, stageIdx(s)).forEach((x) => (dates[x.id] = dates[x.id] ?? stamp));
    set({ stage: s, stageDates: dates });
    st.log({ type: "status", message: `Install stage → ${INSTALL_STAGES.find((x) => x.id === s)?.label}`, entityType: "install", entityId: id, customerId: i.customerId });
  };
  const importDesign = async () => {
    if (!p?.designProjectId) return;
    const { repo } = await import("@/lib/storage/repository");
    const { analyzeProject } = await import("@/lib/analysis");
    const { defaultMaterialProducts } = await import("@/lib/materials/pricing");
    const proj = await repo.getProject(p.designProjectId);
    if (!proj) return toast("Design project not found", "error");
    const a = analyzeProject(proj, defaultMaterialProducts());
    const rule = st.settings.defaultPricing;
    const lines: LineItem[] = a.estimate.lines.filter((l) => l.quantity > 0).map((l) => {
      const match = data.items.find((it) => it.name.toLowerCase().includes(l.item.toLowerCase()) || l.item.toLowerCase().includes(it.name.toLowerCase()));
      const cost = l.unitCost || match?.cost || 0;
      return { id: uid("li"), itemId: match?.id, kind: "material", name: l.item, description: l.description, qty: Math.ceil(l.orderQty || l.quantity), unit: l.unit, unitCost: cost, unitPrice: match ? priceFromRule(match.cost, match.pricing) : priceFromRule(cost, rule), taxable: true };
    });
    const labor = data.items.find((x) => x.id === "lab_install");
    if (labor) lines.push({ id: uid("li"), itemId: labor.id, kind: "labor", name: labor.name, description: "From design quantities", qty: Math.ceil(a.estimate.laborHours), unit: "hr", unitCost: labor.cost, unitPrice: priceFromRule(labor.cost, labor.pricing), taxable: false });
    const zones = proj.zones.map((z) => {
      const hz = a.hyd.zones.find((x) => x.zoneId === z.id);
      return { id: uid("dz"), name: z.name, area: (z.plantType.includes("turf") ? "lawn" : "beds") as ZoneArea, heads: hz?.headCount ?? proj.sprinklers.filter((s) => s.zoneId === z.id).length, flowGpm: hz ? +hz.gpm.toFixed(1) : undefined };
    });
    set({ takeoff: lines, design: { ...d, zones: zones.length ? zones : d.zones, mainLineFt: Math.round(a.totals.mainline), controllerStations: proj.zones.length } });
    toast(`Imported ${lines.length} takeoff lines from the engineering plan`, "success");
  };
  return (
    <Page wide>
      <PageHeader
        back={{ href: "/installs", label: "Install projects" }}
        title={i.name}
        subtitle={<span className="flex flex-wrap gap-x-3"><Link href={`/customers/${c?.id}`} className="font-medium text-slate-700 hover:text-brand-700">{customerName(c)}</Link><Link href={`/properties/${p?.id}`} className="hover:text-brand-700">{addressFull(p?.address)}</Link><span>Created {date(i.createdAt)}</span></span>}
        actions={
          <>
            {p?.designProjectId ? <Link href={`/design/${p.designProjectId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><PencilRuler size={14} /> Design Studio plan</Link> : <Link href={`/properties/${p?.id}?tab=map`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><PencilRuler size={14} /> Start design</Link>}
            {est ? <Button onClick={() => router.push(`/estimates/${est.id}`)}><FileText size={14} /> Estimate #{est.number}</Button> : <Button variant="primary" disabled={!i.takeoff.length} onClick={() => { const e = st.createEstimate({ customerId: i.customerId, propertyId: i.propertyId, title: "New irrigation system", serviceType: "new_install", installId: id, depositPct: st.settings.defaultDepositPct, options: [{ id: uid("opt"), name: "Complete system", description: `${d.zones.length} zones · ${totalHeads} heads · ${d.controllerStations ?? d.zones.length}-station smart controller`, tier: "better", items: i.takeoff.map((l) => ({ ...l, id: uid("li") })) }] }); set({ estimateId: e.id }); advance("estimate"); router.push(`/estimates/${e.id}`); }}><FileText size={14} /> Create estimate from takeoff</Button>}
            {job && <Button variant="primary" onClick={() => router.push(`/jobs/${job.id}`)}><Wrench size={14} /> Job #{job.number}</Button>}
          </>
        }
      />
      <Card pad={false} className="mb-3">
        <div className="no-scrollbar flex gap-0 overflow-x-auto p-2">
          {INSTALL_STAGES.map((s, k) => {
            const doneS = k < cur;
            const active = k === cur;
            return (
              <button key={s.id} onClick={() => advance(s.id)} className={cn("group flex min-w-[96px] flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center", active && "bg-brand-50")} title={i.stageDates[s.id] ? date(i.stageDates[s.id]) : "Click to move here"}>
                <span className="flex w-full items-center">
                  <span className={cn("h-0.5 flex-1", k === 0 ? "bg-transparent" : doneS || active ? "bg-brand-400" : "bg-slate-200")} />
                  {doneS ? <CheckCircle2 size={18} className="shrink-0 text-brand-600" /> : active ? <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{k + 1}</span> : <Circle size={18} className="shrink-0 text-slate-300 group-hover:text-slate-400" />}
                  <span className={cn("h-0.5 flex-1", k === INSTALL_STAGES.length - 1 ? "bg-transparent" : doneS ? "bg-brand-400" : "bg-slate-200")} />
                </span>
                <span className={cn("text-[11px] leading-tight", active ? "font-semibold text-brand-700" : doneS ? "text-slate-700" : "text-slate-400")}>{s.label}</span>
                {i.stageDates[s.id] && <span className="text-[10px] text-slate-400">{date(i.stageDates[s.id])}</span>}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-3">
          <Card title="System design data" sub="measured at the site visit / flow & pressure test">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
              <Field label="Available GPM"><NumberInput value={d.availableGpm} allowEmpty onChange={(v) => setD({ availableGpm: Number.isNaN(v) ? undefined : v })} step={0.5} suffix="gpm" /></Field>
              <Field label="Static PSI"><NumberInput value={d.staticPsi} allowEmpty onChange={(v) => setD({ staticPsi: Number.isNaN(v) ? undefined : v })} suffix="psi" /></Field>
              <Field label="Dynamic PSI"><NumberInput value={d.dynamicPsi} allowEmpty onChange={(v) => setD({ dynamicPsi: Number.isNaN(v) ? undefined : v })} suffix="psi" /></Field>
              <Field label="Meter size"><Input value={d.meterSize} onChange={(e) => setD({ meterSize: e.target.value })} /></Field>
              <Field label="Service line"><Input value={d.serviceLineSize} onChange={(e) => setD({ serviceLineSize: e.target.value })} /></Field>
              <Field label="Main line size"><Input value={d.mainLineSize} onChange={(e) => setD({ mainLineSize: e.target.value })} /></Field>
              <Field label="Lateral pipe size"><Input value={d.pipeSize} onChange={(e) => setD({ pipeSize: e.target.value })} /></Field>
              <Field label="Valve size"><Input value={d.valveSize} onChange={(e) => setD({ valveSize: e.target.value })} /></Field>
              <Field label="Controller stations"><NumberInput value={d.controllerStations} allowEmpty onChange={(v) => setD({ controllerStations: Number.isNaN(v) ? undefined : v })} /></Field>
              <Field label="Main line length"><NumberInput value={d.mainLineFt} allowEmpty onChange={(v) => setD({ mainLineFt: Number.isNaN(v) ? undefined : v })} suffix="ft" step={10} /></Field>
            </div>
          </Card>
          <Card title="Zones" sub={`${d.zones.length} zones · ${totalHeads} heads${maxZone ? ` · max ${maxZone.toFixed(1)} GPM per zone (75% of available)` : ""}`} pad={false} actions={<Button size="sm" onClick={() => setD({ zones: [...d.zones, { id: uid("dz"), name: `Zone ${d.zones.length + 1}`, area: "lawn", heads: 6 }] })}><Plus size={13} /> Add zone</Button>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead><tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500"><th className="px-4 py-2 font-medium">#</th><th className="px-2 font-medium">Name</th><th className="px-2 font-medium">Area</th><th className="px-2 text-right font-medium">Heads</th><th className="px-2 text-right font-medium">Zone GPM</th><th className="px-2 text-right font-medium">Zone PSI</th><th className="px-2 text-right font-medium">Lateral ft</th><th className="w-8" /></tr></thead>
                <tbody>
                  {d.zones.map((z, k) => {
                    const upd = (patch: Partial<typeof z>) => setD({ zones: d.zones.map((x) => (x.id === z.id ? { ...x, ...patch } : x)) });
                    const over = maxZone && z.flowGpm && z.flowGpm > maxZone;
                    return (
                      <tr key={z.id} className="border-b border-slate-50">
                        <td className="px-4 py-1.5 font-semibold">{k + 1}</td>
                        <td className="px-2"><Input value={z.name} onChange={(e) => upd({ name: e.target.value })} className="h-7" /></td>
                        <td className="px-2"><Select value={z.area} onChange={(e) => upd({ area: e.target.value as ZoneArea })} options={ZONE_AREAS.map((a) => ({ value: a.id, label: a.label }))} className="h-7" /></td>
                        <td className="px-2"><NumberInput value={z.heads} onChange={(v) => upd({ heads: v })} inputClassName="h-7 text-right" className="ml-auto w-20" /></td>
                        <td className="px-2"><NumberInput value={z.flowGpm} allowEmpty onChange={(v) => upd({ flowGpm: Number.isNaN(v) ? undefined : v })} inputClassName={cn("h-7 text-right", over && "border-red-400 text-red-600")} className="ml-auto w-20" step={0.5} /></td>
                        <td className="px-2"><NumberInput value={z.psi} allowEmpty onChange={(v) => upd({ psi: Number.isNaN(v) ? undefined : v })} inputClassName="h-7 text-right" className="ml-auto w-20" /></td>
                        <td className="px-2"><NumberInput value={z.lateralFt} allowEmpty onChange={(v) => upd({ lateralFt: Number.isNaN(v) ? undefined : v })} inputClassName="h-7 text-right" className="ml-auto w-20" step={10} /></td>
                        <td className="px-2"><button onClick={() => setD({ zones: d.zones.filter((x) => x.id !== z.id) })} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalGpm > 0 && maxZone && totalGpm > maxZone && <p className="px-4 py-2 text-[12px] text-red-600">One or more zones exceed the safe flow for this water supply — split the zone or reduce heads.</p>}
          </Card>
          <Card
            title="Material takeoff"
            sub={`${i.takeoff.length} lines · material cost ${money0(t.materialCost)} · total cost ${money0(t.cost)}`}
            actions={
              <>
                {p?.designProjectId && <Button size="sm" onClick={importDesign}><PencilRuler size={13} /> Import from design</Button>}
                <Button size="sm" variant="primary" onClick={() => { set({ takeoff: generateTakeoff(d, data.items) }); toast("Takeoff generated from design data", "success"); }}><Wand2 size={13} /> Generate</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadText("material-takeoff.csv", toCsv(i.takeoff, [{ header: "Item", value: (l) => l.name }, { header: "Qty", value: (l) => l.qty }, { header: "Unit", value: (l) => l.unit }, { header: "Unit cost", value: (l) => l.unitCost }, { header: "Extended cost", value: (l) => (l.qty * l.unitCost).toFixed(2) }]))}><Download size={13} /></Button>
              </>
            }
          >
            <LineItemsEditor items={i.takeoff} onChange={(takeoff) => set({ takeoff })} />
            {i.takeoff.length > 0 && <div className="mt-3 flex flex-wrap justify-end gap-6 border-t border-slate-100 pt-3 text-[12.5px]"><span>Material cost <b className="tabular">{money(t.materialCost)}</b></span><span>Labor cost <b className="tabular">{money(t.laborCost)}</b></span><span>Selling price <b className="tabular">{money(t.subtotal)}</b></span><span>Margin <b className="tabular">{t.subtotal ? Math.round((1 - t.cost / t.subtotal) * 100) : 0}%</b></span></div>}
          </Card>
        </div>
        <div className="space-y-3">
          <Card title="Project">
            <KV cols={2} items={[["Stage", INSTALL_STAGES[cur]?.label], ["Progress", `${cur + 1} / ${INSTALL_STAGES.length}`], ["Estimate", est ? <span key="e" className="flex items-center gap-1.5">#{est.number}<StatusBadge list={ESTIMATE_STATUSES} value={est.status} /></span> : "—"], ["Job", job ? <span key="j" className="flex items-center gap-1.5">#{job.number}<StatusBadge list={JOB_STATUSES} value={job.status} /></span> : "—"], ["Value", est ? money0(estimateTotal(est)) : money0(t.subtotal)], ["Install date", job?.scheduledStart ? date(job.scheduledStart) : "—"]]} />
            {cur < INSTALL_STAGES.length - 1 && <Button variant="primary" className="mt-3 w-full" onClick={() => advance(INSTALL_STAGES[cur + 1].id)}>Mark “{INSTALL_STAGES[cur].label}” done → {INSTALL_STAGES[cur + 1].label}</Button>}
          </Card>
          <Card title="Permit">
            <Check label="Permit required" checked={i.permitRequired} onChange={(v) => set({ permitRequired: v })} />
            {i.permitRequired && <Field label="Permit #" className="mt-2"><Input value={i.permitNumber} onChange={(e) => set({ permitNumber: e.target.value })} /></Field>}
          </Card>
          <Card title="Warranty" icon={<ShieldCheck size={14} />}>
            {warranties.length ? warranties.map((w) => { const s = warrantyStatus(w, now); return <div key={w.id} className="mb-2 text-[12.5px]"><div className="font-medium">{w.item}</div><div className="text-slate-500">Labor until {date(s.laborExpires)}{s.mfrExpires ? ` · manufacturer until ${date(s.mfrExpires)}` : ""}</div></div>; }) : <p className="text-[12.5px] text-slate-500">Warranties start automatically when the install job is completed.</p>}
          </Card>
          <Card title="Notes"><Textarea rows={5} value={i.notes} onChange={(e) => set({ notes: e.target.value })} /></Card>
        </div>
      </div>
    </Page>
  );
}

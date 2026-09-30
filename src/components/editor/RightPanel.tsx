"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, AlertOctagon, Lightbulb, ChevronUp, ChevronDown, Trash2, Plus, Crosshair, Spline, Wand2, CheckCircle2, Circle, Sparkles, ArrowRight, Boxes } from "lucide-react";
import { useEditorStore, type RightTab } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { PropertiesPanel } from "./PropertiesPanel";
import { Badge, Button, cn, Select, Stat, TextInput } from "../ui";
import { formatArea, formatCurrency0, pipeSizeLabel } from "@/lib/units/units";
import type { Project } from "@/lib/model/types";
import { actions } from "./actions";
import { ZONE_COLORS } from "@/lib/irrigation/autoZone";
import { compareLateralStyles, type StyleComparison } from "@/lib/irrigation/autoDesign";
import type { DesignWarning } from "@/lib/irrigation/designCheck";
import { uid } from "@/lib/model/factory";
import { HEAD_NAMES } from "@/lib/plan/symbols";
import type { LateralStyle } from "@/lib/irrigation/autoRoute";
import { PLANT_KC } from "@/lib/irrigation/schedule";

export function RightPanel() {
  const tab = useEditorStore((s) => s.rightTab);
  const set = useEditorStore((s) => s.set);
  const analysis = useAnalysis();
  const errs = analysis?.warnings.filter((w) => w.severity === "error").length ?? 0;
  const warns = analysis?.warnings.filter((w) => w.severity === "warning").length ?? 0;
  const tabs: { id: RightTab; label: string; badge?: React.ReactNode }[] = [
    { id: "properties", label: "Properties" },
    { id: "zones", label: "Zones" },
    { id: "checks", label: "Checks", badge: errs + warns > 0 ? <span className={cn("ml-1 rounded px-1 text-[10px] font-semibold", errs ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>{errs + warns}</span> : null },
    { id: "assistant", label: "Assistant" },
  ];
  return (
    <aside className="flex h-full w-[330px] shrink-0 flex-col border-l border-slate-200 bg-white" aria-label="Properties and engineering">
      <Totals />
      <div className="flex shrink-0 border-b border-slate-200 px-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => set({ rightTab: t.id })} className={cn("flex items-center border-b-2 px-2.5 py-2 text-[12.5px] font-medium", tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900")}>
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "properties" && <PropertiesPanel />}
        {tab === "zones" && <ZonesPanel />}
        {tab === "checks" && <ChecksPanel />}
        {tab === "assistant" && <AssistantPanel />}
      </div>
    </aside>
  );
}

function Totals() {
  const analysis = useAnalysis();
  const project = useProjectStore((s) => s.project)!;
  const t = analysis?.totals;
  const customer = project.estimate.customerMode;
  return (
    <div className="grid shrink-0 grid-cols-4 gap-x-2 gap-y-1.5 border-b border-slate-200 bg-slate-50/70 px-3 py-2" aria-label="Design information">
      <Stat label="Lawn" value={t ? formatArea(t.lawnArea).replace(" sq ft", "") : "—"} sub="sq ft" />
      <Stat label="Irrigated" value={t ? formatArea(t.irrigatedArea).replace(" sq ft", "") : "—"} sub="sq ft" />
      <Stat label="Heads" value={t?.heads ?? "—"} sub={`${t?.zones ?? 0} zones`} />
      <Stat label="Max zone" value={t ? t.maxZoneGpm.toFixed(1) : "—"} sub="GPM" />
      <Stat label="Pipe" value={t ? `${Math.round(t.totalPipe)}'` : "—"} sub={t ? `ML ${Math.round(t.mainline)}'` : ""} />
      <Stat label="Valves" value={t?.valves ?? "—"} />
      <Stat label="Materials" value={analysis ? formatCurrency0(analysis.estimate.materialSubtotal + analysis.estimate.waste) : "—"} />
      <Stat label={customer ? "Proposal" : "Project"} value={analysis ? formatCurrency0(analysis.estimate.total) : "—"} />
    </div>
  );
}

function ZonesPanel() {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const activeZone = useEditorStore((s) => s.activeZoneId);
  const set = useEditorStore((s) => s.set);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const [open, setOpen] = useState<string | null>(null);
  const zones = [...project.zones].sort((a, b) => a.number - b.number);
  const renumber = (d: Project) => {
    d.zones.sort((a, b) => a.number - b.number).forEach((z, i) => {
      z.number = i + 1;
      z.name = z.name.replace(/^Zone \d+/, `Zone ${i + 1}`);
    });
  };
  const selValves = project.valves.filter((v) => selection.includes(v.id));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2">
        <Button size="sm" variant="primary" onClick={actions.autoZone}>
          <Wand2 size={13} /> Auto zone
        </Button>
        <Button size="sm" onClick={() => actions.autoRoute("auto")}>
          <Spline size={13} /> Auto route
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            apply((d) => {
              const n = Math.max(0, ...d.zones.map((z) => z.number)) + 1;
              d.zones.push({ id: uid("z"), number: n, name: `Zone ${n}`, color: ZONE_COLORS[(n - 1) % ZONE_COLORS.length], plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0, schedule: { daysPerWeek: 3 } });
            })
          }
        >
          <Plus size={13} /> Zone
        </Button>
      </div>
      {!zones.length && <div className="px-4 py-8 text-center text-[12px] text-slate-500">No zones yet. Place sprinklers, then use <b>Auto zone</b> — or place valves manually (each new valve creates a zone).</div>}
      {zones.map((z, idx) => {
        const zr = analysis?.hyd.zones.find((r) => r.zoneId === z.id);
        const valve = project.valves.find((v) => v.id === z.valveId);
        const tone = zr?.status === "error" ? "red" : zr?.status === "warning" ? "amber" : "green";
        const counts = zr ? Object.entries(zr.counts).map(([c, n]) => `${n} ${HEAD_NAMES[c as keyof typeof HEAD_NAMES]?.toLowerCase()}${n > 1 ? "s" : ""}`).join(", ") : "";
        return (
          <div key={z.id} className={cn("border-b border-slate-200", activeZone === z.id && "bg-brand-50/40")}>
            <div
              className="cursor-pointer px-3 py-2.5 hover:bg-slate-50"
              onClick={() => {
                const ids = project.sprinklers.filter((s) => s.zoneId === z.id).map((s) => s.id);
                select(ids);
                set({ activeZoneId: z.id });
                setOpen(open === z.id ? null : z.id);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: z.color }}>
                  {z.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold uppercase tracking-wide text-slate-900">Zone {z.number}</div>
                  <div className="truncate text-[11px] text-slate-500">{counts || "no heads"}{zr?.dripGpm ? " + drip" : ""}</div>
                </div>
                <Badge tone={tone}>{zr ? zr.status.toUpperCase() : "—"}</Badge>
              </div>
              {zr && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Flow" value={`${zr.gpm.toFixed(1)} GPM`} sub={zr.flowPct ? `${zr.flowPct.toFixed(0)}% avail.` : undefined} />
                  <Stat label="Rec. pipe" value={pipeSizeLabel(zr.recommendedLateralSize)} sub={zr.maxVelocity ? `${zr.maxVelocity.toFixed(1)} ft/s` : undefined} />
                  <Stat label="Op. pressure" value={zr.criticalPressure !== undefined ? `${zr.criticalPressure.toFixed(0)} PSI` : "—"} sub={zr.avgHeadPressure !== undefined ? `avg ${zr.avgHeadPressure.toFixed(0)}` : undefined} />
                </div>
              )}
              {zr && zr.issues.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {zr.issues.map((i, k) => (
                    <li key={k} className="text-[11px] text-amber-800">
                      • {i}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {open === z.id && (
              <ZoneEditor
                zoneId={z.id}
                onMove={(dir) =>
                  apply((d) => {
                    const sorted = [...d.zones].sort((a, b) => a.number - b.number);
                    const i = sorted.findIndex((x) => x.id === z.id);
                    const j = i + dir;
                    if (j < 0 || j >= sorted.length) return;
                    const t = sorted[i].number;
                    sorted[i].number = sorted[j].number;
                    sorted[j].number = t;
                    renumber(d as Project);
                  })
                }
                canUp={idx > 0}
                canDown={idx < zones.length - 1}
                valveName={valve?.name}
                onDelete={() =>
                  apply((d) => {
                    d.sprinklers.forEach((s) => s.zoneId === z.id && (s.zoneId = undefined));
                    d.pipes.forEach((p) => p.zoneId === z.id && (p.zoneId = undefined));
                    d.zones = d.zones.filter((x) => x.id !== z.id);
                    renumber(d as Project);
                  })
                }
              />
            )}
          </div>
        );
      })}
      <div className="px-3 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Boxes size={13} /> Valve manifold
        </div>
        {project.manifolds.map((m) => (
          <div key={m.id} className="mb-1 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[12px]">
            <span>
              {m.name} · {m.valveIds.length} valves
            </span>
            <button className="text-[11px] text-brand-700 hover:underline" onClick={() => arrangeManifold(m.id)}>
              Arrange in row
            </button>
          </div>
        ))}
        <Button
          size="sm"
          className="w-full"
          disabled={selValves.length < 2}
          onClick={() => {
            const id = uid("man");
            apply((d) => {
              for (const m of d.manifolds) m.valveIds = m.valveIds.filter((v) => !selValves.some((s) => s.id === v));
              d.manifolds = d.manifolds.filter((m) => m.valveIds.length);
              d.manifolds.push({ id, name: `Manifold ${String.fromCharCode(65 + d.manifolds.length)}`, valveIds: selValves.map((v) => v.id) });
              d.valves.forEach((v) => selValves.some((s) => s.id === v.id) && (v.manifoldId = id));
            });
            arrangeManifold(id);
          }}
        >
          Create manifold from {selValves.length} selected valve(s)
        </Button>
        <p className="mt-1 text-[11px] text-slate-500">Shift-click valves on the plan to select them.</p>
      </div>
    </div>
  );
}

function arrangeManifold(id: string) {
  useProjectStore.getState().apply((d) => {
    const m = d.manifolds.find((x) => x.id === id);
    if (!m) return;
    const vs = m.valveIds.map((v) => d.valves.find((x) => x.id === v)!).filter(Boolean);
    if (!vs.length) return;
    const zoneNum = (vid: string) => d.zones.find((z) => z.valveId === vid)?.number ?? 99;
    vs.sort((a, b) => zoneNum(a.id) - zoneNum(b.id));
    const origin = vs[0].position;
    vs.forEach((v, i) => {
      const np = { x: origin.x + i * 1.5, y: origin.y };
      // move attached pipe ends with the valve
      for (const p of d.pipes) p.points.forEach((q, k) => Math.hypot(q.x - v.position.x, q.y - v.position.y) < 0.3 && (p.points[k] = np));
      v.position = np;
    });
  });
}

function ZoneEditor({ zoneId, onMove, canUp, canDown, onDelete, valveName }: { zoneId: string; onMove: (d: number) => void; canUp: boolean; canDown: boolean; onDelete: () => void; valveName?: string }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const z = project.zones.find((x) => x.id === zoneId)!;
  const [cmp, setCmp] = useState<{ rows: StyleComparison[]; recommended: LateralStyle } | null>(null);
  return (
    <div className="space-y-2 bg-slate-50 px-3 pb-3 pt-2">
      <div className="flex items-center gap-1">
        <TextInput value={z.name} onChange={(v) => apply((d) => void (d.zones.find((x) => x.id === zoneId)!.name = v))} className="flex-1" />
        <input type="color" value={z.color} onChange={(e) => apply((d) => void (d.zones.find((x) => x.id === zoneId)!.color = e.target.value))} className="h-8 w-9 cursor-pointer rounded-md border border-slate-300" title="Zone color" />
        <button className="rounded p-1.5 hover:bg-slate-200 disabled:opacity-30" disabled={!canUp} onClick={() => onMove(-1)} title="Move up">
          <ChevronUp size={14} />
        </button>
        <button className="rounded p-1.5 hover:bg-slate-200 disabled:opacity-30" disabled={!canDown} onClick={() => onMove(1)} title="Move down">
          <ChevronDown size={14} />
        </button>
        <button className="rounded p-1.5 text-red-600 hover:bg-red-50" onClick={onDelete} title="Delete zone">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Select value={z.valveId ?? ""} onChange={(v) => apply((d) => void (d.zones.find((x) => x.id === zoneId)!.valveId = v || undefined))} options={[{ value: "", label: "— no valve —" }, ...project.valves.filter((v) => v.type !== "master" && v.type !== "isolation").map((v) => ({ value: v.id, label: v.name ?? v.id }))]} />
        <Select value={z.plantType} onChange={(v) => apply((d) => void (d.zones.find((x) => x.id === zoneId)!.plantType = v))} options={(Object.keys(PLANT_KC) as (keyof typeof PLANT_KC)[]).map((k) => ({ value: k, label: PLANT_KC[k].label.split(" (")[0] }))} />
      </div>
      <div className="text-[11px] text-slate-500">Valve: {valveName ?? "none"} · click heads on the plan while this zone is active to place new heads in it.</div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" onClick={() => actions.zoomTo([zoneId])}>
          <Crosshair size={13} /> Zoom
        </Button>
        <Button size="sm" onClick={() => actions.matchNozzles(zoneId)}>
          Match nozzles
        </Button>
        <Button size="sm" onClick={() => setCmp(compareLateralStyles(project, zoneId))}>
          Compare layouts
        </Button>
      </div>
      {cmp && (
        <div className="rounded-md border border-slate-200 bg-white">
          <table className="w-full text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="px-1.5 py-1 text-left font-medium">Lateral layout</th>
                <th className="px-1 text-right font-medium">Pipe</th>
                <th className="px-1 text-right font-medium">Min PSI</th>
                <th className="px-1 text-right font-medium">Var.</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular">
              {cmp.rows.map((r) => (
                <tr key={r.style} className={cn("border-t border-slate-100", r.style === cmp.recommended && "bg-emerald-50")}>
                  <td className="px-1.5 py-1 capitalize">
                    {r.style}
                    {r.style === cmp.recommended && <span className="ml-1 text-emerald-700">★</span>}
                  </td>
                  <td className="px-1 text-right">{r.pipeFt.toFixed(0)}&apos;</td>
                  <td className="px-1 text-right">{r.minPressure.toFixed(1)}</td>
                  <td className="px-1 text-right">{r.variationPct.toFixed(0)}%</td>
                  <td className="px-1 text-right">
                    <button className="text-brand-700 hover:underline" onClick={() => actions.autoRoute(r.style, [zoneId])}>
                      Apply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-1.5 py-1 text-[10.5px] text-slate-500">★ recommended: shortest trench unless another layout improves pressure uniformity by &gt;5 points.</p>
        </div>
      )}
    </div>
  );
}

export function useWarningFocus() {
  const set = useEditorStore((s) => s.set);
  return (w: DesignWarning) => {
    const project = useProjectStore.getState().project!;
    const ids = w.targets.flatMap((t) => {
      const z = project.zones.find((zz) => zz.id === t);
      return z ? project.sprinklers.filter((s) => s.zoneId === z.id).map((s) => s.id).concat(z.valveId ? [z.valveId] : []) : [t];
    });
    set({ highlight: ids, selection: ids.filter((id) => !project.areas.some((a) => a.id === id) || ids.length === 1) });
    if (ids.length) actions.zoomTo(ids);
    else if (w.location) actions.zoomTo([]);
  };
}

function ChecksPanel() {
  const analysis = useAnalysis();
  const focus = useWarningFocus();
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "recommendation">("all");
  if (!analysis) return <div className="p-4 text-slate-500">Analyzing…</div>;
  const list = analysis.warnings.filter((w) => filter === "all" || w.severity === filter);
  const count = (s: string) => analysis.warnings.filter((w) => w.severity === s).length;
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 px-3 py-2">
        {(
          [
            ["all", `All ${analysis.warnings.length}`],
            ["error", `Errors ${count("error")}`],
            ["warning", `Warnings ${count("warning")}`],
            ["recommendation", `Tips ${count("recommendation")}`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded px-2 py-0.5 text-[11.5px] ring-1", filter === k ? "bg-slate-900 text-white ring-slate-900" : "text-slate-700 ring-slate-200 hover:bg-slate-50")}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[12px] text-slate-500">
          <CheckCircle2 className="text-emerald-500" size={28} />
          No issues in this category.
        </div>
      )}
      {list.map((w) => (
        <button key={w.id} onClick={() => focus(w)} className="flex w-full gap-2 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
          <span className="mt-0.5 shrink-0">{w.severity === "error" ? <AlertOctagon size={15} className="text-red-600" /> : w.severity === "warning" ? <AlertTriangle size={15} className="text-amber-500" /> : <Lightbulb size={15} className="text-sky-600" />}</span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-slate-900">{w.title}</span>
            <span className="block text-[12px] leading-snug text-slate-600">{w.message}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function AssistantPanel() {
  const project = useProjectStore((s) => s.project)!;
  const analysis = useAnalysis();
  const set = useEditorStore((s) => s.set);
  const setTool = useEditorStore((s) => s.setTool);
  const setOpts = useEditorStore((s) => s.setOpts);
  const focus = useWarningFocus();
  const steps = useMemo(() => {
    const hasSite = project.areas.some((a) => a.type === "lawn" || a.type === "bed" || a.type === "planting");
    const hasSource = project.waterSources.length > 0;
    const hasHeads = project.sprinklers.length > 0 || project.drips.length > 0;
    const hasZones = project.zones.length > 0 && project.sprinklers.every((s) => s.zoneId);
    const hasPipes = project.pipes.some((p) => p.kind === "lateral" || p.kind === "drip");
    const hydOk = analysis ? analysis.hyd.zones.length > 0 && analysis.hyd.zones.every((z) => z.status !== "error") : false;
    const priced = analysis ? analysis.estimate.missingPrices === 0 && analysis.takeoff.length > 0 : false;
    return [
      { done: hasSite, label: "Draw the site: property, house, hardscape and lawn/planting areas", action: () => { setOpts({ areaType: "lawn" }); setTool("area"); } },
      { done: hasSource, label: "Add the water source (static PSI, available GPM)", action: () => setTool("source") },
      { done: hasHeads, label: "Place sprinklers — select a lawn and use Auto design, or place manually", action: () => set({ dialog: "autodesign" }) },
      { done: hasZones, label: "Divide heads into zones (Auto zone respects flow & hydrozones)", action: actions.autoZone },
      { done: hasPipes, label: "Route laterals & mainline (Auto route or draw pipe)", action: () => actions.autoRoute("auto") },
      { done: hydOk, label: "Resolve hydraulic errors (pressure, flow, velocity)", action: () => set({ rightTab: "checks" }) },
      { done: priced, label: "Review materials & estimate", action: () => set({ dialog: "estimate" }) },
      { done: false, label: "Export the installation plan PDF", action: () => set({ dialog: "export" }) },
    ];
  }, [project, analysis, set, setTool, setOpts]);
  const top = analysis?.warnings.slice(0, 7) ?? [];
  const next = steps.find((s) => !s.done);
  return (
    <div className="px-3 py-3">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
        <Sparkles size={15} className="text-brand-600" /> Design assistant
      </div>
      {next && (
        <button onClick={next.action} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-left text-[12.5px] font-medium text-white hover:bg-brand-700">
          <span className="flex-1">Next: {next.label}</span>
          <ArrowRight size={15} />
        </button>
      )}
      <ol className="mb-4 space-y-1">
        {steps.map((s, i) => (
          <li key={i}>
            <button onClick={s.action} className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-[12px] hover:bg-slate-50">
              {s.done ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={14} className="mt-0.5 shrink-0 text-slate-300" />}
              <span className={s.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"}>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What needs attention</div>
      {top.length === 0 && <p className="text-[12px] text-slate-600">No issues detected. The design passes all checks.</p>}
      <div className="space-y-1.5">
        {top.map((w) => (
          <button key={w.id} onClick={() => focus(w)} className={cn("block w-full rounded-lg border px-2.5 py-2 text-left text-[12px] leading-snug", w.severity === "error" ? "border-red-200 bg-red-50 text-red-900" : w.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900")}>
            {w.message}
          </button>
        ))}
      </div>
      {analysis?.coverage && (
        <div className="mt-4 rounded-lg border border-slate-200 p-2.5 text-[12px] text-slate-700">
          <div className="mb-1 font-semibold">Coverage summary (modelled)</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Acceptable" value={`${analysis.coverage.stats.acceptablePct.toFixed(0)}%`} />
            <Stat label="Insufficient" value={`${analysis.coverage.stats.insufficientPct.toFixed(0)}%`} />
            <Stat label="DU (lq) est." value={analysis.coverage.stats.duLq.toFixed(2)} />
          </div>
          <button className="mt-1.5 text-[11.5px] text-brand-700 hover:underline" onClick={() => set({ showHeatmap: true })}>
            Show coverage heatmap →
          </button>
        </div>
      )}
    </div>
  );
}

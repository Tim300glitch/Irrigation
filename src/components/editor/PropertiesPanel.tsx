"use client";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { useAnalysis } from "@/store/analysisStore";
import type { RefPoint, Area, AreaType, BackflowType, DripArea, Equipment, Fitting, FittingType, LineObj, MeterSize, Pipe, PipeKind, PipeMaterial, PlantType, Project, SoilType, Sprinkler, SunExposure, TextLabel, Valve, ValveType, WaterSource, Dimension, Plant } from "@/lib/model/types";
import { findObject } from "@/lib/editor/ops";
import { Badge, Button, Field, NumberInput, Section, Select, Stat, TextInput, Toggle, LengthInput } from "../ui";
import { allProducts, getProduct, getNozzle } from "@/lib/catalog/sprinklers";
import { headPerformance } from "@/lib/irrigation/sprinkler";
import { formatArea, formatFeetInches, formatFlow, formatPressure, pipeSizeLabel } from "@/lib/units/units";
import { polygonArea, polygonPerimeter, polylineLength } from "@/lib/geometry/geometry";
import { PIPE_SPECS, sizesFor } from "@/lib/hydraulics/pipes";
import { AREA_DEFAULTS } from "@/lib/model/factory";
import { AREA_LABELS, EQUIPMENT_NAMES, FITTING_LABELS, HEAD_NAMES } from "@/lib/plan/symbols";
import { PLANT_KC, SOIL } from "@/lib/irrigation/schedule";
import { dripCalc } from "@/lib/irrigation/drip";
import { availableFlow, sourcePressure } from "@/lib/hydraulics/analysis";
import { bucketTestGpm } from "@/lib/hydraulics/formulas";
import { locate, referenceLines } from "@/lib/plan/references";
import { Trash2, Copy, Crosshair, Wand2 } from "lucide-react";
import { actions } from "./actions";
import { fitArc } from "@/lib/irrigation/autoLayout";
import { isIrrigated, isNoSpray } from "@/lib/irrigation/site";
import { pointInPolygon, type Vec } from "@/lib/geometry/geometry";
import { useState } from "react";
import { offsetText, originOf } from "@/lib/plan/refPoints";
import { uid } from "@/lib/model/factory";

function useUpdate() {
  const apply = useProjectStore((s) => s.apply);
  return <T,>(id: string, fn: (o: T) => void) =>
    apply((d) => {
      const r = findObject(d as Project, id);
      if (r) fn(r.obj as unknown as T);
    });
}

const PLANTS: { value: PlantType; label: string }[] = (Object.keys(PLANT_KC) as PlantType[]).map((k) => ({ value: k, label: PLANT_KC[k].label }));
const SUNS: { value: SunExposure; label: string }[] = [
  { value: "full", label: "Full sun" },
  { value: "partial", label: "Partial shade" },
  { value: "shade", label: "Shade" },
];
const SOILS: { value: SoilType; label: string }[] = (Object.keys(SOIL) as SoilType[]).map((k) => ({ value: k, label: SOIL[k].label }));

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project)!;
  const selection = useEditorStore((s) => s.selection);
  if (selection.length === 0) return <ProjectSettingsPanel project={project} />;
  if (selection.length > 1) return <MultiSelection project={project} ids={selection} />;
  const ref = findObject(project, selection[0]);
  if (!ref) return <ProjectSettingsPanel project={project} />;
  const header = (title: string, sub?: string) => (
    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-900">{title}</div>
        {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
      </div>
      <div className="flex gap-0.5">
        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Zoom to" onClick={() => actions.zoomTo(selection)}>
          <Crosshair size={14} />
        </button>
        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Duplicate (Ctrl+D)" onClick={actions.duplicate}>
          <Copy size={14} />
        </button>
        <button className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete" onClick={actions.deleteSelection}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
  switch (ref.collection) {
    case "sprinklers":
      return <SprinklerProps s={ref.obj as Sprinkler} project={project} header={header} />;
    case "areas":
      return <AreaProps a={ref.obj as Area} project={project} header={header} />;
    case "pipes":
      return <PipeProps p={ref.obj as Pipe} project={project} header={header} />;
    case "valves":
      return <ValveProps v={ref.obj as Valve} project={project} header={header} />;
    case "waterSources":
      return <SourceProps w={ref.obj as WaterSource} header={header} />;
    case "drips":
      return <DripProps d={ref.obj as DripArea} project={project} header={header} />;
    case "fittings":
      return <FittingProps f={ref.obj as Fitting} header={header} />;
    case "equipment":
      return <EquipmentProps e={ref.obj as Equipment} header={header} />;
    case "lines":
      return <LineProps l={ref.obj as LineObj} header={header} />;
    case "labels":
      return <LabelProps t={ref.obj as TextLabel} header={header} />;
    case "dimensions":
      return <DimensionProps d={ref.obj as Dimension} header={header} />;
    case "plants":
      return <PlantProps p={ref.obj as Plant} header={header} />;
    case "refPoints":
      return <RefPointProps r={ref.obj as RefPoint} project={project} header={header} />;
  }
  return null;
}

type Header = (title: string, sub?: string) => React.ReactNode;

function SprinklerProps({ s, project, header }: { s: Sprinkler; project: Project; header: Header }) {
  const up = useUpdate();
  const analysis = useAnalysis();
  const perf = headPerformance(s);
  const hr = analysis?.hyd.heads.get(s.id);
  const label = analysis?.labels.get(s.id) ?? "Head";
  const product = perf.product;
  const refs = referenceLines(project);
  const loc = locate(s.position, refs);
  const statusTone = !hr ? "slate" : hr.status === "ok" ? "green" : hr.status === "below-min" || hr.status === "disconnected" ? "red" : "amber";
  const statusText: Record<string, string> = { ok: "Pressure OK", low: "Low pressure", "below-min": "Below minimum", high: "High pressure", disconnected: "Not piped", "no-valve": "Not on zone valve", "no-zone": "No zone" };
  const fitToArea = () => {
    const noSpray = project.areas.filter(isNoSpray).map((a) => a.points);
    const irrigated = project.areas.filter(isIrrigated).map((a) => a.points);
    const wettable = (q: Vec) => !noSpray.some((n) => pointInPolygon(q, n)) && irrigated.some((i) => pointInPolygon(q, i));
    const f = fitArc(s.position, perf.radius, wettable);
    if (f) up<Sprinkler>(s.id, (o) => ((o.arcStart = f.start), (o.arc = Math.max(product.arcMin || 1, Math.round(f.arc)))));
  };
  return (
    <div>
      {header(`${label} — ${HEAD_NAMES[product.category]}`, product.model)}
      <Section title="Performance">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Flow" value={formatFlow(perf.flowGpm)} />
          <Stat label="Throw" value={formatFeetInches(perf.radius)} sub={perf.radiusReduction > 0.005 ? `−${(perf.radiusReduction * 100).toFixed(0)}% of ${formatFeetInches(perf.catalogRadius)}` : "catalog"} />
          <Stat label="Precip" value={perf.precipInHr ? `${perf.precipInHr.toFixed(2)} in/h` : "—"} />
          <Stat label="Pressure" value={hr?.pressure !== undefined ? formatPressure(hr.pressure) : "—"} sub={`needs ${hr?.requiredPressure.toFixed(0) ?? perf.pressure} PSI`} />
          <Stat label="Range" value={`${perf.minPressure}–${perf.maxPressure}`} sub="PSI min–max" />
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-slate-500">Status</div>
            <Badge tone={statusTone}>{hr ? statusText[hr.status] : "—"}</Badge>
          </div>
        </div>
      </Section>
      <Section title="Sprinkler">
        <div className="space-y-2">
          <Field label="Product">
            <Select
              value={s.productId}
              onChange={(v) => {
                const p = getProduct(v);
                up<Sprinkler>(s.id, (o) => {
                  o.productId = v;
                  o.nozzleId = p.nozzles.find((n) => n.radius >= perf.radius)?.id ?? p.nozzles[0].id;
                  o.radiusOverride = undefined;
                  if (!p.arcAdjustable) o.arc = p.arcMax;
                  if (p.category === "custom" && !o.custom) o.custom = { radius: 15, flowGpm: 2, pressure: 30, minPressure: 20, maxPressure: 70 };
                });
              }}
              options={allProducts().map((p) => ({ value: p.id, label: `${p.manufacturer} ${p.model}` }))}
            />
          </Field>
          {product.category !== "custom" ? (
            <Field label="Nozzle">
              <Select value={s.nozzleId} onChange={(v) => up<Sprinkler>(s.id, (o) => ((o.nozzleId = v), (o.radiusOverride = undefined)))} options={product.nozzles.map((n) => ({ value: n.id, label: `${n.name} — ${n.radius}' · ${product.matchedPrecip ? `${n.flowGpm} GPM @360°` : `${n.flowGpm} GPM`} · ${n.pressure} PSI` }))} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Radius">
                <LengthInput value={s.custom?.radius} min={0.5} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.custom!.radius = v))} />
              </Field>
              <Field label="Flow (GPM)">
                <NumberInput value={s.custom?.flowGpm} step={0.05} min={0} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.custom!.flowGpm = v))} />
              </Field>
              <Field label="Design PSI">
                <NumberInput value={s.custom?.pressure} step={1} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.custom!.pressure = v))} />
              </Field>
              <Field label="Min PSI">
                <NumberInput value={s.custom?.minPressure} step={1} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.custom!.minPressure = v))} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Arc">
              <NumberInput value={s.arc} step={5} min={product.arcMin || 1} max={product.arcMax} suffix="°" disabled={!product.arcAdjustable} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.arc = v))} />
            </Field>
            <Field label="Arc start (rotation)">
              <NumberInput value={s.arcStart} step={5} suffix="°" onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.arcStart = ((v % 360) + 360) % 360))} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1">
            {[90, 180, 270, 360].map((a) => (
              <button key={a} disabled={!product.arcAdjustable || a < (product.arcMin || 0)} onClick={() => up<Sprinkler>(s.id, (o) => void (o.arc = a))} className={`rounded px-2 py-0.5 text-xs ring-1 disabled:opacity-40 ${Math.round(s.arc) === a ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>
                {a}°
              </button>
            ))}
            <button onClick={fitToArea} className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50" title="Fit the arc so the head does not spray hardscape">
              <Wand2 size={12} /> Fit arc
            </button>
          </div>
          <Field label="Throw distance (radius adjustment)" hint={`Catalog ${formatFeetInches(perf.catalogRadius)} · recommended minimum ${formatFeetInches(perf.catalogRadius * (1 - product.maxRadiusReduction))} (−${(product.maxRadiusReduction * 100).toFixed(0)}%). Drag the orange handle on the canvas to adjust.`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={Math.max(1, perf.catalogRadius * 0.5)}
                max={perf.catalogRadius}
                step={1 / 12}
                value={perf.radius}
                onChange={(e) => up<Sprinkler>(s.id, (o) => void (o.radiusOverride = +e.target.value >= perf.catalogRadius ? undefined : Math.round(+e.target.value * 12) / 12))}
                className="flex-1 accent-amber-500"
                aria-label="Throw distance"
              />
              <LengthInput className="w-24" value={perf.radius} min={0.5} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.radiusOverride = v >= perf.catalogRadius ? undefined : v))} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Zone">
              <Select value={s.zoneId ?? ""} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.zoneId = v || undefined))} options={[{ value: "", label: "— none —" }, ...project.zones.map((z) => ({ value: z.id, label: `Zone ${z.number} ${z.name.replace(/^Zone \d+ — /, "— ")}` }))]} />
            </Field>
            <Field label="Elevation">
              <LengthInput value={s.elevation} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.elevation = v))} />
            </Field>
          </div>
          <Field label="Label override">
            <TextInput value={s.label ?? ""} placeholder={label} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.label = v || undefined))} />
          </Field>
          <Toggle checked={!!s.oversprayOk} onChange={(v) => up<Sprinkler>(s.id, (o) => void (o.oversprayOk = v))} label={<span className="text-[12px]">Allow overspray (override warning)</span>} />
        </div>
      </Section>
      <Section title="Field location">
        <p className="text-[12px] leading-relaxed text-slate-700">
          <span className="font-semibold">{label}</span> {loc.text || "—"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          X {formatFeetInches(s.position.x - originOf(project).x)}, Y {formatFeetInches(s.position.y - originOf(project).y)} from {project.refPoints?.find((r) => r.isOrigin)?.name ?? "drawing origin"}
        </p>
      </Section>
      <RefOffsets p={s.position} />
    </div>
  );
}

function AreaProps({ a, project, header }: { a: Area; project: Project; header: Header }) {
  const up = useUpdate();
  const set = useEditorStore((s) => s.set);
  const irrigated = a.type === "lawn" || a.type === "bed" || a.type === "planting";
  const heads = project.sprinklers.filter((s) => pointInPolygon(s.position, a.points));
  return (
    <div>
      {header(a.name, AREA_LABELS[a.type])}
      <Section title="Geometry">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Area" value={formatArea(polygonArea(a.points))} />
          <Stat label="Perimeter" value={formatFeetInches(polygonPerimeter(a.points))} />
          <Stat label="Vertices" value={a.points.length} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Drag square handles to move vertices, drag a midpoint dot to add one, double-click a vertex to delete it.</p>
      </Section>
      {irrigated && (
        <Section title="Irrigation">
          <div className="mb-2 text-[12px] text-slate-600">{heads.length} sprinkler(s) in this area</div>
          <Button variant="primary" className="w-full" onClick={() => set({ dialog: "autodesign" })}>
            <Wand2 size={14} /> Auto design this area
          </Button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Plant type" className="col-span-2">
              <Select value={a.plantType ?? "cool-turf"} onChange={(v) => up<Area>(a.id, (o) => void (o.plantType = v))} options={PLANTS} />
            </Field>
            <Field label="Sun">
              <Select value={a.sun ?? "full"} onChange={(v) => up<Area>(a.id, (o) => void (o.sun = v))} options={SUNS} />
            </Field>
            <Field label="Soil">
              <Select value={a.soil ?? "loam"} onChange={(v) => up<Area>(a.id, (o) => void (o.soil = v))} options={SOILS} />
            </Field>
            <Field label="Slope">
              <NumberInput value={a.slopePct ?? 0} suffix="%" step={1} min={0} onChange={(v) => up<Area>(a.id, (o) => void (o.slopePct = v))} />
            </Field>
          </div>
        </Section>
      )}
      <Section title="Properties">
        <div className="space-y-2">
          <Field label="Name">
            <TextInput value={a.name} onChange={(v) => up<Area>(a.id, (o) => void (o.name = v))} />
          </Field>
          <Field label="Type">
            <Select
              value={a.type}
              onChange={(v: AreaType) =>
                up<Area>(a.id, (o) => {
                  o.type = v;
                  o.style = { ...AREA_DEFAULTS[v].style };
                  o.layer = AREA_DEFAULTS[v].layer;
                })
              }
              options={(Object.keys(AREA_LABELS) as AreaType[]).map((t) => ({ value: t, label: AREA_LABELS[t] }))}
            />
          </Field>
          <StyleEditor style={a.style} onChange={(fn) => up<Area>(a.id, (o) => fn(o.style))} />
          <Toggle checked={a.showLabel} onChange={(v) => up<Area>(a.id, (o) => void (o.showLabel = v))} label="Show label" />
          <Toggle checked={!!a.locked} onChange={(v) => up<Area>(a.id, (o) => void (o.locked = v))} label="Lock object" />
        </div>
      </Section>
    </div>
  );
}

function StyleEditor({ style, onChange, line }: { style: Area["style"]; onChange: (fn: (s: Area["style"]) => void) => void; line?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {!line && (
        <Field label="Fill">
          <input type="color" className="h-8 w-full cursor-pointer rounded-md border border-slate-300" value={style.fill.startsWith("#") ? style.fill : "#ffffff"} onChange={(e) => onChange((s) => void (s.fill = e.target.value))} />
        </Field>
      )}
      <Field label="Stroke">
        <input type="color" className="h-8 w-full cursor-pointer rounded-md border border-slate-300" value={style.stroke} onChange={(e) => onChange((s) => void (s.stroke = e.target.value))} />
      </Field>
      {!line && (
        <Field label="Opacity">
          <NumberInput value={Math.round(style.opacity * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => onChange((s) => void (s.opacity = v / 100))} />
        </Field>
      )}
      {!line && (
        <Field label="Pattern">
          <Select
            value={style.pattern}
            onChange={(v) => onChange((s) => void (s.pattern = v))}
            options={(["solid", "none", "hatch", "crosshatch", "dots", "grass", "brick"] as const).map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
          />
        </Field>
      )}
      <Field label="Line style">
        <Select value={style.lineStyle} onChange={(v) => onChange((s) => void (s.lineStyle = v))} options={(["solid", "dashed", "dotted", "dashdot"] as const).map((p) => ({ value: p, label: p }))} />
      </Field>
      <Field label="Line weight">
        <NumberInput value={style.strokeWidth} min={0.5} max={8} step={0.5} onChange={(v) => onChange((s) => void (s.strokeWidth = v))} />
      </Field>
    </div>
  );
}

function PipeProps({ p, project, header }: { p: Pipe; project: Project; header: Header }) {
  const up = useUpdate();
  const analysis = useAnalysis();
  const r = analysis?.hyd.pipes.get(p.id);
  const eff = r?.sizes ?? [p.size];
  const maxV = project.settings.maxVelocityFps;
  const kinds: PipeKind[] = ["mainline", "lateral", "drip", "sleeve", "wire"];
  const edges = analysis ? (analysis.hyd.net.pipeEdges.get(p.id) ?? []).map((e) => analysis.hyd.edges.get(e)!) : [];
  return (
    <div>
      {header(`${pipeSizeLabel(eff[0])} ${p.kind} pipe`, PIPE_SPECS[p.material].label)}
      <Section title="Hydraulics">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Length" value={formatFeetInches(polylineLength(p.points))} />
          <Stat label="Size" value={eff.map(pipeSizeLabel).join(" / ")} sub={p.autoSize ? "auto-sized" : "manual"} />
          <Stat label="Flow" value={r ? `${r.maxFlow.toFixed(2)} GPM` : "—"} />
          <Stat label="Velocity" value={<span className={r && r.maxVelocity > maxV ? "text-red-600" : ""}>{r ? `${r.maxVelocity.toFixed(2)} ft/s` : "—"}</span>} sub={`limit ${maxV} ft/s`} />
          <Stat label="Friction loss" value={r ? `${r.lossPsi.toFixed(2)} PSI` : "—"} sub={`incl. ${project.settings.minorLossPct}% fittings`} />
          <Stat label="Recommended" value={r ? pipeSizeLabel(r.recommendedSize) : "—"} />
        </div>
        {r && r.maxFlow === 0 && p.kind !== "sleeve" && p.kind !== "wire" && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">This pipe carries no flow — connect it to a valve and heads (ends must touch).</p>}
        {edges.length > 1 && (
          <table className="mt-2 w-full text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left font-medium">Segment</th>
                <th className="text-right font-medium">Ft</th>
                <th className="text-right font-medium">Size</th>
                <th className="text-right font-medium">GPM</th>
                <th className="text-right font-medium">ft/s</th>
                <th className="text-right font-medium">PSI</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {edges.map((e, i) => (
                <tr key={e.edgeId} className="border-t border-slate-100">
                  <td>#{i + 1}</td>
                  <td className="text-right">{e.length.toFixed(1)}</td>
                  <td className="text-right">{pipeSizeLabel(e.nominal)}</td>
                  <td className="text-right">{e.flow.toFixed(1)}</td>
                  <td className={`text-right ${e.velocity > maxV ? "text-red-600" : ""}`}>{e.velocity.toFixed(1)}</td>
                  <td className="text-right">{e.lossPsi.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Pipe">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <Select value={p.kind} onChange={(v) => up<Pipe>(p.id, (o) => ((o.kind = v), (o.layer = v === "mainline" ? "mainline" : v === "wire" ? "electrical" : v === "drip" ? "drip" : "laterals")))} options={kinds.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} />
            </Field>
            <Field label="Material">
              <Select
                value={p.material}
                onChange={(v: PipeMaterial) => up<Pipe>(p.id, (o) => ((o.material = v), (o.size = sizesFor(v).includes(o.size) ? o.size : sizesFor(v)[0])))}
                options={(Object.keys(PIPE_SPECS) as PipeMaterial[]).map((m) => ({ value: m, label: PIPE_SPECS[m].label }))}
              />
            </Field>
          </div>
          <Toggle checked={p.autoSize} onChange={(v) => up<Pipe>(p.id, (o) => ((o.autoSize = v), (o.size = v ? o.size : eff[0])))} label="Auto size by velocity" />
          {!p.autoSize && (
            <Field label="Nominal size">
              <Select value={p.size} onChange={(v) => up<Pipe>(p.id, (o) => void (o.size = v))} options={sizesFor(p.material).map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
            </Field>
          )}
          {(p.kind === "lateral" || p.kind === "drip") && (
            <Field label="Zone" hint="Pipes of different zones never connect hydraulically.">
              <Select value={p.zoneId ?? ""} onChange={(v) => up<Pipe>(p.id, (o) => void (o.zoneId = v || undefined))} options={[{ value: "", label: "— unassigned —" }, ...project.zones.map((z) => ({ value: z.id, label: `Zone ${z.number}` }))]} />
            </Field>
          )}
          {p.kind === "wire" && (
            <Field label="Conductors">
              <NumberInput value={p.conductors ?? project.zones.length + 2} min={2} step={1} onChange={(v) => up<Pipe>(p.id, (o) => void (o.conductors = v))} />
            </Field>
          )}
        </div>
      </Section>
    </div>
  );
}

function ValveProps({ v, project, header }: { v: Valve; project: Project; header: Header }) {
  const up = useUpdate();
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const zone = project.zones.find((z) => z.valveId === v.id);
  const zr = zone ? analysis?.hyd.zones.find((z) => z.zoneId === zone.id) : undefined;
  const types: ValveType[] = ["electric", "master", "drip", "prv", "isolation"];
  return (
    <div>
      {header(v.name ?? "Valve", `${pipeSizeLabel(v.size)} ${v.type} valve${zone ? ` · Zone ${zone.number}` : ""}`)}
      {zr && (
        <Section title="Zone hydraulics">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Zone flow" value={`${zr.gpm.toFixed(1)} GPM`} />
            <Stat label="Valve loss" value={`${zr.valveLoss.toFixed(1)} PSI`} />
            <Stat label="Inlet" value={zr.valveInPressure !== undefined ? `${zr.valveInPressure.toFixed(1)} PSI` : "—"} />
          </div>
        </Section>
      )}
      <Section title="Valve">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name">
              <TextInput value={v.name ?? ""} onChange={(x) => up<Valve>(v.id, (o) => void (o.name = x))} />
            </Field>
            <Field label="Type">
              <Select value={v.type} onChange={(x) => up<Valve>(v.id, (o) => void (o.type = x))} options={types.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Size">
              <Select value={v.size} onChange={(x) => up<Valve>(v.id, (o) => void (o.size = x))} options={[0.75, 1, 1.5, 2].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
            </Field>
            <Field label="Elevation">
              <LengthInput value={v.elevation} onChange={(x) => up<Valve>(v.id, (o) => void (o.elevation = x))} />
            </Field>
          </div>
          <Field label="Assigned zone">
            <Select
              value={zone?.id ?? ""}
              onChange={(zid) =>
                apply((d) => {
                  for (const z of d.zones) if (z.valveId === v.id) z.valveId = undefined;
                  const z = d.zones.find((x) => x.id === zid);
                  if (z) z.valveId = v.id;
                })
              }
              options={[{ value: "", label: "— none —" }, ...project.zones.map((z) => ({ value: z.id, label: `Zone ${z.number}${z.valveId && z.valveId !== v.id ? " (reassign)" : ""}` }))]}
            />
          </Field>
          <Field label="Loss override (PSI)" hint="Leave blank to use the generic loss curve; enter the manufacturer value at design flow.">
            <NumberInput allowEmpty value={v.lossOverridePsi} step={0.1} min={0} onChange={(x) => up<Valve>(v.id, (o) => void (o.lossOverridePsi = x || undefined))} />
          </Field>
        </div>
      </Section>
      <RefOffsets p={v.position} />
    </div>
  );
}

function SourceProps({ w, header }: { w: WaterSource; header: Header }) {
  const up = useUpdate();
  const [gal, setGal] = useState(w.flowTest?.gallons ?? 5);
  const [sec, setSec] = useState(w.flowTest?.seconds ?? 15);
  const av = availableFlow(w);
  const sp = sourcePressure(w, av.gpm * 0.9);
  const meters: MeterSize[] = ["none", "5/8", "3/4", "1", "1-1/2", "2"];
  const bfs: { value: BackflowType; label: string }[] = [
    { value: "none", label: "None" },
    { value: "pvb", label: "PVB — pressure vacuum breaker" },
    { value: "rp", label: "RP — reduced pressure" },
    { value: "dcva", label: "DCVA — double check" },
    { value: "avb", label: "AVB — atmospheric" },
  ];
  return (
    <div>
      {header(w.name, "Point of connection")}
      <Section title="Supply summary">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Available" value={`${av.gpm.toFixed(1)} GPM`} sub={av.basis} />
          <Stat label="Static" value={`${w.staticPsi} PSI`} />
          <Stat label={`POC @ ${(av.gpm * 0.9).toFixed(0)} GPM`} value={`${sp.pressure.toFixed(1)} PSI`} sub={`meter ${sp.meterLoss.toFixed(1)} · svc ${sp.serviceLoss.toFixed(1)} · BF ${sp.backflowLoss.toFixed(1)}`} />
        </div>
        {av.basis === "meter/service estimate" && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Flow estimated from meter/service size (75% of meter rating, 7.5 ft/s service velocity). A measured flow test is preferable.</p>}
      </Section>
      <Section title="Pressure & flow">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name" className="col-span-2">
            <TextInput value={w.name} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.name = v))} />
          </Field>
          <Field label="Static pressure">
            <NumberInput value={w.staticPsi} suffix="PSI" step={1} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.staticPsi = v))} />
          </Field>
          <Field label="Dynamic (measured)">
            <NumberInput allowEmpty value={w.dynamicPsi} suffix="PSI" step={1} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.dynamicPsi = v || undefined))} />
          </Field>
          <Field label="Available flow" hint="blank = test/estimate">
            <NumberInput allowEmpty value={w.availableGpm} suffix="GPM" step={0.5} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.availableGpm = v || undefined))} />
          </Field>
          <Field label="Elevation">
            <LengthInput value={w.elevation} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.elevation = v))} />
          </Field>
        </div>
      </Section>
      <Section title="Flow test calculator">
        <p className="mb-2 text-[11px] text-slate-500">GPM = gallons ÷ seconds × 60 (fill a bucket at the hose bib nearest the meter, all other water off).</p>
        <div className="grid grid-cols-3 items-end gap-2">
          <Field label="Gallons">
            <NumberInput value={gal} step={0.5} min={0.1} onChange={setGal} />
          </Field>
          <Field label="Seconds">
            <NumberInput value={sec} step={0.5} min={0.5} onChange={setSec} />
          </Field>
          <div className="pb-1 text-right">
            <div className="text-[11px] text-slate-500">Result</div>
            <div className="tabular text-sm font-semibold">{bucketTestGpm(gal, sec).toFixed(1)} GPM</div>
          </div>
        </div>
        <Button className="mt-2 w-full" onClick={() => up<WaterSource>(w.id, (o) => ((o.flowTest = { gallons: gal, seconds: sec }), (o.availableGpm = undefined)))}>
          Use flow test result
        </Button>
      </Section>
      <Section title="Service & equipment">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Water meter">
            <Select value={w.meterSize} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.meterSize = v))} options={meters.map((m) => ({ value: m, label: m === "none" ? "None / well" : `${m}"` }))} />
          </Field>
          <Field label="Service line">
            <Select value={w.serviceLineSize} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.serviceLineSize = v))} options={[0.75, 1, 1.25, 1.5, 2].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
          </Field>
          <Field label="Service length">
            <LengthInput value={w.serviceLineLengthFt} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.serviceLineLengthFt = v))} />
          </Field>
          <Field label="Mainline size">
            <Select value={w.mainlineSize} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.mainlineSize = v))} options={[0.75, 1, 1.25, 1.5, 2].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
          </Field>
          <Field label="Backflow" className="col-span-2">
            <Select value={w.backflow} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.backflow = v))} options={bfs} />
          </Field>
          <Field label="Backflow size">
            <Select value={w.backflowSize} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.backflowSize = v))} options={[0.75, 1, 1.5, 2].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
          </Field>
          <Field label="PRV setting">
            <NumberInput allowEmpty value={w.prvSettingPsi} suffix="PSI" step={1} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.prvSettingPsi = v || undefined))} />
          </Field>
          <Field label="Pump boost">
            <NumberInput allowEmpty value={w.pumpBoostPsi} suffix="PSI" step={1} min={0} onChange={(v) => up<WaterSource>(w.id, (o) => void (o.pumpBoostPsi = v || undefined))} />
          </Field>
        </div>
      </Section>
      <RefOffsets p={w.position} />
    </div>
  );
}

function DripProps({ d, project, header }: { d: DripArea; project: Project; header: Header }) {
  const up = useUpdate();
  const c = dripCalc(d);
  return (
    <div>
      {header(d.name, "Dripline area")}
      <Section title="Drip calculation">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Area" value={formatArea(c.area)} />
          <Stat label="Dripline" value={formatFeetInches(c.tubingFt)} />
          <Stat label="Emitters" value={c.emitters} />
          <Stat label="Flow" value={`${c.flowGpm.toFixed(2)} GPM`} sub={`${(c.flowGpm * 60).toFixed(0)} GPH`} />
          <Stat label="Precip" value={`${c.precipInHr.toFixed(2)} in/h`} />
        </div>
      </Section>
      <Section title="Dripline">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name" className="col-span-2">
            <TextInput value={d.name} onChange={(v) => up<DripArea>(d.id, (o) => void (o.name = v))} />
          </Field>
          <Field label="Emitter flow">
            <Select value={d.emitterGph} onChange={(v) => up<DripArea>(d.id, (o) => void (o.emitterGph = v))} options={[0.4, 0.6, 0.9, 1.0].map((g) => ({ value: g, label: `${g} GPH` }))} />
          </Field>
          <Field label="Emitter spacing">
            <Select value={d.emitterSpacingIn} onChange={(v) => up<DripArea>(d.id, (o) => void (o.emitterSpacingIn = v))} options={[12, 18, 24].map((g) => ({ value: g, label: `${g}"` }))} />
          </Field>
          <Field label="Row spacing">
            <Select value={d.rowSpacingIn} onChange={(v) => up<DripArea>(d.id, (o) => void (o.rowSpacingIn = v))} options={[12, 18, 24].map((g) => ({ value: g, label: `${g}"` }))} />
          </Field>
          <Field label="Zone">
            <Select value={d.zoneId ?? ""} onChange={(v) => up<DripArea>(d.id, (o) => void (o.zoneId = v || undefined))} options={[{ value: "", label: "— none —" }, ...project.zones.map((z) => ({ value: z.id, label: `Zone ${z.number}` }))]} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function FittingProps({ f, header }: { f: Fitting; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header(`${pipeSizeLabel(f.size)} ${FITTING_LABELS[f.type]}`, "Fitting (counted in material takeoff)")}
      <Section title="Fitting">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type">
            <Select value={f.type} onChange={(v: FittingType) => up<Fitting>(f.id, (o) => void (o.type = v))} options={(Object.keys(FITTING_LABELS) as FittingType[]).map((t) => ({ value: t, label: FITTING_LABELS[t] }))} />
          </Field>
          <Field label="Size">
            <Select value={f.size} onChange={(v) => up<Fitting>(f.id, (o) => void (o.size = v))} options={[0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
          </Field>
          <Field label="Rotation">
            <NumberInput value={f.rotation} suffix="°" step={45} onChange={(v) => up<Fitting>(f.id, (o) => void (o.rotation = v))} />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Manually placed fittings replace automatically inferred fittings at the same location.</p>
      </Section>
      <RefOffsets p={f.position} />
    </div>
  );
}

function EquipmentProps({ e, header }: { e: Equipment; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header(e.label || EQUIPMENT_NAMES[e.type], EQUIPMENT_NAMES[e.type])}
      <Section title="Equipment">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label" className="col-span-2">
            <TextInput value={e.label ?? ""} onChange={(v) => up<Equipment>(e.id, (o) => void (o.label = v))} />
          </Field>
          {e.type.includes("controller") ? (
            <Field label="Stations">
              <Select value={e.stations ?? 6} onChange={(v) => up<Equipment>(e.id, (o) => void (o.stations = v))} options={[4, 6, 8, 12, 16, 24, 32].map((s) => ({ value: s, label: `${s} stations` }))} />
            </Field>
          ) : (
            <Field label="Size">
              <Select value={e.size ?? 1} onChange={(v) => up<Equipment>(e.id, (o) => void (o.size = v))} options={[0.75, 1, 1.5, 2].map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
            </Field>
          )}
        </div>
      </Section>
      <RefOffsets p={e.position} />
    </div>
  );
}

function LineProps({ l, header }: { l: LineObj; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header(l.name, `${l.type} · ${formatFeetInches(polylineLength(l.points))}`)}
      <Section title="Line">
        <div className="space-y-2">
          <Field label="Name">
            <TextInput value={l.name} onChange={(v) => up<LineObj>(l.id, (o) => void (o.name = v))} />
          </Field>
          <StyleEditor line style={l.style} onChange={(fn) => up<LineObj>(l.id, (o) => fn(o.style))} />
        </div>
      </Section>
    </div>
  );
}

function LabelProps({ t, header }: { t: TextLabel; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header("Text label", t.text)}
      <Section title="Text">
        <div className="space-y-2">
          <Field label="Text">
            <TextInput value={t.text} onChange={(v) => up<TextLabel>(t.id, (o) => void (o.text = v))} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Text height">
              <LengthInput value={t.size} min={1 / 12} onChange={(v) => up<TextLabel>(t.id, (o) => void (o.size = v))} />
            </Field>
            <Field label="Rotation">
              <NumberInput value={t.rotation} step={15} suffix="°" onChange={(v) => up<TextLabel>(t.id, (o) => void (o.rotation = v))} />
            </Field>
            <Field label="Color">
              <input type="color" className="h-8 w-full rounded-md border border-slate-300" value={t.color} onChange={(e) => up<TextLabel>(t.id, (o) => void (o.color = e.target.value))} />
            </Field>
          </div>
        </div>
      </Section>
    </div>
  );
}

function DimensionProps({ d, header }: { d: Dimension; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header("Dimension", formatFeetInches(d.kind === "horizontal" ? Math.abs(d.b.x - d.a.x) : d.kind === "vertical" ? Math.abs(d.b.y - d.a.y) : Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y)))}
      <Section title="Dimension">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kind">
            <Select value={d.kind} onChange={(v) => up<Dimension>(d.id, (o) => void (o.kind = v))} options={[{ value: "aligned", label: "Aligned" }, { value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }]} />
          </Field>
          <Field label="Offset">
            <LengthInput value={d.offset} onChange={(v) => up<Dimension>(d.id, (o) => void (o.offset = v))} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function PlantProps({ p, header }: { p: Plant; header: Header }) {
  const up = useUpdate();
  return (
    <div>
      {header(p.name, p.type)}
      <Section title="Plant">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name" className="col-span-2">
            <TextInput value={p.name} onChange={(v) => up<Plant>(p.id, (o) => void (o.name = v))} />
          </Field>
          <Field label="Canopy radius">
            <LengthInput value={p.canopyRadius} min={0.5} onChange={(v) => up<Plant>(p.id, (o) => void (o.canopyRadius = v))} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function MultiSelection({ project, ids }: { project: Project; ids: string[] }) {
  const apply = useProjectStore((s) => s.apply);
  const heads = project.sprinklers.filter((s) => ids.includes(s.id));
  const q = heads.reduce((a, s) => a + headPerformance(s).flowGpm, 0);
  return (
    <div>
      <div className="border-b border-slate-200 px-3 py-2.5">
        <div className="text-[13px] font-semibold">{ids.length} objects selected</div>
        <div className="text-[11px] text-slate-500">{heads.length} sprinklers · {q.toFixed(2)} GPM</div>
      </div>
      {heads.length > 0 && (
        <Section title="Assign heads to zone">
          <div className="flex flex-wrap gap-1">
            {project.zones.map((z) => (
              <button key={z.id} onClick={() => apply((d) => d.sprinklers.forEach((s) => ids.includes(s.id) && (s.zoneId = z.id)))} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} /> Zone {z.number}
              </button>
            ))}
            <button onClick={() => apply((d) => d.sprinklers.forEach((s) => ids.includes(s.id) && (s.zoneId = undefined)))} className="rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">
              None
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Set arc">
              <Select value={0} onChange={(v) => v && apply((d) => d.sprinklers.forEach((s) => ids.includes(s.id) && (s.arc = v)))} options={[{ value: 0, label: "—" }, ...[90, 180, 270, 360].map((a) => ({ value: a, label: `${a}°` }))]} />
            </Field>
            <Field label="Set nozzle">
              <Select
                value=""
                onChange={(v) => v && apply((d) => d.sprinklers.forEach((s) => ids.includes(s.id) && getProduct(s.productId).nozzles.some((n) => n.id === v) && (s.nozzleId = v)))}
                options={[{ value: "", label: "—" }, ...getProduct(heads[0].productId).nozzles.map((n) => ({ value: n.id, label: n.name }))]}
              />
            </Field>
          </div>
        </Section>
      )}
      <Section title="Actions">
        <div className="flex gap-2">
          <Button onClick={actions.duplicate}>
            <Copy size={14} /> Duplicate
          </Button>
          <Button variant="danger" onClick={actions.deleteSelection}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </Section>
    </div>
  );
}

function ProjectSettingsPanel({ project }: { project: Project }) {
  const apply = useProjectStore((s) => s.apply);
  const st = project.settings;
  return (
    <div>
      <div className="border-b border-slate-200 px-3 py-2.5">
        <div className="text-[13px] font-semibold">Design settings</div>
        <div className="text-[11px] text-slate-500">Select an object to edit its properties</div>
      </div>
      <Section title="Hydraulic design criteria">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max velocity">
            <NumberInput value={st.maxVelocityFps} suffix="ft/s" step={0.5} min={1} onChange={(v) => apply((d) => void (d.settings.maxVelocityFps = v))} />
          </Field>
          <Field label="Fitting loss allowance">
            <NumberInput value={st.minorLossPct} suffix="%" step={1} min={0} onChange={(v) => apply((d) => void (d.settings.minorLossPct = v))} />
          </Field>
          <Field label="Max zone flow">
            <NumberInput value={st.maxZoneFlowPct} suffix="% avail." step={5} min={10} max={100} onChange={(v) => apply((d) => void (d.settings.maxZoneFlowPct = v))} />
          </Field>
          <Field label="Valve layout">
            <Select value={st.valveLayout} onChange={(v) => apply((d) => void (d.settings.valveLayout = v))} options={[{ value: "grouped", label: "Grouped manifold" }, { value: "distributed", label: "Distributed" }]} />
          </Field>
          <Field label="Lateral pipe">
            <Select value={st.lateralMaterial} onChange={(v) => apply((d) => void (d.settings.lateralMaterial = v))} options={(["pvc-sch40", "pvc-cl200", "poly-100"] as PipeMaterial[]).map((m) => ({ value: m, label: PIPE_SPECS[m].label }))} />
          </Field>
          <Field label="Mainline pipe">
            <Select value={st.mainlineMaterial} onChange={(v) => apply((d) => void (d.settings.mainlineMaterial = v))} options={(["pvc-sch40", "pvc-cl315", "pvc-cl200"] as PipeMaterial[]).map((m) => ({ value: m, label: PIPE_SPECS[m].label }))} />
          </Field>
          <Field label="Head labels" className="col-span-2">
            <Select value={st.headLabelStyle} onChange={(v) => apply((d) => void (d.settings.headLabelStyle = v))} options={[{ value: "sequential", label: "R1, R2, S1… (by type)" }, { value: "zone", label: "Z1-H1, Z1-H2… (by zone)" }]} />
          </Field>
        </div>
      </Section>
      <Section title="Units">
        <Select value={st.unitSystem} onChange={(v) => apply((d) => void (d.settings.unitSystem = v))} options={[{ value: "imperial", label: "Imperial (ft, GPM, PSI)" }, { value: "metric", label: "Metric display (m, L/min, kPa)" }]} />
      </Section>
    </div>
  );
}

/** Offsets from every reference point, with one click to add dimension lines. */
export function RefOffsets({ p }: { p: Vec }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const set = useEditorStore((s) => s.setTool);
  const refs = project.refPoints ?? [];
  return (
    <Section title="From reference points">
      {!refs.length && (
        <p className="text-[12px] text-slate-500">
          Place a reference point (<button className="text-brand-700 hover:underline" onClick={() => set("refpoint")}>R</button>) at a fixed spot such as a house corner or hose bib to see this location measured from it.
        </p>
      )}
      <div className="space-y-1.5">
        {refs.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
            <div className="min-w-0">
              <span className="font-semibold text-rose-700">{r.name}</span>
              {r.isOrigin && <span className="ml-1 text-[10.5px] text-slate-500">(origin)</span>}
              <div className="text-slate-700">{offsetText(r.position, p)}</div>
            </div>
            <button
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
              title="Add horizontal and vertical dimension lines from this reference point"
              onClick={() =>
                apply((d) => {
                  const a = r.position;
                  if (Math.abs(p.x - a.x) > 1 / 24) d.dimensions.push({ id: uid("dim"), kind: "horizontal", a, b: { x: p.x, y: a.y }, offset: -2, layer: "measurements" });
                  if (Math.abs(p.y - a.y) > 1 / 24) d.dimensions.push({ id: uid("dim"), kind: "vertical", a: { x: p.x, y: a.y }, b: p, offset: 2, layer: "measurements" });
                })
              }
            >
              Dimension
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RefPointProps({ r, project, header }: { r: RefPoint; project: Project; header: Header }) {
  const up = useUpdate();
  const apply = useProjectStore((s) => s.apply);
  const o = originOf(project);
  return (
    <div>
      {header(r.name, r.isOrigin ? "Reference point · measuring origin (0,0)" : "Reference point")}
      <Section title="Reference point">
        <div className="space-y-2">
          <Field label="Name" hint="e.g. NW house corner, hose bib, meter box">
            <TextInput value={r.name} onChange={(v) => up<RefPoint>(r.id, (x) => void (x.name = v))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={r.isOrigin ? "X" : "X from origin"}>
              <LengthInput value={r.position.x - o.x} disabled={r.isOrigin} onChange={(v) => up<RefPoint>(r.id, (x) => void (x.position = { x: o.x + v, y: x.position.y }))} />
            </Field>
            <Field label={r.isOrigin ? "Y" : "Y from origin"}>
              <LengthInput value={r.position.y - o.y} disabled={r.isOrigin} onChange={(v) => up<RefPoint>(r.id, (x) => void (x.position = { x: x.position.x, y: o.y + v }))} />
            </Field>
          </div>
          <Toggle
            checked={!!r.isOrigin}
            onChange={(v) =>
              apply((d) => {
                for (const x of d.refPoints ?? []) x.isOrigin = v && x.id === r.id ? true : undefined;
              })
            }
            label="Measure everything from this point (0,0)"
          />
          <p className="text-[11px] text-slate-500">The rulers and cursor coordinates start at the origin point. Select any head, valve or piece of equipment to see its distance from each reference point.</p>
        </div>
      </Section>
      <Section title="Other reference points">
        {(project.refPoints ?? []).filter((x) => x.id !== r.id).map((x) => (
          <div key={x.id} className="text-[12px]">
            <span className="font-semibold text-rose-700">{x.name}</span>: {offsetText(r.position, x.position)}
          </div>
        ))}
        {(project.refPoints ?? []).length < 2 && <p className="text-[12px] text-slate-500">Only one reference point placed.</p>}
      </Section>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import type { Project } from "@/lib/model/types";
import { headPerformance } from "@/lib/irrigation/sprinkler";
import { AreaShape, CanvasPatterns, CoverageShape, DimensionShape, DripShape, EquipmentShape, FittingShape, LabelShape, LineShape, PipeShape, PlantShape, SourceShape, SprinklerShape, ValveShape } from "./shapes";
import { DraftOverlay, SelectionOverlay } from "./Overlays";
import { useCanvasController, type MarqueeState } from "./useCanvasController";
import { niceStep, toScreen } from "./viewport";
import { PIPE_STYLE } from "@/lib/plan/symbols";
import type { CoverageGrid } from "@/lib/irrigation/coverage";
import { polygonArea } from "@/lib/geometry/geometry";
import { locate, referenceLines } from "@/lib/plan/references";

const RULER = 22;
const PIPE_ORDER = ["sleeve", "lateral", "drip", "mainline", "wire"];

const CURSORS: Record<string, string> = {
  select: "default",
  pan: "grab",
  measure: "crosshair",
  dimension: "crosshair",
  calibrate: "crosshair",
};

export function CanvasView() {
  const project = useProjectStore((s) => s.project);
  const ref = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const ctl = useCanvasController(ref, setMarquee);
  const viewport = useEditorStore((s) => s.viewport);
  const size = useEditorStore((s) => s.canvasSize);
  const tool = useEditorStore((s) => s.tool);
  const spacePan = useEditorStore((s) => s.spacePan);
  const rulersVisible = project?.settings.rulersVisible ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      useEditorStore.getState().setCanvasSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const wheel = (e: WheelEvent) => ctl.onWheel(e);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, [ctl]);

  if (!project) return null;
  const cursor = spacePan ? "grab" : CURSORS[tool] ?? "crosshair";
  const { x, y, zoom } = viewport;
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f4f6f8] select-none" style={{ touchAction: "none" }}>
      <div
        ref={ref}
        className="absolute inset-0"
        style={{ cursor, left: rulersVisible ? RULER : 0, top: rulersVisible ? RULER : 0 }}
        onPointerDown={ctl.onPointerDown}
        onPointerMove={ctl.onPointerMove}
        onPointerUp={ctl.onPointerUp}
        onPointerCancel={ctl.onPointerUp}
        onPointerLeave={() => useEditorStore.getState().setCursor(null)}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="design-canvas"
      >
        <svg width="100%" height="100%" className="block">
          <GridLayer project={project} />
          <g transform={`scale(${zoom}) translate(${-x} ${-y})`}>
            <CanvasPatterns />
            <WorldLayers project={project} />
            <SelectionOverlay project={project} />
            <DraftOverlay project={project} />
            {marquee && (
              <rect
                x={Math.min(marquee.a.x, marquee.b.x)}
                y={Math.min(marquee.a.y, marquee.b.y)}
                width={Math.abs(marquee.b.x - marquee.a.x)}
                height={Math.abs(marquee.b.y - marquee.a.y)}
                fill="#2563eb"
                fillOpacity={0.07}
                stroke="#2563eb"
                strokeWidth={1 / zoom}
                strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        </svg>
      </div>
      {rulersVisible && <Rulers width={size.w} height={size.h} />}
      <CanvasHud />
    </div>
  );
}

function GridLayer({ project }: { project: Project }) {
  const vp = useEditorStore((s) => s.viewport);
  if (!project.settings.gridVisible) return null;
  let step = project.settings.gridSize;
  while (step * vp.zoom < 7) step *= step < 1 ? 2 : 5;
  const major = step * (step === project.settings.gridSize ? 10 : 5);
  const px = step * vp.zoom;
  const mpx = major * vp.zoom;
  const ox = ((-vp.x * vp.zoom) % px + px) % px;
  const oy = ((-vp.y * vp.zoom) % px + px) % px;
  const mox = ((-vp.x * vp.zoom) % mpx + mpx) % mpx;
  const moy = ((-vp.y * vp.zoom) % mpx + mpx) % mpx;
  return (
    <>
      <defs>
        <pattern id="g-minor" patternUnits="userSpaceOnUse" width={px} height={px} x={ox} y={oy}>
          <path d={`M ${px} 0 L 0 0 0 ${px}`} fill="none" stroke="#dde3ea" strokeWidth="0.6" />
        </pattern>
        <pattern id="g-major" patternUnits="userSpaceOnUse" width={mpx} height={mpx} x={mox} y={moy}>
          <path d={`M ${mpx} 0 L 0 0 0 ${mpx}`} fill="none" stroke="#c3ccd7" strokeWidth="0.9" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#g-minor)" />
      <rect width="100%" height="100%" fill="url(#g-major)" />
    </>
  );
}

function WorldLayers({ project }: { project: Project }) {
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const selection = useEditorStore((s) => s.selection);
  const hover = useEditorStore((s) => s.hover);
  const highlight = useEditorStore((s) => s.highlight);
  const showCoverage = useEditorStore((s) => s.showCoverage);
  const showHeatmap = useEditorStore((s) => s.showHeatmap);
  const installer = useEditorStore((s) => s.installerMode);
  const showLabels = useEditorStore((s) => s.showLabels);
  const showPipeLabels = useEditorStore((s) => s.showPipeLabels);
  const activeZone = useEditorStore((s) => s.activeZoneId);
  const analysis = useAnalysis();
  const sel = useMemo(() => new Set(selection), [selection]);
  const hi = useMemo(() => new Set(highlight), [highlight]);
  const vis = useMemo(() => new Map(project.layers.map((l) => [l.id, l.visible])), [project.layers]);
  const zoneColor = useMemo(() => new Map(project.zones.map((z) => [z.id, z.color])), [project.zones]);
  const zoneNum = useMemo(() => new Map(project.zones.map((z) => [z.id, z.number])), [project.zones]);
  const perfs = useMemo(() => new Map(project.sprinklers.map((s) => [s.id, headPerformance(s)])), [project.sprinklers]);
  const v = (l: string) => vis.get(l as never) !== false;
  const areas = useMemo(
    () => [...project.areas].sort((a, b) => (a.type === "property" ? -1 : b.type === "property" ? 1 : polygonArea(b.points) - polygonArea(a.points))),
    [project.areas],
  );
  const pipes = useMemo(() => [...project.pipes].sort((a, b) => PIPE_ORDER.indexOf(a.kind) - PIPE_ORDER.indexOf(b.kind)), [project.pipes]);
  const bg = project.background;
  return (
    <g>
      {bg && bg.visible && v("background") && !installer && (
        <image href={bg.dataUrl} x={bg.x} y={bg.y} width={bg.pxWidth * bg.ftPerPx} height={bg.pxHeight * bg.ftPerPx} opacity={bg.opacity} preserveAspectRatio="none" style={{ imageRendering: "auto" }} />
      )}
      {areas.map((a) => v(a.layer) && <AreaShape key={a.id} a={installer ? { ...a, style: { ...a.style, fill: "#ffffff", opacity: a.type === "building" ? 0.9 : 0, pattern: a.type === "building" ? "hatch" : "none" } } : a} zoom={zoom} selected={sel.has(a.id)} hovered={hover === a.id} highlighted={hi.has(a.id)} showLabel={showLabels} />)}
      {!installer && project.plants.map((p) => v(p.layer) && <PlantShape key={p.id} p={p} zoom={zoom} selected={sel.has(p.id)} hovered={hover === p.id} />)}
      {project.lines.map((l) => v(l.layer) && <LineShape key={l.id} l={l} zoom={zoom} selected={sel.has(l.id)} hovered={hover === l.id} />)}
      {project.drips.map((d) => v(d.layer) && <DripShape key={d.id} d={d} zoom={zoom} color={d.zoneId ? zoneColor.get(d.zoneId) ?? "#0d9488" : "#0d9488"} selected={sel.has(d.id)} hovered={hover === d.id} />)}
      {showHeatmap && analysis?.coverage && <HeatmapImage grid={analysis.coverage} />}
      {showCoverage && !installer && v("coverage") && project.sprinklers.map((s) => <CoverageShape key={s.id} s={s} perf={perfs.get(s.id)!} color={s.zoneId ? zoneColor.get(s.zoneId) ?? "#2563eb" : "#64748b"} zoom={zoom} emphasize={sel.has(s.id) || (!!activeZone && s.zoneId === activeZone)} />)}
      {pipes.map((p) => {
        const layer = p.kind === "mainline" ? "mainline" : p.kind === "wire" ? "electrical" : p.kind === "drip" ? "drip" : "laterals";
        if (!v(layer)) return null;
        const color = (p.kind === "lateral" || p.kind === "drip") && p.zoneId ? zoneColor.get(p.zoneId) ?? PIPE_STYLE[p.kind].color : PIPE_STYLE[p.kind].color;
        return <PipeShape key={p.id} p={p} zoom={zoom} color={color} result={analysis?.hyd.pipes.get(p.id)} selected={sel.has(p.id)} hovered={hover === p.id} highlighted={hi.has(p.id)} showLabel={showPipeLabels} />;
      })}
      {project.fittings.map((f) => v(f.layer) && <FittingShape key={f.id} f={f} zoom={zoom} selected={sel.has(f.id)} hovered={hover === f.id} />)}
      {project.equipment.map((e) => v(e.layer) && <EquipmentShape key={e.id} e={e} zoom={zoom} selected={sel.has(e.id)} hovered={hover === e.id} />)}
      {project.waterSources.map((w) => <SourceShape key={w.id} w={w} zoom={zoom} selected={sel.has(w.id)} hovered={hover === w.id} />)}
      {project.valves.map((val) => {
        if (!v(val.layer)) return null;
        const z = project.zones.find((zz) => zz.valveId === val.id);
        return <ValveShape key={val.id} v={val} zoom={zoom} zoneNumber={z?.number} color={z?.color} selected={sel.has(val.id)} hovered={hover === val.id} highlighted={hi.has(val.id)} />;
      })}
      {v("sprinklers") &&
        project.sprinklers.map((s) => (
          <SprinklerShape
            key={s.id}
            s={s}
            perf={perfs.get(s.id)!}
            color={s.zoneId ? zoneColor.get(s.zoneId) ?? "#334155" : "#334155"}
            zoom={zoom}
            label={analysis?.labels.get(s.id) ?? (s.zoneId ? `Z${zoneNum.get(s.zoneId)}` : "")}
            selected={sel.has(s.id)}
            hovered={hover === s.id}
            highlighted={hi.has(s.id)}
            status={analysis?.hyd.heads.get(s.id)?.status}
            showLabel={showLabels}
          />
        ))}
      {v("measurements") && project.dimensions.map((d) => <DimensionShape key={d.id} d={d} zoom={zoom} selected={sel.has(d.id)} hovered={hover === d.id} />)}
      {v("labels") && project.labels.map((t) => <LabelShape key={t.id} t={t} zoom={zoom} selected={sel.has(t.id)} hovered={hover === t.id} />)}
      {installer && <InstallerRefs project={project} />}
    </g>
  );
}

function InstallerRefs({ project }: { project: Project }) {
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const selection = useEditorStore((s) => s.selection);
  const refs = useMemo(() => referenceLines(project), [project]);
  const heads = selection.length ? project.sprinklers.filter((s) => selection.includes(s.id)) : project.sprinklers;
  return (
    <g pointerEvents="none">
      {heads.map((h) => {
        const loc = locate(h.position, refs);
        return [loc.d1, loc.d2].map((r, i) =>
          r && r.dist < 80 && r.dist > 0.5 ? (
            <g key={`${h.id}-${i}`}>
              <line x1={h.position.x} y1={h.position.y} x2={r.foot.x} y2={r.foot.y} stroke="#2563eb" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} />
              {zoom > 3 && (
                <text x={(h.position.x + r.foot.x) / 2} y={(h.position.y + r.foot.y) / 2} fontSize={9 / zoom} fill="#1d4ed8" textAnchor="middle" style={{ paintOrder: "stroke" }} stroke="#fff" strokeWidth={3 / zoom} fontFamily="Inter, system-ui">
                  {Math.floor(r.dist)}&apos;-{Math.round((r.dist % 1) * 12)}&quot;
                </text>
              )}
            </g>
          ) : null,
        );
      })}
    </g>
  );
}

function HeatmapImage({ grid }: { grid: CoverageGrid }) {
  const url = useMemo(() => {
    if (typeof document === "undefined") return "";
    const c = document.createElement("canvas");
    c.width = grid.cols;
    c.height = grid.rows;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(grid.cols, grid.rows);
    for (let k = 0; k < grid.cols * grid.rows; k++) {
      if (!grid.mask[k]) continue;
      const cls = grid.cls[k];
      const rel = grid.median > 0 ? grid.rate[k] / grid.median : 0;
      let col: [number, number, number, number];
      if (grid.count[k] === 0) col = [185, 28, 28, 190];
      else if (cls === 1) col = [239, 68, 68, 150];
      else if (cls === 3) col = [79, 70, 229, 150];
      else {
        const t = Math.min(1, Math.max(0, (rel - 0.5) / 1.5));
        col = [34 + t * 20, 197 - t * 60, 94 + t * 60, 125];
      }
      img.data.set(col, k * 4);
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, [grid]);
  return <image href={url} x={grid.originX} y={grid.originY} width={grid.cols * grid.step} height={grid.rows * grid.step} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} pointerEvents="none" />;
}

function Rulers({ width, height }: { width: number; height: number }) {
  const vp = useEditorStore((s) => s.viewport);
  const cursor = useEditorStore((s) => s.cursor);
  const step = niceStep(vp.zoom, 56);
  const minor = step / (step >= 10 ? 5 : step >= 2 ? 2 : 2);
  const ticksX: React.ReactNode[] = [];
  const ticksY: React.ReactNode[] = [];
  const x0 = Math.floor(vp.x / minor) * minor;
  const x1 = vp.x + width / vp.zoom;
  for (let v = x0; v <= x1; v += minor) {
    const sx = (v - vp.x) * vp.zoom;
    const isMajor = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    ticksX.push(<line key={`x${v.toFixed(3)}`} x1={sx} y1={isMajor ? 8 : 15} x2={sx} y2={RULER} stroke="#64748b" strokeWidth={isMajor ? 1 : 0.6} />);
    if (isMajor)
      ticksX.push(
        <text key={`tx${v.toFixed(3)}`} x={sx + 3} y={10} fontSize={9.5} fill="#334155" fontFamily="Inter, system-ui">
          {fmt(v)}
        </text>,
      );
  }
  const y0 = Math.floor(vp.y / minor) * minor;
  const y1 = vp.y + height / vp.zoom;
  for (let v = y0; v <= y1; v += minor) {
    const sy = (v - vp.y) * vp.zoom;
    const isMajor = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    ticksY.push(<line key={`y${v.toFixed(3)}`} y1={sy} x1={isMajor ? 8 : 15} y2={sy} x2={RULER} stroke="#64748b" strokeWidth={isMajor ? 1 : 0.6} />);
    if (isMajor)
      ticksY.push(
        <text key={`ty${v.toFixed(3)}`} x={10} y={sy - 3} fontSize={9.5} fill="#334155" fontFamily="Inter, system-ui" transform={`rotate(-90 10 ${sy - 3})`}>
          {fmt(v)}
        </text>,
      );
  }
  const cs = cursor ? toScreen(vp, cursor) : null;
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0" width={width + RULER} height={RULER} style={{ left: 0 }}>
        <rect x={0} y={0} width="100%" height={RULER} fill="#ffffff" />
        <g transform={`translate(${RULER} 0)`}>
          {ticksX}
          {cs && <line x1={cs.x} y1={0} x2={cs.x} y2={RULER} stroke="#dc2626" strokeWidth={1.2} />}
        </g>
        <line x1={0} y1={RULER - 0.5} x2="100%" y2={RULER - 0.5} stroke="#cbd5e1" />
        <text x={4} y={14} fontSize={9} fill="#94a3b8" fontFamily="Inter, system-ui">
          ft
        </text>
      </svg>
      <svg className="pointer-events-none absolute left-0" width={RULER} height={height} style={{ top: RULER }}>
        <rect x={0} y={0} width={RULER} height="100%" fill="#ffffff" />
        {ticksY}
        {cs && <line y1={cs.y} x1={0} y2={cs.y} x2={RULER} stroke="#dc2626" strokeWidth={1.2} />}
        <line x1={RULER - 0.5} y1={0} x2={RULER - 0.5} y2="100%" stroke="#cbd5e1" />
      </svg>
    </>
  );
}

function fmt(v: number) {
  const r = Math.round(v * 100) / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}'`;
}

function CanvasHud() {
  const toast = useEditorStore((s) => s.toast);
  const showHeatmap = useEditorStore((s) => s.showHeatmap);
  const tool = useEditorStore((s) => s.tool);
  const draft = useEditorStore((s) => s.draft);
  const opts = useEditorStore((s) => s.opts);
  const hint = TOOL_HINTS[tool]?.(draft.length, opts.areaShape);
  return (
    <>
      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow">
          {hint}
        </div>
      )}
      {showHeatmap && (
        <div className="pointer-events-none absolute bottom-3 left-8 flex items-center gap-3 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm">
          <span className="font-semibold">Coverage</span>
          <Legend color="rgb(185,28,28)" label="Dry" />
          <Legend color="rgb(239,68,68)" label="Insufficient" />
          <Legend color="rgb(34,197,94)" label="Acceptable" />
          <Legend color="rgb(79,70,229)" label="Excessive" />
        </div>
      )}
      {toast && (
        <div className={`pointer-events-none absolute bottom-4 right-4 rounded-md px-3 py-2 text-sm text-white shadow-lg ${toast.kind === "success" ? "bg-emerald-600" : toast.kind === "warn" ? "bg-amber-600" : "bg-slate-800"}`}>{toast.msg}</div>
      )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: color, opacity: 0.75 }} />
      {label}
    </span>
  );
}

const TOOL_HINTS: Partial<Record<string, (n: number, shape: string) => string | null>> = {
  area: (n, shape) => (shape === "rectangle" ? "Drag to draw a rectangle" : shape === "circle" ? "Drag from center to set radius" : n === 0 ? "Click to place vertices · click first point or double-click to close" : `${n} point(s) · click first point, double-click or Enter to close · Esc cancels`),
  line: (n) => (n === 0 ? "Click to start the line" : "Double-click or Enter to finish · Esc cancels"),
  drip: (n) => (n === 0 ? "Outline the drip area" : "Click first point or double-click to close"),
  pipe: (n) => (n === 0 ? "Click to start the pipe (snaps to heads, valves and pipes) · Shift = 45° angles" : null),
  sprinkler: () => "Click to place · arc auto-fits the area (toggle in the tool panel)",
  fitting: () => "Click on a pipe to place the fitting",
  valve: () => "Click to place a valve (creates a new zone)",
  measure: () => "Click points to measure · double-click to restart · Esc clears",
  dimension: (n) => (n === 0 ? "Click the first point" : n === 1 ? "Click the second point" : "Click to place the dimension line (Shift = horizontal/vertical)"),
  calibrate: (n) => (n === 0 ? "Click the first point of a known distance on the background" : "Click the second point"),
  source: () => "Click to place the point of connection",
  equipment: () => "Click to place equipment",
  plant: () => "Click to place",
  text: () => "Click to place a text label",
};

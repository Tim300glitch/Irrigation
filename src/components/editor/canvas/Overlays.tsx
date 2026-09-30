"use client";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { Project } from "@/lib/model/types";
import { getHandles } from "./handles";
import { selectionBounds } from "@/lib/editor/ops";
import { angleOf, dist, polygonArea, polygonPerimeter, polylineLength, sub, type Vec } from "@/lib/geometry/geometry";
import { formatArea, formatFeetInches } from "@/lib/units/units";
import { dimensionGeometry } from "@/lib/plan/planSvg";
import { headPerformance } from "@/lib/irrigation/sprinkler";
import { arcPath } from "@/lib/plan/symbols";
import { getProduct } from "@/lib/catalog/sprinklers";
import { SEL } from "./shapes";

const pts = (ps: Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

function Readout({ p, zoom, lines }: { p: Vec; zoom: number; lines: string[] }) {
  const fs = 11 / zoom;
  const w = (Math.max(...lines.map((l) => l.length)) * 6.4 + 12) / zoom;
  const h = (lines.length * 15 + 6) / zoom;
  return (
    <g pointerEvents="none" fontFamily="Inter, system-ui" fontSize={fs}>
      <rect x={p.x + 12 / zoom} y={p.y + 12 / zoom} width={w} height={h} rx={4 / zoom} fill="#0f172a" fillOpacity={0.88} />
      {lines.map((l, i) => (
        <text key={i} x={p.x + 18 / zoom} y={p.y + (26 + i * 15) / zoom} fill="#fff" fontWeight={i === 0 ? 600 : 400}>
          {l}
        </text>
      ))}
    </g>
  );
}

export function SelectionOverlay({ project }: { project: Project }) {
  const selection = useEditorStore((s) => s.selection);
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const tool = useEditorStore((s) => s.tool);
  if (!selection.length || tool !== "select") return null;
  const handles = getHandles(project, selection, zoom);
  const b = selectionBounds(project, selection);
  const hs = 4.5 / zoom;
  const single = selection.length === 1 ? project.sprinklers.find((s) => s.id === selection[0]) : undefined;
  const perf = single ? headPerformance(single) : null;
  const box = handles.some((h) => h.kind === "scale" || h.kind === "rotate");
  return (
    <g>
      {b && box && <rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} fill="none" stroke={SEL} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />}
      {single && perf && (
        <g pointerEvents="none">
          <path d={arcPath(single.position.x, single.position.y, perf.radius, single.arcStart, single.arc)} fill="none" stroke={SEL} strokeWidth={1.4 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} />
          {perf.radius < perf.catalogRadius - 0.01 && <path d={arcPath(single.position.x, single.position.y, perf.catalogRadius, single.arcStart, single.arc)} fill="none" stroke="#94a3b8" strokeWidth={1 / zoom} strokeDasharray={`${2 / zoom} ${3 / zoom}`} />}
        </g>
      )}
      {handles.map((h) => {
        if (h.kind === "rotate")
          return (
            <g key={h.id}>
              <line x1={h.p.x} y1={h.p.y} x2={h.p.x} y2={b ? b.minY : h.p.y} stroke={SEL} strokeWidth={1 / zoom} />
              <circle cx={h.p.x} cy={h.p.y} r={hs * 1.2} fill="#fff" stroke={SEL} strokeWidth={1.5 / zoom} style={{ cursor: "grab" }} />
            </g>
          );
        if (h.kind === "mid") return <circle key={h.id} cx={h.p.x} cy={h.p.y} r={hs * 0.75} fill={SEL} fillOpacity={0.35} stroke={SEL} strokeWidth={1 / zoom} />;
        if (h.kind === "radius" || h.kind === "arcStart" || h.kind === "arcEnd" || h.kind === "canopy")
          return (
            <g key={h.id}>
              <circle cx={h.p.x} cy={h.p.y} r={hs * 1.15} fill={h.kind === "radius" || h.kind === "canopy" ? "#f59e0b" : "#fff"} stroke={h.kind === "radius" ? "#b45309" : SEL} strokeWidth={1.6 / zoom} />
            </g>
          );
        return <rect key={h.id} x={h.p.x - hs} y={h.p.y - hs} width={hs * 2} height={hs * 2} fill="#fff" stroke={SEL} strokeWidth={1.5 / zoom} />;
      })}
      {single && perf && (
        <Readout
          p={handles.find((h) => h.kind === "radius")?.p ?? single.position}
          zoom={zoom}
          lines={[`Throw ${perf.radius.toFixed(1)}' ${perf.radius < perf.catalogRadius - 0.01 ? `(−${(perf.radiusReduction * 100).toFixed(0)}%)` : ""}`, `Arc ${Math.round(single.arc)}° · ${perf.flowGpm.toFixed(2)} GPM`]}
        />
      )}
    </g>
  );
}

export function DraftOverlay({ project }: { project: Project }) {
  const tool = useEditorStore((s) => s.tool);
  const draft = useEditorStore((s) => s.draft);
  const cursor = useEditorStore((s) => s.cursor);
  const snap = useEditorStore((s) => s.snap);
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const opts = useEditorStore((s) => s.opts);
  const measure = useEditorStore((s) => s.measurePoints);
  const cur = snap?.point ?? cursor;
  const els: React.ReactNode[] = [];
  const sw = 1.6 / zoom;
  if (cur && (tool === "area" || tool === "drip" || tool === "line") && draft.length) {
    const closed = tool !== "line";
    const all = opts.areaShape === "polygon" || tool !== "area" ? [...draft, cur] : draft;
    els.push(<polyline key="d" points={pts(closed && all.length > 2 ? [...all, all[0]] : all)} fill={closed ? "#2563eb" : "none"} fillOpacity={0.08} stroke={SEL} strokeWidth={sw} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />);
    draft.forEach((p, i) => els.push(<rect key={`v${i}`} x={p.x - 3 / zoom} y={p.y - 3 / zoom} width={6 / zoom} height={6 / zoom} fill="#fff" stroke={SEL} strokeWidth={1.2 / zoom} />));
    const last = draft[draft.length - 1];
    const lines = [`Segment ${formatFeetInches(dist(last, cur))}`, `Angle ${((-angleOf(sub(cur, last)) + 360) % 360).toFixed(0)}°`];
    if (closed && all.length >= 3) lines.push(`Area ${formatArea(polygonArea(all))}`);
    els.push(<Readout key="r" p={cur} zoom={zoom} lines={lines} />);
  }
  if (cur && tool === "pipe") {
    const last = draft[draft.length - 1];
    if (last) {
      els.push(<line key="p" x1={last.x} y1={last.y} x2={cur.x} y2={cur.y} stroke={opts.pipeKind === "mainline" ? "#7c3aed" : "#0f172a"} strokeWidth={Math.max(2.5 / zoom, 0.1)} strokeDasharray={`${6 / zoom} ${3 / zoom}`} />);
      els.push(<Readout key="r" p={cur} zoom={zoom} lines={[`${opts.pipeKind} ${formatFeetInches(dist(last, cur))}`, "Click = next · Dbl-click/Esc = end", "Space/middle/right-drag = pan"]} />);
    }
  }
  if (cur && tool === "sprinkler") {
    const product = getProduct(opts.sprinklerProduct);
    const nz = product.nozzles.find((n) => n.id === opts.sprinklerNozzle) ?? product.nozzles[0];
    els.push(<circle key="s" cx={cur.x} cy={cur.y} r={nz.radius} fill="#2563eb" fillOpacity={0.06} stroke="#2563eb" strokeOpacity={0.5} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />);
  }
  if (cur && tool === "dimension" && draft.length) {
    const a = draft[0];
    const b = draft[1] ?? cur;
    if (draft.length === 1) els.push(<line key="dm" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1e3a8a" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />);
    else {
      const L = dist(a, b) || 1;
      const off = (cur.x - a.x) * (-(b.y - a.y) / L) + (cur.y - a.y) * ((b.x - a.x) / L);
      const g = dimensionGeometry(a, b, "aligned", off);
      els.push(<line key="dm" x1={g.d1.x} y1={g.d1.y} x2={g.d2.x} y2={g.d2.y} stroke="#1e3a8a" strokeWidth={1 / zoom} />);
    }
    els.push(<Readout key="r" p={cur} zoom={zoom} lines={[formatFeetInches(dist(a, b))]} />);
  }
  if (tool === "calibrate" && draft.length && cur) {
    els.push(<line key="c" x1={draft[0].x} y1={draft[0].y} x2={cur.x} y2={cur.y} stroke="#dc2626" strokeWidth={2 / zoom} />);
    els.push(<Readout key="r" p={cur} zoom={zoom} lines={["Calibrate: click the 2nd known point", `${dist(draft[0], cur).toFixed(2)} ft (current scale)`]} />);
  }
  if (tool === "measure" && measure.length) {
    const mode = opts.measureMode;
    const all = cur && !(mode === "angle" && measure.length >= 3) && !(mode === "radius" && measure.length >= 2) ? [...measure, cur] : measure;
    const c = "#db2777";
    if (mode === "distance") {
      els.push(<polyline key="m" points={pts(all)} fill="none" stroke={c} strokeWidth={2 / zoom} strokeDasharray={`${6 / zoom} ${3 / zoom}`} />);
      const L = polylineLength(all);
      const lastSeg = all.length >= 2 ? dist(all[all.length - 2], all[all.length - 1]) : 0;
      els.push(<Readout key="r" p={all[all.length - 1]} zoom={zoom} lines={[`Total ${formatFeetInches(L)}`, `Segment ${formatFeetInches(lastSeg)}`, `${L.toFixed(2)} ft`]} />);
    } else if (mode === "area") {
      els.push(<polygon key="m" points={pts(all)} fill={c} fillOpacity={0.12} stroke={c} strokeWidth={2 / zoom} />);
      if (all.length >= 3) els.push(<Readout key="r" p={all[all.length - 1]} zoom={zoom} lines={[`Area ${formatArea(polygonArea(all))}`, `Perimeter ${formatFeetInches(polygonPerimeter(all))}`]} />);
    } else if (mode === "radius") {
      if (all.length >= 2) {
        const r = dist(all[0], all[1]);
        els.push(<circle key="m" cx={all[0].x} cy={all[0].y} r={r} fill={c} fillOpacity={0.06} stroke={c} strokeWidth={1.5 / zoom} />);
        els.push(<line key="l" x1={all[0].x} y1={all[0].y} x2={all[1].x} y2={all[1].y} stroke={c} strokeWidth={1.5 / zoom} />);
        els.push(<Readout key="r" p={all[1]} zoom={zoom} lines={[`Radius ${formatFeetInches(r)}`, `Diameter ${formatFeetInches(2 * r)}`, `Area ${formatArea(Math.PI * r * r)}`]} />);
      }
    } else if (mode === "angle") {
      els.push(<polyline key="m" points={pts(all)} fill="none" stroke={c} strokeWidth={2 / zoom} />);
      if (all.length >= 3) {
        const a1 = angleOf(sub(all[0], all[1]));
        const a2 = angleOf(sub(all[2], all[1]));
        let ang = Math.abs(a2 - a1) % 360;
        if (ang > 180) ang = 360 - ang;
        els.push(<Readout key="r" p={all[1]} zoom={zoom} lines={[`Angle ${ang.toFixed(1)}°`]} />);
      }
    }
    measure.forEach((p, i) => els.push(<circle key={`mp${i}`} cx={p.x} cy={p.y} r={3 / zoom} fill={c} />));
  }
  if (snap && snap.kind !== "none" && snap.kind !== "grid" && cur && tool !== "select") {
    const s = 6 / zoom;
    els.push(
      snap.kind === "edge" ? (
        <path key="snap" d={`M${cur.x - s},${cur.y - s} L${cur.x + s},${cur.y + s} M${cur.x - s},${cur.y + s} L${cur.x + s},${cur.y - s}`} stroke="#16a34a" strokeWidth={2 / zoom} />
      ) : (
        <rect key="snap" x={cur.x - s} y={cur.y - s} width={s * 2} height={s * 2} fill="none" stroke="#16a34a" strokeWidth={2 / zoom} />
      ),
    );
  }
  if (cur && tool !== "select" && tool !== "pan") {
    const s = 10 / zoom;
    els.push(<path key="xh" d={`M${cur.x - s},${cur.y} H${cur.x + s} M${cur.x},${cur.y - s} V${cur.y + s}`} stroke="#0f172a" strokeOpacity={0.6} strokeWidth={1 / zoom} pointerEvents="none" />);
  }
  void project;
  return <g pointerEvents="none">{els}</g>;
}

export function useProjectOrNull() {
  return useProjectStore((s) => s.project);
}

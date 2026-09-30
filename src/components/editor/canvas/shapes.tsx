"use client";
/** Memoized SVG renderers for each canvas object type (world coordinates, feet). */
import { memo } from "react";
import type { Area, Dimension, DripArea, Equipment, Fitting, LineObj, Pipe, Plant, Sprinkler, TextLabel, Valve, WaterSource } from "@/lib/model/types";
import type { HeadPerformance } from "@/lib/irrigation/sprinkler";
import type { HeadResult, PipeResult } from "@/lib/hydraulics/analysis";
import { arcPath, EQUIPMENT_ABBR, FITTING_ABBR, PIPE_STYLE } from "@/lib/plan/symbols";
import { dimensionGeometry, labelPoint } from "@/lib/plan/planSvg";
import { formatArea, formatFeetInches, pipeSizeLabel } from "@/lib/units/units";
import { polygonArea, polylineLength, type Vec } from "@/lib/geometry/geometry";

export const SEL = "#2563eb";
const HOVER = "#f59e0b";
const pts = (ps: Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");
const dashFor = (s: string, z: number) => (s === "dashed" ? `${6 / z} ${4 / z}` : s === "dotted" ? `${1.5 / z} ${3 / z}` : s === "dashdot" ? `${10 / z} ${3 / z} ${2 / z} ${3 / z}` : undefined);

export function CanvasPatterns() {
  return (
    <defs>
      <pattern id="cp-hatch" patternUnits="userSpaceOnUse" width="1.5" height="1.5" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="1.5" stroke="#64748b" strokeWidth="0.12" />
      </pattern>
      <pattern id="cp-crosshatch" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="rotate(45)">
        <path d="M0,0 V2 M0,0 H2" stroke="#94a3b8" strokeWidth="0.1" />
      </pattern>
      <pattern id="cp-dots" patternUnits="userSpaceOnUse" width="1.6" height="1.6">
        <circle cx="0.8" cy="0.8" r="0.14" fill="#7c5a3c" opacity="0.5" />
      </pattern>
      <pattern id="cp-grass" patternUnits="userSpaceOnUse" width="3" height="3">
        <path d="M0.6,1.3 l0.2,-0.5 M0.9,1.3 l-0.1,-0.45 M2.1,2.8 l0.2,-0.5 M2.4,2.8 l-0.1,-0.45" stroke="#15803d" strokeWidth="0.09" opacity="0.55" />
      </pattern>
      <pattern id="cp-brick" patternUnits="userSpaceOnUse" width="2" height="1">
        <path d="M0,0 H2 M0,0.5 H2 M0.5,0 V0.5 M1.5,0.5 V1" stroke="#8b6f53" strokeWidth="0.06" fill="none" opacity="0.7" />
      </pattern>
    </defs>
  );
}

export const AreaShape = memo(function AreaShape({ a, zoom, selected, hovered, highlighted, showLabel }: { a: Area; zoom: number; selected: boolean; hovered: boolean; highlighted: boolean; showLabel: boolean }) {
  const st = a.style;
  const stroke = selected ? SEL : highlighted ? "#dc2626" : hovered ? HOVER : st.stroke;
  const sw = (selected || hovered || highlighted ? st.strokeWidth + 1 : st.strokeWidth) / zoom;
  const patternId = st.pattern === "none" || st.pattern === "solid" ? null : `cp-${st.pattern === "crosshatch" ? "crosshatch" : st.pattern}`;
  const c = showLabel && a.showLabel ? labelPoint(a.points) : null;
  const fs = 11 / zoom;
  return (
    <g>
      <polygon points={pts(a.points)} fill={st.pattern === "none" ? "none" : st.fill} fillOpacity={st.opacity} stroke={stroke} strokeWidth={sw} strokeDasharray={dashFor(st.lineStyle, zoom)} strokeLinejoin="round" />
      {patternId && <polygon points={pts(a.points)} fill={`url(#${patternId})`} pointerEvents="none" />}
      {c && zoom > 1.2 && (
        <g pointerEvents="none" fontSize={fs} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
          <text x={c.x} y={c.y} fill="#334155" fontWeight={600} style={{ paintOrder: "stroke" }} stroke="#ffffff" strokeWidth={3 / zoom} strokeOpacity={0.7}>
            {a.name}
          </text>
          {a.type !== "building" && a.type !== "property" && (
            <text x={c.x} y={c.y + fs * 1.25} fill="#64748b" style={{ paintOrder: "stroke" }} stroke="#ffffff" strokeWidth={3 / zoom} strokeOpacity={0.7} fontSize={fs * 0.9}>
              {formatArea(polygonArea(a.points))}
            </text>
          )}
        </g>
      )}
    </g>
  );
});

export const LineShape = memo(function LineShape({ l, zoom, selected, hovered }: { l: LineObj; zoom: number; selected: boolean; hovered: boolean }) {
  return (
    <polyline
      points={pts(l.points)}
      fill="none"
      stroke={selected ? SEL : hovered ? HOVER : l.style.stroke}
      strokeWidth={(l.style.strokeWidth + (selected ? 1 : 0)) / zoom}
      strokeDasharray={dashFor(l.style.lineStyle, zoom)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});

export const PlantShape = memo(function PlantShape({ p, zoom, selected, hovered }: { p: Plant; zoom: number; selected: boolean; hovered: boolean }) {
  const stroke = selected ? SEL : hovered ? HOVER : "#15803d";
  if (p.type === "tree")
    return (
      <g>
        <circle cx={p.position.x} cy={p.position.y} r={p.canopyRadius} fill="#16a34a" fillOpacity={0.14} stroke={stroke} strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
        <circle cx={p.position.x} cy={p.position.y} r={Math.max(0.35, 2.5 / zoom)} fill="#15803d" />
      </g>
    );
  return <circle cx={p.position.x} cy={p.position.y} r={p.canopyRadius} fill="#22c55e" fillOpacity={0.35} stroke={stroke} strokeWidth={1 / zoom} />;
});

export const DripShape = memo(function DripShape({ d, zoom, color, selected, hovered }: { d: DripArea; zoom: number; color: string; selected: boolean; hovered: boolean }) {
  const c = labelPoint(d.points);
  const rows = d.rowSpacingIn / 12;
  return (
    <g>
      <defs>
        <pattern id={`drip-${d.id}`} patternUnits="userSpaceOnUse" width={rows} height={rows}>
          <line x1="0" y1={rows / 2} x2={rows} y2={rows / 2} stroke={color} strokeWidth={Math.max(0.05, 0.8 / zoom)} strokeOpacity="0.6" />
        </pattern>
      </defs>
      <polygon points={pts(d.points)} fill={color} fillOpacity={0.08} stroke={selected ? SEL : hovered ? HOVER : color} strokeWidth={(selected ? 2.5 : 1.5) / zoom} strokeDasharray={`${6 / zoom} ${3 / zoom}`} />
      <polygon points={pts(d.points)} fill={`url(#drip-${d.id})`} pointerEvents="none" />
      {zoom > 2 && (
        <text x={c.x} y={c.y} fontSize={10 / zoom} textAnchor="middle" fill={color} fontWeight={600} pointerEvents="none" fontFamily="Inter, system-ui">
          {d.name} · drip {d.emitterGph} GPH @ {d.emitterSpacingIn}&quot;
        </text>
      )}
    </g>
  );
});

export const CoverageShape = memo(function CoverageShape({ s, perf, color, zoom, emphasize }: { s: Sprinkler; perf: HeadPerformance; color: string; zoom: number; emphasize: boolean }) {
  if (perf.product.category === "emitter") return null;
  const d = arcPath(s.position.x, s.position.y, perf.radius, s.arcStart, s.arc);
  return <path d={d} fill={color} fillOpacity={emphasize ? 0.2 : 0.09} stroke={color} strokeOpacity={emphasize ? 0.9 : 0.4} strokeWidth={(emphasize ? 1.5 : 0.8) / zoom} pointerEvents="none" />;
});

export const PipeShape = memo(function PipeShape({ p, zoom, color, result, selected, hovered, highlighted, showLabel }: { p: Pipe; zoom: number; color: string; result?: PipeResult; selected: boolean; hovered: boolean; highlighted: boolean; showLabel: boolean }) {
  const st = PIPE_STYLE[p.kind];
  const w = Math.max(st.width / zoom, p.kind === "sleeve" ? 0.6 : 0);
  const over = result && result.maxVelocity > 5.0001 && p.kind !== "sleeve" && p.kind !== "wire";
  const label = showLabel && (p.kind === "lateral" || p.kind === "mainline" || p.kind === "drip") && polylineLength(p.points) * zoom > 60;
  const a = p.points[0];
  const b = p.points[p.points.length - 1];
  let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const size = result?.sizes[0] ?? p.size;
  return (
    <g>
      {(selected || hovered || highlighted) && <polyline points={pts(p.points)} fill="none" stroke={selected ? SEL : highlighted ? "#dc2626" : HOVER} strokeOpacity={0.35} strokeWidth={w + 6 / zoom} strokeLinecap="round" strokeLinejoin="round" />}
      {p.kind === "sleeve" ? (
        <>
          <polyline points={pts(p.points)} fill="none" stroke="#475569" strokeWidth={w} strokeLinecap="butt" />
          <polyline points={pts(p.points)} fill="none" stroke="#f8fafc" strokeWidth={w * 0.6} strokeLinecap="butt" />
        </>
      ) : (
        <polyline points={pts(p.points)} fill="none" stroke={over ? "#dc2626" : color} strokeWidth={w} strokeDasharray={st.dash ? st.dash.split(" ").map((n) => +n / zoom).join(" ") : undefined} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {label && (
        <text x={mid.x} y={mid.y - 4 / zoom} fontSize={9.5 / zoom} textAnchor="middle" fill={over ? "#dc2626" : color} fontWeight={600} transform={`rotate(${ang} ${mid.x} ${mid.y})`} style={{ paintOrder: "stroke" }} stroke="#ffffff" strokeWidth={3 / zoom} pointerEvents="none" fontFamily="Inter, system-ui">
          {pipeSizeLabel(size)}
          {p.kind === "mainline" ? " ML" : ""}
          {result && result.maxFlow > 0 ? ` · ${result.maxFlow.toFixed(1)} gpm` : ""}
        </text>
      )}
    </g>
  );
});

export const SprinklerShape = memo(function SprinklerShape({ s, perf, color, zoom, label, selected, hovered, highlighted, status, showLabel }: { s: Sprinkler; perf: HeadPerformance; color: string; zoom: number; label: string; selected: boolean; hovered: boolean; highlighted: boolean; status?: HeadResult["status"]; showLabel: boolean }) {
  const cat = perf.product.category;
  const R = Math.max(0.35, 5.5 / zoom);
  const x = s.position.x;
  const y = s.position.y;
  const bad = status === "below-min" || status === "disconnected";
  const warn = status === "low" || status === "high" || status === "no-valve" || status === "no-zone";
  return (
    <g>
      {(selected || hovered || highlighted) && <circle cx={x} cy={y} r={R * 1.9} fill="none" stroke={selected ? SEL : highlighted ? "#dc2626" : HOVER} strokeWidth={2 / zoom} />}
      {cat === "emitter" ? (
        <circle cx={x} cy={y} r={R * 0.5} fill={color} />
      ) : cat === "bubbler" ? (
        <polygon points={`${x},${y - R} ${x + R},${y + R * 0.8} ${x - R},${y + R * 0.8}`} fill="#fff" stroke={color} strokeWidth={1.4 / zoom} />
      ) : (
        <>
          <circle cx={x} cy={y} r={R} fill="#fff" stroke={color} strokeWidth={1.5 / zoom} />
          <path d={arcPath(x, y, R, s.arcStart, s.arc)} fill={color} />
          {(cat === "spray" || cat === "rotary" || cat === "microspray") && <circle cx={x} cy={y} r={R * 0.42} fill="#fff" stroke={color} strokeWidth={0.8 / zoom} />}
        </>
      )}
      {(bad || warn) && <circle cx={x + R} cy={y - R} r={R * 0.45} fill={bad ? "#dc2626" : "#f59e0b"} stroke="#fff" strokeWidth={0.8 / zoom} />}
      {showLabel && zoom > 2.2 && (
        <text x={x + R * 1.3} y={y - R * 1.1} fontSize={9.5 / zoom} fill="#0f172a" fontWeight={600} style={{ paintOrder: "stroke" }} stroke="#fff" strokeWidth={2.5 / zoom} pointerEvents="none" fontFamily="Inter, system-ui">
          {label}
        </text>
      )}
    </g>
  );
});

export const ValveShape = memo(function ValveShape({ v, zoom, zoneNumber, color, selected, hovered, highlighted }: { v: Valve; zoom: number; zoneNumber?: number; color?: string; selected: boolean; hovered: boolean; highlighted: boolean }) {
  const s = Math.max(0.5, 7 / zoom);
  const x = v.position.x;
  const y = v.position.y;
  return (
    <g>
      {(selected || hovered || highlighted) && <rect x={x - s * 1.5} y={y - s * 1.5} width={s * 3} height={s * 3} fill="none" stroke={selected ? SEL : highlighted ? "#dc2626" : HOVER} strokeWidth={2 / zoom} />}
      <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={color ?? "#fff"} stroke="#0f172a" strokeWidth={1.4 / zoom} rx={s * 0.2} />
      <text x={x} y={y + s * 0.42} fontSize={s * 1.2} textAnchor="middle" fill={color ? "#fff" : "#0f172a"} fontWeight={700} pointerEvents="none" fontFamily="Inter, system-ui">
        {v.type === "master" ? "M" : v.type === "isolation" ? "ISO" : v.type === "prv" ? "PRV" : zoneNumber ?? "V"}
      </text>
    </g>
  );
});

export const EquipmentShape = memo(function EquipmentShape({ e, zoom, selected, hovered }: { e: Equipment; zoom: number; selected: boolean; hovered: boolean }) {
  const s = Math.max(0.6, 8 / zoom);
  return (
    <g>
      <rect x={e.position.x - s * 1.2} y={e.position.y - s * 0.8} width={s * 2.4} height={s * 1.6} fill="#fff" stroke={selected ? SEL : hovered ? HOVER : "#334155"} strokeWidth={(selected ? 2.2 : 1.3) / zoom} rx={s * 0.2} />
      <text x={e.position.x} y={e.position.y + s * 0.35} fontSize={s * 0.95} textAnchor="middle" fill="#0f172a" fontWeight={700} pointerEvents="none" fontFamily="Inter, system-ui">
        {EQUIPMENT_ABBR[e.type]}
      </text>
    </g>
  );
});

export const SourceShape = memo(function SourceShape({ w, zoom, selected, hovered }: { w: WaterSource; zoom: number; selected: boolean; hovered: boolean }) {
  const r = Math.max(0.8, 10 / zoom);
  const hex = [0, 60, 120, 180, 240, 300].map((a) => `${w.position.x + r * Math.cos((a * Math.PI) / 180)},${w.position.y + r * Math.sin((a * Math.PI) / 180)}`).join(" ");
  return (
    <g>
      <polygon points={hex} fill="#dbeafe" stroke={selected ? SEL : hovered ? HOVER : "#1d4ed8"} strokeWidth={(selected ? 2.5 : 1.5) / zoom} />
      <text x={w.position.x} y={w.position.y + r * 0.3} fontSize={r * 0.72} textAnchor="middle" fill="#1e3a8a" fontWeight={700} pointerEvents="none" fontFamily="Inter, system-ui">
        POC
      </text>
    </g>
  );
});

export const FittingShape = memo(function FittingShape({ f, zoom, selected, hovered }: { f: Fitting; zoom: number; selected: boolean; hovered: boolean }) {
  const s = Math.max(0.35, 5 / zoom);
  const x = f.position.x;
  const y = f.position.y;
  return (
    <g transform={`rotate(${f.rotation} ${x} ${y})`}>
      <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill="#fef3c7" stroke={selected ? SEL : hovered ? HOVER : "#92400e"} strokeWidth={(selected ? 2 : 1.2) / zoom} />
      <text x={x} y={y + s * 0.38} fontSize={s * (FITTING_ABBR[f.type].length > 2 ? 0.75 : 1.05)} textAnchor="middle" fill="#78350f" fontWeight={700} pointerEvents="none" fontFamily="Inter, system-ui">
        {FITTING_ABBR[f.type]}
      </text>
    </g>
  );
});

export const DimensionShape = memo(function DimensionShape({ d, zoom, selected, hovered }: { d: Dimension; zoom: number; selected: boolean; hovered: boolean }) {
  const g = dimensionGeometry(d.a, d.b, d.kind, d.offset);
  const c = selected ? SEL : hovered ? HOVER : "#1e3a8a";
  const [e1a, e1b, e2a, e2b] = g.ext;
  let ang = (Math.atan2(g.d2.y - g.d1.y, g.d2.x - g.d1.x) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mx = (g.d1.x + g.d2.x) / 2;
  const my = (g.d1.y + g.d2.y) / 2;
  const t = 4 / zoom;
  const tick = (p: Vec) => <line x1={p.x - t} y1={p.y + t} x2={p.x + t} y2={p.y - t} stroke={c} strokeWidth={1.3 / zoom} />;
  return (
    <g>
      <line x1={e1a.x} y1={e1a.y} x2={e1b.x} y2={e1b.y} stroke={c} strokeWidth={0.7 / zoom} />
      <line x1={e2a.x} y1={e2a.y} x2={e2b.x} y2={e2b.y} stroke={c} strokeWidth={0.7 / zoom} />
      <line x1={g.d1.x} y1={g.d1.y} x2={g.d2.x} y2={g.d2.y} stroke={c} strokeWidth={1 / zoom} />
      {tick(g.d1)}
      {tick(g.d2)}
      <text x={mx} y={my - 3 / zoom} fontSize={11 / zoom} textAnchor="middle" fill={c} fontWeight={600} transform={`rotate(${ang} ${mx} ${my})`} style={{ paintOrder: "stroke" }} stroke="#fff" strokeWidth={3 / zoom} pointerEvents="none" fontFamily="Inter, system-ui">
        {formatFeetInches(g.length)}
      </text>
    </g>
  );
});

export const LabelShape = memo(function LabelShape({ t, zoom, selected, hovered }: { t: TextLabel; zoom: number; selected: boolean; hovered: boolean }) {
  return (
    <g>
      {(selected || hovered) && <rect x={t.position.x - 0.3} y={t.position.y - t.size - 0.2} width={t.text.length * t.size * 0.58 + 0.6} height={t.size + 0.6} fill="none" stroke={selected ? SEL : HOVER} strokeWidth={1.5 / zoom} transform={`rotate(${t.rotation} ${t.position.x} ${t.position.y})`} />}
      <text x={t.position.x} y={t.position.y} fontSize={t.size} fill={t.color} fontWeight={600} transform={`rotate(${t.rotation} ${t.position.x} ${t.position.y})`} fontFamily="Inter, system-ui" pointerEvents="none">
        {t.text}
      </text>
    </g>
  );
});

"use client";
/**
 * Interactive irrigation system map. Map units are an abstract canvas
 * (mapWidth × mapHeight) with a feet-per-unit scale for measuring. Points
 * (heads, valves, equipment), polylines (main, laterals, drip, sleeves, wire)
 * and polygons (lawn, beds, structures, hardscape) are SystemComponent rows.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MousePointer2, Hand, Ruler, Trash2, Upload, Printer, Layers, Wand2, PencilRuler, ZoomIn, ZoomOut, Maximize2, Copy, X, Check as CheckIcon, Image as ImageIcon } from "lucide-react";
import type { ComponentType, IrrigationSystem, SystemComponent, Zone, Condition, Property } from "@/lib/crm/types";
import { COMPONENT_TYPES, CONDITIONS, componentMeta, JOB_STATUSES } from "@/lib/crm/constants";
import { useCrm } from "@/store/crmStore";
import { crmRepo } from "@/lib/crm/repository";
import { uid } from "@/lib/crm/workflows";
import { date } from "@/lib/crm/format";
import { SERIES } from "./charts";
import { Button, cn, Field, Input, Select, Textarea, Badge, StatusBadge, Segmented } from "./ui";
import { PhotoGallery, PhotoUploadButton } from "./Photos";
import { usePrint } from "./widgets";

type Tool = "select" | "pan" | "measure" | ComponentType;
interface Pt {
  x: number;
  y: number;
}

const zoneColor = (n?: number) => (n ? SERIES[(n - 1) % SERIES.length] : "#64748b");

/* ───────── symbols ───────── */

export function Symbol({ c, s, color, selected }: { c: SystemComponent; s: number; color: string; selected?: boolean }) {
  const r = s;
  const ring = selected ? <circle cx={0} cy={0} r={r * 1.9} fill="none" stroke="#0f6490" strokeWidth={r * 0.35} strokeDasharray={`${r * 0.6} ${r * 0.4}`} /> : null;
  const stroke = "var(--map-ink, #1e293b)";
  let body: ReactNode;
  switch (c.type) {
    case "rotor":
      body = (
        <>
          <circle r={r} fill={color} stroke={stroke} strokeWidth={r * 0.18} />
          <path d={`M${-r * 0.6},0 H${r * 0.6} M0,${-r * 0.6} V${r * 0.6}`} stroke="#fff" strokeWidth={r * 0.22} />
        </>
      );
      break;
    case "spray":
      body = <circle r={r * 0.75} fill={color} stroke={stroke} strokeWidth={r * 0.18} />;
      break;
    case "mp_rotator":
      body = (
        <>
          <circle r={r * 0.85} fill="#fff" stroke={color} strokeWidth={r * 0.35} />
          <circle r={r * 0.3} fill={color} />
        </>
      );
      break;
    case "bubbler":
      body = <rect x={-r * 0.65} y={-r * 0.65} width={r * 1.3} height={r * 1.3} transform="rotate(45)" fill={color} stroke={stroke} strokeWidth={r * 0.15} />;
      break;
    case "drip_zone":
      body = (
        <>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill="#dcfce7" stroke="#16a34a" strokeWidth={r * 0.22} />
          <text y={r * 0.38} textAnchor="middle" fontSize={r * 1.0} fontWeight={700} fill="#166534">D</text>
        </>
      );
      break;
    case "valve":
      body = (
        <>
          <path d={`M${-r * 1.1},${-r * 0.8} L${r * 1.1},${r * 0.8} L${r * 1.1},${-r * 0.8} L${-r * 1.1},${r * 0.8} Z`} fill={color} stroke={stroke} strokeWidth={r * 0.15} strokeLinejoin="round" />
        </>
      );
      break;
    case "shutoff":
      body = <path d={`M${-r},${-r * 0.7} L${r},${r * 0.7} L${r},${-r * 0.7} L${-r},${r * 0.7} Z`} fill="#fff" stroke="#ea580c" strokeWidth={r * 0.25} />;
      break;
    case "valve_box":
      body = <rect x={-r * 1.4} y={-r * 0.9} width={r * 2.8} height={r * 1.8} rx={r * 0.2} fill="#e7e5e4" stroke="#57534e" strokeWidth={r * 0.18} />;
      break;
    case "controller":
      body = (
        <>
          <rect x={-r * 1.2} y={-r * 1.2} width={r * 2.4} height={r * 2.4} rx={r * 0.3} fill="#1d4ed8" stroke={stroke} strokeWidth={r * 0.15} />
          <text y={r * 0.42} textAnchor="middle" fontSize={r * 1.2} fontWeight={700} fill="#fff">C</text>
        </>
      );
      break;
    case "backflow":
      body = (
        <>
          <path d={`M0,${-r * 1.3} L${r * 1.2},${r * 0.9} L${-r * 1.2},${r * 0.9} Z`} fill="#a21caf" stroke={stroke} strokeWidth={r * 0.15} />
          <text y={r * 0.6} textAnchor="middle" fontSize={r * 0.8} fontWeight={700} fill="#fff">BF</text>
        </>
      );
      break;
    case "meter":
      body = (
        <>
          <circle r={r * 1.1} fill="#fff" stroke="#334155" strokeWidth={r * 0.25} />
          <text y={r * 0.4} textAnchor="middle" fontSize={r * 1.1} fontWeight={700} fill="#334155">M</text>
        </>
      );
      break;
    case "tree":
      body = <circle r={r * 2.4} fill="#22c55e" fillOpacity={0.25} stroke="#15803d" strokeWidth={r * 0.2} strokeDasharray={`${r * 0.5} ${r * 0.3}`} />;
      break;
    case "note":
      body = (
        <>
          <rect x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.3} fill="#fef3c7" stroke="#b45309" strokeWidth={r * 0.15} />
          <text y={r * 0.4} textAnchor="middle" fontSize={r * 1.1} fontWeight={700} fill="#b45309">!</text>
        </>
      );
      break;
    default:
      body = <circle r={r * 0.6} fill={color} />;
  }
  const failed = c.condition === "failed" || c.condition === "poor";
  return (
    <g>
      {ring}
      {body}
      {failed && <circle cx={r * 0.95} cy={-r * 0.95} r={r * 0.45} fill={c.condition === "failed" ? "#ef4444" : "#f59e0b"} stroke="#fff" strokeWidth={r * 0.12} />}
    </g>
  );
}

/* ───────── main component ───────── */

export function SystemMap({ system, property, readOnly = false, height = 620 }: { system: IrrigationSystem; property?: Property; readOnly?: boolean; height?: number }) {
  const { data, insert, update, remove, ensureMap, log } = useCrm();
  const comps = useMemo(() => data.components.filter((c) => c.systemId === system.id), [data.components, system.id]);
  const zones = useMemo(() => data.zones.filter((z) => z.systemId === system.id).sort((a, b) => a.number - b.number), [data.zones, system.id]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const [tool, setTool] = useState<Tool>("select");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hoverPt, setHoverPt] = useState<Pt | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [zoneFilter, setZoneFilter] = useState<string>("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colorBy, setColorBy] = useState<"zone" | "type" | "condition">("zone");
  const [palette, setPalette] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id?: string; start: Pt; orig?: Pt; origPts?: Pt[]; pan?: { x: number; y: number } } | null>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const { print, portal } = usePrint();
  const W = system.mapWidth;
  const H = system.mapHeight;
  const selected = comps.find((c) => c.id === sel);
  // symbols keep a constant on-screen size (~7px radius) whatever the map scale / zoom
  const [upp, setUpp] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setUpp(Math.max(W / e.contentRect.width, H / e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);
  const iconSize = (6.5 * upp) / Math.pow(view.k, 0.85);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel && !readOnly) {
        remove("components", sel);
        setSel(null);
      }
      if (e.key === "Escape") {
        setDraft([]);
        setTool("select");
      }
      if (e.key === "Enter" && draft.length > 1) finishDraft();
      if (!readOnly && e.key === "v") setTool("select");
      if (e.key === "h") setTool("pan");
      if (e.key === "m") setTool("measure");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const toMap = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const sx = W / r.width;
    const sy = H / r.height;
    const s = Math.max(sx, sy);
    const ox = (r.width * s - W) / 2;
    const oy = (r.height * s - H) / 2;
    const vx = (e.clientX - r.left) * s - ox;
    const vy = (e.clientY - r.top) * s - oy;
    return { x: +((vx - view.x) / view.k).toFixed(1), y: +((vy - view.y) / view.k).toFixed(1) };
  };

  const meta = (t: ComponentType) => componentMeta(t);
  const colorOf = (c: SystemComponent) => {
    if (colorBy === "condition") return { good: "#16a34a", fair: "#d97706", poor: "#ea580c", failed: "#dc2626", unknown: "#64748b" }[c.condition];
    if (colorBy === "zone" && c.zoneId) return zoneColor(zoneById.get(c.zoneId)?.number);
    return meta(c.type).color;
  };
  const visible = (c: SystemComponent) => !hidden.has(meta(c.type).group) && (!zoneFilter || c.zoneId === zoneFilter || ["structure", "hardscape", "meter", "backflow", "main_line", "controller", "shutoff", "valve_box", "tree"].includes(c.type));
  const len = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) * system.mapFtPerUnit;

  function finishDraft() {
    const t = tool as ComponentType;
    const k = meta(t)?.kind;
    if (!k || draft.length < 2 || (k === "area" && draft.length < 3)) {
      setDraft([]);
      return;
    }
    const c: SystemComponent = { id: uid("cmp"), systemId: system.id, type: t, label: meta(t).label, x: draft[0].x, y: draft[0].y, points: draft, size: t === "main_line" ? property?.mainLineSize ?? '1"' : t === "lateral" ? '3/4"' : "", manufacturer: "", model: t === "main_line" || t === "lateral" ? "PVC SCH 40" : "", condition: "good", notes: "", zoneId: zoneFilter || undefined, installedDate: undefined };
    insert("components", c);
    setDraft([]);
    setSel(c.id);
    setTool("select");
  }

  const onDown = (e: React.PointerEvent) => {
    const p = toMap(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pan" || e.button === 1 || e.button === 2 || (readOnly && tool === "select")) {
      drag.current = { start: { x: e.clientX, y: e.clientY }, pan: { x: view.x, y: view.y } };
      return;
    }
    if (tool === "measure") {
      setDraft((d) => [...d, p]);
      return;
    }
    if (tool === "select") {
      setSel(null);
      drag.current = { start: { x: e.clientX, y: e.clientY }, pan: { x: view.x, y: view.y } };
      return;
    }
    const m = meta(tool);
    if (m.kind === "point") {
      const zone = zoneFilter ? zoneById.get(zoneFilter) : undefined;
      const c: SystemComponent = { id: uid("cmp"), systemId: system.id, type: tool, label: m.label, x: p.x, y: p.y, size: tool === "rotor" || tool === "spray" ? '4"' : tool === "valve" ? '1"' : "", manufacturer: zone?.manufacturer ?? "", model: zone?.model ?? "", condition: "good", notes: "", zoneId: zone?.id, installedDate: new Date().toISOString().slice(0, 10), ...(tool === "valve" ? { valve: { valveType: "inline" as const, flowControl: true, solenoid: "24VAC" } } : {}), ...(["rotor", "spray", "mp_rotator"].includes(tool) ? { sprinkler: { nozzle: zone?.nozzleType ?? "", arcDeg: 90, radiusFt: tool === "rotor" ? 30 : 12 } } : {}) };
      insert("components", c);
      setSel(c.id);
      return;
    }
    setDraft((d) => [...d, p]);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = toMap(e);
    setHoverPt(p);
    const d = drag.current;
    if (!d) return;
    if (d.pan) {
      const svg = svgRef.current!.getBoundingClientRect();
      const s = Math.max(W / svg.width, H / svg.height);
      setView((v) => ({ ...v, x: d.pan!.x + (e.clientX - d.start.x) * s, y: d.pan!.y + (e.clientY - d.start.y) * s }));
    } else if (d.id && !readOnly) {
      const svg = svgRef.current!.getBoundingClientRect();
      const s = Math.max(W / svg.width, H / svg.height) / view.k;
      const dx = (e.clientX - d.start.x) * s;
      const dy = (e.clientY - d.start.y) * s;
      update("components", d.id, (c) => ({ ...c, x: +(d.orig!.x + dx).toFixed(1), y: +(d.orig!.y + dy).toFixed(1), points: d.origPts?.map((q) => ({ x: +(q.x + dx).toFixed(1), y: +(q.y + dy).toFixed(1) })) }));
    }
  };
  const onUp = () => {
    drag.current = null;
  };
  const startDragComp = (e: React.PointerEvent, c: SystemComponent) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSel(c.id);
    if (readOnly) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: c.id, start: { x: e.clientX, y: e.clientY }, orig: { x: c.x, y: c.y }, origPts: c.points };
  };
  const zoom = (f: number, center?: Pt) => {
    setView((v) => {
      const k = Math.min(12, Math.max(0.4, v.k * f));
      const cx = center?.x ?? (W / 2 - v.x) / v.k;
      const cy = center?.y ?? (H / 2 - v.y) / v.k;
      return { k, x: v.x + cx * v.k - cx * k, y: v.y + cy * v.k - cy * k };
    });
  };

  const order = ["structure", "hardscape", "lawn", "flower_bed", "tree", "sleeve", "wire", "main_line", "lateral", "drip_line"];
  const sorted = comps.filter(visible).sort((a, b) => {
    const ia = order.indexOf(a.type);
    const ib = order.indexOf(b.type);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const design = property?.designProjectId;
  const counts = COMPONENT_TYPES.filter((t) => t.kind === "point").map((t) => [t, comps.filter((c) => c.type === t.id).length] as const).filter(([, n]) => n > 0);

  const svgBody = (forPrint = false) => (
    <>
      {system.mapBackground && <image href={system.mapBackground.url} x={0} y={0} width={W} height={H} opacity={system.mapBackground.opacity} preserveAspectRatio="xMidYMid slice" />}
      {!system.mapBackground && !forPrint && (
        <>
          <defs>
            <pattern id={`grid-${system.id}`} width={50} height={50} patternUnits="userSpaceOnUse">
              <path d="M50,0 L0,0 0,50" fill="none" stroke="var(--color-slate-200)" strokeWidth={0.6} />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#grid-${system.id})`} />
        </>
      )}
      {sorted.map((c) => {
        const m = meta(c.type);
        const col = colorOf(c);
        const isSel = c.id === sel && !forPrint;
        if (m.kind === "area" && c.points) {
          const fill = c.type === "structure" ? "#cbd5e1" : c.type === "hardscape" ? "#e2e8f0" : c.type === "lawn" ? "#86efac" : "#fde68a";
          return (
            <g key={c.id} onPointerDown={(e) => startDragComp(e, c)} className={tool === "select" ? "cursor-pointer" : ""}>
              <polygon points={c.points.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} fillOpacity={c.type === "structure" ? 0.9 : 0.45} stroke={isSel ? "#0f6490" : c.type === "structure" ? "#64748b" : colorBy === "zone" && c.zoneId ? col : "#94a3b8"} strokeWidth={isSel ? 3 : 1.2} vectorEffect="non-scaling-stroke" />
              {c.label && (
                <text x={c.points.reduce((s, p) => s + p.x, 0) / c.points.length} y={c.points.reduce((s, p) => s + p.y, 0) / c.points.length} textAnchor="middle" fontSize={iconSize * 1.5} fill={c.type === "structure" ? "#334155" : "#166534"} fontWeight={600} className="pointer-events-none select-none" opacity={0.8}>
                  {c.label}
                </text>
              )}
            </g>
          );
        }
        if (m.kind === "line" && c.points) {
          return (
            <g key={c.id} onPointerDown={(e) => startDragComp(e, c)} className={tool === "select" ? "cursor-pointer" : ""}>
              <polyline points={c.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" />
              {isSel && <polyline points={c.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#0f6490" strokeOpacity={0.3} strokeWidth={9} vectorEffect="non-scaling-stroke" />}
              <polyline points={c.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={c.type === "main_line" ? "#dc2626" : c.type === "wire" || c.type === "sleeve" ? m.color : col} strokeWidth={c.type === "main_line" ? 3.2 : c.type === "sleeve" ? 3 : 1.9} strokeDasharray={m.dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        }
        return (
          <g key={c.id} transform={`translate(${c.x},${c.y})`} onPointerDown={(e) => startDragComp(e, c)} className={tool === "select" ? "cursor-pointer" : ""}>
            {c.sprinkler?.radiusFt && (c.type === "rotor" || c.type === "spray" || c.type === "mp_rotator") && view.k > 1.4 && !forPrint && <circle r={c.sprinkler.radiusFt / system.mapFtPerUnit} fill={col} fillOpacity={0.05} stroke={col} strokeOpacity={0.25} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />}
            <circle r={iconSize * 2.2} fill="transparent" />
            <Symbol c={c} s={iconSize} color={col} selected={isSel} />
            {(c.type === "valve" || c.type === "controller" || c.type === "backflow" || c.type === "meter") && c.label && (
              <text x={iconSize * 1.8} y={iconSize * 0.4} fontSize={iconSize * 1.25} fontWeight={600} fill="var(--color-slate-700)" className="pointer-events-none select-none" paintOrder="stroke" stroke="var(--color-surface)" strokeWidth={iconSize * 0.35}>
                {c.label}
              </text>
            )}
          </g>
        );
      })}
      {draft.length > 0 && (
        <g className="pointer-events-none">
          <polyline points={[...draft, ...(hoverPt ? [hoverPt] : [])].map((p) => `${p.x},${p.y}`).join(" ")} fill={tool !== "measure" && meta(tool as ComponentType)?.kind === "area" ? "#0f649022" : "none"} stroke={tool === "measure" ? "#f59e0b" : meta(tool as ComponentType)?.color ?? "#0f6490"} strokeWidth={2.4} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          {draft.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={iconSize * 0.5} fill="#fff" stroke="#0f6490" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
    </>
  );

  const tools: { id: Tool; icon: ReactNode; label: string; key?: string; hide?: boolean }[] = [
    { id: "select", icon: <MousePointer2 size={15} />, label: "Select / move", key: "V" },
    { id: "pan", icon: <Hand size={15} />, label: "Pan", key: "H" },
    { id: "measure", icon: <Ruler size={15} />, label: "Measure", key: "M" },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
          {tools.map((t) => (
            <button key={t.id} title={`${t.label}${t.key ? ` (${t.key})` : ""}`} onClick={() => (setTool(t.id), setDraft([]))} className={cn("flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium", tool === t.id ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-100")}>
              {t.icon}
              <span className="hidden sm:inline">{t.label.split(" ")[0]}</span>
            </button>
          ))}
          {!readOnly && (
            <div className="relative">
              <button onClick={() => setPalette(!palette)} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium", !["select", "pan", "measure"].includes(tool) ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-100")}>
                <PencilRuler size={15} /> {!["select", "pan", "measure"].includes(tool) ? meta(tool as ComponentType).label : "Place / draw"}
              </button>
              {palette && (
                <div className="animate-in absolute left-0 z-20 mt-1 w-[300px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                  {["Heads", "Control", "Pipe", "Landscape"].map((g) => (
                    <div key={g} className="mb-1.5">
                      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g}</div>
                      <div className="grid grid-cols-2 gap-1">
                        {COMPONENT_TYPES.filter((t) => t.group === g).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTool(t.id);
                              setDraft([]);
                              setPalette(false);
                            }}
                            className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-slate-100", tool === t.id && "bg-brand-50 text-brand-700")}
                          >
                            <svg width={20} height={16} viewBox="-10 -8 20 16" className="shrink-0">
                              {t.kind === "line" ? <line x1={-9} y1={0} x2={9} y2={0} stroke={t.color} strokeWidth={2.4} strokeDasharray={t.dash} /> : t.kind === "area" ? <rect x={-8} y={-6} width={16} height={12} fill={t.color} fillOpacity={0.4} stroke={t.color} /> : <Symbol c={{ type: t.id, condition: "good" } as SystemComponent} s={4.2} color={t.color} />}
                            </svg>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="px-1 pt-1 text-[11px] text-slate-500">Points: click to place. Pipes &amp; areas: click each vertex, double-click or Enter to finish, Esc to cancel.</p>
                </div>
              )}
            </div>
          )}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} options={[{ value: "", label: "All zones" }, ...zones.map((z) => ({ value: z.id, label: `Zone ${z.number} — ${z.name}` }))]} className="h-8 w-40 text-[12px]" />
          <Segmented size="sm" value={colorBy} onChange={setColorBy} options={[{ id: "zone", label: "Zone" }, { id: "type", label: "Type" }, { id: "condition", label: "Condition" }]} />
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => zoom(1.25)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Zoom in"><ZoomIn size={15} /></button>
            <button onClick={() => zoom(0.8)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Zoom out"><ZoomOut size={15} /></button>
            <button onClick={() => setView({ x: 0, y: 0, k: 1 })} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fit"><Maximize2 size={15} /></button>
            <button
              onClick={() =>
                print(
                  <MapPrint title={property ? `${property.address.street}, ${property.address.city}` : system.name} zones={zones}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "6.6in", border: "1px solid #cbd5e1" }}>{svgBody(true)}</svg>
                  </MapPrint>,
                )
              }
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Print or save as PDF"
              title="Print / save as PDF"
            >
              <Printer size={15} />
            </button>
          </div>
        </div>
        <div className="relative bg-slate-50" style={{ height }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={cn("h-full w-full touch-none select-none", tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onDoubleClick={() => draft.length > 1 && tool !== "measure" && finishDraft()}
            onContextMenu={(e) => e.preventDefault()}
            onWheel={(e) => zoom(e.deltaY < 0 ? 1.12 : 0.89, toMap(e))}
          >
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>{svgBody()}</g>
          </svg>
          {!comps.length && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <Layers size={22} className="mx-auto mb-2 text-slate-400" />
                <div className="text-[14px] font-semibold text-slate-900">No system map yet</div>
                <p className="mb-3 mt-1 text-[12.5px] text-slate-500">Upload a satellite image or plan and place heads, valves and pipes — or generate a schematic from the zone records.</p>
                {!readOnly && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => ensureMap(system.id)}>
                      <Wand2 size={13} /> Generate schematic
                    </Button>
                    <Button size="sm" onClick={() => bgInput.current?.click()}>
                      <Upload size={13} /> Upload image
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {tool === "measure" && draft.length > 1 && (
            <div className="absolute left-3 top-3 rounded-lg bg-white px-3 py-1.5 text-[12.5px] shadow ring-1 ring-slate-200">
              <b className="tabular">{len(hoverPt ? [...draft, hoverPt] : draft).toFixed(1)} ft</b> <button className="ml-2 text-slate-400 hover:text-slate-700" onClick={() => setDraft([])}>clear</button>
            </div>
          )}
          {draft.length > 0 && tool !== "measure" && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[12px] shadow ring-1 ring-slate-200">
              {meta(tool as ComponentType)?.label} · {draft.length} pts · {len(draft).toFixed(0)} ft
              <button onClick={finishDraft} className="flex items-center gap-1 font-medium text-brand-700"><CheckIcon size={12} /> Finish</button>
              <button onClick={() => setDraft([])} className="text-slate-400"><X size={12} /></button>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[10.5px] text-slate-600 shadow-sm ring-1 ring-slate-200">
            {counts.slice(0, 6).map(([t, n]) => (
              <span key={t.id}>
                {n} {t.label.toLowerCase()}
                {n > 1 ? "s" : ""}
              </span>
            ))}
            {hoverPt && <span className="tabular text-slate-400">· {(hoverPt.x * system.mapFtPerUnit).toFixed(0)}′, {(hoverPt.y * system.mapFtPerUnit).toFixed(0)}′</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2 text-[12px]">
          <span className="font-medium text-slate-500">Layers:</span>
          {["Heads", "Control", "Pipe", "Landscape"].map((g) => (
            <label key={g} className="flex cursor-pointer items-center gap-1 text-slate-600">
              <input type="checkbox" checked={!hidden.has(g)} onChange={(e) => setHidden((h) => { const n = new Set(h); if (e.target.checked) n.delete(g); else n.add(g); return n; })} className="accent-[var(--color-brand-600)]" /> {g}
            </label>
          ))}
          {!readOnly && (
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <input
                ref={bgInput}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await crmRepo.uploadFile(f, `systems/${system.id}/background-${Date.now()}`);
                  const img = new window.Image();
                  img.onload = () => {
                    const h = Math.round((1000 * img.height) / img.width);
                    update("systems", system.id, { mapBackground: { url, kind: /plan|pdf/i.test(f.name) ? "plan" : "satellite", opacity: 0.85 }, mapWidth: system.mapWidth === 1000 ? 1000 : system.mapWidth, mapHeight: comps.length ? system.mapHeight : h });
                  };
                  img.src = url;
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="ghost" onClick={() => bgInput.current?.click()}>
                <ImageIcon size={13} /> {system.mapBackground ? "Replace" : "Upload"} satellite / plan
              </Button>
              {system.mapBackground && (
                <>
                  <input type="range" min={0.1} max={1} step={0.05} value={system.mapBackground.opacity} onChange={(e) => update("systems", system.id, { mapBackground: { ...system.mapBackground!, opacity: Number(e.target.value) } })} className="w-20 accent-[var(--color-brand-600)]" aria-label="Background opacity" />
                  <button onClick={() => update("systems", system.id, { mapBackground: undefined })} className="text-slate-400 hover:text-red-600" title="Remove background"><X size={13} /></button>
                </>
              )}
              {design ? (
                <Link href={`/design/${design}`} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-brand-700 hover:bg-brand-50">
                  <PencilRuler size={13} /> Engineering plan
                </Link>
              ) : null}
              {comps.length > 0 && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  const { ask } = await import("@/components/AskHost");
                  if (!(await ask.confirm("Regenerate the schematic from zone records? This replaces the current map components.", true))) return;
                  remove("components", comps.map((c) => c.id));
                  setTimeout(() => ensureMap(system.id), 0);
                  log({ type: "system", message: "System map regenerated from zones", entityType: "property", entityId: system.propertyId, customerId: property?.customerId });
                }}>
                  <Wand2 size={13} /> Regenerate
                </Button>
              )}
            </span>
          )}
        </div>
      </div>
      <ComponentPanel comp={selected} zones={zones} readOnly={readOnly} system={system} onClose={() => setSel(null)} />
      {portal}
    </div>
  );
}

function ComponentPanel({ comp, zones, readOnly, system, onClose }: { comp?: SystemComponent; zones: Zone[]; readOnly: boolean; system: IrrigationSystem; onClose: () => void }) {
  const { data, update, insert, remove } = useCrm();
  if (!comp)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[13px] font-semibold text-slate-800">Component details</div>
        <p className="mt-1 text-[12.5px] text-slate-500">Click a head, valve, pipe or area to see its size, model, zone, install date, condition, notes, photos and repair history.</p>
        <div className="mt-4 space-y-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Legend</div>
          {COMPONENT_TYPES.filter((t) => ["rotor", "spray", "mp_rotator", "drip_zone", "valve", "controller", "backflow", "meter", "main_line", "lateral", "drip_line", "sleeve", "wire"].includes(t.id)).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[12px] text-slate-600">
              <svg width={22} height={16} viewBox="-11 -8 22 16">
                {t.kind === "line" ? <line x1={-10} y1={0} x2={10} y2={0} stroke={t.color} strokeWidth={2.4} strokeDasharray={t.dash} /> : <Symbol c={{ type: t.id, condition: "good" } as SystemComponent} s={4.2} color={t.color} />}
              </svg>
              {t.label}
            </div>
          ))}
          <div className="pt-1 text-[11.5px] text-slate-500">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" /> failed · <span className="mx-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> poor condition
          </div>
        </div>
      </div>
    );
  const m = componentMeta(comp.type);
  const set = (p: Partial<SystemComponent>) => update("components", comp.id, p);
  const zone = zones.find((z) => z.id === comp.zoneId);
  const history = data.jobs
    .filter((j) => j.componentIds.includes(comp.id) || (comp.zoneId && j.zoneIds.includes(comp.zoneId)) || (j.propertyId === system.propertyId && j.completedAt && ["valve_repair", "sprinkler_repair", "head_replacement", "lateral_repair", "main_line_repair", "leak_repair"].includes(j.serviceType) && comp.type === "valve" && j.serviceType === "valve_repair"))
    .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt));
  const photos = data.photos.filter((p) => p.entityType === "component" && p.entityId === comp.id);
  const lengthFt = comp.points && m.kind === "line" ? comp.points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - comp.points![i].x, p.y - comp.points![i].y), 0) * system.mapFtPerUnit : undefined;
  const dis = readOnly;
  return (
    <div className="max-h-[760px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-slate-900">{comp.label || m.label}</div>
          <div className="text-[11.5px] text-slate-500">
            {m.label}
            {zone ? ` · Zone ${zone.number} ${zone.name}` : ""}
            {lengthFt ? ` · ${lengthFt.toFixed(0)} ft` : ""}
          </div>
        </div>
        <div className="flex gap-0.5">
          {!readOnly && (
            <>
              <button onClick={() => insert("components", { ...comp, id: uid("cmp"), x: comp.x + 15, y: comp.y + 15, points: comp.points?.map((p) => ({ x: p.x + 15, y: p.y + 15 })) })} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Duplicate"><Copy size={14} /></button>
              <button onClick={() => (remove("components", comp.id), onClose())} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete (Del)"><Trash2 size={14} /></button>
            </>
          )}
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label" className="col-span-2"><Input disabled={dis} value={comp.label} onChange={(e) => set({ label: e.target.value })} /></Field>
          <Field label="Type"><Select disabled={dis} value={comp.type} onChange={(e) => set({ type: e.target.value as ComponentType })} options={COMPONENT_TYPES.filter((t) => t.kind === m.kind).map((t) => ({ value: t.id, label: t.label }))} /></Field>
          <Field label="Zone"><Select disabled={dis} value={comp.zoneId ?? ""} onChange={(e) => set({ zoneId: e.target.value || undefined })} options={[{ value: "", label: "—" }, ...zones.map((z) => ({ value: z.id, label: `${z.number}. ${z.name}` }))]} /></Field>
          <Field label="Size"><Input disabled={dis} value={comp.size} onChange={(e) => set({ size: e.target.value })} placeholder='1"' /></Field>
          <Field label="Condition"><Select disabled={dis} value={comp.condition} onChange={(e) => set({ condition: e.target.value as Condition })} options={CONDITIONS.map((c) => ({ value: c.id, label: c.label }))} /></Field>
          <Field label="Manufacturer"><Input disabled={dis} value={comp.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
          <Field label="Model"><Input disabled={dis} value={comp.model} onChange={(e) => set({ model: e.target.value })} /></Field>
          <Field label="Installed" className="col-span-2"><Input disabled={dis} type="date" value={comp.installedDate ?? ""} onChange={(e) => set({ installedDate: e.target.value || undefined })} /></Field>
        </div>
        {(comp.type === "rotor" || comp.type === "spray" || comp.type === "mp_rotator") && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Nozzle" className="col-span-3"><Input disabled={dis} value={comp.sprinkler?.nozzle ?? ""} onChange={(e) => set({ sprinkler: { ...comp.sprinkler, nozzle: e.target.value } })} /></Field>
            <Field label="Arc °"><Input disabled={dis} type="number" value={comp.sprinkler?.arcDeg ?? ""} onChange={(e) => set({ sprinkler: { nozzle: "", ...comp.sprinkler, arcDeg: Number(e.target.value) } })} /></Field>
            <Field label="Radius ft"><Input disabled={dis} type="number" value={comp.sprinkler?.radiusFt ?? ""} onChange={(e) => set({ sprinkler: { nozzle: "", ...comp.sprinkler, radiusFt: Number(e.target.value) } })} /></Field>
            <Field label="Pop-up in"><Input disabled={dis} type="number" value={comp.sprinkler?.popUpIn ?? ""} onChange={(e) => set({ sprinkler: { nozzle: "", ...comp.sprinkler, popUpIn: Number(e.target.value) } })} /></Field>
          </div>
        )}
        {comp.type === "valve" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Valve type"><Select disabled={dis} value={comp.valve?.valveType ?? "inline"} onChange={(e) => set({ valve: { flowControl: true, solenoid: "24VAC", ...comp.valve, valveType: e.target.value as "inline" } })} options={["anti-siphon", "inline", "master", "drip", "isolation"].map((v) => ({ value: v, label: v }))} /></Field>
            <Field label="Solenoid"><Input disabled={dis} value={comp.valve?.solenoid ?? ""} onChange={(e) => set({ valve: { valveType: "inline", flowControl: true, ...comp.valve, solenoid: e.target.value } })} /></Field>
            <Field label="Depth (in)"><Input disabled={dis} type="number" value={comp.valve?.depthIn ?? ""} onChange={(e) => set({ valve: { valveType: "inline", flowControl: true, solenoid: "", ...comp.valve, depthIn: Number(e.target.value) } })} /></Field>
          </div>
        )}
        <Field label="Notes"><Textarea disabled={dis} value={comp.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Location details, depth, what you found…" /></Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Photos</span>
            {!readOnly && <PhotoUploadButton entityType="component" entityId={comp.id} propertyId={system.propertyId} category="problem" label="Add" />}
          </div>
          {photos.length ? <PhotoGallery photos={photos} columns="grid-cols-2" /> : <p className="text-[12px] text-slate-400">No photos of this component.</p>}
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Repair history</div>
          {history.length ? (
            <div className="space-y-1">
              {history.slice(0, 8).map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-slate-50">
                  <span className="min-w-0 truncate">#{j.number} {j.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                    {date(j.completedAt ?? j.scheduledStart ?? j.createdAt)}
                    <StatusBadge list={JOB_STATUSES} value={j.status} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">No recorded repairs.</p>
          )}
          {zone?.lastRepairDate && <Badge className="mt-1.5">Zone last repaired {date(zone.lastRepairDate)}</Badge>}
        </div>
      </div>
    </div>
  );
}

function MapPrint({ title, zones, children }: { title: string; zones: Zone[]; children: ReactNode }) {
  const s = useCrm.getState().settings;
  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #0f172a", paddingBottom: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Irrigation System Map</div>
          <div style={{ fontSize: 12 }}>{title}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          <div style={{ fontWeight: 700 }}>{s.businessName}</div>
          <div>{s.phone} · {s.license}</div>
          <div>Printed {new Date().toLocaleDateString()}</div>
        </div>
      </div>
      {children}
      <table style={{ width: "100%", marginTop: 10, fontSize: 10, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #94a3b8" }}>
            <th>Zone</th>
            <th>Name</th>
            <th>Type</th>
            <th>Equipment</th>
            <th>Valve</th>
            <th>Heads</th>
            <th>GPM</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: zoneColor(z.number), marginRight: 4 }} />
                {z.number}
              </td>
              <td>{z.name}</td>
              <td>{z.sprinklerType}</td>
              <td>{z.manufacturer} {z.model}</td>
              <td>{z.valveType} {z.valveSize} — {z.valveLocation}</td>
              <td>{z.headCount || "—"}</td>
              <td>{z.flowGpm ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

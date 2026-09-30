"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Home, Trees, Fence, Square, Circle, Pentagon, Droplets, Spline, GitMerge, Box, Cpu, CloudRain, Gauge, Filter, ShieldCheck, Plug, Waves, Sprout, Type, Image as ImageIcon, Crosshair } from "lucide-react";
import { useEditorStore, type Tool } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { AreaType, EquipmentType, FittingType, LineType, PipeKind, PipeMaterial, ValveType } from "@/lib/model/types";
import { AREA_DEFAULTS } from "@/lib/model/factory";
import { allProducts, getProduct } from "@/lib/catalog/sprinklers";
import { FITTING_LABELS, EQUIPMENT_NAMES, HEAD_NAMES } from "@/lib/plan/symbols";
import { sizesFor } from "@/lib/hydraulics/pipes";
import { pipeSizeLabel } from "@/lib/units/units";
import { cn, Select, Toggle } from "../ui";

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {title}
      </button>
      {open && <div className="px-2 pb-2.5">{children}</div>}
    </div>
  );
}

function Tile({ active, onClick, icon, label, swatch, title }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; swatch?: string; title?: string }) {
  return (
    <button onClick={onClick} title={title ?? label} className={cn("flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[12px] leading-tight transition-colors", active ? "bg-brand-50 text-brand-800 ring-1 ring-brand-300" : "text-slate-700 hover:bg-slate-100")}>
      {swatch ? <span className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: swatch }} /> : <span className="shrink-0 text-slate-500">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}

const AREA_TYPES: AreaType[] = ["property", "building", "lawn", "bed", "planting", "driveway", "walkway", "concrete", "patio", "deck", "pool", "utility", "custom"];
const LINE_TYPES: { t: LineType; label: string }[] = [
  { t: "fence", label: "Fence" },
  { t: "wall", label: "Retaining wall" },
  { t: "hedge", label: "Hedge" },
  { t: "custom", label: "Custom line" },
];
const PIPE_TYPES: { kind: PipeKind; material: PipeMaterial; label: string }[] = [
  { kind: "mainline", material: "pvc-sch40", label: "PVC mainline" },
  { kind: "lateral", material: "pvc-sch40", label: "PVC lateral (Sch 40)" },
  { kind: "lateral", material: "pvc-cl200", label: "PVC lateral (Cl 200)" },
  { kind: "lateral", material: "poly-100", label: "Polyethylene" },
  { kind: "drip", material: "drip-tubing", label: "Drip tubing" },
  { kind: "lateral", material: "funny-pipe", label: "Swing / funny pipe" },
  { kind: "sleeve", material: "pvc-sch40", label: "Sleeve" },
  { kind: "wire", material: "pvc-sch40", label: "Wire path" },
];
const VALVES: { t: ValveType; label: string }[] = [
  { t: "electric", label: "Electric control valve" },
  { t: "master", label: "Master valve" },
  { t: "drip", label: "Drip valve kit" },
  { t: "prv", label: "Pressure-regulating" },
  { t: "isolation", label: "Isolation valve" },
];
const FITTINGS: FittingType[] = ["tee", "elbow90", "elbow45", "coupling", "reducer", "cap", "cross", "male-adapter", "female-adapter", "union", "swing-joint"];
const EQUIPMENT: { t: EquipmentType; icon: React.ReactNode }[] = [
  { t: "backflow", icon: <ShieldCheck size={14} /> },
  { t: "pressure-regulator", icon: <Gauge size={14} /> },
  { t: "filter", icon: <Filter size={14} /> },
  { t: "check-valve", icon: <GitMerge size={14} /> },
  { t: "quick-coupler", icon: <Plug size={14} /> },
  { t: "hose-bib", icon: <Droplets size={14} /> },
  { t: "pump", icon: <Waves size={14} /> },
  { t: "controller", icon: <Cpu size={14} /> },
  { t: "smart-controller", icon: <Cpu size={14} /> },
  { t: "rain-sensor", icon: <CloudRain size={14} /> },
  { t: "flow-meter", icon: <Gauge size={14} /> },
  { t: "valve-box", icon: <Box size={14} /> },
];

export function LeftPanel() {
  const tool = useEditorStore((s) => s.tool);
  const opts = useEditorStore((s) => s.opts);
  const setTool = useEditorStore((s) => s.setTool);
  const setOpts = useEditorStore((s) => s.setOpts);
  const set = useEditorStore((s) => s.set);
  const project = useProjectStore((s) => s.project);
  const use = (t: Tool, o: Partial<typeof opts> = {}) => {
    setOpts(o);
    setTool(t);
  };
  const product = getProduct(opts.sprinklerProduct);
  const products = allProducts();
  const cats = [...new Set(products.map((p) => p.category))];
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white" aria-label="Drawing tools and library">
      <Group title="Site drawing">
        <div className="mb-2 flex gap-1 rounded-md bg-slate-100 p-0.5">
          {(
            [
              ["polygon", <Pentagon key="p" size={13} />, "Polygon"],
              ["rectangle", <Square key="r" size={13} />, "Rectangle"],
              ["circle", <Circle key="c" size={13} />, "Circle"],
            ] as const
          ).map(([s, icon, label]) => (
            <button key={s} onClick={() => setOpts({ areaShape: s })} className={cn("flex flex-1 items-center justify-center gap-1 rounded py-1 text-[11px]", opts.areaShape === s ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600")}>
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {AREA_TYPES.map((t) => (
            <Tile key={t} active={tool === "area" && opts.areaType === t} onClick={() => use("area", { areaType: t })} swatch={t === "property" ? "#fff" : AREA_DEFAULTS[t].style.fill} label={AREA_DEFAULTS[t].name.replace("Property boundary", "Property line")} />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-0.5">
          {LINE_TYPES.map((l) => (
            <Tile key={l.t} active={tool === "line" && opts.lineType === l.t} onClick={() => use("line", { lineType: l.t })} icon={<Fence size={14} />} label={l.label} />
          ))}
          <Tile active={tool === "plant" && opts.plantType === "tree"} onClick={() => use("plant", { plantType: "tree" })} icon={<Trees size={14} />} label="Tree" />
          <Tile active={tool === "plant" && opts.plantType === "shrub"} onClick={() => use("plant", { plantType: "shrub" })} icon={<Sprout size={14} />} label="Shrub" />
          <Tile active={tool === "text"} onClick={() => use("text")} icon={<Type size={14} />} label="Text label" />
          <Tile active={false} onClick={() => set({ dialog: "background" })} icon={<ImageIcon size={14} />} label="Import plan" />
        </div>
      </Group>

      <Group title="Sprinklers">
        <Select
          value={opts.sprinklerProduct}
          onChange={(v) => {
            const p = getProduct(v);
            const nz = p.nozzles[Math.min(p.nozzles.length - 1, Math.floor(p.nozzles.length / 2))];
            use("sprinkler", { sprinklerProduct: v, sprinklerNozzle: nz.id, sprinklerArc: p.arcAdjustable ? opts.sprinklerArc : p.arcMax });
          }}
          options={cats.flatMap((c) => products.filter((p) => p.category === c).map((p) => ({ value: p.id, label: `${HEAD_NAMES[c]} — ${p.model}` })))}
        />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Select value={opts.sprinklerNozzle} onChange={(v) => use("sprinkler", { sprinklerNozzle: v })} options={product.nozzles.map((n) => ({ value: n.id, label: `${n.name} · ${n.radius}'` }))} />
          <Select
            value={opts.sprinklerArc}
            onChange={(v) => use("sprinkler", { sprinklerArc: v })}
            options={[90, 120, 180, 210, 270, 360].filter((a) => a >= (product.arcMin || 0) && a <= product.arcMax).map((a) => ({ value: a, label: `${a}°` }))}
          />
        </div>
        <Toggle checked={opts.sprinklerAutoArc} onChange={(v) => setOpts({ sprinklerAutoArc: v })} label={<span className="text-[12px]">Auto-fit arc to area</span>} />
        <button onClick={() => use("sprinkler")} className={cn("mt-1 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium", tool === "sprinkler" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200")}>
          <Droplets size={14} /> Place {HEAD_NAMES[product.category].toLowerCase()} (S)
        </button>
      </Group>

      <Group title="Drip">
        <div className="grid grid-cols-2 gap-0.5">
          <Tile active={tool === "drip"} onClick={() => use("drip")} icon={<Pentagon size={14} />} label="Dripline area" />
          <Tile active={tool === "sprinkler" && opts.sprinklerProduct === "gen-emitter"} onClick={() => use("sprinkler", { sprinklerProduct: "gen-emitter", sprinklerNozzle: "E-1", sprinklerArc: 360 })} icon={<Crosshair size={14} />} label="Emitter" />
          <Tile active={tool === "sprinkler" && opts.sprinklerProduct === "gen-microspray"} onClick={() => use("sprinkler", { sprinklerProduct: "gen-microspray", sprinklerNozzle: "MS-4", sprinklerArc: 360 })} icon={<Droplets size={14} />} label="Micro-spray" />
          <Tile active={tool === "valve" && opts.valveType === "drip"} onClick={() => use("valve", { valveType: "drip" })} icon={<Square size={14} />} label="Drip manifold" />
        </div>
      </Group>

      <Group title="Pipe">
        <div className="grid grid-cols-1 gap-0.5">
          {PIPE_TYPES.map((p) => (
            <Tile
              key={p.label}
              active={tool === "pipe" && opts.pipeKind === p.kind && (opts.pipeMaterial === p.material || p.kind === "sleeve" || p.kind === "wire")}
              onClick={() => use("pipe", { pipeKind: p.kind, pipeMaterial: p.material, pipeSize: sizesFor(p.material).includes(opts.pipeSize) ? opts.pipeSize : sizesFor(p.material)[0] })}
              icon={<Spline size={14} />}
              label={p.label}
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-2 items-center gap-1.5">
          <Select value={opts.pipeSize} onChange={(v) => setOpts({ pipeSize: v, pipeAutoSize: false })} options={sizesFor(opts.pipeMaterial).map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
          <Toggle checked={opts.pipeAutoSize} onChange={(v) => setOpts({ pipeAutoSize: v })} label={<span className="text-[12px]">Auto size</span>} />
        </div>
      </Group>

      <Group title="Fittings">
        <div className="grid grid-cols-2 gap-0.5">
          {FITTINGS.map((f) => (
            <Tile key={f} active={tool === "fitting" && opts.fittingType === f} onClick={() => use("fitting", { fittingType: f })} icon={<GitMerge size={14} />} label={FITTING_LABELS[f]} />
          ))}
        </div>
      </Group>

      <Group title="Valves & source">
        <div className="grid grid-cols-1 gap-0.5">
          <Tile active={tool === "source"} onClick={() => use("source")} icon={<Home size={14} />} label="Point of connection (water source)" />
          {VALVES.map((v) => (
            <Tile key={v.t} active={tool === "valve" && opts.valveType === v.t} onClick={() => use("valve", { valveType: v.t })} icon={<Square size={14} />} label={v.label} />
          ))}
        </div>
        <Toggle checked={opts.valveCreatesZone} onChange={(v) => setOpts({ valveCreatesZone: v })} label={<span className="text-[12px]">New valve creates a zone</span>} />
      </Group>

      <Group title="Equipment" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-0.5">
          {EQUIPMENT.map((e) => (
            <Tile key={e.t} active={tool === "equipment" && opts.equipmentType === e.t} onClick={() => use("equipment", { equipmentType: e.t })} icon={e.icon} label={EQUIPMENT_NAMES[e.t]} />
          ))}
        </div>
      </Group>

      <Group title="Measure">
        <div className="grid grid-cols-2 gap-0.5">
          {(
            [
              ["distance", "Distance"],
              ["area", "Area / perimeter"],
              ["radius", "Radius"],
              ["angle", "Angle"],
            ] as const
          ).map(([m, label]) => (
            <Tile key={m} active={tool === "measure" && opts.measureMode === m} onClick={() => useEditorStore.setState({ opts: { ...opts, measureMode: m }, tool: "measure", measurePoints: [] })} icon={<Crosshair size={14} />} label={label} />
          ))}
          <Tile active={tool === "dimension" && opts.dimensionKind !== "horizontal" && opts.dimensionKind !== "vertical"} onClick={() => use("dimension", { dimensionKind: "auto" })} icon={<Spline size={14} />} label="Aligned dim." />
          <Tile active={tool === "dimension" && (opts.dimensionKind === "horizontal" || opts.dimensionKind === "vertical")} onClick={() => use("dimension", { dimensionKind: "horizontal" })} icon={<Spline size={14} />} label="Linear dim." />
        </div>
        {project?.background && (
          <button onClick={() => use("calibrate")} className="mt-1.5 w-full rounded-md bg-slate-100 py-1.5 text-[12px] hover:bg-slate-200">
            Calibrate background scale
          </button>
        )}
      </Group>
    </aside>
  );
}

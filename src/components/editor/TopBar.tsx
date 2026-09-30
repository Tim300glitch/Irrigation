"use client";
import { ask } from "@/components/AskHost";
import Link from "next/link";
import {
  MousePointer2,
  Hand,
  Spline,
  Droplets,
  GitMerge,
  Ruler,
  MoveHorizontal,
  Type,
  Undo2,
  Redo2,
  Magnet,
  Grid3x3,
  Layers,
  Gauge,
  Wand2,
  Package,
  Calculator,
  CalendarClock,
  FileDown,
  Keyboard,
  Save,
  Image as ImageIcon,
  Eye,
  Flame,
  HardHat,
  ChevronDown,
  Square,
  Check,
  Lock,
  Unlock,
  EyeOff,
  Target,
  History,
  Info,
  Crosshair,
} from "lucide-react";
import { useEditorStore, type Tool } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { IconButton, cn } from "../ui";
import { Popover, MenuItem } from "../Popover";
import { actions } from "./actions";

const CURSOR_TOOLS: { tool: Tool; icon: React.ReactNode; label: string; key: string }[] = [
  { tool: "select", icon: <MousePointer2 size={16} />, label: "Select / edit", key: "V" },
  { tool: "pan", icon: <Hand size={16} />, label: "Pan", key: "H" },
  { tool: "pipe", icon: <Spline size={16} />, label: "Draw pipe", key: "P" },
  { tool: "sprinkler", icon: <Droplets size={16} />, label: "Place sprinkler", key: "S" },
  { tool: "fitting", icon: <GitMerge size={16} />, label: "Place fitting (tee, 45°, 90°…)", key: "F" },
  { tool: "valve", icon: <Square size={15} />, label: "Place valve", key: "A" },
  { tool: "measure", icon: <Ruler size={16} />, label: "Measure", key: "M" },
  { tool: "dimension", icon: <MoveHorizontal size={16} />, label: "Dimension", key: "D" },
  { tool: "refpoint", icon: <Crosshair size={16} />, label: "Reference point", key: "R" },
  { tool: "text", icon: <Type size={16} />, label: "Text label", key: "T" },
];

function Divider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-slate-200" />;
}

export function TopBar() {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const lastSaved = useProjectStore((s) => s.lastSavedAt);
  const apply = useProjectStore((s) => s.apply);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const showCoverage = useEditorStore((s) => s.showCoverage);
  const showHeatmap = useEditorStore((s) => s.showHeatmap);
  const installer = useEditorStore((s) => s.installerMode);
  const set = useEditorStore((s) => s.set);
  const selection = useEditorStore((s) => s.selection);
  if (!project) return null;
  const st = project.settings;
  const selArea = project.areas.find((a) => selection.includes(a.id) && (a.type === "lawn" || a.type === "bed" || a.type === "planting"));
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100" title="Back to dashboard">
        <span className="hidden min-[1700px]:block"><Logo /></span>
        <span className="min-[1700px]:hidden"><Logo compact /></span>
      </Link>
      <button onClick={() => set({ dialog: "project" })} className="min-w-0 max-w-[170px] shrink rounded-md px-2 py-1 text-left hover:bg-slate-100" title="Project information">
        <div className="truncate text-[13px] font-semibold text-slate-900">{project.meta.name}</div>
        <div className="truncate text-[11px] text-slate-500">{dirty ? "Unsaved changes…" : lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "All changes saved"}</div>
      </button>
      <Divider />
      <IconButton title="Undo (Ctrl+Z)" onClick={actions.undo} disabled={!canUndo}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton title="Redo (Ctrl+Shift+Z)" onClick={actions.redo} disabled={!canRedo}>
        <Redo2 size={16} />
      </IconButton>
      <Divider />
      <div className="flex shrink-0 items-center rounded-lg bg-slate-50 p-0.5 ring-1 ring-slate-200" role="toolbar" aria-label="Cursor tools">
        {CURSOR_TOOLS.map((t) => (
          <IconButton key={t.tool} title={`${t.label} (${t.key})`} active={tool === t.tool} onClick={() => setTool(t.tool)}>
            {t.icon}
          </IconButton>
        ))}
      </div>
      <Divider />
      <Popover
        width={230}
        trigger={(open, toggle) => (
          <IconButton title="Snapping" active={st.snapGrid || st.snapVertex || st.snapEdge} onClick={toggle}>
            <Magnet size={16} />
            <ChevronDown size={12} />
          </IconButton>
        )}
      >
        {() => (
          <div className="p-1">
            {(
              [
                ["snapGrid", "Snap to grid"],
                ["snapVertex", "Snap to vertices"],
                ["snapEdge", "Snap to edges"],
                ["snapSprinkler", "Snap to sprinklers & devices"],
              ] as const
            ).map(([k, label]) => (
              <MenuItem key={k} icon={st[k] ? <Check size={14} /> : <span className="inline-block w-3.5" />} label={label} onClick={() => apply((d) => void (d.settings[k] = !d.settings[k]), { history: false })} />
            ))}
            <div className="my-1 border-t border-slate-100" />
            <div className="px-2 py-1 text-[11px] text-slate-500">Angle snap while drawing</div>
            <div className="flex gap-1 px-2 pb-1">
              {[0, 15, 45, 90].map((a) => (
                <button key={a} onClick={() => apply((d) => void (d.settings.angleSnapDeg = a), { history: false })} className={cn("rounded px-2 py-0.5 text-xs ring-1", st.angleSnapDeg === a ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200")}>
                  {a === 0 ? "Off" : `${a}°`}
                </button>
              ))}
            </div>
            <div className="px-2 pb-1 text-[11px] text-slate-400">Hold Shift for 45° · Alt disables snapping</div>
          </div>
        )}
      </Popover>
      <Popover
        width={220}
        trigger={(open, toggle) => (
          <IconButton title="Grid & rulers" active={st.gridVisible} onClick={toggle}>
            <Grid3x3 size={16} />
            <ChevronDown size={12} />
          </IconButton>
        )}
      >
        {() => (
          <div className="p-1">
            <MenuItem icon={st.gridVisible ? <Check size={14} /> : <span className="inline-block w-3.5" />} label="Show grid" hint="G" onClick={() => apply((d) => void (d.settings.gridVisible = !d.settings.gridVisible), { history: false })} />
            <MenuItem icon={st.rulersVisible ? <Check size={14} /> : <span className="inline-block w-3.5" />} label="Show rulers (ft)" onClick={() => apply((d) => void (d.settings.rulersVisible = !d.settings.rulersVisible), { history: false })} />
            <div className="px-2 pt-2 text-[11px] text-slate-500">Grid spacing</div>
            <div className="flex flex-wrap gap-1 px-2 py-1">
              {[1 / 12, 3 / 12, 0.5, 1, 2, 5, 10].map((g) => (
                <button key={g} onClick={() => apply((d) => void (d.settings.gridSize = g), { history: false })} className={cn("rounded px-2 py-0.5 text-xs ring-1", st.gridSize === g ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200")}>
                  {g < 1 ? `${Math.round(g * 12)}"` : `${g}'`}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
      <Popover
        width={200}
        trigger={(open, toggle) => (
          <button onClick={toggle} className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-slate-700 hover:bg-slate-100" title="Drawing (plot) scale">
            1&quot;={st.drawingScale}&apos; <ChevronDown size={12} />
          </button>
        )}
      >
        {(close) => (
          <div className="p-1">
            <div className="px-2 py-1 text-[11px] text-slate-500">Plan scale for printing</div>
            {[5, 8, 10, 16, 20, 30, 40, 50].map((s) => (
              <MenuItem
                key={s}
                icon={st.drawingScale === s ? <Check size={14} /> : <span className="inline-block w-3.5" />}
                label={`1" = ${s}'-0"`}
                onClick={() => {
                  apply((d) => void (d.settings.drawingScale = s));
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Popover>
      <LayersMenu />
      <Divider />
      <IconButton title="Show sprinkler coverage arcs" active={showCoverage} onClick={() => set({ showCoverage: !showCoverage })}>
        <Eye size={16} />
      </IconButton>
      <IconButton title="Coverage heatmap (head-to-head analysis)" active={showHeatmap} onClick={() => set({ showHeatmap: !showHeatmap })}>
        <Flame size={16} />
      </IconButton>
      <IconButton title="Installer mode (simplified plan with field measurements)" active={installer} onClick={() => set({ installerMode: !installer })}>
        <HardHat size={16} />
      </IconButton>
      <Divider />
      <button onClick={() => set({ dialog: "hydraulics" })} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-700 hover:bg-slate-100" title="Hydraulic analysis">
        <Gauge size={16} /> <span className="hidden min-[1780px]:inline">Hydraulics</span>
      </button>
      <Popover
        width={290}
        trigger={(open, toggle) => (
          <button onClick={toggle} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-brand-50 px-2 text-[13px] font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100" title="Automatic design tools">
            <Wand2 size={16} /> <span className="whitespace-nowrap">Auto-Design</span> <ChevronDown size={12} />
          </button>
        )}
      >
        {(close) => (
          <div className="p-1">
            <MenuItem
              icon={<Target size={14} />}
              label={selArea ? `Auto design area: ${selArea.name}` : "Auto design area (select a lawn/bed)"}
              disabled={!selArea}
              onClick={() => {
                set({ dialog: "autodesign" });
                close();
              }}
            />
            <MenuItem
              icon={<Droplets size={14} />}
              label="Auto layout all irrigated areas"
              onClick={() => {
                set({ dialog: "autodesign" });
                close();
              }}
            />
            <MenuItem
              icon={<Layers size={14} />}
              label="Auto zone"
              hint="flow & hydrozone"
              onClick={() => {
                actions.autoZone();
                close();
              }}
            />
            <MenuItem
              icon={<Spline size={14} />}
              label="Auto route pipes"
              hint="laterals + mainline"
              onClick={() => {
                actions.autoRoute("auto");
                close();
              }}
            />
            <MenuItem
              icon={<Gauge size={14} />}
              label="Match nozzles (precipitation)"
              onClick={() => {
                actions.matchNozzles();
                close();
              }}
            />
            <div className="my-1 border-t border-slate-100" />
            <MenuItem
              icon={<Wand2 size={14} />}
              label={<span className="font-semibold">Auto design everything</span>}
              hint="layout → zone → route"
              onClick={async () => {
                if (project.sprinklers.length && !(await ask.confirm("Auto design replaces zones and pipes (existing heads are kept). Continue?"))) return;
                actions.autoDesignAll();
                close();
              }}
            />
          </div>
        )}
      </Popover>
      <button onClick={() => set({ dialog: "materials" })} title="Material takeoff" className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-700 hover:bg-slate-100">
        <Package size={16} /> <span className="hidden min-[1780px]:inline">Materials</span>
      </button>
      <button onClick={() => set({ dialog: "estimate" })} title="Cost estimate" className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-700 hover:bg-slate-100">
        <Calculator size={16} /> <span className="hidden min-[1780px]:inline">Estimate</span>
      </button>
      <button onClick={() => set({ dialog: "schedule" })} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-700 hover:bg-slate-100" title="Scheduling & water use">
        <CalendarClock size={16} /> <span className="hidden min-[1780px]:inline">Schedule</span>
      </button>
      <div className="flex-1" />
      <IconButton title="Background / site plan / aerial" onClick={() => set({ dialog: "background" })}>
        <ImageIcon size={16} />
      </IconButton>
      <IconButton title="Version history" onClick={() => set({ dialog: "versions" })}>
        <History size={16} />
      </IconButton>
      <IconButton title="Keyboard shortcuts (?)" onClick={() => set({ dialog: "shortcuts" })}>
        <Keyboard size={16} />
      </IconButton>
      <IconButton title="Project info" onClick={() => set({ dialog: "project" })}>
        <Info size={16} />
      </IconButton>
      <IconButton title="Save (Ctrl+S)" onClick={() => actions.save()}>
        <Save size={16} />
      </IconButton>
      <button onClick={() => set({ dialog: "export" })} title="Export PDF plan set" className="ml-1 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-brand-700">
        <FileDown size={16} /> <span className="hidden min-[1280px]:inline">Export PDF</span>
      </button>
    </header>
  );
}

function LayersMenu() {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  return (
    <Popover
      width={250}
      trigger={(open, toggle) => (
        <IconButton title="Layers" onClick={toggle} active={open}>
          <Layers size={16} />
          <ChevronDown size={12} />
        </IconButton>
      )}
    >
      {() => (
        <div className="max-h-[60vh] overflow-y-auto p-1">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Layers</div>
          {[...project.layers].reverse().map((l) => (
            <div key={l.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-50">
              <button className="rounded p-1 text-slate-600 hover:bg-slate-200" title={l.visible ? "Hide" : "Show"} onClick={() => apply((d) => void (d.layers.find((x) => x.id === l.id)!.visible = !l.visible), { history: false })}>
                {l.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-slate-400" />}
              </button>
              <button className="rounded p-1 text-slate-600 hover:bg-slate-200" title={l.locked ? "Unlock" : "Lock"} onClick={() => apply((d) => void (d.layers.find((x) => x.id === l.id)!.locked = !l.locked), { history: false })}>
                {l.locked ? <Lock size={14} className="text-amber-600" /> : <Unlock size={14} className="text-slate-400" />}
              </button>
              <span className={cn("flex-1 text-[13px]", !l.visible && "text-slate-400")}>{l.name}</span>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2 L22 20 H2 Z" fill="none" stroke="#0f6490" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M6 16 Q12 9 18 16" fill="none" stroke="#1a7aa6" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-tight text-slate-900">
            DeltaLine<span className="font-medium text-brand-600"> Irrigation</span>
          </div>
        </div>
      )}
    </div>
  );
}

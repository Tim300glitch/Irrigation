"use client";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { formatFeetInches } from "@/lib/units/units";
import { AlertOctagon, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import { actions } from "./actions";
import { MIN_ZOOM, MAX_ZOOM } from "./canvas/viewport";

export function StatusBar() {
  const cursor = useEditorStore((s) => s.cursor);
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const tool = useEditorStore((s) => s.tool);
  const activeZone = useEditorStore((s) => s.activeZoneId);
  const snap = useEditorStore((s) => s.snap);
  const set = useEditorStore((s) => s.set);
  const selection = useEditorStore((s) => s.selection);
  const project = useProjectStore((s) => s.project);
  const analysis = useAnalysis();
  if (!project) return null;
  const zone = project.zones.find((z) => z.id === activeZone);
  const errs = analysis?.warnings.filter((w) => w.severity === "error").length ?? 0;
  const warns = analysis?.warnings.filter((w) => w.severity === "warning").length ?? 0;
  const hs = analysis?.hyd.status;
  // 100% = drawing at plot scale on a 96 dpi screen
  const pct = Math.round(((zoom * project.settings.drawingScale) / 96) * 100);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-3 text-[11.5px] text-slate-600 tabular">
      <span className="w-[190px] truncate">{cursor ? `X ${formatFeetInches(cursor.x)}   Y ${formatFeetInches(cursor.y)}` : "X —   Y —"}</span>
      <span className="capitalize">Tool: {tool}</span>
      {snap && snap.kind !== "none" && <span className="text-emerald-700">Snap: {snap.kind}</span>}
      <span>
        Scale 1&quot;={project.settings.drawingScale}&apos;
      </span>
      <span className="flex items-center gap-1">
        <button className="rounded px-1 hover:bg-slate-100" onClick={() => actions.zoom(1 / 1.25)} disabled={zoom <= MIN_ZOOM}>
          −
        </button>
        <button className="rounded px-1 hover:bg-slate-100" title="Zoom to fit (0)" onClick={actions.fit}>
          {pct}%
        </button>
        <button className="rounded px-1 hover:bg-slate-100" onClick={() => actions.zoom(1.25)} disabled={zoom >= MAX_ZOOM}>
          +
        </button>
      </span>
      <span className="flex items-center gap-1">
        Zone:{" "}
        {zone ? (
          <span className="flex items-center gap-1 font-medium text-slate-800">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: zone.color }} /> {zone.number}
          </span>
        ) : (
          "—"
        )}
      </span>
      {selection.length > 0 && <span>{selection.length} selected</span>}
      <div className="flex-1" />
      <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => set({ rightTab: "checks" })}>
        {errs > 0 ? <AlertOctagon size={13} className="text-red-600" /> : warns > 0 ? <AlertTriangle size={13} className="text-amber-500" /> : <CheckCircle2 size={13} className="text-emerald-600" />}
        {errs} errors · {warns} warnings
      </button>
      <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => set({ dialog: "hydraulics" })}>
        <Gauge size={13} className={hs === "error" ? "text-red-600" : hs === "warning" ? "text-amber-500" : "text-emerald-600"} />
        Hydraulics: {hs ? (hs === "good" ? "OK" : hs.toUpperCase()) : "…"}
        {analysis && ` · max ${analysis.totals.maxZoneGpm.toFixed(1)} GPM`}
      </button>
    </footer>
  );
}

"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { useAppStore } from "@/store/appStore";
import { Button, Field, Modal, Select, Toggle, cn } from "../../ui";
import { PAPER, type ExportOptions, type PaperSize } from "@/lib/pdf/exportPdf";
import { renderPlanSvg } from "@/lib/plan/planSvg";
import { logActivity } from "@/lib/storage/seed";

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const analysis = useAnalysis();
  const profile = useAppStore((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [o, setO] = useState<ExportOptions>({
    paper: "tabloid",
    orientation: "landscape",
    mode: "color",
    sheets: { plan: true, installer: true, schedule: true, materials: true },
    showCoverage: true,
    customerMode: project.estimate.customerMode,
    company: { name: project.meta.company || profile.company, phone: project.meta.phone || profile.phone, email: project.meta.email || profile.email, license: profile.license },
  });
  if (!analysis) return null;
  const preview = renderPlanSvg(project, analysis, { width: 420, height: 270, mode: o.mode, installer: false, showCoverage: o.showCoverage, showLabels: false, showPipeSizes: false });
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { exportPdf } = await import("@/lib/pdf/exportPdf");
      const blob = await exportPdf(project, analysis, o);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.meta.name.replace(/[^\w\- ]+/g, "")} - ${o.mode === "ink" ? "ink-saver" : "irrigation plan"} (${o.paper}).pdf`;
      a.click();
      logActivity(`Plan exported (${PAPER[o.paper].label}, ${o.mode === "ink" ? "ink-saver" : "full color"})`, project.id, project.meta.name);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Export PDF plan set"
      subtitle="Vector construction plans with title block, legend, scale, north arrow and schedules."
      width={820}
      footer={
        <Button variant="primary" onClick={run} disabled={busy || !Object.values(o.sheets).some(Boolean)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {busy ? "Generating…" : "Download PDF"}
        </Button>
      }
    >
      <div className="grid grid-cols-[1fr_1fr] gap-5">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paper size">
              <Select value={o.paper} onChange={(v: PaperSize) => setO({ ...o, paper: v })} options={(Object.keys(PAPER) as PaperSize[]).map((k) => ({ value: k, label: PAPER[k].label }))} />
            </Field>
            <Field label="Orientation">
              <Select value={o.orientation} onChange={(v) => setO({ ...o, orientation: v })} options={[{ value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }]} />
            </Field>
          </div>
          <Field label="Print style" group>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["color", "Full color", "Zone colors, tinted areas"],
                  ["ink", "Ink-saver", "White background, black linework, hatch patterns"],
                ] as const
              ).map(([k, l, d]) => (
                <button key={k} onClick={() => setO({ ...o, mode: k })} className={cn("rounded-lg border p-2.5 text-left", o.mode === k ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300" : "border-slate-200 hover:bg-slate-50")}>
                  <div className="text-[13px] font-semibold">{l}</div>
                  <div className="text-[11px] text-slate-500">{d}</div>
                </button>
              ))}
            </div>
          </Field>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sheets</div>
            <Toggle checked={o.sheets.plan} onChange={(v) => setO({ ...o, sheets: { ...o.sheets, plan: v } })} label="L-1 Irrigation plan (legend, zone schedule, notes)" />
            <Toggle checked={o.sheets.installer} onChange={(v) => setO({ ...o, sheets: { ...o.sheets, installer: v } })} label="Installer plan + head location schedule" />
            <Toggle checked={o.sheets.schedule} onChange={(v) => setO({ ...o, sheets: { ...o.sheets, schedule: v } })} label="Hydraulic & watering schedule" />
            <Toggle checked={o.sheets.materials} onChange={(v) => setO({ ...o, sheets: { ...o.sheets, materials: v } })} label="Materials / estimate" />
          </div>
          <Toggle checked={o.showCoverage} onChange={(v) => setO({ ...o, showCoverage: v })} label="Show coverage arcs on plan" />
          <Toggle checked={o.customerMode} onChange={(v) => setO({ ...o, customerMode: v })} label="Customer proposal (hide markup & internal costs)" />
          {error && <p className="rounded bg-red-50 p-2 text-[12px] text-red-700">{error}</p>}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preview</div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" dangerouslySetInnerHTML={{ __html: preview }} />
          <p className="mt-2 text-[11.5px] text-slate-500">
            Drawing scale: the plan prints at 1&quot; = {project.settings.drawingScale}&apos; when it fits the sheet, otherwise the next standard engineering scale is chosen automatically.
          </p>
        </div>
      </div>
    </Modal>
  );
}

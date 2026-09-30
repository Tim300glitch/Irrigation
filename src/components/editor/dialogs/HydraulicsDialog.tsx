"use client";
import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { Badge, Modal, cn } from "../../ui";
import { pipeSizeLabel } from "@/lib/units/units";
import { PIPE_SPECS } from "@/lib/hydraulics/pipes";

export function HydraulicsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const analysis = useAnalysis();
  const [tab, setTab] = useState<"zones" | "pipes" | "method">("zones");
  const [zoneId, setZoneId] = useState<string | null>(null);
  if (!analysis) return null;
  const h = analysis.hyd;
  const labels = analysis.labels;
  const maxV = project.settings.maxVelocityFps;
  const sel = h.zones.find((z) => z.zoneId === zoneId) ?? h.zones[0];
  return (
    <Modal open onClose={onClose} title="Hydraulic analysis" subtitle="Hazen-Williams friction · one zone operating at a time · values recalculate as you edit" width={1000}>
      <div className="mb-3 flex gap-1">
        {(
          [
            ["zones", "Zones"],
            ["pipes", "Pipe segments"],
            ["method", "Method & assumptions"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 text-[12.5px]", tab === k ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")}>
            {l}
          </button>
        ))}
      </div>
      {tab === "zones" && (
        <>
          {project.waterSources.map((w) => {
            const s = h.sources.get(w.id);
            return (
              <div key={w.id} className="mb-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
                <b>{w.name}</b>
                <span>Static {w.staticPsi} PSI</span>
                {w.dynamicPsi ? <span>Dynamic {w.dynamicPsi} PSI</span> : null}
                <span>
                  Available {s?.availableGpm.toFixed(1)} GPM <span className="text-slate-500">({s?.availableGpmBasis})</span>
                </span>
                <span>Zone limit {((s?.availableGpm ?? 0) * project.settings.maxZoneFlowPct) / 100 > 0 ? (((s?.availableGpm ?? 0) * project.settings.maxZoneFlowPct) / 100).toFixed(1) : "—"} GPM</span>
                <span>Meter {w.meterSize}&quot; · Backflow {w.backflow.toUpperCase()}</span>
              </div>
            );
          })}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Zone", "Heads", "GPM", "POC PSI", "Mainline", "Valve", "Lateral", "Elev.", "Critical head", "Min PSI", "Var.", "Max vel.", "Pipe", "Status"].map((c) => (
                    <th key={c} className="px-2 py-1.5 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {h.zones.map((z) => (
                  <tr key={z.zoneId} onClick={() => setZoneId(z.zoneId)} className={cn("cursor-pointer border-t border-slate-100 hover:bg-slate-50", sel?.zoneId === z.zoneId && "bg-brand-50/50")}>
                    <td className="px-2 py-1.5 font-semibold">
                      <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: project.zones.find((x) => x.id === z.zoneId)?.color }} />
                      {z.number}
                    </td>
                    <td className="px-2">{z.headCount}</td>
                    <td className="px-2">{z.gpm.toFixed(1)}</td>
                    <td className="px-2">{z.source?.pressure.toFixed(1) ?? "—"}</td>
                    <td className="px-2">−{z.mainlineLoss.toFixed(1)}</td>
                    <td className="px-2">−{z.valveLoss.toFixed(1)}</td>
                    <td className="px-2">−{z.maxLateralLoss.toFixed(1)}</td>
                    <td className="px-2">{z.elevationLoss ? `${z.elevationLoss > 0 ? "−" : "+"}${Math.abs(z.elevationLoss).toFixed(1)}` : "0"}</td>
                    <td className="px-2">{z.criticalHeadId ? labels.get(z.criticalHeadId) : "—"}</td>
                    <td className="px-2 font-semibold">{z.criticalPressure?.toFixed(1) ?? "—"}</td>
                    <td className={cn("px-2", z.pressureVariationPct > 20 && "text-red-600")}>{z.pressureVariationPct.toFixed(0)}%</td>
                    <td className={cn("px-2", z.maxVelocity > maxV && "text-red-600")}>{z.maxVelocity.toFixed(1)}</td>
                    <td className="px-2">{pipeSizeLabel(z.recommendedLateralSize)}</td>
                    <td className="px-2">
                      <Badge tone={z.status === "good" ? "green" : z.status === "warning" ? "amber" : "red"}>{z.status.toUpperCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-[12.5px] font-semibold">Zone {sel.number} pressure budget</div>
                <table className="w-full text-[12px] tabular">
                  <tbody>
                    {[
                      ["Static pressure at source", project.waterSources.find((w) => w.id === sel.sourceId)?.staticPsi ?? 0, true],
                      ["Meter loss", -(sel.source?.meterLoss ?? 0)],
                      ["Service line friction", -(sel.source?.serviceLoss ?? 0)],
                      ["Backflow preventer loss", -(sel.source?.backflowLoss ?? 0)],
                      ["Pressure at POC", sel.source?.pressure ?? 0, true],
                      [`Mainline friction (${sel.mainlineLength.toFixed(0)} ft${sel.mainlineAssumed ? ", not connected" : ""})`, -sel.mainlineLoss],
                      ["Master valve", -sel.masterValveLoss],
                      ["Zone valve", -sel.valveLoss],
                      ["Pressure leaving valve", sel.valveOutPressure ?? 0, true],
                      [`Lateral friction to critical head (${sel.longestPathFt.toFixed(0)} ft longest path)`, -(sel.valveOutPressure !== undefined && sel.criticalPressure !== undefined ? sel.valveOutPressure - sel.criticalPressure : 0)],
                      ["Pressure at critical head", sel.criticalPressure ?? 0, true],
                    ].map(([l, v, bold], i) => (
                      <tr key={i} className={cn("border-t border-slate-100", bold && "font-semibold")}>
                        <td className="py-1">{l as string}</td>
                        <td className="py-1 text-right">{(v as number).toFixed(1)} PSI</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-[12.5px] font-semibold">Head pressures — Zone {sel.number}</div>
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-[12px] tabular">
                    <thead className="text-[11px] text-slate-500">
                      <tr>
                        <th className="text-left font-medium">Head</th>
                        <th className="text-right font-medium">GPM</th>
                        <th className="text-right font-medium">Path ft</th>
                        <th className="text-right font-medium">PSI</th>
                        <th className="text-right font-medium">Needs</th>
                        <th className="text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.sprinklers
                        .filter((s) => s.zoneId === sel.zoneId)
                        .map((s) => h.heads.get(s.id)!)
                        .sort((a, b) => (a.pressure ?? 0) - (b.pressure ?? 0))
                        .map((r) => (
                          <tr key={r.sprinklerId} className="border-t border-slate-100">
                            <td className="py-1">{labels.get(r.sprinklerId)}</td>
                            <td className="text-right">{r.perf.flowGpm.toFixed(2)}</td>
                            <td className="text-right">{r.pathLength?.toFixed(0) ?? "—"}</td>
                            <td className="text-right font-medium">{r.pressure?.toFixed(1) ?? "—"}</td>
                            <td className="text-right">{r.requiredPressure.toFixed(0)}</td>
                            <td className={cn("text-right", r.status === "ok" ? "text-emerald-700" : r.status === "below-min" || r.status === "disconnected" ? "text-red-600" : "text-amber-700")}>{r.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {tab === "pipes" && (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-[12px] tabular">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Pipe", "Zone", "Material", "Size", "Length ft", "Flow GPM", "Velocity ft/s", "Loss PSI", "Recommended"].map((c) => (
                  <th key={c} className="px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.pipes
                .filter((p) => p.kind !== "wire" && p.kind !== "sleeve")
                .map((p) => ({ p, r: h.pipes.get(p.id)! }))
                .sort((a, b) => b.r.maxVelocity - a.r.maxVelocity)
                .map(({ p, r }) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 capitalize">{p.kind}</td>
                    <td className="px-2">{r.zoneIds.map((z) => project.zones.find((x) => x.id === z)?.number).join(", ") || "—"}</td>
                    <td className="px-2">{PIPE_SPECS[p.material].label}</td>
                    <td className="px-2">
                      {r.sizes.map(pipeSizeLabel).join("/")}
                      {p.autoSize ? " (auto)" : ""}
                    </td>
                    <td className="px-2">{r.length.toFixed(1)}</td>
                    <td className="px-2">{r.maxFlow.toFixed(2)}</td>
                    <td className={cn("px-2", r.maxVelocity > maxV && "font-semibold text-red-600")}>{r.maxVelocity.toFixed(2)}</td>
                    <td className="px-2">{r.lossPsi.toFixed(2)}</td>
                    <td className="px-2">{pipeSizeLabel(r.recommendedSize)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "method" && (
        <div className="space-y-2 text-[12.5px] leading-relaxed text-slate-700">
          <p>
            <b>Friction loss (Hazen-Williams, psi):</b> hf = 4.52 × Q<sup>1.852</sup> / (C<sup>1.852</sup> × d<sup>4.87</sup>) × L, with Q in GPM, d = inside diameter (in) from the published pipe class dimensions, C = 150 for PVC and 140 for polyethylene. A {project.settings.minorLossPct}% allowance is added for fittings.
          </p>
          <p>
            <b>Velocity:</b> V = 0.4085 × Q / d² (ft/s). Auto-sized pipes use the smallest size with V ≤ {project.settings.maxVelocityFps} ft/s.
          </p>
          <p>
            <b>Elevation:</b> 0.433 psi per foot of rise between source, valve and head.
          </p>
          <p>
            <b>Flows:</b> branched laterals carry the exact sum of downstream head flows; looped laterals are balanced with the Hardy-Cross method. Head flows are catalog values at design pressure; reducing throw with the radius screw is assumed not to reduce flow (conservative).
          </p>
          <p>
            <b>Component losses:</b> valve, backflow and meter losses use generic representative loss curves by device size. Enter manufacturer values (valve loss override, measured dynamic pressure) for final design.
          </p>
          <p>
            <b>Status rules:</b> error when a head is below its minimum pressure or zone flow exceeds available flow; warning when pressure is &lt; 90% of design, velocity exceeds the limit, zone flow exceeds {project.settings.maxZoneFlowPct}% of available, or pressure varies &gt; 20% across the zone.
          </p>
        </div>
      )}
    </Modal>
  );
}

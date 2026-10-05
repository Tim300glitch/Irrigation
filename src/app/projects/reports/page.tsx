"use client";
import { saveFile } from "@/lib/saveFile";
import { Download } from "lucide-react";
import { AppShell, STATUS_META } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui";
import { formatCurrency0 } from "@/lib/units/units";
import type { ProjectStatus } from "@/lib/model/types";

export default function ReportsPage() {
  const summaries = useAppStore((s) => s.summaries);
  const statuses = Object.keys(STATUS_META) as ProjectStatus[];
  const byStatus = statuses.map((st) => {
    const l = summaries.filter((s) => s.status === st);
    return { st, n: l.length, value: l.reduce((a, s) => a + s.estimateTotal, 0), area: l.reduce((a, s) => a + s.irrigatedArea, 0) };
  });
  const maxV = Math.max(1, ...byStatus.map((b) => b.value));
  const totals = { value: summaries.reduce((a, s) => a + s.estimateTotal, 0), area: summaries.reduce((a, s) => a + s.irrigatedArea, 0), heads: summaries.reduce((a, s) => a + s.headCount, 0), zones: summaries.reduce((a, s) => a + s.zoneCount, 0) };
  const exportCsv = () => {
    const head = ["Project", "Customer", "Address", "Status", "Type", "Zones", "Heads", "Irrigated sq ft", "Estimate", "Errors", "Warnings", "Created", "Updated"];
    const rows = summaries.map((s) => [s.name, s.client, s.address, STATUS_META[s.status].label, s.projectType, s.zoneCount, s.headCount, Math.round(s.irrigatedArea), s.estimateTotal.toFixed(2), s.errorCount, s.warningCount, s.createdAt.slice(0, 10), s.updatedAt.slice(0, 10)]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    saveFile(new Blob([csv], { type: "text/csv" }), "deltaline-projects-report.csv");
  };
  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 md:px-6">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">Portfolio report</h2>
          <Button className="ml-auto" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Projects", String(summaries.length)],
            ["Total estimate value", formatCurrency0(totals.value)],
            ["Designed irrigated area", `${Math.round(totals.area).toLocaleString()} sq ft`],
            ["Heads / zones designed", `${totals.heads} / ${totals.zones}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
              <div className="tabular text-xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-[14px] font-semibold">Pipeline by status</h3>
          <div className="space-y-2">
            {byStatus.map((b) => (
              <div key={b.st} className="grid grid-cols-[120px_1fr_90px_120px] items-center gap-3 text-[12.5px]">
                <span className="text-slate-700">{STATUS_META[b.st].label}</span>
                <div className="h-5 rounded bg-slate-100">
                  <div className="h-5 rounded bg-brand-500" style={{ width: `${(b.value / maxV) * 100}%` }} />
                </div>
                <span className="tabular text-right text-slate-600">
                  {b.n} project{b.n === 1 ? "" : "s"}
                </span>
                <span className="tabular text-right font-medium">{formatCurrency0(b.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-[14px] font-semibold">Design quality</h3>
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1.5 font-medium">Project</th>
                <th className="text-right font-medium">Errors</th>
                <th className="text-right font-medium">Warnings</th>
                <th className="text-right font-medium">Hydraulic issues</th>
                <th className="text-right font-medium">Unpriced items</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {summaries.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5">{s.name}</td>
                  <td className={`text-right ${s.errorCount ? "text-red-600" : ""}`}>{s.errorCount}</td>
                  <td className={`text-right ${s.warningCount ? "text-amber-700" : ""}`}>{s.warningCount}</td>
                  <td className="text-right">{s.hydraulicIssueCount}</td>
                  <td className="text-right">{s.missingPriceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

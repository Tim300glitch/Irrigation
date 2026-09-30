"use client";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { StatusBadge, relTime } from "@/components/app/Dashboard";
import { Badge } from "@/components/ui";
import { formatCurrency0 } from "@/lib/units/units";
import { simpleEstimate } from "@/lib/materials/estimate";

export default function EstimatesPage() {
  return (
    <AppShell title="Estimates">
      <Estimates />
    </AppShell>
  );
}

function Estimates() {
  const summaries = useAppStore((s) => s.summaries);
  const quick = useAppStore((s) => s.quickEstimates);
  const setQuick = useAppStore((s) => s.setQuickEstimates);
  const designTotal = summaries.filter((s) => s.status === "design" || s.status === "quoted").reduce((a, s) => a + s.estimateTotal, 0);
  return (
    <div className="mx-auto max-w-[1300px] space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Estimates</h2>
          <p className="text-[12.5px] text-slate-500">Design-based estimates update automatically from each project&apos;s material takeoff. Quick estimates cover repairs and small jobs.</p>
        </div>
        <Link href="/estimates/quick" className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white hover:bg-brand-700">
          <Plus size={15} /> Quick estimate
        </Link>
        <Link href="/estimates/quick?kind=repair" className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50">
          Repair quote
        </Link>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-[14px] font-semibold">Design estimates</h3>
          <span className="text-[12.5px] text-slate-500">Open (design + quoted): {formatCurrency0(designTotal)}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-2 font-medium">Customer</th>
              <th className="px-2 font-medium">Status</th>
              <th className="px-2 text-right font-medium">Heads / zones</th>
              <th className="px-2 text-right font-medium">Estimate</th>
              <th className="px-2 font-medium">Updated</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-2">{s.client}</td>
                <td className="px-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="tabular px-2 text-right">
                  {s.headCount} / {s.zoneCount}
                </td>
                <td className="tabular px-2 text-right font-semibold">
                  {formatCurrency0(s.estimateTotal)} {s.missingPriceCount > 0 && <Badge tone="amber">{s.missingPriceCount} unpriced</Badge>}
                </td>
                <td className="px-2 text-[12px] text-slate-500">{relTime(s.updatedAt)}</td>
                <td className="px-4 text-right">
                  <Link href={`/design/${s.id}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">
                    Open estimate →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-[14px] font-semibold">Quick estimates</h3>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-2 font-medium">Customer</th>
              <th className="px-2 font-medium">Type</th>
              <th className="px-2 font-medium">Status</th>
              <th className="px-2 text-right font-medium">Total</th>
              <th className="px-2 font-medium">Updated</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {quick.map((q) => (
              <tr key={q.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/estimates/quick?id=${q.id}`} className="hover:underline">
                    {q.name}
                  </Link>
                </td>
                <td className="px-2">{q.customer}</td>
                <td className="px-2 capitalize">{q.kind}</td>
                <td className="px-2">
                  <Badge tone={q.status === "accepted" ? "green" : q.status === "sent" ? "violet" : q.status === "declined" ? "red" : "slate"}>{q.status}</Badge>
                </td>
                <td className="tabular px-2 text-right font-semibold">{formatCurrency0(simpleEstimate(q.items, q.laborHours, q.laborRate, q.taxPct, q.markupPct).total)}</td>
                <td className="px-2 text-[12px] text-slate-500">{relTime(q.updatedAt)}</td>
                <td className="px-4 text-right">
                  <button onClick={() => confirm(`Delete "${q.name}"?`) && setQuick(quick.filter((x) => x.id !== q.id))} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!quick.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No quick estimates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

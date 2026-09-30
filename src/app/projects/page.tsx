"use client";
import { searchParams } from "@/lib/nav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Copy } from "lucide-react";
import { AppShell, STATUS_META } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { ProjectActions, StatusBadge, duplicateProject, relTime } from "@/components/app/Dashboard";
import { cn, Select } from "@/components/ui";
import { formatCurrency0 } from "@/lib/units/units";
import type { ProjectStatus } from "@/lib/model/types";

export default function ProjectsPage() {
  return (
    <AppShell title="Projects">
      <Projects />
    </AppShell>
  );
}

function Projects() {
  const summaries = useAppStore((s) => s.summaries);
  const openNew = useAppStore((s) => s.openNewProject);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [sort, setSort] = useState<"updated" | "created" | "name" | "value">("updated");
  const [view, setView] = useState<"table" | "cards">("table");
  useEffect(() => {
    const p = searchParams();
    setQ(p.get("q") ?? "");
    const st = p.get("status");
    if (st) setStatus(st as ProjectStatus);
  }, []);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = summaries.filter((s) => (status === "all" || s.status === status) && (!t || `${s.name} ${s.client} ${s.address}`.toLowerCase().includes(t)));
    l = [...l].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "value" ? b.estimateTotal - a.estimateTotal : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)));
    return l;
  }, [summaries, q, status, sort]);
  const counts = (st: ProjectStatus) => summaries.filter((s) => s.status === st).length;
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by project, customer or address" className="h-9 w-72 rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" aria-label="Filter projects" />
        <Select className="h-9 w-44" value={sort} onChange={setSort} options={[{ value: "updated", label: "Last edited" }, { value: "created", label: "Created date" }, { value: "name", label: "Name" }, { value: "value", label: "Estimate value" }]} />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          <button onClick={() => setView("table")} className={cn("rounded-md p-1.5", view === "table" && "bg-slate-100")} aria-label="Table view">
            <List size={16} />
          </button>
          <button onClick={() => setView("cards")} className={cn("rounded-md p-1.5", view === "cards" && "bg-slate-100")} aria-label="Card view">
            <LayoutGrid size={16} />
          </button>
        </div>
        <button onClick={() => openNew(true)} className="h-9 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white hover:bg-brand-700">
          New Project
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        <button onClick={() => setStatus("all")} className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium ring-1", status === "all" ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200")}>
          All · {summaries.length}
        </button>
        {(Object.keys(STATUS_META) as ProjectStatus[]).map((st) => (
          <button key={st} onClick={() => setStatus(st)} className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium ring-1", status === st ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200")}>
            {STATUS_META[st].label} · {counts(st)}
          </button>
        ))}
      </div>
      {view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-2 font-medium">Customer</th>
                <th className="px-2 font-medium">Status</th>
                <th className="px-2 text-right font-medium">Zones</th>
                <th className="px-2 text-right font-medium">Heads</th>
                <th className="px-2 text-right font-medium">Irrigated</th>
                <th className="px-2 text-right font-medium">Estimate</th>
                <th className="px-2 font-medium">Last edited</th>
                <th className="px-2 font-medium">Created</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/design/${s.id}`} className="flex items-center gap-3">
                      <div className="h-11 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: s.thumbnailSvg ?? "" }} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{s.name}</span>
                        <span className="block truncate text-[12px] text-slate-500">{s.address}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2">{s.client}</td>
                  <td className="px-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="tabular px-2 text-right">{s.zoneCount}</td>
                  <td className="tabular px-2 text-right">{s.headCount}</td>
                  <td className="tabular whitespace-nowrap px-2 text-right">{Math.round(s.irrigatedArea).toLocaleString()} sq ft</td>
                  <td className="tabular px-2 text-right font-medium">{formatCurrency0(s.estimateTotal)}</td>
                  <td className="whitespace-nowrap px-2 text-[12px] text-slate-500">{relTime(s.updatedAt)}</td>
                  <td className="whitespace-nowrap px-2 text-[12px] text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/design/${s.id}`} className="rounded-md border border-slate-300 px-2.5 py-1 text-[12px] font-medium hover:bg-white">
                        Open
                      </Link>
                      <button onClick={() => duplicateProject(s.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Duplicate">
                        <Copy size={15} />
                      </button>
                      <ProjectActions s={s} />
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No matching projects.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Link href={`/design/${s.id}`} className="block h-40 border-b border-slate-100 bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: s.thumbnailSvg ?? "" }} />
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/design/${s.id}`} className="truncate font-semibold text-slate-900">
                    {s.name}
                  </Link>
                  <StatusBadge status={s.status} />
                </div>
                <div className="truncate text-[12px] text-slate-500">
                  {s.client} · {s.address}
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-slate-600">
                  <span>
                    {s.zoneCount} zones · {Math.round(s.irrigatedArea).toLocaleString()} sq ft
                  </span>
                  <span className="font-semibold text-slate-900">{formatCurrency0(s.estimateTotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11.5px] text-slate-400">Edited {relTime(s.updatedAt)}</span>
                  <ProjectActions s={s} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

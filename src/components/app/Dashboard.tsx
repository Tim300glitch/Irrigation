"use client";
import { saveFile } from "@/lib/saveFile";
import { ask } from "@/components/AskHost";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PencilRuler, FolderOpen, Calculator, Package, ArrowRight, Copy, MoreHorizontal, Wrench, UserPlus, Tags, BookOpen, FileBarChart, AlertTriangle, Gauge, CircleDollarSign, CheckCircle2, Map as MapIcon, Droplets, Layers, Activity, ClipboardList, FileText, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Badge, cn } from "../ui";
import { STATUS_META } from "./AppShell";
import { formatCurrency0 } from "@/lib/units/units";
import type { ProjectStatus, ProjectSummary } from "@/lib/model/types";
import { repo } from "@/lib/storage/repository";
import { persistProject, logActivity } from "@/lib/storage/seed";
import { uid } from "@/lib/model/factory";
import { Popover, MenuItem } from "../Popover";

export function relTime(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 172800) return "Yesterday";
  if (d < 86400 * 30) return `${Math.round(d / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}

export async function duplicateProject(id: string) {
  const p = await repo.getProject(id);
  if (!p) return;
  const now = new Date().toISOString();
  const copy = { ...p, id: uid("prj"), createdAt: now, updatedAt: now, meta: { ...p.meta, name: `${p.meta.name} (copy)`, status: "design" as const } };
  await persistProject(copy, useAppStore.getState().products);
  await logActivity("Project duplicated", copy.id, copy.meta.name);
  await useAppStore.getState().refresh();
}

export async function deleteProject(id: string, name: string) {
  if (!(await ask.confirm(`Delete "${name}"? This cannot be undone.`, true))) return;
  await repo.deleteProject(id);
  await useAppStore.getState().refresh();
}

export async function setProjectStatus(id: string, status: ProjectStatus) {
  const p = await repo.getProject(id);
  if (!p) return;
  p.meta.status = status;
  p.updatedAt = new Date().toISOString();
  await persistProject(p, useAppStore.getState().products);
  await logActivity(`Status changed to ${STATUS_META[status].label}`, p.id, p.meta.name);
  await useAppStore.getState().refresh();
}

export function ProjectActions({ s }: { s: ProjectSummary }) {
  return (
    <Popover
      align="right"
      width={200}
      trigger={(_o, toggle) => (
        <button onClick={toggle} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="More actions">
          <MoreHorizontal size={16} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold uppercase text-slate-400">Set status</div>
          {(Object.keys(STATUS_META) as ProjectStatus[]).map((st) => (
            <MenuItem
              key={st}
              label={STATUS_META[st].label}
              icon={s.status === st ? <CheckCircle2 size={13} /> : <span className="inline-block w-[13px]" />}
              onClick={() => {
                setProjectStatus(s.id, st);
                close();
              }}
            />
          ))}
          <div className="my-1 border-t border-slate-100" />
          <MenuItem
            label="Export project file"
            icon={<FileText size={13} />}
            onClick={async () => {
              const p = await repo.getProject(s.id);
              if (!p) return;
              saveFile(new Blob([JSON.stringify(p)], { type: "application/json" }), `${p.meta.name}.deltaline.json`);
              close();
            }}
          />
          <MenuItem
            danger
            label="Delete project"
            icon={<Trash2 size={13} />}
            onClick={() => {
              close();
              deleteProject(s.id, s.name);
            }}
          />
        </div>
      )}
    </Popover>
  );
}

function Thumb({ svg, className }: { svg?: string; className?: string }) {
  return svg ? <div className={cn("overflow-hidden rounded-md border border-slate-200 bg-white [&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className={cn("flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400", className)}><MapIcon size={18} /></div>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

const WORKFLOW = [
  { label: "Site", icon: MapIcon },
  { label: "Sprinklers", icon: Droplets },
  { label: "Zones", icon: Layers },
  { label: "Hydraulics", icon: Gauge },
  { label: "Materials", icon: Package },
  { label: "Estimate", icon: CircleDollarSign },
  { label: "Plan", icon: FileText },
];

export function Dashboard({ onNew }: { onNew?: () => void }) {
  const router = useRouter();
  const summaries = useAppStore((s) => s.summaries);
  const activity = useAppStore((s) => s.activity);
  const profile = useAppStore((s) => s.profile);
  const products = useAppStore((s) => s.products);
  const quick = useAppStore((s) => s.quickEstimates);
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const openNew = useAppStore((s) => s.openNewProject);
  const newProject = onNew ?? (() => openNew(true));
  const metrics = useMemo(() => {
    const active = summaries.filter((s) => s.status !== "completed" && s.status !== "lead");
    const month = new Date();
    const thisMonth = summaries.filter((s) => {
      const d = new Date(s.createdAt);
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    const open = summaries.filter((s) => s.status === "design" || s.status === "quoted");
    const qe = quick.filter((q) => q.status === "draft" || q.status === "sent");
    const qeTotal = qe.reduce((a, q) => a + q.items.reduce((x, i) => x + i.quantity * i.unitCost, 0) * (1 + q.markupPct / 100) + q.laborHours * q.laborRate, 0);
    return {
      active: active.length,
      area: summaries.reduce((a, s) => a + s.irrigatedArea, 0),
      openEstimates: open.reduce((a, s) => a + s.estimateTotal, 0) + qeTotal,
      openCount: open.length + qe.length,
      thisMonth: thisMonth.length,
      pipeline: summaries.filter((s) => s.status !== "completed").reduce((a, s) => a + s.estimateTotal, 0),
    };
  }, [summaries, quick]);
  const recent = summaries.filter((s) => filter === "all" || s.status === filter).slice(0, 6);
  const health = {
    hydraulic: summaries.filter((s) => s.hydraulicIssueCount > 0),
    lowPressure: summaries.filter((s) => s.lowPressureCount > 0),
    errors: summaries.filter((s) => s.errorCount > 0),
    missingPrices: summaries.filter((s) => s.missingPriceCount > 0),
  };
  const priceDate = profile.pricesUpdatedAt ? new Date(profile.pricesUpdatedAt) : null;
  const catCounts = ["pipe", "sprinklers", "valves", "fittings"].map((c) => ({ c, n: products.filter((p) => p.category === c).length }));

  if (!summaries.length)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
        <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-600">
          <PencilRuler size={32} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Create your first irrigation plan.</h2>
        <p className="mt-2 text-slate-600">Draw your site, place sprinklers, calculate zones and hydraulics, estimate materials, and export an installer-ready PDF.</p>
        <button onClick={newProject} className="mt-6 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          <PencilRuler size={16} /> Start First Project
        </button>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* hero */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-6">
            <svg className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 text-brand-100" viewBox="0 0 200 200" aria-hidden>
              <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="100" cy="100" r="65" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="100" cy="100" r="35" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M100 100 L195 100 A95 95 0 0 0 100 5 Z" fill="currentColor" opacity="0.5" />
            </svg>
            <div className="relative">
              <p className="text-[12.5px] font-medium text-brand-700">Welcome back, {profile.designer.split(" ")[0]}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Design smarter irrigation systems.</h2>
              <p className="mt-1.5 max-w-2xl text-[13.5px] text-slate-600">Plan zones, calculate hydraulics, estimate materials, and generate professional installation plans from one workspace.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={newProject} className="flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[13.5px] font-medium text-white shadow-sm hover:bg-brand-700">
                  <PencilRuler size={16} /> Start New Irrigation Design
                </button>
                {summaries[0] && (
                  <Link href={`/design/${summaries[0].id}`} className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-[13.5px] font-medium text-slate-800 hover:bg-slate-50">
                    <FolderOpen size={16} /> Open Recent Project <span className="hidden text-slate-500 sm:inline">· {summaries[0].name}</span>
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* quick actions */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: <PencilRuler size={20} />, title: "New Irrigation Design", desc: "Start from a blank site, uploaded plan, or property dimensions.", onClick: newProject },
              { icon: <FolderOpen size={20} />, title: "Open Project", desc: "Continue an existing design.", href: "/projects" },
              { icon: <Calculator size={20} />, title: "Quick Estimate", desc: "Create a fast repair or installation estimate without a full design.", href: "/projects/estimates/quick" },
              { icon: <Package size={20} />, title: "Material Calculator", desc: "Calculate pipe, fittings, valves, sprinklers and other materials.", href: "/materials?tab=calculator" },
            ].map((a) =>
              a.href ? (
                <Link key={a.title} href={a.href} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm">
                  <QuickCard {...a} />
                </Link>
              ) : (
                <button key={a.title} onClick={a.onClick} className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm">
                  <QuickCard {...a} />
                </button>
              ),
            )}
          </section>

          {/* metrics */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Active projects" value={String(metrics.active)} sub={`${summaries.length} total`} href="/projects" />
            <Metric label="Total designed area" value={`${Math.round(metrics.area).toLocaleString()} sq ft`} sub="irrigated" href="/projects/reports" />
            <Metric label="Open estimates" value={formatCurrency0(metrics.openEstimates)} sub={`${metrics.openCount} designs & quotes`} href="/projects/estimates" />
            <Metric label="Projects this month" value={String(metrics.thisMonth)} sub={`${formatCurrency0(metrics.pipeline)} pipeline`} href="/projects/reports" />
          </section>

          {/* recent projects */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
              <h3 className="text-[14px] font-semibold text-slate-900">Recent projects</h3>
              <div className="ml-2 flex flex-wrap gap-1">
                {(["all", "lead", "site-survey", "design", "quoted", "approved", "installation", "completed"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2 py-0.5 text-[11.5px] font-medium", filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                    {f === "all" ? "All" : STATUS_META[f].label}
                  </button>
                ))}
              </div>
              <Link href="/projects" className="ml-auto flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline">
                View All Projects <ArrowRight size={14} />
              </Link>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Zones</th>
                    <th className="px-2 py-2 text-right font-medium">Irrigated</th>
                    <th className="px-2 py-2 text-right font-medium">Estimate</th>
                    <th className="px-2 py-2 font-medium">Last edited</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/design/${s.id}`} className="flex items-center gap-3">
                          <Thumb svg={s.thumbnailSvg} className="h-12 w-[72px] shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-900">{s.name}</span>
                            <span className="block truncate text-[12px] text-slate-500">
                              {s.client} · {s.address}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-2">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="tabular px-2 text-right">{s.zoneCount}</td>
                      <td className="tabular whitespace-nowrap px-2 text-right">{Math.round(s.irrigatedArea).toLocaleString()} sq ft</td>
                      <td className="tabular px-2 text-right font-medium">{formatCurrency0(s.estimateTotal)}</td>
                      <td className="whitespace-nowrap px-2 text-[12px] text-slate-500">{relTime(s.updatedAt)}</td>
                      <td className="px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/design/${s.id}`} className="rounded-md border border-slate-300 px-2.5 py-1 text-[12px] font-medium hover:bg-white">
                            Open
                          </Link>
                          <button onClick={() => duplicateProject(s.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Duplicate" aria-label="Duplicate">
                            <Copy size={15} />
                          </button>
                          <ProjectActions s={s} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No projects with this status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {recent.map((s) => (
                <Link key={s.id} href={`/design/${s.id}`} className="flex gap-3 px-4 py-3">
                  <Thumb svg={s.thumbnailSvg} className="h-14 w-20 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{s.name}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="truncate text-[12px] text-slate-500">{s.client}</div>
                    <div className="mt-0.5 text-[12px] text-slate-600">
                      {s.zoneCount} zones · {Math.round(s.irrigatedArea).toLocaleString()} sq ft · <b>{formatCurrency0(s.estimateTotal)}</b>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* workflow */}
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-slate-900">Design workflow</h3>
              <span className="text-[12px] text-slate-500">Auto and manual at every step</span>
            </div>
            <ol className="flex flex-wrap items-center gap-y-2">
              {WORKFLOW.map((w, i) => {
                const Icon = w.icon;
                return (
                  <li key={w.label} className="flex items-center">
                    <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                      <Icon size={14} className="text-brand-600" /> {w.label}
                    </span>
                    {i < WORKFLOW.length - 1 && <ArrowRight size={14} className="mx-1.5 text-slate-300" />}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* business shortcuts */}
          <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              { icon: <Wrench size={16} />, label: "Create Repair Quote", href: "/projects/estimates/quick?kind=repair" },
              { icon: <UserPlus size={16} />, label: "Add Customer", href: "/customers" },
              { icon: <Tags size={16} />, label: "Update Material Prices", href: "/materials" },
              { icon: <BookOpen size={16} />, label: "View Product Library", href: "/products" },
              { icon: <FileBarChart size={16} />, label: "Export Reports", href: "/reports" },
            ].map((b) => (
              <Link key={b.label} href={b.href} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] font-medium text-slate-700 hover:border-brand-300 hover:text-brand-800">
                <span className="text-slate-500">{b.icon}</span> {b.label}
              </Link>
            ))}
          </section>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Activity size={15} className="text-slate-500" />
              <h3 className="text-[14px] font-semibold text-slate-900">Design activity</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {activity.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link href={a.projectId ? `/design/${a.projectId}` : "/"} className="block px-4 py-2.5 hover:bg-slate-50">
                    <div className="text-[12.5px] font-semibold text-slate-900">{a.projectName ?? "DeltaLine"}</div>
                    <div className="text-[12.5px] text-slate-600">{a.message}</div>
                    <div className="text-[11px] text-slate-400">{relTime(a.at)}</div>
                  </Link>
                </li>
              ))}
              {!activity.length && <li className="px-4 py-4 text-[12.5px] text-slate-500">No activity yet.</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <ClipboardList size={15} className="text-slate-500" />
              <h3 className="text-[14px] font-semibold text-slate-900">Design health</h3>
            </div>
            <div className="space-y-1 p-2">
              <HealthRow tone="amber" icon={<Gauge size={15} />} text={`${health.hydraulic.length} project${health.hydraulic.length === 1 ? " has" : "s have"} hydraulic warnings`} target={health.hydraulic[0]} />
              <HealthRow tone="red" icon={<AlertTriangle size={15} />} text={`${health.lowPressure.length} project${health.lowPressure.length === 1 ? " has" : "s have"} sprinklers below design pressure`} target={health.lowPressure[0]} />
              <HealthRow tone="red" icon={<AlertTriangle size={15} />} text={`${health.errors.length} project${health.errors.length === 1 ? " has" : "s have"} design errors`} target={health.errors[0]} />
              <HealthRow tone="slate" icon={<CircleDollarSign size={15} />} text={`${health.missingPrices.length} project${health.missingPrices.length === 1 ? " is" : "s are"} missing material pricing`} target={health.missingPrices[0]} fallbackHref="/materials" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-slate-900">Material prices</h3>
              <Badge tone="green">{products.length} items</Badge>
            </div>
            <p className="text-[12px] text-slate-500">Last updated: {priceDate ? priceDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "never"}</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {catCounts.map(({ c, n }) => (
                <div key={c} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[12px] capitalize text-slate-700">
                  <span>{c === "pipe" ? "PVC & pipe" : c}</span>
                  <span className="tabular text-slate-500">{n}</span>
                </div>
              ))}
            </div>
            <Link href="/materials" className="mt-3 flex h-8 w-full items-center justify-center rounded-lg border border-slate-300 text-[12.5px] font-medium hover:bg-slate-50">
              Manage Pricing
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">{icon}</div>
      <div className="text-[12.5px] font-bold uppercase tracking-wide text-slate-900">{title}</div>
      <div className="mt-1 text-[12.5px] leading-snug text-slate-600">{desc}</div>
    </>
  );
}

function Metric({ label, value, sub, href }: { label: string; value: string; sub: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="tabular mt-0.5 text-[22px] font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="text-[12px] text-slate-500">{sub}</div>
    </Link>
  );
}

function HealthRow({ tone, icon, text, target, fallbackHref }: { tone: "amber" | "red" | "slate"; icon: React.ReactNode; text: string; target?: ProjectSummary; fallbackHref?: string }) {
  const ok = text.startsWith("0 ");
  const href = target ? `/design/${target.id}` : fallbackHref ?? "/projects";
  return (
    <Link href={href} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-slate-50">
      <span className={cn("mt-0.5", ok ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-500" : "text-slate-500")}>{ok ? <CheckCircle2 size={15} /> : icon}</span>
      <span className={ok ? "text-slate-500" : "text-slate-800"}>
        {text}
        {target && !ok && <span className="block text-[11.5px] text-slate-500">e.g. {target.name}</span>}
      </span>
    </Link>
  );
}

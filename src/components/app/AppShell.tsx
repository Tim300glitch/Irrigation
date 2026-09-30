"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Home, FolderKanban, PencilRuler, Calculator, Package, BookOpen, Users, BarChart3, Settings, HelpCircle, Search, Plus, Bell, Menu, X, Building2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Logo } from "../editor/TopBar";
import { cn } from "../ui";
import { NewProjectModal } from "./NewProjectModal";
import { Popover } from "../Popover";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/?new=1", label: "New Design", icon: PencilRuler, action: "new" as const },
  { href: "/estimates", label: "Estimates", icon: Calculator },
  { href: "/materials", label: "Materials", icon: Package },
  { href: "/products", label: "Product Library", icon: BookOpen },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, title, actions }: { children: ReactNode; title?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const init = useAppStore((s) => s.init);
  const ready = useAppStore((s) => s.ready);
  const profile = useAppStore((s) => s.profile);
  const summaries = useAppStore((s) => s.summaries);
  const activity = useAppStore((s) => s.activity);
  const newOpen = useAppStore((s) => s.newProjectOpen);
  const setNewOpen = useAppStore((s) => s.openNewProject);
  const [mobileNav, setMobileNav] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1") setNewOpen(true);
  }, [pathname, setNewOpen]);
  const issues = summaries.filter((s) => s.errorCount > 0 || s.hydraulicIssueCount > 0);
  const initials = profile.designer
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex flex-col">
          <Logo />
          <span className="ml-[30px] -mt-0.5 text-[10.5px] text-slate-500">Irrigation Design &amp; Planning</span>
        </Link>
      </div>
      <div className="flex-1 space-y-0.5 px-2.5 py-2">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : !n.action && pathname.startsWith(n.href);
          const Icon = n.icon;
          const cls = cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors", active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-100");
          return n.action ? (
            <button key={n.label} className={cls} onClick={() => setNewOpen(true)}>
              <Icon size={17} className="text-slate-500" /> {n.label}
            </button>
          ) : (
            <Link key={n.label} href={n.href} className={cls} aria-current={active ? "page" : undefined} onClick={() => setMobileNav(false)}>
              <Icon size={17} className={active ? "text-brand-600" : "text-slate-500"} /> {n.label}
            </Link>
          );
        })}
      </div>
      <div className="space-y-0.5 border-t border-slate-200 px-2.5 py-2.5">
        <Link href="/settings#help" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100">
          <HelpCircle size={17} className="text-slate-500" /> Help
        </Link>
        <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">{initials}</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[12.5px] font-medium text-slate-800">{profile.designer}</span>
            <span className="block truncate text-[11px] text-slate-500">{profile.company}</span>
          </span>
        </Link>
      </div>
    </nav>
  );
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f9]">
      <aside className="hidden w-[228px] shrink-0 border-r border-slate-200 bg-white lg:block">{nav}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileNav(false)} />
          <aside className="relative h-full w-[240px] bg-white shadow-xl">{nav}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Menu">
            {mobileNav ? <X size={18} /> : <Menu size={18} />}
          </button>
          {title && <h1 className="hidden text-[15px] font-semibold text-slate-900 md:block">{title}</h1>}
          <form
            className="relative ml-auto w-full max-w-md md:ml-4"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/projects?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, customers, addresses…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100" aria-label="Search projects" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button onClick={() => setNewOpen(true)} className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-brand-700 sm:flex">
              <Plus size={16} /> New Project
            </button>
            <Popover
              align="right"
              width={320}
              trigger={(_o, toggle) => (
                <button onClick={toggle} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
                  <Bell size={18} />
                  {issues.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
                </button>
              )}
            >
              {(close) => (
                <div className="max-h-96 overflow-y-auto p-1">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notifications</div>
                  {issues.map((s) => (
                    <Link key={s.id} href={`/design/${s.id}`} onClick={close} className="block rounded-md px-2 py-1.5 text-[12.5px] hover:bg-slate-50">
                      <span className="font-medium">{s.name}</span>: {s.errorCount} error(s), {s.hydraulicIssueCount} hydraulic issue(s)
                    </Link>
                  ))}
                  {activity.slice(0, 6).map((a) => (
                    <Link key={a.id} href={a.projectId ? `/design/${a.projectId}` : "/"} onClick={close} className="block rounded-md px-2 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">
                      {a.projectName && <span className="font-medium text-slate-800">{a.projectName}: </span>}
                      {a.message}
                    </Link>
                  ))}
                  {!issues.length && !activity.length && <div className="px-2 py-3 text-[12.5px] text-slate-500">You&apos;re all caught up.</div>}
                </div>
              )}
            </Popover>
            <Link href="/settings" className="hidden items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 md:flex" title="Company profile">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[12px] font-semibold text-white">{initials}</span>
              <Building2 size={15} className="text-slate-400" />
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{ready ? children : <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>}</main>
      </div>
      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
      <button onClick={() => setNewOpen(true)} className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg sm:hidden" aria-label="New project">
        <Plus size={22} />
      </button>
    </div>
  );
}

export const STATUS_META: Record<string, { label: string; tone: "slate" | "blue" | "violet" | "amber" | "green" | "brand" }> = {
  lead: { label: "Lead", tone: "slate" },
  "site-survey": { label: "Site Survey", tone: "slate" },
  design: { label: "Design", tone: "blue" },
  quoted: { label: "Quoted", tone: "violet" },
  approved: { label: "Approved", tone: "green" },
  installation: { label: "Installation", tone: "amber" },
  completed: { label: "Completed", tone: "green" },
};

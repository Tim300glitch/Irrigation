"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  LayoutDashboard,
  Filter,
  Users,
  House,
  FileText,
  Wrench,
  CalendarDays,
  Route,
  Receipt,
  CreditCard,
  Droplets,
  ClipboardCheck,
  Repeat,
  Package,
  HardHat,
  Truck,
  BarChart3,
  Megaphone,
  FolderOpen,
  Settings,
  Smartphone,
  Search,
  Bell,
  Plus,
  Moon,
  Sun,
  Menu as MenuIcon,
  X,
  Construction,
  PencilRuler,
  Globe,
  UserCog,
  Command,
  CheckCheck,
} from "lucide-react";
import { useCrm } from "@/store/crmStore";
import type { Permission } from "@/lib/crm/types";
import { cn, Avatar, Menu, MenuItem } from "./ui";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { QuickCreateHost, useQuickCreate, QUICK_ACTIONS } from "./QuickCreate";
import { Toasts } from "./Toasts";
import { relative, fullName } from "@/lib/crm/format";
import { roleLabel } from "@/lib/crm/constants";
import { installTheme, setDarkTheme, themeStore } from "@/lib/theme";
import { AskHost } from "@/components/AskHost";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: Permission;
  badge?: (s: ReturnType<typeof useCrm.getState>) => number;
}
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" }] },
  {
    group: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: Filter, perm: "leads", badge: (s) => s.data.leads.filter((l) => l.stage === "new").length },
      { href: "/customers", label: "Customers", icon: Users, perm: "customers" },
      { href: "/properties", label: "Properties", icon: House, perm: "customers" },
      { href: "/estimates", label: "Estimates", icon: FileText, perm: "estimates" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/jobs", label: "Jobs", icon: Wrench, perm: "jobs", badge: (s) => s.data.jobs.filter((j) => j.status === "unscheduled").length },
      { href: "/schedule", label: "Schedule", icon: CalendarDays, perm: "schedule" },
      { href: "/dispatch", label: "Dispatch", icon: Route, perm: "dispatch" },
      { href: "/installs", label: "Install Projects", icon: Construction, perm: "jobs" },
    ],
  },
  {
    group: "Billing",
    items: [
      { href: "/invoices", label: "Invoices", icon: Receipt, perm: "invoices" },
      { href: "/payments", label: "Payments", icon: CreditCard, perm: "payments" },
    ],
  },
  {
    group: "Irrigation",
    items: [
      { href: "/systems", label: "Irrigation Systems", icon: Droplets, perm: "systems" },
      { href: "/audits", label: "Inspections / Audits", icon: ClipboardCheck, perm: "systems" },
      { href: "/service-plans", label: "Service Plans", icon: Repeat, perm: "customers" },
      { href: "/projects", label: "Design Studio", icon: PencilRuler, perm: "systems" },
    ],
  },
  {
    group: "Resources",
    items: [
      { href: "/inventory", label: "Inventory", icon: Package, perm: "inventory" },
      { href: "/employees", label: "Employees", icon: HardHat, perm: "employees" },
      { href: "/vendors", label: "Vendors", icon: Truck, perm: "vendors" },
    ],
  },
  {
    group: "Growth",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports" },
      { href: "/marketing", label: "Marketing", icon: Megaphone, perm: "marketing" },
      { href: "/documents", label: "Documents", icon: FolderOpen, perm: "documents" },
    ],
  },
  { group: "", items: [{ href: "/settings", label: "Settings", icon: Settings, perm: "settings" }] },
];

export function useTheme() {
  useEffect(installTheme, []);
  const dark = useSyncExternalStore(themeStore.subscribe, themeStore.isDark, themeStore.serverIsDark);
  return { dark, toggle: () => setDarkTheme(!themeStore.isDark()) };
}

/** Global keyboard shortcuts + store bootstrap + clock tick shared by every shell. */
export function useCrmBoot() {
  const init = useCrm((s) => s.init);
  const tick = useCrm((s) => s.tick);
  const runAutomations = useCrm((s) => s.runAutomations);
  useEffect(() => {
    init();
    const t = setInterval(() => {
      tick();
      runAutomations();
    }, 60000);
    return () => clearInterval(t);
  }, [init, tick, runAutomations]);
}

export function CrmShell({ children, title }: { children: ReactNode; title?: string }) {
  useCrmBoot();
  const ready = useCrm((s) => s.ready);
  const error = useCrm((s) => s.error);
  const session = useCrm((s) => s.session);
  const settings = useCrm((s) => s.settings);
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const openPalette = useCommandPalette((s) => s.setOpen);
  const openQuick = useQuickCreate((s) => s.open);
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const state = useCrm();
  const me = state.data.employees.find((e) => e.id === session?.employeeId);
  const perms = new Set(session ? (settings.rolePermissions[session.role] ?? []) : []);
  useEffect(() => setMobileNav(false), [pathname]);
  useEffect(() => {
    if (title) document.title = `${title} · ${settings.businessName}`;
  }, [title, settings.businessName]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette(true);
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        openPalette(true);
      } else if (!typing && e.key === "n" && !e.metaKey && !e.ctrlKey) {
        openQuick("lead");
      } else if (!typing && e.key === "g") {
        const go = (ev: KeyboardEvent) => {
          const map: Record<string, string> = { d: "/", l: "/leads", c: "/customers", e: "/estimates", j: "/jobs", s: "/schedule", i: "/invoices", r: "/reports" };
          if (map[ev.key]) router.push(map[ev.key]);
          window.removeEventListener("keydown", go);
        };
        window.addEventListener("keydown", go);
        setTimeout(() => window.removeEventListener("keydown", go), 1200);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openPalette, openQuick, router]);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Droplets size={16} />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-semibold text-slate-900">{settings.businessName}</div>
          <div className="text-[10.5px] text-slate-500">Irrigation CRM</div>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-2.5 pb-3">
        {NAV.map((g, gi) => {
          const items = g.items.filter((i) => perms.has(i.perm));
          if (!items.length) return null;
          return (
            <div key={gi} className={cn(g.group ? "mt-3" : "mt-1")}>
              {g.group && <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</div>}
              {items.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname === n.href || pathname.startsWith(n.href + "/");
                const Icon = n.icon;
                const badge = n.badge?.(state) ?? 0;
                return (
                  <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors", active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
                    <Icon size={16} className={active ? "text-brand-600" : "text-slate-400"} />
                    <span className="flex-1 truncate">{n.label}</span>
                    {badge > 0 && <span className="tabular rounded-full bg-slate-200/80 px-1.5 text-[10.5px] font-semibold text-slate-700">{badge}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <div className="mt-3 border-t border-slate-200 pt-3">
          {perms.has("field") && (
            <Link href="/field" className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-slate-600 hover:bg-slate-100">
              <Smartphone size={16} className="text-slate-400" /> Technician App
            </Link>
          )}
          <Link href="/portal" className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-slate-600 hover:bg-slate-100">
            <Globe size={16} className="text-slate-400" /> Customer Portal
          </Link>
          <Link href="/book" className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-slate-600 hover:bg-slate-100">
            <CalendarDays size={16} className="text-slate-400" /> Booking Form
          </Link>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="hidden w-[232px] shrink-0 border-r border-slate-200 bg-white lg:block">{nav}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <aside className="animate-in relative h-full w-[260px] bg-white shadow-xl">{nav}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
            {mobileNav ? <X size={18} /> : <MenuIcon size={18} />}
          </button>
          <button onClick={() => openPalette(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-left text-[13px] text-slate-400 hover:border-slate-300" aria-label="Search">
            <Search size={15} />
            <span className="flex-1 truncate">Search customers, addresses, jobs, models…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 sm:flex">
              <Command size={10} />K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Menu
              width={220}
              trigger={(t) => (
                <button onClick={t} className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-brand-700 md:flex">
                  <Plus size={16} /> New
                </button>
              )}
            >
              {(close) =>
                QUICK_ACTIONS.map((a) => (
                  <MenuItem
                    key={a.kind}
                    icon={<a.icon size={14} />}
                    hint={a.key}
                    onClick={() => {
                      close();
                      openQuick(a.kind);
                    }}
                  >
                    {a.label}
                  </MenuItem>
                ))
              }
            </Menu>
            <button onClick={toggle} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Toggle dark mode" title="Toggle dark mode">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Notifications />
            <Menu
              width={260}
              trigger={(t) => (
                <button onClick={t} className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100" aria-label="Account">
                  <Avatar e={me} size={28} />
                </button>
              )}
            >
              {(close) => (
                <div>
                  <div className="border-b border-slate-100 px-2 pb-2 pt-1">
                    <div className="text-[13px] font-medium text-slate-900">{me ? fullName(me) : "Guest"}</div>
                    <div className="text-[11.5px] text-slate-500">
                      {roleLabel(session?.role ?? "")} · {session?.demo ? "Local demo mode" : session?.email}
                    </div>
                  </div>
                  <div className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">View as (permissions preview)</div>
                  {state.data.employees.filter((e) => !e.archived).map((e) => (
                    <MenuItem
                      key={e.id}
                      icon={<Avatar e={e} size={18} />}
                      hint={roleLabel(e.role)}
                      onClick={() => {
                        close();
                        state.signInAs(e.id);
                        if (["technician", "helper", "crew_lead"].includes(e.role)) router.push("/field");
                      }}
                    >
                      {fullName(e)}
                    </MenuItem>
                  ))}
                  <div className="mt-1 border-t border-slate-100 pt-1">
                    <MenuItem icon={<UserCog size={14} />} href="/settings" onClick={close}>
                      Settings
                    </MenuItem>
                  </div>
                </div>
              )}
            </Menu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto" id="main">
          {!ready ? <Loading /> : error ? <div className="p-6 text-red-600">Failed to load data: {error}</div> : session && perms.size ? children : <div className="p-6 text-slate-600">You don&apos;t have access to this area.</div>}
        </main>
      </div>
      <button onClick={() => useQuickCreate.getState().setMenu(true)} className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-transform hover:scale-105 hover:bg-brand-700 md:bottom-6 md:right-6" aria-label="Quick actions" title="Quick actions">
        <Plus size={22} />
      </button>
      <CommandPalette />
      <QuickCreateHost />
      <Toasts />
      <AskHost />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      <span className="text-[13px]">Loading your business…</span>
    </div>
  );
}

function Notifications() {
  const notifications = useCrm((s) => s.data.notifications);
  const markRead = useCrm((s) => s.markRead);
  const now = useCrm((s) => s.now);
  const unread = notifications.filter((n) => !n.readAt).length;
  const list = notifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  return (
    <Menu
      width={360}
      trigger={(t) => (
        <button onClick={t} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Notifications (${unread} unread)`}>
          <Bell size={17} />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <span className="text-[12.5px] font-semibold text-slate-800">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markRead()} className="flex items-center gap-1 text-[11.5px] text-brand-700 hover:underline">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {list.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/"}
                onClick={() => {
                  markRead([n.id]);
                  close();
                }}
                className={cn("flex gap-2 rounded-md px-2 py-2 hover:bg-slate-50", !n.readAt && "bg-brand-50/50")}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-slate-900">{n.title}</span>
                  <span className="block truncate text-[12px] text-slate-500">{n.body}</span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{relative(n.createdAt, now)}</span>
              </Link>
            ))}
            {!list.length && <div className="px-2 py-6 text-center text-[12.5px] text-slate-500">You&apos;re all caught up.</div>}
          </div>
        </div>
      )}
    </Menu>
  );
}

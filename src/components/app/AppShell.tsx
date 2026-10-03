"use client";
import { searchParams } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "../ui";
import { NewProjectModal } from "./NewProjectModal";
import { CrmShell } from "../crm/Shell";


/** Design Studio pages render inside the CRM shell so navigation, search and theme are shared. */
export function AppShell({ children, title, actions }: { children: ReactNode; title?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  const init = useAppStore((s) => s.init);
  const ready = useAppStore((s) => s.ready);
  const newOpen = useAppStore((s) => s.newProjectOpen);
  const setNewOpen = useAppStore((s) => s.openNewProject);
  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (searchParams().get("new") === "1") setNewOpen(true);
  }, [pathname, setNewOpen]);
  return (
    <CrmShell title={title}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
        <nav className="flex flex-wrap gap-1 text-[12.5px]">
          {STUDIO_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-md px-2 py-1", pathname === n.href ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <button onClick={() => setNewOpen(true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12.5px] font-medium text-white hover:bg-brand-700">
            <Plus size={14} /> New design
          </button>
        </div>
      </div>
      {ready ? children : <div className="flex h-64 items-center justify-center text-slate-500">Loading…</div>}
      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
    </CrmShell>
  );
}

const STUDIO_NAV = [
  { href: "/studio", label: "Overview" },
  { href: "/projects", label: "Designs" },
  { href: "/projects/estimates", label: "Design estimates" },
  { href: "/materials", label: "Materials" },
  { href: "/products", label: "Product library" },
  { href: "/projects/reports", label: "Design reports" },
  { href: "/settings/design", label: "Studio settings" },
];

export const STATUS_META: Record<string, { label: string; tone: "slate" | "blue" | "violet" | "amber" | "green" | "brand" }> = {
  lead: { label: "Lead", tone: "slate" },
  "site-survey": { label: "Site Survey", tone: "slate" },
  design: { label: "Design", tone: "blue" },
  quoted: { label: "Quoted", tone: "violet" },
  approved: { label: "Approved", tone: "green" },
  installation: { label: "Installation", tone: "amber" },
  completed: { label: "Completed", tone: "green" },
};

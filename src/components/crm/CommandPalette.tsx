"use client";
/** ⌘K command palette: commands + instant global search across the whole CRM. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { Search, User, House, Wrench, FileText, Receipt, Droplets, HardHat, Package, Filter, CornerDownLeft, CalendarDays, Plus, ArrowRight } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import { search, type SearchKind } from "@/lib/crm/search";
import { useQuickCreate, QUICK_ACTIONS } from "./QuickCreate";
import { cn } from "./ui";

export const useCommandPalette = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const KIND_ICON: Record<SearchKind, typeof User> = { customer: User, property: House, job: Wrench, estimate: FileText, invoice: Receipt, equipment: Droplets, employee: HardHat, item: Package, lead: Filter };
const KIND_LABEL: Record<SearchKind, string> = { customer: "Customers", property: "Properties", job: "Jobs", estimate: "Estimates", invoice: "Invoices", equipment: "Installed equipment", employee: "Team", item: "Materials", lead: "Leads" };

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: typeof User;
  run: () => void;
  group: string;
  sub?: string;
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const data = useCrm((s) => s.data);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
    }
  }, [open]);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const commands: Cmd[] = useMemo(
    () => [
      ...QUICK_ACTIONS.map((a) => ({ id: `new-${a.kind}`, label: `Create ${a.label.replace("New ", "").toLowerCase()}`, icon: Plus, hint: a.key, group: "Commands", run: () => (setOpen(false), openQuick(a.kind)) })),
      { id: "sched", label: "Schedule job", icon: CalendarDays, group: "Commands", run: () => go("/schedule") },
      { id: "cal", label: "Open calendar", icon: CalendarDays, hint: "G S", group: "Commands", run: () => go("/schedule") },
      { id: "disp", label: "Open dispatch board", icon: ArrowRight, group: "Commands", run: () => go("/dispatch") },
      { id: "searchc", label: "Search customers", icon: Search, group: "Commands", run: () => go("/customers") },
      { id: "field", label: "Open technician app", icon: ArrowRight, group: "Commands", run: () => go("/field") },
      { id: "rep", label: "Open reports", icon: ArrowRight, hint: "G R", group: "Commands", run: () => go("/reports") },
      { id: "pb", label: "Open price book", icon: ArrowRight, group: "Commands", run: () => go("/inventory?tab=pricebook") },
      { id: "auto", label: "Automation rules", icon: ArrowRight, group: "Commands", run: () => go("/settings?tab=automations") },
    ],
    [openQuick, setOpen], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const results = useMemo(() => (q.trim().length >= 2 ? search(data, q, 30) : []), [data, q]);
  const items: Cmd[] = useMemo(() => {
    const t = q.toLowerCase().trim();
    const cmds = commands.filter((c) => !t || c.label.toLowerCase().includes(t));
    const res = results.map((r) => ({ id: `${r.kind}:${r.id}`, label: r.title, sub: r.match ? `${r.subtitle} — ${r.match}` : r.subtitle, icon: KIND_ICON[r.kind], group: KIND_LABEL[r.kind], run: () => go(r.href) }));
    return t ? [...res, ...cmds.slice(0, 5)] : cmds;
  }, [q, results, commands]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);
  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/40 p-3 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="animate-in w-full max-w-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3.5">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(items.length - 1, h + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              }
              if (e.key === "Enter") items[hi]?.run();
            }}
            placeholder='Search anything — "Rain Bird 5000", a phone number, an address, #2104…'
            className="h-12 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10.5px] text-slate-500">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {items.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                {header && <div className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{header}</div>}
                <button data-i={i} onMouseEnter={() => setHi(i)} onClick={c.run} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", hi === i ? "bg-slate-100" : "")}>
                  <Icon size={15} className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900">{c.label}</span>
                    {c.sub && <span className="block truncate text-[11.5px] text-slate-500">{c.sub}</span>}
                  </span>
                  {c.hint && <kbd className="rounded border border-slate-200 px-1.5 text-[10.5px] text-slate-500">{c.hint}</kbd>}
                  {hi === i && <CornerDownLeft size={13} className="text-slate-400" />}
                </button>
              </div>
            );
          })}
          {q.trim().length >= 2 && !results.length && <div className="px-3 py-6 text-center text-[13px] text-slate-500">No records match “{q}”.</div>}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">
            Shortcuts: <kbd>N</kbd> new lead · <kbd>G</kbd> then <kbd>D/L/C/E/J/S/I/R</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

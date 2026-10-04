"use client";
/** CRM UI kit: compact, information-dense primitives shared by every screen. */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import Link from "next/link";
import { X, ChevronRight, Search, Inbox } from "lucide-react";
import { cn } from "@/components/ui";
import type { Tone } from "@/lib/crm/constants";
import { initials } from "@/lib/crm/format";
import { spaRouter } from "@/lib/spaRouter";
import type { Employee } from "@/lib/crm/types";

export { cn };
export { Button, Modal, NumberInput } from "@/components/ui";

/* ───────── URL query (works in Next and the single-file hash build) ───────── */

function readQuery() {
  if (typeof window === "undefined") return "";
  const r = spaRouter();
  if (r) {
    const u = r.get();
    const i = u.indexOf("?");
    return i >= 0 ? u.slice(i + 1) : "";
  }
  return window.location.search.slice(1);
}
const qSubs = new Set<() => void>();
if (typeof window !== "undefined") {
  const fire = () => qSubs.forEach((f) => f());
  window.addEventListener("popstate", fire);
  for (const k of ["pushState", "replaceState"] as const) {
    const orig = history[k].bind(history);
    history[k] = (...args: Parameters<History["pushState"]>) => {
      orig(...args);
      queueMicrotask(fire);
    };
  }
}
export function useQuery(): URLSearchParams {
  const q = useSyncExternalStore(
    (cb) => {
      qSubs.add(cb);
      const unsub = spaRouter()?.subscribe(cb);
      return () => {
        qSubs.delete(cb);
        unsub?.();
      };
    },
    readQuery,
    () => "",
  );
  return new URLSearchParams(q);
}
/** Update one query param without a navigation (keeps tabs/filters linkable). */
export function setQueryParam(key: string, value: string | null) {
  const p = new URLSearchParams(readQuery());
  if (value === null || value === "") p.delete(key);
  else p.set(key, value);
  const qs = p.toString();
  const r = spaRouter();
  if (r) return r.replace(`${r.get().split("?")[0]}${qs ? "?" + qs : ""}`);
  try {
    history.replaceState(null, "", `${window.location.pathname}${qs ? "?" + qs : ""}`);
  } catch {
    /* URL not writable in this frame */
  }
}

/* ───────── layout ───────── */

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-3 py-4 sm:px-5 md:py-5", wide ? "max-w-[1800px]" : "max-w-[1480px]", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, back, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="mb-4">
      {back && (
        <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800">
          {back.label} <ChevronRight size={12} />
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[12.5px] text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className, pad = true, sub, icon }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="text-slate-400">{icon}</span>}
            <h2 className="truncate text-[13px] font-semibold text-slate-800">{title}</h2>
            {sub && <span className="truncate text-[12px] text-slate-500">{sub}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-1 flex gap-0.5 overflow-x-auto border-b border-slate-200 px-1", className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn("relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors", value === t.id ? "text-brand-700" : "text-slate-500 hover:text-slate-800")}>
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[10.5px] tabular", value === t.id ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = "md" }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={cn("whitespace-nowrap rounded-md font-medium transition-colors", size === "sm" ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-[12.5px]", value === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── badges ───────── */

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};
const DOTS: Record<Tone, string> = { slate: "bg-slate-400", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-sky-500", violet: "bg-violet-500", brand: "bg-brand-500", orange: "bg-orange-500", teal: "bg-teal-500" };

export function Badge({ tone = "slate", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-[1px] text-[11px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ list, value }: { list: { id: string; label: string; tone: Tone }[]; value: string }) {
  const s = list.find((x) => x.id === value);
  return (
    <Badge tone={s?.tone ?? "slate"} dot>
      {s?.label ?? value}
    </Badge>
  );
}

export function Avatar({ e, size = 24, className }: { e?: Pick<Employee, "firstName" | "lastName" | "color"> | null; size?: number; className?: string }) {
  if (!e) return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400", className)} style={{ width: size, height: size }}>?</span>;
  return (
    <span title={`${e.firstName} ${e.lastName}`} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)} style={{ width: size, height: size, background: e.color, fontSize: size * 0.4 }}>
      {initials(e)}
    </span>
  );
}

/* ───────── form controls ───────── */

export const inputCls = "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";

export function Field({ label, children, hint, className, required }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(inputCls, className)} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(inputCls, "h-auto min-h-[64px] py-1.5 leading-relaxed", className)} />;
}
export function Select({ className, options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...p} className={cn(inputCls, "pr-7", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…", className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, "pl-8")} aria-label={placeholder} />
    </div>
  );
}

export function Check({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-700", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[var(--color-brand-600)]" />
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-4.5" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

/* ───────── overlays ───────── */

export function SlideOver({ open, onClose, title, subtitle, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="animate-slide relative flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Menu({ trigger, children, align = "right", width = 220 }: { trigger: (toggle: () => void, open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div className={cn("animate-in absolute z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl", align === "right" ? "right-0" : "left-0")} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, href, danger, hint }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; href?: string; danger?: boolean; hint?: ReactNode }) {
  const cls = cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100");
  const inner = (
    <>
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls} onClick={onClick}>
      {inner}
    </Link>
  ) : (
    <button className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

/* ───────── data display ───────── */

export function KV({ items, cols = 2, className }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-2.5", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="truncate text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="mt-0.5 break-words text-[13px] text-slate-900">{v === undefined || v === null || v === "" ? <span className="text-slate-400">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatTile({ label, value, sub, href, trend, icon, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; href?: string; trend?: { value: number; good?: boolean }; icon?: ReactNode; tone?: "default" | "warn" | "bad" }) {
  const body = (
    <div className={cn("group h-full rounded-xl border bg-white px-3.5 py-3 transition-colors", tone === "bad" ? "border-red-200" : tone === "warn" ? "border-amber-200" : "border-slate-200", href && "hover:border-brand-300")}>
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[11.5px] font-medium text-slate-500">{label}</div>
        {icon && <span className="text-slate-400 group-hover:text-brand-600">{icon}</span>}
      </div>
      <div className="tabular mt-1 truncate text-[20px] font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-slate-500">
        {trend && (
          <span className={cn("font-medium", (trend.good ?? trend.value >= 0) ? "text-emerald-700" : "text-red-600")}>
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(Math.round(trend.value * 100))}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {body}
    </Link>
  ) : (
    <div className="min-w-0">{body}</div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon ?? <Inbox size={18} />}</span>
      <div className="text-[13.5px] font-medium text-slate-800">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[12.5px] text-slate-500">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Progress({ value, tone = "brand", className }: { value: number; tone?: "brand" | "green" | "amber" | "red"; className?: string }) {
  const c = { brand: "bg-brand-600", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function LinkText({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-slate-900 hover:text-brand-700 hover:underline", className)} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h3>
      {right}
    </div>
  );
}

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  return [
    v,
    (n: T) => {
      setV(n);
      try {
        localStorage.setItem(key, JSON.stringify(n));
      } catch {
        /* ignore */
      }
    },
  ];
}

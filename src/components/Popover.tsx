"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./ui";

export function Popover({ trigger, children, align = "left", width = 240, className }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div className={cn("relative", className)} ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={cn("absolute top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl", align === "right" ? "right-0" : "left-0")} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, label, hint, onClick, disabled, danger }: { icon?: ReactNode; label: ReactNode; hint?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-slate-100 disabled:opacity-40", danger ? "text-red-700" : "text-slate-800")}>
      {icon && <span className="text-slate-500">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </button>
  );
}

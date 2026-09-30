"use client";
/**
 * Dropdown/popover rendered in a portal on top of everything (toolbars scroll
 * horizontally and would otherwise clip their menus).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./ui";

export function Popover({ trigger, children, align = "left", width = 240, className }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const top = r.bottom + 4;
    setPos({ left, top, maxH: window.innerHeight - top - 12 });
  };
  useLayoutEffect(() => {
    if (open) place();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const reflow = () => place();
    window.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      window.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn("relative shrink-0", className)} ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open &&
        pos &&
        createPortal(
          <div ref={panel} className="fixed z-[1000] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl" style={{ left: pos.left, top: pos.top, width, maxHeight: pos.maxH }}>
            {children(() => setOpen(false))}
          </div>,
          document.body,
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

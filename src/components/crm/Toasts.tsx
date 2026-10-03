"use client";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useToasts } from "@/lib/crm/toast";
import { cn } from "./ui";

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-3 md:bottom-6 md:left-6 md:translate-x-0" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn("animate-in pointer-events-auto flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-800 shadow-lg", t.tone === "error" ? "border-red-200" : "border-slate-200")}>
          {t.tone === "success" ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : t.tone === "error" ? <AlertCircle size={16} className="shrink-0 text-red-600" /> : <Info size={16} className="shrink-0 text-brand-600" />}
          <span className="flex-1">{t.message}</span>
          {t.action &&
            (t.action.href ? (
              <Link href={t.action.href} className="shrink-0 font-medium text-brand-700 hover:underline">
                {t.action.label}
              </Link>
            ) : (
              <button onClick={t.action.onClick} className="shrink-0 font-medium text-brand-700 hover:underline">
                {t.action.label}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

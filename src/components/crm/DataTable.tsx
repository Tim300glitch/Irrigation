"use client";
/**
 * Data table: sticky header, click-to-sort, incremental rendering for large
 * lists, row click, and a stacked card layout on phones. Columns opt into
 * mobile display with `mobile`. `toCsv` exports exactly what is shown.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, Empty } from "./ui";
import { saveFile } from "@/lib/saveFile";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** shown on phones (first mobile column is the card title) */
  mobile?: boolean;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  csv?: (row: T) => string | number;
}

export function DataTable<T extends { id: string }>({ rows, columns, onRowClick, empty, initialSort, pageSize = 60, className, dense, rowClassName, footer }: { rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void; empty?: ReactNode; initialSort?: { key: string; dir: "asc" | "desc" }; pageSize?: number; className?: string; dense?: boolean; rowClassName?: (row: T) => string | undefined; footer?: ReactNode }) {
  const [sort, setSort] = useState(initialSort);
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    const out = rows.slice().sort((a, b) => {
      const x = f(a);
      const y = f(b);
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    });
    return sort!.dir === "desc" ? out.reverse() : out;
  }, [rows, columns, sort]);
  const shown = sorted.slice(0, limit);
  const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };
  const mobileCols = columns.filter((c) => c.mobile);
  if (!rows.length) return <div className={className}>{empty ?? <Empty title="Nothing here yet" />}</div>;
  return (
    <div className={className}>
      {/* desktop / tablet */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={cn("whitespace-nowrap px-3 py-2 font-medium first:pl-4 last:pr-4", c.align === "right" && "text-right", c.align === "center" && "text-center", c.hideBelow && hide[c.hideBelow])}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === "desc" ? "asc" : "desc" }))}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("border-b border-slate-100 last:border-0", onRowClick && "cursor-pointer hover:bg-slate-50", rowClassName?.(r))}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 first:pl-4 last:pr-4", dense ? "py-1.5" : "py-2.5", c.align === "right" && "tabular text-right", c.align === "center" && "text-center", c.hideBelow && hide[c.hideBelow])}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer}
        </table>
      </div>
      {/* phone */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {shown.map((r) => (
          <div key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("px-3 py-2.5", onRowClick && "active:bg-slate-50")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[13.5px]">{mobileCols[0]?.cell(r)}</div>
              {mobileCols[1] && <div className="shrink-0 text-right text-[13px]">{mobileCols[1].cell(r)}</div>}
            </div>
            {mobileCols.length > 2 && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">{mobileCols.slice(2).map((c) => <span key={c.key}>{c.cell(r)}</span>)}</div>}
          </div>
        ))}
      </div>
      {sorted.length > limit && (
        <div className="border-t border-slate-100 p-2 text-center">
          <button className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-brand-700 hover:bg-brand-50" onClick={() => setLimit((l) => l + pageSize * 2)}>
            Show more ({sorted.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export function toCsv<T>(rows: T[], cols: { header: string; value: (r: T) => string | number | undefined }[]): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => esc(c.header)).join(","), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(","))].join("\n");
}

export function downloadText(name: string, text: string, mime = "text/csv") {
  void saveFile(new Blob([text], { type: mime }), name);
}

"use client";
/**
 * Lightweight SVG charts (no chart library): line/area with crosshair tooltip,
 * vertical (optionally stacked) bars with per-bar tooltips, ranked horizontal
 * bars and sparklines. Colors come from the validated categorical slots
 * (--color-s1…s8, fixed order), text stays in neutral ink, one y-axis only.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

export const SERIES = ["var(--color-s1)", "var(--color-s2)", "var(--color-s3)", "var(--color-s4)", "var(--color-s5)", "var(--color-s6)", "var(--color-s7)", "var(--color-s8)"];

export interface Series {
  key: string;
  label: string;
  color?: string;
}
type Row = Record<string, number | string>;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-600">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2.5 rounded-sm" style={{ background: s.color ?? SERIES[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 12, 4), w - 168);
  return (
    <div className="pointer-events-none absolute z-10 w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11.5px] shadow-lg" style={{ left, top: Math.max(0, y - 10) }}>
      {children}
    </div>
  );
}

const PAD = { l: 44, r: 10, t: 10, b: 24 };

export function LineChart({ data, series, x, height = 220, format = (v) => String(v), area = false, className }: { data: Row[]; series: Series[]; x: string; height?: number; format?: (v: number) => string; area?: boolean; className?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const iw = Math.max(10, w - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const sx = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const sy = (v: number) => PAD.t + ih - (v / max) * ih;
  const empty = !data.some((d) => series.some((s) => Number(d[s.key]) > 0));
  const ticks = empty ? [0] : [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 64))));
  return (
    <div className={cn("w-full", className)}>
      {series.length > 1 && (
        <div className="mb-2">
          <Legend series={series} />
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[12px] text-slate-400">No data yet</div>}
        {w > 0 && (
          <svg width={w} height={height} className="block overflow-visible" role="img">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--color-slate-200)" strokeDasharray={t ? "2 3" : undefined} />
                <text x={PAD.l - 6} y={sy(t) + 3.5} textAnchor="end" className="fill-slate-500 text-[10px] tabular">
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % every === 0 || i === data.length - 1 ? (
                <text key={i} x={sx(i)} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {String(d[x])}
                </text>
              ) : null,
            )}
            {series.map((s, si) => {
              const c = s.color ?? SERIES[si];
              const pts = data.map((d, i) => `${sx(i)},${sy(Number(d[s.key]) || 0)}`);
              return (
                <g key={s.key}>
                  {area && <path d={`M${sx(0)},${sy(0)} L${pts.join(" L")} L${sx(data.length - 1)},${sy(0)} Z`} fill={c} opacity={0.1} />}
                  <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
            {hover !== null && (
              <g>
                <line x1={sx(hover)} x2={sx(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-slate-400)" strokeDasharray="3 3" />
                {series.map((s, si) => (
                  <circle key={s.key} cx={sx(hover)} cy={sy(Number(data[hover][s.key]) || 0)} r={4} fill={s.color ?? SERIES[si]} stroke="var(--color-surface)" strokeWidth={2} />
                ))}
              </g>
            )}
            <rect
              x={PAD.l}
              y={PAD.t}
              width={iw}
              height={ih}
              fill="transparent"
              onMouseMove={(e) => {
                const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
                setHover(Math.max(0, Math.min(data.length - 1, i)));
              }}
            />
          </svg>
        )}
        {hover !== null && data[hover] && (
          <Tooltip x={sx(hover)} y={PAD.t} w={w}>
            <div className="mb-1 font-medium text-slate-800">{String(data[hover][x])}</div>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? SERIES[si] }} />
                  {s.label}
                </span>
                <span className="tabular font-medium text-slate-900">{format(Number(data[hover][s.key]) || 0)}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function BarChart({ data, series, x, height = 220, format = (v) => String(v), stacked = false, className }: { data: Row[]; series: Series[]; x: string; height?: number; format?: (v: number) => string; stacked?: boolean; className?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const iw = Math.max(10, w - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const vals = data.map((d) => series.map((s) => Math.max(0, Number(d[s.key]) || 0)));
  const max = niceMax(Math.max(1, ...vals.map((v) => (stacked ? v.reduce((a, b) => a + b, 0) : Math.max(...v)))));
  const band = iw / Math.max(1, data.length);
  const gap = Math.min(10, band * 0.28);
  const groupW = band - gap;
  const barW = stacked ? groupW : (groupW - (series.length - 1) * 2) / series.length;
  const sy = (v: number) => (v / max) * ih;
  const empty = !data.some((d) => series.some((s) => Number(d[s.key]) > 0));
  const ticks = empty ? [0] : [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  const r = Math.min(4, barW / 2);
  const roundTop = (x0: number, y0: number, bw: number, bh: number) => (bh <= r ? `M${x0},${y0 + bh} h${bw} v${-bh} h${-bw} Z` : `M${x0},${y0 + bh} v${-(bh - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${bh - r} Z`);
  return (
    <div className={cn("w-full", className)}>
      {series.length > 1 && (
        <div className="mb-2">
          <Legend series={series} />
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[12px] text-slate-400">No data yet</div>}
        {w > 0 && (
          <svg width={w} height={height} className="block" role="img">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={PAD.t + ih - sy(t)} y2={PAD.t + ih - sy(t)} stroke="var(--color-slate-200)" strokeDasharray={t ? "2 3" : undefined} />
                <text x={PAD.l - 6} y={PAD.t + ih - sy(t) + 3.5} textAnchor="end" className="fill-slate-500 text-[10px] tabular">
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x0 = PAD.l + i * band + gap / 2;
              let acc = 0;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
                  <rect x={PAD.l + i * band} y={PAD.t} width={band} height={ih} fill="transparent" />
                  {series.map((s, si) => {
                    const v = vals[i][si];
                    const h = sy(v);
                    const c = s.color ?? SERIES[si];
                    if (stacked) {
                      const y0 = PAD.t + ih - acc - h;
                      acc += h;
                      const top = si === series.length - 1 || vals[i].slice(si + 1).every((z) => z === 0);
                      return top ? <path key={s.key} d={roundTop(x0, y0, barW, Math.max(0, h - (si ? 2 : 0)))} fill={c} /> : <rect key={s.key} x={x0} y={y0} width={barW} height={Math.max(0, h - (si ? 2 : 0))} fill={c} />;
                    }
                    return <path key={s.key} d={roundTop(x0 + si * (barW + 2), PAD.t + ih - h, barW, h)} fill={c} />;
                  })}
                  {(i % every === 0 || i === data.length - 1) && (
                    <text x={x0 + groupW / 2} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                      {String(d[x])}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && data[hover] && (
          <Tooltip x={PAD.l + hover * band + band / 2} y={PAD.t} w={w}>
            <div className="mb-1 font-medium text-slate-800">{String(data[hover][x])}</div>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? SERIES[si] }} />
                  {s.label}
                </span>
                <span className="tabular font-medium text-slate-900">{format(vals[hover][si])}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** Ranked horizontal bars with labels and values — for "by technician", "by service type", etc. */
export function RankBars({ rows, format = (v) => String(v), color = SERIES[0], max: maxIn, onClick }: { rows: { label: ReactNode; value: number; sub?: ReactNode; color?: string; key: string }[]; format?: (v: number) => string; color?: string; max?: number; onClick?: (key: string) => void }) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className={cn("group", onClick && "cursor-pointer")} onClick={() => onClick?.(r.key)} title={`${format(r.value)}`}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate text-slate-700 group-hover:text-slate-900">{r.label}</span>
            <span className="tabular shrink-0 font-medium text-slate-900">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 font-normal text-slate-500">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${(Math.max(0, r.value) / max) * 100}%`, background: r.color ?? color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = SERIES[0], width = 80, height = 24 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(" ");
  return (
    <svg width={width} height={height} className="block" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Two-value comparison bar (estimated vs actual etc.) */
export function CompareBar({ a, b, labelA, labelB, format }: { a: number; b: number; labelA: string; labelB: string; format: (v: number) => string }) {
  const max = Math.max(a, b, 1);
  return (
    <div className="space-y-1.5 text-[12px]">
      {[
        [labelA, a, SERIES[0]],
        [labelB, b, SERIES[1]],
      ].map(([l, v, c]) => (
        <div key={l as string} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-slate-500">{l}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${((v as number) / max) * 100}%`, background: c as string }} />
          </div>
          <span className="tabular w-16 shrink-0 text-right font-medium text-slate-900">{format(v as number)}</span>
        </div>
      ))}
    </div>
  );
}

"use client";
/** Calendar (day / week / month / technician / crew) with drag-and-drop scheduling, plus the dispatch board. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Clock, MapPin, Route as RouteIcon, Flame, CalendarDays, Navigation, Phone } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Appointment, Employee, Job } from "@/lib/crm/types";
import { JOB_STATUSES, OPEN_JOB, serviceColor, serviceShort, serviceLabel, statusTone } from "@/lib/crm/constants";
import { addDays, customerName, isoDate, money0, startOfDay, startOfWeek, time, fullName, addressLine, relative, mapsUrl, phone } from "@/lib/crm/format";
import { lineTotals } from "@/lib/crm/calc";
import { providers } from "@/lib/crm/integrations";
import { Page, PageHeader, Button, Badge, Avatar, Segmented, cn, Card, StatusBadge, useLocalState, Select } from "../ui";
import { useQuickCreate } from "../QuickCreate";
import { toast } from "@/lib/crm/toast";

type View = "day" | "week" | "month" | "tech" | "crew";
const START_H = 6;
const END_H = 19;
const HOUR_PX = 52;
const fieldRoles = ["technician", "crew_lead"];

function useDnD() {
  const [drag, setDrag] = useState<string | null>(null);
  return { drag, setDrag };
}

export function SchedulePage() {
  const { data, now, scheduleJob } = useCrm();
  const openQuick = useQuickCreate((s) => s.open);
  const [view, setView] = useLocalState<View>("sched-view", "week");
  const [colorBy, setColorBy] = useLocalState<"tech" | "type">("sched-color", "tech");
  const [anchor, setAnchor] = useState(() => startOfDay(now).getTime());
  const { drag, setDrag } = useDnD();
  const emp = byId(data.employees);
  const techs = data.employees.filter((e) => e.active && fieldRoles.includes(e.role));
  const unscheduled = data.jobs.filter((j) => !j.archived && j.status === "unscheduled").sort((a, b) => (a.priority === "urgent" ? -1 : 0) - (b.priority === "urgent" ? -1 : 0));
  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [new Date(anchor)];
  const step = view === "week" ? 7 : view === "month" ? 30 : 1;
  const title = view === "month" ? new Date(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : view === "week" ? `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : new Date(anchor).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const colorOf = (j: Job) => (colorBy === "tech" ? (emp.get(j.assignedTo ?? "")?.color ?? "#94a3b8") : serviceColor(j.serviceType));
  const drop = (start: Date, assignedTo?: string) => {
    if (!drag) return;
    const j = data.jobs.find((x) => x.id === drag);
    scheduleJob(drag, start.toISOString(), assignedTo ?? j?.assignedTo);
    toast(`Job #${j?.number} scheduled ${start.toLocaleDateString("en-US", { weekday: "short" })} ${time(start)}`, "success");
    setDrag(null);
  };
  return (
    <Page wide>
      <PageHeader
        title="Schedule"
        subtitle="Drag jobs from the unscheduled list onto the calendar, or drag scheduled jobs to reschedule / reassign."
        actions={
          <>
            <Segmented value={colorBy} onChange={setColorBy} size="sm" options={[{ id: "tech", label: "Color: tech" }, { id: "type", label: "Color: job type" }]} />
            <Button variant="primary" onClick={() => openQuick("job")}><Plus size={15} /> New job</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "tech", label: "Technician" }, { id: "crew", label: "Crew" }]} />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAnchor(addDays(anchor, -step).getTime())} aria-label="Previous"><ChevronLeft size={16} /></Button>
          <Button size="sm" onClick={() => setAnchor(startOfDay(now).getTime())}>Today</Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(addDays(anchor, step).getTime())} aria-label="Next"><ChevronRight size={16} /></Button>
        </div>
        <span className="text-[14px] font-semibold text-slate-800">{title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11.5px] text-slate-600">
          {colorBy === "tech" && techs.map((t) => <span key={t.id} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />{t.firstName}</span>)}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(view === "week" || view === "day") && <TimeGrid days={days} jobs={data.jobs.filter((j) => !j.archived)} appts={data.appointments} colorOf={colorOf} drag={drag} setDrag={setDrag} onDrop={(d) => drop(d)} now={now} />}
          {view === "month" && <MonthGrid anchor={anchor} colorOf={colorOf} setDrag={setDrag} onDrop={(d) => drop(d)} onDay={(d) => { setAnchor(d.getTime()); setView("day"); }} />}
          {(view === "tech" || view === "crew") && <ResourceGrid day={new Date(anchor)} rows={view === "tech" ? techs : crews(techs, data.employees)} colorOf={colorOf} drag={drag} setDrag={setDrag} onDrop={drop} now={now} />}
        </div>
        <UnscheduledList jobs={unscheduled} setDrag={setDrag} />
      </div>
    </Page>
  );
}

function crews(techs: Employee[], all: Employee[]) {
  // crews = each crew lead/tech with helpers; rendered as a resource row per lead
  const helpers = all.filter((e) => e.role === "helper");
  return techs.map((t) => ({ ...t, lastName: `${t.lastName}${t.role === "crew_lead" && helpers.length ? ` + ${helpers.map((h) => h.firstName).join(", ")}` : ""}` }));
}

function JobBlock({ j, colorOf, setDrag, compact }: { j: Job; colorOf: (j: Job) => string; setDrag: (id: string | null) => void; compact?: boolean }) {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const c = data.customers.find((x) => x.id === j.customerId);
  const p = data.properties.find((x) => x.id === j.propertyId);
  const e = data.employees.find((x) => x.id === j.assignedTo);
  const late = j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now;
  const col = colorOf(j);
  return (
    <div
      draggable
      onDragStart={(ev) => { setDrag(j.id); ev.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => setDrag(null)}
      onClick={() => router.push(`/jobs/${j.id}`)}
      className={cn("h-full cursor-pointer overflow-hidden rounded-md border-l-[3px] bg-white px-1.5 py-1 text-[11px] leading-tight shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md hover:ring-slate-300", j.status === "completed" && "opacity-60")}
      style={{ borderLeftColor: col, background: `color-mix(in oklab, ${col} 9%, var(--color-surface))` }}
      title={`#${j.number} ${j.title}\n${customerName(c)} · ${addressLine(p?.address)}\n${fullName(e)} · ${j.durationHrs}h · ${money0(lineTotals(j.items).subtotal)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-semibold text-slate-900">{customerName(c)}</span>
        {late ? <AlertTriangle size={11} className="shrink-0 text-red-500" /> : j.status === "in_progress" ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" /> : null}
      </div>
      {!compact && (
        <>
          <div className="truncate text-slate-600">{time(j.scheduledStart)} · {serviceShort(j.serviceType)} · {j.durationHrs}h</div>
          <div className="truncate text-slate-500">{p?.address.city} · {e?.firstName ?? "Unassigned"} · {money0(lineTotals(j.items).subtotal)}</div>
          <div className="mt-0.5"><Badge tone={statusTone(JOB_STATUSES, j.status)} className="px-1 py-0 text-[9.5px]">{JOB_STATUSES.find((s) => s.id === j.status)?.label}</Badge></div>
        </>
      )}
    </div>
  );
}

function TimeGrid({ days, jobs, appts, colorOf, drag, setDrag, onDrop, now }: { days: Date[]; jobs: Job[]; appts: Appointment[]; colorOf: (j: Job) => string; drag: string | null; setDrag: (id: string | null) => void; onDrop: (d: Date) => void; now: number }) {
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const [hover, setHover] = useState<string | null>(null);
  const cust = byId(useCrm((s) => s.data.customers));
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: days.length > 1 ? 840 : 360 }}>
        <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const today = isoDate(d) === isoDate(now);
            const dayJobs = jobs.filter((j) => j.scheduledStart && isoDate(new Date(j.scheduledStart)) === isoDate(d) && j.status !== "cancelled");
            return (
              <div key={d.toISOString()} className="border-l border-slate-100 px-2 py-1.5 text-center">
                <div className={cn("text-[11px] uppercase tracking-wide", today ? "font-semibold text-brand-700" : "text-slate-500")}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={cn("mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold", today ? "bg-brand-600 text-white" : "text-slate-800")}>{d.getDate()}</div>
                <div className="text-[10.5px] text-slate-400">{dayJobs.length} jobs · {money0(dayJobs.reduce((s, j) => s + lineTotals(j.items).subtotal, 0))}</div>
              </div>
            );
          })}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="relative border-b border-slate-100 pr-1.5 text-right text-[10px] text-slate-400" style={{ height: HOUR_PX }}>
                <span className="relative -top-1.5">{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayJobs = jobs.filter((j) => j.scheduledStart && isoDate(new Date(j.scheduledStart)) === isoDate(d) && j.status !== "cancelled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
            // simple overlap lanes
            const lanes: Job[][] = [];
            for (const j of dayJobs) {
              const s = new Date(j.scheduledStart!).getTime();
              const lane = lanes.find((l) => { const last = l[l.length - 1]; return new Date(last.scheduledStart!).getTime() + last.durationHrs * 3600000 <= s; });
              if (lane) lane.push(j);
              else lanes.push([j]);
            }
            const dayAppts = appts.filter((a) => isoDate(new Date(a.start)) === isoDate(d));
            const isToday = isoDate(d) === isoDate(now);
            const nowTop = ((new Date(now).getHours() + new Date(now).getMinutes() / 60 - START_H) * HOUR_PX);
            return (
              <div key={d.toISOString()} className="relative border-l border-slate-100">
                {hours.map((h) =>
                  [0, 30].map((m) => {
                    const key = `${isoDate(d)}-${h}-${m}`;
                    return (
                      <div
                        key={key}
                        className={cn("border-slate-100", m === 30 ? "border-b" : "border-b border-dashed border-b-slate-50", hover === key && drag && "bg-brand-50")}
                        style={{ height: HOUR_PX / 2 }}
                        onDragOver={(e) => { e.preventDefault(); setHover(key); }}
                        onDragLeave={() => setHover(null)}
                        onDrop={(e) => { e.preventDefault(); setHover(null); const s = new Date(d); s.setHours(h, m, 0, 0); onDrop(s); }}
                      />
                    );
                  }),
                )}
                {isToday && nowTop > 0 && nowTop < hours.length * HOUR_PX && <div className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-red-500" style={{ top: nowTop }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></div>}
                {lanes.map((lane, li) =>
                  lane.map((j) => {
                    const s = new Date(j.scheduledStart!);
                    const top = (s.getHours() + s.getMinutes() / 60 - START_H) * HOUR_PX;
                    return (
                      <div key={j.id} className="absolute px-0.5" style={{ top: Math.max(0, top), height: Math.max(22, j.durationHrs * HOUR_PX - 2), left: `${(li / lanes.length) * 100}%`, width: `${100 / lanes.length}%` }}>
                        <JobBlock j={j} colorOf={colorOf} setDrag={setDrag} compact={j.durationHrs < 1.25 || lanes.length > 2} />
                      </div>
                    );
                  }),
                )}
                {dayAppts.map((a) => {
                  const s = new Date(a.start);
                  const top = (s.getHours() + s.getMinutes() / 60 - START_H) * HOUR_PX;
                  const h = (new Date(a.end).getTime() - s.getTime()) / 3600000;
                  return (
                    <div key={a.id} className="absolute right-0.5 w-[42%] overflow-hidden rounded-md border border-dashed border-violet-300 bg-violet-50/90 px-1.5 py-1 text-[10.5px] leading-tight text-violet-800" style={{ top, height: Math.max(22, h * HOUR_PX - 2) }} title={a.title}>
                      <div className="truncate font-semibold">{a.kind === "estimate" ? "Estimate visit" : a.title}</div>
                      <div className="truncate">{customerName(cust.get(a.customerId ?? ""))}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ anchor, colorOf, setDrag, onDrop, onDay }: { anchor: number; colorOf: (j: Job) => string; setDrag: (id: string | null) => void; onDrop: (d: Date) => void; onDay: (d: Date) => void }) {
  const { data, now } = useCrm();
  const first = new Date(anchor);
  first.setDate(1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const cust = byId(data.customers);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-200 text-center text-[11px] uppercase tracking-wide text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const jobs = data.jobs.filter((j) => !j.archived && j.scheduledStart && isoDate(new Date(j.scheduledStart)) === isoDate(d) && j.status !== "cancelled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
          const other = d.getMonth() !== first.getMonth();
          const today = isoDate(d) === isoDate(now);
          return (
            <div key={d.toISOString()} className={cn("min-h-[112px] border-b border-r border-slate-100 p-1", other && "bg-slate-50/60")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const s = new Date(d); s.setHours(8, 0, 0, 0); onDrop(s); }}>
              <button onClick={() => onDay(d)} className={cn("mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px]", today ? "bg-brand-600 font-semibold text-white" : other ? "text-slate-400" : "text-slate-700 hover:bg-slate-100")}>{d.getDate()}</button>
              <div className="space-y-0.5">
                {jobs.slice(0, 4).map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} draggable onDragStart={() => setDrag(j.id)} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10.5px] hover:bg-slate-100" style={{ background: `color-mix(in oklab, ${colorOf(j)} 12%, transparent)` }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf(j) }} />
                    <span className="truncate text-slate-700">{time(j.scheduledStart).replace(":00", "")} {customerName(cust.get(j.customerId))}</span>
                  </Link>
                ))}
                {jobs.length > 4 && <button onClick={() => onDay(d)} className="px-1 text-[10.5px] font-medium text-brand-700">+{jobs.length - 4} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResourceGrid({ day, rows, colorOf, drag, setDrag, onDrop, now }: { day: Date; rows: Employee[]; colorOf: (j: Job) => string; drag: string | null; setDrag: (id: string | null) => void; onDrop: (d: Date, emp?: string) => void; now: number }) {
  const data = useCrm((s) => s.data);
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const W = 84;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 180 + hours.length * W }}>
        <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white">
          <div className="w-[180px] shrink-0 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
          {hours.map((h) => <div key={h} className="shrink-0 border-l border-slate-100 py-2 pl-1 text-[10.5px] text-slate-400" style={{ width: W }}>{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</div>)}
        </div>
        {rows.map((e) => {
          const jobs = data.jobs.filter((j) => !j.archived && (j.assignedTo === e.id || j.crew.includes(e.id)) && j.scheduledStart && isoDate(new Date(j.scheduledStart)) === isoDate(day) && j.status !== "cancelled");
          const booked = jobs.reduce((s, j) => s + j.durationHrs, 0);
          const shift = (Number(e.shiftEnd.split(":")[0]) - Number(e.shiftStart.split(":")[0])) || 8;
          return (
            <div key={e.id} className="flex border-b border-slate-100">
              <div className="flex w-[180px] shrink-0 items-center gap-2 px-3 py-2">
                <Avatar e={e} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-slate-900">{fullName(e)}</div>
                  <div className={cn("text-[11px]", booked > shift ? "text-red-600" : "text-slate-500")}>{booked}h / {shift}h booked</div>
                </div>
              </div>
              <div className="relative flex" style={{ height: 76 }}>
                {hours.map((h) => (
                  <div key={h} className={cn("shrink-0 border-l border-slate-100", hover === `${e.id}-${h}` && drag && "bg-brand-50")} style={{ width: W }} onDragOver={(ev) => { ev.preventDefault(); setHover(`${e.id}-${h}`); }} onDragLeave={() => setHover(null)} onDrop={(ev) => { ev.preventDefault(); setHover(null); const s = new Date(day); s.setHours(h, 0, 0, 0); onDrop(s, e.id); }} />
                ))}
                {isoDate(day) === isoDate(now) && <div className="pointer-events-none absolute inset-y-0 z-[5] border-l-2 border-red-500" style={{ left: (new Date(now).getHours() + new Date(now).getMinutes() / 60 - START_H) * W }} />}
                {jobs.map((j) => {
                  const s = new Date(j.scheduledStart!);
                  const left = (s.getHours() + s.getMinutes() / 60 - START_H) * W;
                  return (
                    <div key={j.id} className="absolute top-1.5 bottom-1.5 px-0.5" style={{ left, width: Math.max(40, j.durationHrs * W - 2) }}>
                      <JobBlock j={j} colorOf={colorOf} setDrag={setDrag} compact={j.durationHrs < 1.5} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnscheduledList({ jobs, setDrag }: { jobs: Job[]; setDrag: (id: string | null) => void }) {
  const data = useCrm((s) => s.data);
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  return (
    <div className="rounded-xl border border-slate-200 bg-white xl:sticky xl:top-0 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <span className="text-[13px] font-semibold text-slate-800">Unscheduled</span>
        <Badge>{jobs.length}</Badge>
      </div>
      <div className="space-y-1.5 p-2">
        {jobs.map((j) => (
          <div key={j.id} draggable onDragStart={(e) => { setDrag(j.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDrag(null)} className="cursor-grab rounded-lg border border-slate-200 bg-white p-2 shadow-sm hover:border-slate-300 active:cursor-grabbing">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/jobs/${j.id}`} className="truncate text-[12.5px] font-semibold text-slate-900 hover:text-brand-700">{customerName(cust.get(j.customerId))}</Link>
              {j.priority === "urgent" ? <Badge tone="red"><Flame size={10} /> Urgent</Badge> : j.priority === "high" ? <Badge tone="amber">High</Badge> : null}
            </div>
            <div className="truncate text-[11.5px] text-slate-600">#{j.number} {j.title}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 truncate"><MapPin size={10} />{prop.get(j.propertyId)?.address.city}</span>
              <span className="flex items-center gap-1"><Clock size={10} />{j.durationHrs}h · {money0(lineTotals(j.items).subtotal)}</span>
            </div>
          </div>
        ))}
        {!jobs.length && <p className="px-2 py-6 text-center text-[12.5px] text-slate-500">Everything is scheduled.</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Dispatch ───────────────────────── */

export function DispatchPage() {
  const { data, now, scheduleJob, setJobStatus } = useCrm();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = isoDate(now);
  const techs = data.employees.filter((e) => e.active && fieldRoles.includes(e.role));
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const todays = data.jobs.filter((j) => !j.archived && j.scheduledStart && isoDate(new Date(j.scheduledStart)) === today && j.status !== "cancelled");
  const unassigned = data.jobs.filter((j) => !j.archived && j.status === "unscheduled" || (OPEN_JOB.includes(j.status) && !j.assignedTo));
  const urgent = unassigned.filter((j) => j.priority === "urgent" || j.priority === "high");
  const assign = (techId: string) => {
    if (!drag) return;
    const j = data.jobs.find((x) => x.id === drag)!;
    const theirs = todays.filter((x) => x.assignedTo === techId && x.id !== drag).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
    const last = theirs[theirs.length - 1];
    const startMs = Math.max(now + 30 * 60000, last ? new Date(last.scheduledStart!).getTime() + last.durationHrs * 3600000 + 20 * 60000 : now + 30 * 60000);
    const start = new Date(Math.ceil(startMs / (15 * 60000)) * 15 * 60000);
    scheduleJob(drag, start.toISOString(), techId);
    toast(`Job #${j.number} dispatched to ${data.employees.find((e) => e.id === techId)?.firstName} at ${time(start)}`, "success");
    setDrag(null);
    setOver(null);
  };
  const optimize = async (techId: string) => {
    const jobs = todays.filter((j) => j.assignedTo === techId && j.status === "scheduled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
    if (jobs.length < 2) return toast("Nothing to optimize — fewer than 2 remaining stops");
    // pseudo-coordinates from ZIP until geocoding (Google Maps) is connected
    const pts = jobs.map((j) => { const z = Number(prop.get(j.propertyId)?.address.zip ?? 92500); return { lat: (z % 97) / 10, lng: (z % 89) / 10 }; });
    const order = await providers.routing.optimize(pts);
    let t = new Date(jobs[0].scheduledStart!).getTime();
    order.forEach((i) => { scheduleJob(jobs[i].id, new Date(t).toISOString(), techId); t += (jobs[i].durationHrs * 60 + 20) * 60000; });
    toast("Route re-ordered (nearest-neighbour; connect Google Maps for drive-time optimization)", "success");
  };
  return (
    <Page wide>
      <PageHeader title="Dispatch" subtitle={`${new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${todays.length} jobs · drag unassigned work onto a technician`} actions={<Link href="/schedule" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><CalendarDays size={14} /> Calendar</Link>} />
      <div className="grid gap-3 xl:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Card title="Unassigned & unscheduled" sub={`${unassigned.length}`} pad={false}>
            <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-2">
              {urgent.length > 0 && <div className="px-1 text-[10.5px] font-semibold uppercase tracking-wider text-red-600">Urgent / high priority</div>}
              {[...urgent, ...unassigned.filter((j) => !urgent.includes(j))].map((j) => (
                <div key={j.id} draggable onDragStart={() => setDrag(j.id)} onDragEnd={() => setDrag(null)} className={cn("cursor-grab rounded-lg border bg-white p-2 shadow-sm", j.priority === "urgent" ? "border-red-200" : "border-slate-200")}>
                  <div className="flex items-center justify-between gap-1">
                    <Link href={`/jobs/${j.id}`} className="truncate text-[12.5px] font-semibold text-slate-900">{customerName(cust.get(j.customerId))}</Link>
                    {j.priority === "urgent" && <Badge tone="red"><Flame size={10} /> Urgent</Badge>}
                  </div>
                  <div className="truncate text-[11.5px] text-slate-600">#{j.number} {j.title}</div>
                  <div className="text-[11px] text-slate-500">{prop.get(j.propertyId)?.address.city} · {j.durationHrs}h · {serviceLabel(j.serviceType)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {techs.map((t) => {
            const jobs = todays.filter((j) => j.assignedTo === t.id || j.crew.includes(t.id)).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
            const current = jobs.find((j) => ["en_route", "arrived", "in_progress"].includes(j.status));
            const next = jobs.find((j) => j.status === "scheduled");
            const remaining = jobs.filter((j) => j.status !== "completed");
            const last = jobs[jobs.length - 1];
            const eta = last ? new Date(Math.max(now, new Date(last.scheduledStart!).getTime()) + last.durationHrs * 3600000) : undefined;
            const late = jobs.find((j) => j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now && j.id !== current?.id);
            const clocked = data.timeEntries.some((x) => x.employeeId === t.id && x.type === "shift" && !x.end);
            return (
              <div key={t.id} onDragOver={(e) => { e.preventDefault(); setOver(t.id); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); assign(t.id); }} className={cn("rounded-xl border bg-white transition-colors", over === t.id ? "border-brand-400 ring-2 ring-brand-100" : late ? "border-red-200" : "border-slate-200")}>
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5">
                  <Avatar e={t} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">{fullName(t)} {late && <Badge tone="red" dot>Late</Badge>}</div>
                    <div className="text-[11.5px] text-slate-500">{data.trucks.find((x) => x.id === t.truckId)?.name ?? "No truck"} · {clocked ? <span className="text-emerald-700">clocked in</span> : "off the clock"} · {jobs.filter((j) => j.status === "completed").length}/{jobs.length} done</div>
                  </div>
                  <button onClick={() => optimize(t.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Optimize route order"><RouteIcon size={15} /></button>
                </div>
                <div className="grid grid-cols-2 gap-px bg-slate-100">
                  <div className="bg-white px-3 py-2">
                    <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Current</div>
                    {current ? <Link href={`/jobs/${current.id}`} className="block truncate text-[12.5px] font-medium text-slate-900 hover:text-brand-700">{customerName(cust.get(current.customerId))}</Link> : <div className="text-[12.5px] text-slate-400">—</div>}
                    {current && <StatusBadge list={JOB_STATUSES} value={current.status} />}
                  </div>
                  <div className="bg-white px-3 py-2">
                    <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Next</div>
                    {next ? <Link href={`/jobs/${next.id}`} className="block truncate text-[12.5px] font-medium text-slate-900 hover:text-brand-700">{customerName(cust.get(next.customerId))}</Link> : <div className="text-[12.5px] text-slate-400">—</div>}
                    {next && <div className="text-[11.5px] text-slate-500">{time(next.scheduledStart)} ({relative(next.scheduledStart, now)})</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11.5px] text-slate-600">
                  <span>Est. finish <b>{eta ? time(eta) : "—"}</b></span>
                  <span>{remaining.length} remaining · {money0(jobs.reduce((s, j) => s + lineTotals(j.items).subtotal, 0))}</span>
                </div>
                <ol className="divide-y divide-slate-100">
                  {jobs.map((j, i) => {
                    const lateJ = j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now;
                    return (
                      <li key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", j.status === "completed" ? "bg-emerald-100 text-emerald-700" : ["en_route", "arrived", "in_progress"].includes(j.status) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/jobs/${j.id}`} className={cn("block truncate text-[12px] font-medium hover:text-brand-700", j.status === "completed" ? "text-slate-400 line-through" : "text-slate-900")}>{customerName(cust.get(j.customerId))}</Link>
                          <div className="truncate text-[11px] text-slate-500">{time(j.scheduledStart)} · {serviceShort(j.serviceType)} · {prop.get(j.propertyId)?.address.city}</div>
                        </div>
                        {lateJ && <AlertTriangle size={13} className="text-red-500" />}
                        <a href={mapsUrl(prop.get(j.propertyId)?.address)} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Directions"><Navigation size={12} /></a>
                        <a href={`tel:${cust.get(j.customerId)?.phone}`} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Call"><Phone size={12} /></a>
                        <Select value={j.status} onChange={(e) => setJobStatus(j.id, e.target.value as Job["status"])} options={JOB_STATUSES.map((s) => ({ value: s.id, label: s.label }))} className="h-6 w-[104px] px-1 text-[11px]" />
                      </li>
                    );
                  })}
                  {!jobs.length && <li className="px-3 py-6 text-center text-[12px] text-slate-400">Drop a job here to dispatch</li>}
                </ol>
              </div>
            );
          })}
          <Card title="Live locations" className="md:col-span-2 2xl:col-span-3">
            <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-slate-600">
              <MapPin size={15} className="text-slate-400" /> GPS tracking appears here when the Google Maps / fleet integration is connected (Settings → Integrations). Until then, status updates from the Technician App drive this board in real time.
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

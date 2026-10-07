"use client";
/** Technician field app: mobile-first, big touch targets, works on phone or tablet. */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Navigation, Phone, KeyRound, Dog, Truck, MapPin, Play, Pause, CheckCircle2, Camera, ClipboardList, Package, StickyNote, History, Droplets, FilePlus2, PenLine, CreditCard, Flag, LogIn, LogOut, Clock, Minus, Plus, Map as MapIcon, Home, CalendarDays, Wrench, AlertTriangle, Sun, Moon, MessageSquare } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Job, JobStatus, PaymentMethod, ZoneStatus } from "@/lib/crm/types";
import { JOB_STATUSES, ZONE_STATUSES, serviceLabel, serviceColor, roleLabel } from "@/lib/crm/constants";
import { addressFull, customerName, date, dateTime, hours, mapsUrl, money, phone, time, fullName, isoDate, relative } from "@/lib/crm/format";
import { entryHours, invoiceTotals, lineTotals } from "@/lib/crm/calc";
import { lineFromItem } from "@/lib/crm/workflows";
import { Button, Badge, cn, Modal, StatusBadge, Avatar, Textarea, Select, NumberInput, Input, Field, useQuery } from "../ui";
import { SignaturePad } from "../widgets";
import { PhotoGallery, PhotoUploadButton } from "../Photos";
import { ItemPicker } from "../pickers";
import { SystemMap } from "../SystemMap";
import { ChecklistEditor, ChangeOrderModal, ChangeOrderCard } from "./Jobs";
import { useCrmBoot, useTheme } from "../Shell";
import { Toasts } from "../Toasts";
import { AskHost } from "@/components/AskHost";
import { toast } from "@/lib/crm/toast";

function FieldShell({ children, title, back }: { children: ReactNode; title: ReactNode; back?: string }) {
  useCrmBoot();
  const { ready, session, data, now } = useCrm();
  const st = useCrm();
  const { dark, toggle } = useTheme();
  const me = data.employees.find((e) => e.id === session?.employeeId);
  const shift = data.timeEntries.find((t) => t.employeeId === me?.id && t.type === "shift" && !t.end);
  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-[68px]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3">
        {back ? <Link href={back} className="-ml-1 rounded-lg p-2 text-slate-600 active:bg-slate-100" aria-label="Back"><ChevronLeft size={22} /></Link> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Droplets size={17} /></span>}
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{title}</div>
        {me && (
          <button onClick={() => (shift ? st.stopTimers(me.id) : st.startTimer(me.id, "shift"))} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold", shift ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600")}>
            {shift ? <LogOut size={14} /> : <LogIn size={14} />} {shift ? `On ${hours(entryHours(shift, now))}` : "Clock in"}
          </button>
        )}
        <button onClick={toggle} className="rounded-lg p-2 text-slate-500" aria-label="Theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">{ready ? children : <div className="py-20 text-center text-slate-500">Loading…</div>}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {[
          { href: "/field", icon: Home, label: "Today" },
          { href: "/field?view=week", icon: CalendarDays, label: "Upcoming" },
          { href: "/field?view=truck", icon: Truck, label: "Truck" },
          { href: "/", icon: Wrench, label: "Office" },
        ].map((n) => (
          <Link key={n.label} href={n.href} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-600 active:bg-slate-50">
            <n.icon size={20} />
            {n.label}
          </Link>
        ))}
      </nav>
      <Toasts />
      <AskHost />
    </div>
  );
}

function useTech() {
  const { data, session } = useCrm();
  const [override, setOverride] = useState<string>("");
  const me = data.employees.find((e) => e.id === session?.employeeId);
  const isField = me && ["technician", "crew_lead", "helper"].includes(me.role);
  const techId = override || (isField ? me!.id : data.employees.find((e) => e.role === "crew_lead")?.id) || "";
  return { techId, me, isField, setOverride };
}

export function FieldHome() {
  const view = useQuery().get("view") ?? undefined;
  const { data, now } = useCrm();
  const { techId, isField, setOverride } = useTech();
  const tech = data.employees.find((e) => e.id === techId);
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const mine = data.jobs.filter((j) => (j.assignedTo === techId || j.crew.includes(techId)) && j.scheduledStart && j.status !== "cancelled");
  const today = mine.filter((j) => isoDate(new Date(j.scheduledStart!)) === isoDate(now)).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
  const upcoming = mine.filter((j) => new Date(j.scheduledStart!).getTime() > new Date(isoDate(now) + "T23:59:59").getTime()).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!)).slice(0, 25);
  const active = today.find((j) => ["en_route", "arrived", "in_progress"].includes(j.status));
  const done = today.filter((j) => j.status === "completed").length;
  const truck = data.trucks.find((t) => t.id === tech?.truckId);
  return (
    <FieldShell title={view === "truck" ? `${truck?.name ?? "Truck"} inventory` : view === "week" ? "Upcoming jobs" : `${new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}>
      {!isField && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-2.5 text-[12.5px] text-slate-600">
          Previewing as
          <Select value={techId} onChange={(e) => setOverride(e.target.value)} options={data.employees.filter((e) => e.active && ["technician", "crew_lead"].includes(e.role)).map((e) => ({ value: e.id, label: fullName(e) }))} className="h-8 flex-1" />
        </div>
      )}
      {view === "truck" ? (
        <TruckStock truckId={truck?.id} />
      ) : view === "week" ? (
        <div className="space-y-2">{upcoming.map((j) => <JobCardMobile key={j.id} j={j} showDate />)}{!upcoming.length && <p className="py-10 text-center text-slate-500">Nothing scheduled ahead.</p>}</div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-white">
            <Avatar e={tech} size={44} className="ring-2 ring-white/40" />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold">{tech ? `Hi ${tech.firstName}` : "Today"}</div>
              <div className="text-[13px] text-white/80">{today.length} jobs · {done} done · {truck?.name ?? ""} · {money(today.reduce((s, j) => s + lineTotals(j.items).subtotal, 0))}</div>
            </div>
          </div>
          {active && (
            <Link href={`/field/${active.id}`} className="mb-3 block rounded-2xl border-2 border-brand-500 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Current job · {JOB_STATUSES.find((s) => s.id === active.status)?.label}</div>
              <div className="text-[17px] font-semibold text-slate-900">{customerName(cust.get(active.customerId))}</div>
              <div className="text-[13.5px] text-slate-600">{active.title}</div>
              <div className="mt-1 text-[13px] text-slate-500">{addressFull(prop.get(active.propertyId)?.address)}</div>
            </Link>
          )}
          <div className="space-y-2">{today.map((j, i) => <JobCardMobile key={j.id} j={j} index={i + 1} />)}{!today.length && <p className="py-10 text-center text-slate-500">No jobs today.</p>}</div>
        </>
      )}
    </FieldShell>
  );
}

function JobCardMobile({ j, index, showDate }: { j: Job; index?: number; showDate?: boolean }) {
  const { data, now } = useCrm();
  const c = data.customers.find((x) => x.id === j.customerId);
  const p = data.properties.find((x) => x.id === j.propertyId);
  const late = j.status === "scheduled" && new Date(j.scheduledStart!).getTime() + 10 * 60000 < now;
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-white shadow-sm", j.status === "completed" ? "border-slate-200 opacity-70" : late ? "border-red-200" : "border-slate-200")}>
      <Link href={`/field/${j.id}`} className="flex gap-3 p-3.5 active:bg-slate-50">
        <div className="flex w-14 shrink-0 flex-col items-center">
          {index !== undefined && <span className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", j.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{j.status === "completed" ? "✓" : index}</span>}
          <span className="text-[13px] font-semibold text-slate-900">{time(j.scheduledStart)}</span>
          {showDate && <span className="text-[11px] text-slate-500">{date(j.scheduledStart)}</span>}
          <span className="text-[11px] text-slate-400">{j.durationHrs}h</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[15px] font-semibold text-slate-900">{customerName(c)}</div>
            {late ? <Badge tone="red" dot>Late</Badge> : <StatusBadge list={JOB_STATUSES} value={j.status} />}
          </div>
          <div className="truncate text-[13.5px] text-slate-700">{j.title}</div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-slate-500"><MapPin size={12} />{p?.address.street}, {p?.address.city}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: serviceColor(j.serviceType) }}>{serviceLabel(j.serviceType)}</span>
            {p?.gateCode && <Badge tone="violet"><KeyRound size={10} /> {p.gateCode}</Badge>}
            {p?.pets && <Badge tone="amber"><Dog size={10} /> Pets</Badge>}
            {j.priority === "urgent" && <Badge tone="red">Urgent</Badge>}
          </div>
        </div>
      </Link>
      {j.status !== "completed" && (
        <div className="grid grid-cols-2 border-t border-slate-100">
          <a href={mapsUrl(p?.address)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-brand-700 active:bg-slate-50"><Navigation size={15} /> Navigate</a>
          <a href={`tel:${c?.phone}`} className="flex items-center justify-center gap-1.5 border-l border-slate-100 py-2.5 text-[13px] font-semibold text-brand-700 active:bg-slate-50"><Phone size={15} /> Call</a>
        </div>
      )}
    </div>
  );
}

function TruckStock({ truckId }: { truckId?: string }) {
  const { data, update } = useCrm();
  const [q, setQ] = useState("");
  const items = byId(data.items);
  const rows = data.truckStock.filter((s) => s.truckId === truckId && (!q || items.get(s.itemId)?.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (items.get(a.itemId)?.name ?? "").localeCompare(items.get(b.itemId)?.name ?? ""));
  if (!truckId) return <p className="py-10 text-center text-slate-500">No truck assigned.</p>;
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search truck stock…" className="mb-3 h-11 text-[15px]" />
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.map((s) => {
          const it = items.get(s.itemId);
          return (
            <div key={s.id} className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium text-slate-900">{it?.name}</div><div className="text-[12px] text-slate-500">min {s.minQty} {it?.unit}</div></div>
              <span className={cn("tabular w-16 text-right text-[16px] font-semibold", s.qty < s.minQty ? "text-red-600" : "text-slate-900")}>{s.qty}</span>
              {s.qty < s.minQty && <AlertTriangle size={16} className="text-amber-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Section = "overview" | "system" | "checklist" | "photos" | "materials" | "notes" | "history";

export function FieldJob({ id }: { id: string }) {
  const st = useCrm();
  const { data, now } = st;
  const router = useRouter();
  const [sec, setSec] = useState<Section>("overview");
  const [modal, setModal] = useState<null | "sign" | "pay" | "co" | "followup" | "complete">(null);
  const j = data.jobs.find((x) => x.id === id);
  if (!j) return <FieldShell title="Job" back="/field"><p className="py-10 text-center">Job not found.</p></FieldShell>;
  const c = data.customers.find((x) => x.id === j.customerId);
  const p = data.properties.find((x) => x.id === j.propertyId);
  const sys = data.systems.find((s) => s.propertyId === j.propertyId);
  const zones = data.zones.filter((z) => z.systemId === sys?.id).sort((a, b) => a.number - b.number);
  const photos = data.photos.filter((ph) => ph.jobId === id);
  const cos = data.changeOrders.filter((x) => x.jobId === id);
  const inv = data.invoices.find((i) => i.jobId === id && i.kind !== "deposit");
  const history = data.jobs.filter((x) => x.propertyId === j.propertyId && x.id !== id && x.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const travel = data.timeEntries.filter((t) => t.jobId === id && t.type === "travel").reduce((s, t) => s + entryHours(t, now), 0);
  const onsite = data.timeEntries.filter((t) => t.jobId === id && t.type === "job").reduce((s, t) => s + entryHours(t, now), 0);
  const go = (s: JobStatus) => {
    st.setJobStatus(id, s, { notifyCustomer: true });
    if (s === "en_route") toast(`“On my way” text sent to ${c?.firstName}`, "success");
  };
  const primary: { label: string; icon: typeof Play; run: () => void; tone?: string } | null =
    j.status === "scheduled" || j.status === "unscheduled" ? { label: "Start travel", icon: Truck, run: () => go("en_route") } : j.status === "en_route" ? { label: "I've arrived", icon: MapPin, run: () => go("arrived") } : ["arrived", "paused", "waiting_parts", "callback", "needs_follow_up"].includes(j.status) ? { label: j.status === "paused" ? "Resume job" : "Start job", icon: Play, run: () => go("in_progress") } : j.status === "in_progress" ? { label: "Complete job", icon: CheckCircle2, run: () => setModal("complete"), tone: "bg-emerald-600 active:bg-emerald-700" } : null;
  const sections: { id: Section; label: string; icon: typeof Play; badge?: string }[] = [
    { id: "overview", label: "Job", icon: Wrench },
    { id: "system", label: "System", icon: Droplets, badge: String(zones.filter((z) => z.statuses.some((s) => s !== "working")).length || "") },
    { id: "checklist", label: "Checklist", icon: ClipboardList, badge: `${j.checklist.filter((x) => x.done).length}/${j.checklist.length}` },
    { id: "photos", label: "Photos", icon: Camera, badge: String(photos.length || "") },
    { id: "materials", label: "Materials", icon: Package },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "history", label: "History", icon: History, badge: String(history.length || "") },
  ];
  return (
    <FieldShell title={<span>#{j.number} · {customerName(c)}</span>} back="/field">
      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[17px] font-semibold leading-tight text-slate-900">{j.title}</div>
            <div className="mt-0.5 text-[13px] text-slate-600">{serviceLabel(j.serviceType)} · {time(j.scheduledStart)} · {j.durationHrs}h</div>
          </div>
          <StatusBadge list={JOB_STATUSES} value={j.status} />
        </div>
        <a href={mapsUrl(p?.address)} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[14px] font-medium text-brand-700"><MapPin size={15} />{addressFull(p?.address)}</a>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {p?.gateCode ? <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-violet-800"><KeyRound size={16} /><div><div className="text-[10.5px] font-semibold uppercase">Gate code</div><div className="font-mono text-[16px] font-bold">{p.gateCode}</div></div></div> : <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] text-slate-500">No gate code</div>}
          {p?.pets ? <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-800"><Dog size={16} /><div className="text-[12.5px] font-medium leading-tight">{p.pets}</div></div> : <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] text-slate-500">No pets noted</div>}
        </div>
        {p?.accessNotes && <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700"><b>Access:</b> {p.accessNotes}</div>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={mapsUrl(p?.address)} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-[13px] font-semibold active:bg-slate-50"><Navigation size={16} /> Navigate</a>
          <a href={`tel:${c?.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-[13px] font-semibold active:bg-slate-50"><Phone size={16} /> Call</a>
          <a href={`sms:${c?.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-[13px] font-semibold active:bg-slate-50"><MessageSquare size={16} /> Text</a>
        </div>
      </div>

      {primary && (
        <button onClick={primary.run} className={cn("mb-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-white shadow-lg", primary.tone ?? "bg-brand-600 active:bg-brand-700")}>
          <primary.icon size={22} /> {primary.label}
        </button>
      )}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {j.status === "in_progress" && <FieldAction icon={Pause} label="Pause" onClick={() => go("paused")} />}
        {j.status === "in_progress" && <FieldAction icon={Package} label="Waiting parts" onClick={() => go("waiting_parts")} />}
        <FieldAction icon={FilePlus2} label="Change order" onClick={() => setModal("co")} />
        <FieldAction icon={PenLine} label="Signature" onClick={() => setModal("sign")} done={!!j.signature} />
        <FieldAction icon={CreditCard} label="Collect $" onClick={() => setModal("pay")} />
        <FieldAction icon={Flag} label="Follow-up" onClick={() => setModal("followup")} done={!!j.followUp?.required} />
      </div>
      <div className="mb-3 flex items-center justify-around rounded-xl bg-white px-3 py-2 text-[12.5px] text-slate-600 ring-1 ring-slate-200">
        <span className="flex items-center gap-1"><Truck size={13} /> Travel {hours(travel)}</span>
        <span className="flex items-center gap-1"><Clock size={13} /> On site {hours(onsite)}</span>
        <span>Est. {j.estimatedLaborHours}h</span>
      </div>

      <div className="no-scrollbar -mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSec(s.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold", sec === s.id ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-50" : "bg-white text-slate-600 ring-1 ring-slate-200")}>
            <s.icon size={14} /> {s.label} {s.badge && <span className="opacity-70">{s.badge}</span>}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
        {sec === "overview" && (
          <div className="space-y-3 text-[14px]">
            <Block title="Scope of work">{j.scope || "—"}</Block>
            {j.customerNotes && <Block title="Customer notes">{j.customerNotes}</Block>}
            {j.internalNotes && <Block title="Office notes"><span className="text-amber-800">{j.internalNotes}</span></Block>}
            <Block title="Materials needed">
              <ul className="space-y-1">{j.items.filter((i) => i.kind === "material").map((i) => <li key={i.id} className="flex justify-between"><span>{i.name}</span><b className="tabular">{i.qty} {i.unit}</b></li>)}</ul>
              {!j.items.some((i) => i.kind === "material") && <span className="text-slate-500">None listed</span>}
            </Block>
            {j.equipment && <Block title="Equipment">{j.equipment}</Block>}
            <Block title="Property">
              <div className="space-y-0.5 text-[13px] text-slate-700">
                <div>Controller: {p?.controllerLocation || "—"}</div>
                <div>Valves: {p?.valveLocations || "—"}</div>
                <div>Water: {p?.staticPsi ? `${p.staticPsi} psi static` : "—"}{p?.dynamicPsi ? ` · ${p.dynamicPsi} dynamic` : ""} · meter {p?.meterSize}</div>
                <div>Backflow: {p?.backflow.type.toUpperCase()} {p?.backflow.make} — {p?.backflow.location}</div>
                <div>{p?.landscapeNotes}</div>
              </div>
            </Block>
            {cos.map((co) => <ChangeOrderCard key={co.id} co={co} onSign={() => setModal("sign")} />)}
          </div>
        )}
        {sec === "system" && (
          <div className="space-y-2">
            {zones.map((z) => (
              <details key={z.id} className="rounded-xl border border-slate-200 open:bg-slate-50/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0"><span className="block text-[14px] font-semibold text-slate-900">Zone {z.number} · {z.name}</span><span className="block truncate text-[12px] text-slate-500">{z.sprinklerType} · {z.manufacturer} {z.model} · {z.valveType}</span></span>
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", z.statuses.includes("working") ? "bg-emerald-500" : z.statuses.some((s) => ["leaking", "broken"].includes(s)) ? "bg-red-500" : "bg-amber-500")} />
                </summary>
                <div className="space-y-2 px-3 pb-3 text-[13px]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700">
                    <span>Valve: {z.valveType} {z.valveSize}</span><span>Station {z.controllerStation}</span>
                    <span>Heads: {z.headCount || "—"} @ {z.headSpacingFt ?? "—"}′</span><span>Nozzle: {z.nozzleType || "—"}</span>
                    <span>Pipe: {z.pipeSize} {z.pipeMaterial}</span><span>{z.flowGpm ?? "—"} GPM · {z.operatingPsi ?? "—"} psi</span>
                  </div>
                  <div className="text-slate-600">Valve location: {z.valveLocation}</div>
                  {z.problems && <div className="rounded-lg bg-red-50 px-2.5 py-1.5 text-red-700">{z.problems}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {ZONE_STATUSES.map((s) => (
                      <button key={s.id} onClick={() => { let next: ZoneStatus[] = z.statuses.includes(s.id) ? z.statuses.filter((x) => x !== s.id) : s.id === "working" ? ["working"] : [...z.statuses.filter((x) => x !== "working"), s.id]; if (!next.length) next = ["working"]; st.update("zones", z.id, { statuses: next }); if (!j.zoneIds.includes(z.id)) st.update("jobs", id, { zoneIds: [...j.zoneIds, z.id] }); }} className={cn("rounded-full border px-2.5 py-1.5 text-[12px] font-medium", z.statuses.includes(s.id) ? (s.id === "working" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-amber-500 bg-amber-50 text-amber-800") : "border-slate-200 bg-white text-slate-600")}>{s.label}</button>
                    ))}
                  </div>
                </div>
              </details>
            ))}
            {sys && (
              <details className="rounded-xl border border-slate-200">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[14px] font-semibold"><MapIcon size={16} /> System map</summary>
                <div className="p-2"><SystemMap system={sys} property={p} readOnly height={420} /></div>
              </details>
            )}
          </div>
        )}
        {sec === "checklist" && <ChecklistEditor job={j} big />}
        {sec === "photos" && (
          <div>
            <div className="mb-3 flex justify-center"><PhotoUploadButton entityType="job" entityId={id} jobId={id} customerId={j.customerId} propertyId={j.propertyId} size="lg" label="Take photo" category={j.status === "completed" ? "after" : ["in_progress", "paused"].includes(j.status) ? "during" : "before"} /></div>
            <PhotoGallery photos={photos} columns="grid-cols-2 sm:grid-cols-3" />
          </div>
        )}
        {sec === "materials" && <MaterialsUsed job={j} />}
        {sec === "notes" && (
          <div className="space-y-3">
            <Field label="Notes for the office"><Textarea rows={5} value={j.internalNotes} onChange={(e) => st.update("jobs", id, { internalNotes: e.target.value })} className="text-[15px]" /></Field>
            <Field label="Notes for the customer (appear on invoice)"><Textarea rows={4} value={j.customerNotes} onChange={(e) => st.update("jobs", id, { customerNotes: e.target.value })} className="text-[15px]" /></Field>
          </div>
        )}
        {sec === "history" && (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex justify-between text-[13.5px]"><b>{h.title}</b><span className="text-slate-500">{date(h.completedAt)}</span></div>
                <div className="text-[12.5px] text-slate-500">#{h.number} · {fullName(data.employees.find((e) => e.id === h.assignedTo))}</div>
                {h.items.filter((i) => i.kind === "material").length > 0 && <div className="mt-1 text-[12.5px] text-slate-600">{h.items.filter((i) => i.kind === "material").map((i) => `${i.usedQty ?? i.qty}× ${i.name}`).join(" · ")}</div>}
                {h.internalNotes && <div className="mt-1 text-[12.5px] text-amber-800">{h.internalNotes}</div>}
              </div>
            ))}
            {!history.length && <p className="py-6 text-center text-slate-500">First visit to this property.</p>}
          </div>
        )}
      </div>

      {modal === "co" && <ChangeOrderModal jobId={id} onClose={() => setModal(null)} />}
      {modal === "sign" && (
        <Modal open onClose={() => setModal(null)} title="Customer signature" subtitle={cos.some((x) => x.status === "pending") ? "Approves the pending change order(s) and the work performed." : "Confirms the work performed."} width={560}>
          <SignaturePad name={c ? fullName(c) : ""} onSave={(sig) => { for (const co of cos.filter((x) => x.status === "pending")) st.decideChangeOrder(co.id, true, sig); st.update("jobs", id, { signature: sig }); st.log({ type: "job", message: `Customer signed — ${sig.name}`, entityType: "job", entityId: id, customerId: j.customerId, jobId: id }); setModal(null); }} />
        </Modal>
      )}
      {modal === "followup" && <FollowUpModal job={j} onClose={() => setModal(null)} />}
      {modal === "pay" && <CollectPayment job={j} onClose={() => setModal(null)} />}
      {modal === "complete" && (
        <Modal open onClose={() => setModal(null)} title="Complete job" width={560}>
          <div className="space-y-3 text-[14px]">
            {[
              [j.checklist.every((x) => x.done), `Checklist ${j.checklist.filter((x) => x.done).length}/${j.checklist.length}`, () => (setSec("checklist"), setModal(null))],
              [photos.some((x) => x.category === "after"), "After photos taken", () => (setSec("photos"), setModal(null))],
              [!!j.signature, "Customer signature", () => setModal("sign")],
              [!cos.some((x) => x.status === "pending"), "No pending change orders", () => (setSec("overview"), setModal(null))],
            ].map(([ok, label, fix], i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                <span className="flex items-center gap-2">{ok ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-500" />}{label as string}</span>
                {!ok && <Button size="sm" onClick={fix as () => void}>Fix</Button>}
              </div>
            ))}
            <p className="text-[12.5px] text-slate-500">Completing stops the timer, deducts materials from your truck, starts warranties and generates the invoice.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => setModal(null)}>Not yet</Button>
              <Button size="lg" variant="primary" onClick={() => { go("completed"); setModal(null); toast("Job completed — invoice generated", "success"); setTimeout(() => setModal("pay"), 50); }}>Complete</Button>
            </div>
          </div>
        </Modal>
      )}
    </FieldShell>
  );
}

function FieldAction({ icon: Icon, label, onClick, done }: { icon: typeof Play; label: string; onClick: () => void; done?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-xl border bg-white py-2.5 text-[11.5px] font-semibold active:bg-slate-50", done ? "border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-700")}>
      <Icon size={19} /> {label}
    </button>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}

function MaterialsUsed({ job }: { job: Job }) {
  const st = useCrm();
  const tech = st.data.employees.find((e) => e.id === job.assignedTo);
  const truckItems = new Set(st.data.truckStock.filter((s) => s.truckId === tech?.truckId && s.qty > 0).map((s) => s.itemId));
  const setUsed = (itemId: string, used: number) => st.update("jobs", job.id, (j) => ({ ...j, items: j.items.map((i) => (i.id === itemId ? { ...i, usedQty: Math.max(0, used) } : i)) }));
  return (
    <div className="space-y-3">
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {job.items.filter((i) => i.kind === "material").map((i) => (
          <div key={i.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{i.name}</div><div className="text-[12px] text-slate-500">planned {i.qty} {i.unit}{i.addedInField ? " · added in field" : ""}</div></div>
            <button onClick={() => setUsed(i.id, (i.usedQty ?? i.qty) - 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 active:bg-slate-50"><Minus size={16} /></button>
            <span className="tabular w-10 text-center text-[17px] font-semibold">{i.usedQty ?? i.qty}</span>
            <button onClick={() => setUsed(i.id, (i.usedQty ?? i.qty) + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 active:bg-slate-50"><Plus size={16} /></button>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Add material used</div>
        <ItemPicker placeholder="Search truck stock & price book…" onPick={(it) => { st.addJobItem(job.id, lineFromItem(it, 1), { field: true, used: true }); toast(`${it.name} added${truckItems.has(it.id) ? " (on your truck)" : ""}`, "success"); }} />
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unexpected work</div>
        <p className="text-[12.5px] text-slate-500">Found more than the scope covers? Create a <b>change order</b> so the customer approves the extra cost before you continue.</p>
      </div>
    </div>
  );
}

function FollowUpModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const st = useCrm();
  const [notes, setNotes] = useState(job.followUp?.notes ?? "");
  const [due, setDue] = useState(job.followUp?.dueDate ?? isoDate(Date.now() + 7 * 86400000));
  return (
    <Modal open onClose={onClose} title="Mark follow-up required" width={480} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { st.update("jobs", job.id, { followUp: { required: true, notes, dueDate: due } }); st.log({ type: "job", message: `Follow-up required: ${notes}`, entityType: "job", entityId: job.id, customerId: job.customerId, jobId: job.id }); st.notify({ type: "system", title: `Follow-up needed — job #${job.number}`, body: notes, link: `/jobs/${job.id}` }); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="What needs to happen?"><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Customer wants a quote to replace remaining anti-siphon valves…" className="text-[15px]" /></Field>
        <Field label="Due"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function CollectPayment({ job, onClose }: { job: Job; onClose: () => void }) {
  const st = useCrm();
  let inv = st.data.invoices.find((i) => i.jobId === job.id && i.kind !== "deposit");
  const t = inv ? invoiceTotals(inv, st.data.payments) : undefined;
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState(t?.balance ?? lineTotals(job.items).subtotal);
  const [ref, setRef] = useState("");
  return (
    <Modal open onClose={onClose} title="Collect payment" width={480}>
      {!inv && job.status !== "completed" ? (
        <p className="text-[14px] text-slate-600">Complete the job first — the invoice is generated automatically.</p>
      ) : (
        <div className="space-y-3">
          {t && <div className="rounded-xl bg-slate-50 p-3 text-[14px]"><div className="flex justify-between"><span>Invoice INV-{inv!.number}</span><b>{money(t.total)}</b></div>{t.depositCredit > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit paid</span><span>−{money(t.depositCredit)}</span></div>}{t.paid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span>−{money(t.paid)}</span></div>}<div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-[16px] font-semibold"><span>Balance</span><span>{money(t.balance)}</span></div></div>}
          {t && t.balance <= 0 ? <p className="text-center text-[15px] font-semibold text-emerald-700">Paid in full ✓</p> : (
            <>
              <div className="grid grid-cols-4 gap-2">{(["card", "cash", "check", "ach"] as PaymentMethod[]).map((m) => <button key={m} onClick={() => setMethod(m)} className={cn("rounded-xl border py-3 text-[13px] font-semibold uppercase", method === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600")}>{m}</button>)}</div>
              <Field label="Amount"><NumberInput value={amount} onChange={setAmount} inputClassName="h-12 text-[18px]" /></Field>
              {method === "check" && <Field label="Check #"><Input value={ref} onChange={(e) => setRef(e.target.value)} className="h-11" /></Field>}
              <Button size="lg" variant="primary" className="h-12 w-full text-[16px]" onClick={() => { if (!inv) { const iid = st.createInvoiceFromJob(job.id); inv = st.data.invoices.find((i) => i.id === iid) ?? useCrm.getState().data.invoices.find((i) => i.id === iid); } if (!inv) return; st.recordPayment({ invoiceId: inv.id, customerId: job.customerId, amount, method, reference: ref, isDeposit: false, note: "Collected in field", processor: { provider: method === "card" ? "square" : "manual" } }); toast(`${money(amount)} collected`, "success"); onClose(); }}>Collect {money(amount)}</Button>
              {method === "card" && <p className="text-center text-[11.5px] text-slate-500">Card reader (Square / Stripe Terminal) pairs once connected in Settings → Integrations.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

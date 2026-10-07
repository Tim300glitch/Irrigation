"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Navigation, Phone, KeyRound, Dog, Play, Pause, CheckCircle2, Truck, MapPin, Receipt, FilePlus2, Clock, AlertTriangle, PhoneCall, Smartphone, Printer, Download, Flag, Calendar } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Job, JobStatus, LineItem, ChangeOrder, ServiceType } from "@/lib/crm/types";
import { JOB_STATUSES, SERVICE_TYPES, serviceLabel, serviceColor, OPEN_JOB, TIME_TYPES } from "@/lib/crm/constants";
import { addressFull, customerName, date, dateTime, hours, mapsUrl, money, money0, pct, phone, relative, time, fullName } from "@/lib/crm/format";
import { entryHours, lineTotals, invoiceTotals } from "@/lib/crm/calc";
import { crmIndex } from "@/lib/crm/metrics";
import { Page, PageHeader, Card, Button, Badge, Tabs, SearchBox, Select, Field, Input, Textarea, Modal, cn, StatusBadge, useQuery, setQueryParam, Empty, KV, Avatar, Check, Progress } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { LineItemsEditor } from "../LineItems";
import { SignaturePad, Timeline, Conversation } from "../widgets";
import { PhotoGallery, PhotoUploadButton } from "../Photos";
import { EmployeePicker } from "../pickers";
import { CompareBar } from "../charts";
import { useQuickCreate } from "../QuickCreate";
import { ZoneStatusBadges } from "./Customers";
import { toLocalInput } from "./Leads";

export function JobsPage() {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const status = q.get("status") ?? "open";
  const typeFilter = q.get("type") ?? "";
  const [search, setSearch] = useState("");
  const [tech, setTech] = useState("");
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const emp = byId(data.employees);
  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return data.jobs.filter((j) => {
      if (status === "open" && !OPEN_JOB.includes(j.status)) return false;
      if (status === "today" && !(j.scheduledStart && new Date(j.scheduledStart).toDateString() === new Date(now).toDateString())) return false;
      if (!["open", "today", "all"].includes(status) && j.status !== status) return false;
      if (typeFilter && j.serviceType !== typeFilter) return false;
      if (tech && j.assignedTo !== tech) return false;
      if (t && !`${j.number} ${j.title} ${customerName(cust.get(j.customerId))} ${prop.get(j.propertyId)?.address.street ?? ""}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [data.jobs, status, typeFilter, tech, search, cust, prop, now]);
  const c = (s: JobStatus) => data.jobs.filter((j) => j.status === s).length;
  return (
    <Page>
      <PageHeader
        title="Jobs"
        subtitle={`${rows.length} shown · ${money0(rows.reduce((s, j) => s + lineTotals(j.items).subtotal, 0))}`}
        actions={
          <>
            <Button onClick={() => downloadText("jobs.csv", toCsv(rows, [{ header: "Job", value: (j) => j.number }, { header: "Title", value: (j) => j.title }, { header: "Customer", value: (j) => customerName(cust.get(j.customerId)) }, { header: "Type", value: (j) => serviceLabel(j.serviceType) }, { header: "Status", value: (j) => j.status }, { header: "Scheduled", value: (j) => j.scheduledStart ?? "" }, { header: "Tech", value: (j) => fullName(emp.get(j.assignedTo ?? "")) }, { header: "Value", value: (j) => lineTotals(j.items).subtotal.toFixed(2) }]))}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => openQuick("job")}><Plus size={15} /> New job</Button>
          </>
        }
      />
      <Tabs
        className="mb-3"
        value={status}
        onChange={(s) => setQueryParam("status", s)}
        tabs={[
          { id: "open", label: "Open", count: data.jobs.filter((j) => OPEN_JOB.includes(j.status)).length },
          { id: "today", label: "Today" },
          { id: "unscheduled", label: "Unscheduled", count: c("unscheduled") },
          { id: "scheduled", label: "Scheduled", count: c("scheduled") },
          { id: "in_progress", label: "In progress", count: c("in_progress") },
          { id: "waiting_parts", label: "Waiting on parts", count: c("waiting_parts") },
          { id: "needs_follow_up", label: "Follow-up", count: c("needs_follow_up") },
          { id: "callback", label: "Callbacks", count: c("callback") },
          { id: "completed", label: "Completed" },
          { id: "all", label: "All" },
        ]}
      />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Job #, customer, address…" className="w-full sm:w-72" />
          <Select value={typeFilter} onChange={(e) => setQueryParam("type", e.target.value)} options={[{ value: "", label: "All job types" }, ...SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label }))]} className="w-52" />
          <EmployeePicker value={tech} onChange={setTech} roles={["technician", "crew_lead", "estimator", "owner"]} placeholder="All technicians" />
        </div>
        <DataTable
          rows={rows}
          onRowClick={(j) => router.push(`/jobs/${j.id}`)}
          initialSort={{ key: "date", dir: status === "completed" || status === "all" ? "desc" : "asc" }}
          empty={<Empty title="No jobs match" />}
          columns={[
            { key: "job", header: "Job", mobile: true, sort: (j) => j.number, cell: (j) => <div className="flex items-start gap-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: serviceColor(j.serviceType) }} /><div><div className="font-medium text-slate-900">#{j.number} {j.title}</div><div className="text-[11.5px] text-slate-500">{customerName(cust.get(j.customerId))} · {prop.get(j.propertyId)?.address.street}</div></div></div> },
            { key: "status", header: "Status", mobile: true, sort: (j) => j.status, cell: (j) => <span className="flex items-center gap-1.5"><StatusBadge list={JOB_STATUSES} value={j.status} />{j.priority === "urgent" && <Badge tone="red">Urgent</Badge>}{j.priority === "high" && <Badge tone="amber">High</Badge>}</span> },
            { key: "date", header: "Scheduled", mobile: true, sort: (j) => j.scheduledStart ?? (status === "completed" ? "" : "9"), cell: (j) => <span className="text-slate-600">{j.scheduledStart ? `${date(j.scheduledStart)} ${time(j.scheduledStart)}` : <span className="text-slate-400">Unscheduled</span>}</span> },
            { key: "type", header: "Type", hideBelow: "lg", cell: (j) => <span className="text-slate-600">{serviceLabel(j.serviceType)}</span> },
            { key: "tech", header: "Tech", hideBelow: "md", cell: (j) => <span className="flex items-center gap-1"><Avatar e={emp.get(j.assignedTo ?? "")} size={22} />{j.crew.length > 1 && <span className="text-[11px] text-slate-400">+{j.crew.length - 1}</span>}</span> },
            { key: "val", header: "Value", align: "right", sort: (j) => lineTotals(j.items).subtotal, cell: (j) => money0(lineTotals(j.items).subtotal) },
          ]}
        />
      </Card>
    </Page>
  );
}

const FLOW: JobStatus[] = ["scheduled", "en_route", "arrived", "in_progress", "completed"];

export function JobDetail({ id }: { id: string }) {
  const st = useCrm();
  const { data, settings, update, now } = st;
  const router = useRouter();
  const q = useQuery();
  const tab = q.get("tab") ?? "overview";
  const [coOpen, setCoOpen] = useState(false);
  const [signOpen, setSignOpen] = useState<null | "job" | string>(null);
  const j = data.jobs.find((x) => x.id === id);
  if (!j) return <Page><Empty title="Job not found" /></Page>;
  const c = data.customers.find((x) => x.id === j.customerId);
  const p = data.properties.find((x) => x.id === j.propertyId);
  const sys = data.systems.find((s) => s.propertyId === j.propertyId);
  const zones = data.zones.filter((z) => z.systemId === sys?.id).sort((a, b) => a.number - b.number);
  const est = data.estimates.find((e) => e.id === j.estimateId);
  const inv = data.invoices.find((i) => i.jobId === id && i.kind !== "deposit");
  const cos = data.changeOrders.filter((x) => x.jobId === id);
  const photos = data.photos.filter((ph) => ph.jobId === id || (ph.entityType === "job" && ph.entityId === id));
  const entries = data.timeEntries.filter((t) => t.jobId === id).sort((a, b) => a.start.localeCompare(b.start));
  const costing = crmIndex(data, settings).costing(j);
  const lt = lineTotals(j.items);
  const set = (patch: Partial<Job>) => update("jobs", id, patch);
  const done = j.checklist.filter((x) => x.done).length;
  const history = data.jobs.filter((x) => x.propertyId === j.propertyId && x.id !== id && x.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const flowIdx = FLOW.indexOf(j.status);
  const nextAction: { label: string; status: JobStatus; icon: typeof Play } | null =
    j.status === "unscheduled" || j.status === "scheduled" ? { label: "Start travel", status: "en_route", icon: Truck } : j.status === "en_route" ? { label: "Arrived", status: "arrived", icon: MapPin } : j.status === "arrived" || j.status === "paused" || j.status === "waiting_parts" || j.status === "callback" || j.status === "needs_follow_up" ? { label: "Start job", status: "in_progress", icon: Play } : j.status === "in_progress" ? { label: "Complete", status: "completed", icon: CheckCircle2 } : null;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "items", label: "Materials & labor", count: j.items.length },
    { id: "checklist", label: "Checklist", count: j.checklist.length ? undefined : 0 },
    { id: "photos", label: "Photos", count: photos.length },
    { id: "changes", label: "Change orders", count: cos.length },
    { id: "time", label: "Time", count: entries.length },
    { id: "costing", label: "Job costing" },
    { id: "messages", label: "Messages" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <Page>
      <PageHeader
        back={{ href: "/jobs", label: "Jobs" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">#{j.number}</span> {j.title} <StatusBadge list={JOB_STATUSES} value={j.status} />
            {j.priority !== "normal" && <Badge tone={j.priority === "urgent" ? "red" : j.priority === "high" ? "amber" : "slate"}>{j.priority}</Badge>}
            {j.callbackOfJobId && <Badge tone="red"><PhoneCall size={11} /> Callback</Badge>}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-3">
            <Link href={`/customers/${c?.id}`} className="font-medium text-slate-700 hover:text-brand-700">{customerName(c)}</Link>
            <Link href={`/properties/${p?.id}`} className="hover:text-brand-700">{addressFull(p?.address)}</Link>
            <span>{serviceLabel(j.serviceType)}</span>
            {j.scheduledStart && <span>{new Date(j.scheduledStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {j.arrivalWindow}</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/field/${id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><Smartphone size={13} /> Field view</Link>
            <Select value={j.status} onChange={(e) => st.setJobStatus(id, e.target.value as JobStatus)} options={JOB_STATUSES.map((s) => ({ value: s.id, label: s.label }))} className="h-8 w-40" />
            {nextAction && <Button variant="primary" onClick={() => st.setJobStatus(id, nextAction.status)}><nextAction.icon size={14} /> {nextAction.label}</Button>}
            {j.status === "in_progress" && <Button onClick={() => st.setJobStatus(id, "paused")}><Pause size={14} /> Pause</Button>}
            {j.completedAt && (inv ? <Button onClick={() => router.push(`/invoices/${inv.id}`)}><Receipt size={14} /> INV-{inv.number}</Button> : <Button variant="primary" onClick={() => { const iid = st.createInvoiceFromJob(id); if (iid) router.push(`/invoices/${iid}`); }}><Receipt size={14} /> Create invoice</Button>)}
          </>
        }
      />
      {/* status pipeline */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
        {FLOW.map((s, i) => {
          const reached = flowIdx >= i || j.status === "completed";
          const meta = JOB_STATUSES.find((x) => x.id === s)!;
          return (
            <div key={s} className="flex flex-1 items-center gap-1">
              <button onClick={() => st.setJobStatus(id, s)} className={cn("flex min-w-[96px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors", j.status === s ? "bg-brand-600 text-white" : reached ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100")}>
                {reached && j.status !== s ? <CheckCircle2 size={13} /> : null}
                {meta.label}
              </button>
              {i < FLOW.length - 1 && <span className={cn("h-px w-3 shrink-0", reached ? "bg-brand-300" : "bg-slate-200")} />}
            </div>
          );
        })}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => setQueryParam("tab", t === "overview" ? null : t)} className="mb-4" />

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <Card title="Schedule & crew">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Start" className="col-span-2"><Input type="datetime-local" value={j.scheduledStart ? toLocalInput(j.scheduledStart) : ""} onChange={(e) => st.scheduleJob(id, e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Field>
                <Field label="Duration (h)"><Input type="number" min={0.5} step={0.5} value={j.durationHrs} onChange={(e) => set({ durationHrs: Number(e.target.value) })} /></Field>
                <Field label="Arrival window"><Input value={j.arrivalWindow} onChange={(e) => set({ arrivalWindow: e.target.value })} /></Field>
                <Field label="Lead technician" className="col-span-2"><EmployeePicker value={j.assignedTo} onChange={(v) => set({ assignedTo: v || undefined })} roles={["technician", "crew_lead", "estimator", "owner"]} /></Field>
                <Field label="Priority"><Select value={j.priority} onChange={(e) => set({ priority: e.target.value as Job["priority"] })} options={["low", "normal", "high", "urgent"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></Field>
                <Field label="Job type"><Select value={j.serviceType} onChange={(e) => set({ serviceType: e.target.value as ServiceType })} options={SERVICE_TYPES.map((s) => ({ value: s.id, label: s.short }))} /></Field>
              </div>
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Crew</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {data.employees.filter((e) => e.active && ["technician", "crew_lead", "helper"].includes(e.role)).map((e) => (
                    <Check key={e.id} label={<span className="flex items-center gap-1.5"><Avatar e={e} size={18} />{fullName(e)}</span>} checked={j.crew.includes(e.id) || j.assignedTo === e.id} onChange={(v) => set({ crew: v ? [...new Set([...j.crew, e.id])] : j.crew.filter((x) => x !== e.id) })} />
                  ))}
                </div>
              </div>
            </Card>
            <Card title="Scope of work"><Textarea value={j.scope} onChange={(e) => set({ scope: e.target.value })} rows={3} /></Card>
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Customer notes"><Textarea value={j.customerNotes} onChange={(e) => set({ customerNotes: e.target.value })} rows={3} placeholder="Visible to the customer" /></Card>
              <Card title="Internal notes"><Textarea value={j.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} rows={3} /></Card>
            </div>
            <Card title="Zones worked on" sub="links this job to the zone's repair history">
              <div className="flex flex-wrap gap-1.5">
                {zones.map((z) => (
                  <button key={z.id} onClick={() => set({ zoneIds: j.zoneIds.includes(z.id) ? j.zoneIds.filter((x) => x !== z.id) : [...j.zoneIds, z.id] })} className={cn("rounded-full border px-2.5 py-1 text-[12px]", j.zoneIds.includes(z.id) ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                    Z{z.number} {z.name}
                  </button>
                ))}
              </div>
            </Card>
            {j.followUp?.required && (
              <Card title="Follow-up required" icon={<Flag size={14} />}>
                <p className="text-[13px] text-slate-700">{j.followUp.notes}</p>
                {j.followUp.dueDate && <p className="mt-1 text-[12px] text-slate-500">Due {date(j.followUp.dueDate)}</p>}
                <Button size="sm" className="mt-2" onClick={() => set({ followUp: { ...j.followUp!, required: false } })}>Mark handled</Button>
              </Card>
            )}
          </div>
          <div className="space-y-3">
            <Card title="Site">
              <KV cols={1} items={[["Address", <a key="a" href={mapsUrl(p?.address)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{addressFull(p?.address)}</a>], ["Gate code", p?.gateCode ? <span className="flex items-center gap-1 font-mono font-semibold"><KeyRound size={12} />{p.gateCode}</span> : "—"], ["Access", p?.accessNotes], ["Pets", p?.pets ? <span className="flex items-center gap-1 text-amber-700"><Dog size={12} />{p.pets}</span> : "—"], ["Controller", p?.controllerLocation], ["Valves", p?.valveLocations]]} />
              <div className="mt-3 flex gap-1.5">
                <a href={mapsUrl(p?.address)} target="_blank" rel="noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-[12.5px] font-medium hover:bg-slate-50"><Navigation size={13} /> Navigate</a>
                <a href={`tel:${c?.phone}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-[12.5px] font-medium hover:bg-slate-50"><Phone size={13} /> {phone(c?.phone ?? "")}</a>
              </div>
            </Card>
            <Card title="Summary">
              <KV cols={2} items={[["Job value", money(lt.subtotal)], ["Est. labor", `${j.estimatedLaborHours} h`], ["Checklist", `${done}/${j.checklist.length}`], ["Photos", photos.length], ["Estimate", est ? <Link key="e" href={`/estimates/${est.id}`} className="text-brand-700 hover:underline">#{est.number}</Link> : "—"], ["Invoice", inv ? <Link key="i" href={`/invoices/${inv.id}`} className="text-brand-700 hover:underline">INV-{inv.number} · {invoiceTotals(inv, data.payments, now).status}</Link> : "—"]]} />
              {j.signature && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">Signed by {j.signature.name} · {dateTime(j.signature.signedAt)}</div>}
            </Card>
            <Card title="Property history" pad={false}>
              <div className="divide-y divide-slate-100">
                {history.slice(0, 5).map((h) => (
                  <Link key={h.id} href={`/jobs/${h.id}`} className="block px-4 py-2 hover:bg-slate-50">
                    <div className="truncate text-[12.5px] text-slate-900">{h.title}</div>
                    <div className="text-[11.5px] text-slate-500">#{h.number} · {date(h.completedAt)} · {fullName(data.employees.find((e) => e.id === h.assignedTo))}</div>
                  </Link>
                ))}
                {!history.length && <p className="px-4 py-3 text-[12.5px] text-slate-500">First visit to this property.</p>}
              </div>
            </Card>
            <Card title="System at this property" pad={false}>
              <div className="divide-y divide-slate-100">
                {zones.slice(0, 8).map((z) => (
                  <div key={z.id} className="flex items-center justify-between gap-2 px-4 py-1.5">
                    <span className="truncate text-[12px]">Z{z.number} {z.name}</span>
                    <ZoneStatusBadges statuses={z.statuses} />
                  </div>
                ))}
              </div>
              <Link href={`/properties/${p?.id}?tab=map`} className="block border-t border-slate-100 px-4 py-2 text-[12px] font-medium text-brand-700 hover:bg-slate-50">Open system map →</Link>
            </Card>
          </div>
        </div>
      )}

      {tab === "items" && (
        <Card title="Materials, labor & equipment" sub="enter quantities actually used — completing the job deducts them from truck / warehouse stock">
          <LineItemsEditor items={j.items} usedQty onChange={(items) => set({ items })} />
          <div className="mt-3 flex flex-wrap justify-end gap-6 border-t border-slate-100 pt-3 text-[12.5px]">
            <span>Materials <b className="tabular">{money(lt.materialPrice)}</b></span>
            <span>Labor <b className="tabular">{money(lt.laborPrice)}</b></span>
            <span>Total <b className="tabular">{money(lt.subtotal)}</b></span>
          </div>
        </Card>
      )}

      {tab === "checklist" && (
        <Card title="Job checklist" sub={`${done} of ${j.checklist.length} complete`} actions={<Select value="" onChange={(e) => { const t = data.checklistTemplates.find((x) => x.id === e.target.value); if (t) set({ checklistTemplateId: t.id, checklist: t.items.map((label, i) => ({ id: `chk_${Date.now()}_${i}`, label, done: false })) }); }} options={[{ value: "", label: "Load template…" }, ...data.checklistTemplates.map((t) => ({ value: t.id, label: t.name }))]} className="h-7 w-44 text-[12px]" />}>
          <Progress value={j.checklist.length ? done / j.checklist.length : 0} tone="green" className="mb-3" />
          <ChecklistEditor job={j} />
        </Card>
      )}

      {tab === "photos" && (
        <Card>
          <PhotoGallery photos={photos} upload={<PhotoUploadButton entityType="job" entityId={id} jobId={id} customerId={j.customerId} propertyId={j.propertyId} category={j.status === "completed" ? "after" : j.status === "in_progress" ? "during" : "before"} />} />
        </Card>
      )}

      {tab === "changes" && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button variant="primary" onClick={() => setCoOpen(true)}><FilePlus2 size={14} /> New change order</Button></div>
          {cos.map((co) => <ChangeOrderCard key={co.id} co={co} onSign={() => setSignOpen(co.id)} />)}
          {!cos.length && <Card><Empty title="No change orders">Found extra work on site? Create a change order and get the customer&apos;s digital approval before continuing.</Empty></Card>}
        </div>
      )}

      {tab === "time" && <TimePanel job={j} />}
      {tab === "costing" && <CostingPanel job={j} costing={costing} />}
      {tab === "messages" && c && <Card title="Messages"><Conversation customerId={c.id} jobId={id} /></Card>}
      {tab === "activity" && <Card><Timeline entries={data.activity.filter((a) => a.jobId === id || a.entityId === id)} limit={80} /></Card>}

      {coOpen && <ChangeOrderModal jobId={id} onClose={() => setCoOpen(false)} />}
      {signOpen && (
        <Modal open onClose={() => setSignOpen(null)} title="Customer approval — change order" width={560}>
          <SignaturePad name={c ? fullName(c) : ""} onSave={(sig) => { st.decideChangeOrder(signOpen, true, sig); setSignOpen(null); }} />
        </Modal>
      )}
    </Page>
  );
}

export function ChecklistEditor({ job, big }: { job: Job; big?: boolean }) {
  const { update, session } = useCrm();
  const [add, setAdd] = useState("");
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {job.checklist.map((item) => (
          <li key={item.id} className={cn("flex items-center gap-3", big ? "py-3" : "py-2")}>
            <input type="checkbox" checked={item.done} onChange={(e) => update("jobs", job.id, (j) => ({ ...j, checklist: j.checklist.map((x) => (x.id === item.id ? { ...x, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : undefined, doneBy: e.target.checked ? session?.employeeId : undefined } : x)) }))} className={cn("shrink-0 accent-[var(--color-brand-600)]", big ? "h-6 w-6" : "h-4 w-4")} />
            <span className={cn("flex-1", big ? "text-[15px]" : "text-[13px]", item.done ? "text-slate-400 line-through" : "text-slate-800")}>{item.label}</span>
            {item.doneAt && <span className="text-[11px] text-slate-400">{time(item.doneAt)}</span>}
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!add.trim()) return; update("jobs", job.id, (j) => ({ ...j, checklist: [...j.checklist, { id: `chk_${Date.now()}`, label: add.trim(), done: false }] })); setAdd(""); }}>
        <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add checklist item…" className={big ? "h-10" : ""} />
        <Button type="submit" size={big ? "lg" : "md"}>Add</Button>
      </form>
    </div>
  );
}

export function ChangeOrderCard({ co, onSign }: { co: ChangeOrder; onSign: () => void }) {
  const st = useCrm();
  const t = lineTotals(co.items);
  return (
    <Card title={`Change order #${co.number} — ${co.title}`} sub={date(co.createdAt)} actions={<Badge tone={co.status === "approved" ? "green" : co.status === "declined" ? "red" : "amber"} dot>{co.status}</Badge>}>
      <p className="mb-2 text-[13px] text-slate-700">{co.description}</p>
      <LineItemsEditor items={co.items} readOnly onChange={() => {}} showCost={false} compact />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[13px]">Additional cost: <b className="tabular">{money(t.subtotal)}</b> + tax</span>
        {co.status === "pending" ? (
          <span className="flex gap-2">
            <Button size="sm" variant="danger" onClick={() => st.decideChangeOrder(co.id, false)}>Declined</Button>
            <Button size="sm" variant="primary" onClick={onSign}>Get signature & approve</Button>
          </span>
        ) : co.signature ? (
          <span className="text-[12px] text-slate-500">Signed by {co.signature.name} · {dateTime(co.signature.signedAt)}</span>
        ) : null}
      </div>
    </Card>
  );
}

export function ChangeOrderModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const st = useCrm();
  const [title, setTitle] = useState("Additional broken valve discovered");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  return (
    <Modal open onClose={onClose} title="New change order" subtitle="The customer approves digitally before work continues. Approved items are added to the job and invoice." width={860} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!items.length} onClick={() => { st.createChangeOrder(jobId, { title, description, items }); onClose(); }}>Create change order ({money(lineTotals(items).subtotal)})</Button></>}>
      <div className="space-y-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="What was found / why"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Zone 4 valve diaphragm torn — found while testing stations." /></Field>
        <LineItemsEditor items={items} onChange={setItems} compact />
      </div>
    </Modal>
  );
}

function TimePanel({ job }: { job: Job }) {
  const { data, insert, remove, now, settings } = useCrm();
  const entries = data.timeEntries.filter((t) => t.jobId === job.id).sort((a, b) => a.start.localeCompare(b.start));
  const emp = byId(data.employees);
  const [add, setAdd] = useState({ employeeId: job.assignedTo ?? "", type: "job" as const, start: "", end: "" });
  const tot = (type: string) => entries.filter((e) => e.type === type).reduce((s, e) => s + entryHours(e, now), 0);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <Card title="Time entries" pad={false}>
        <DataTable
          rows={entries}
          empty={<Empty icon={<Clock size={18} />} title="No time recorded">Travel and job time are tracked automatically when the tech taps Start travel → Arrived → Start job → Complete.</Empty>}
          columns={[
            { key: "e", header: "Employee", mobile: true, cell: (t) => <span className="flex items-center gap-2"><Avatar e={emp.get(t.employeeId)} size={20} />{fullName(emp.get(t.employeeId))}</span> },
            { key: "t", header: "Type", mobile: true, cell: (t) => <Badge>{TIME_TYPES.find((x) => x.id === t.type)?.label}</Badge> },
            { key: "s", header: "Start", cell: (t) => dateTime(t.start) },
            { key: "f", header: "End", cell: (t) => (t.end ? time(t.end) : <Badge tone="green" dot>Running</Badge>) },
            { key: "h", header: "Hours", align: "right", mobile: true, cell: (t) => hours(entryHours(t, now)) },
            { key: "c", header: "Cost", align: "right", hideBelow: "md", cell: (t) => { const e = emp.get(t.employeeId); return e ? money(entryHours(t, now) * (e.payType === "salary" ? e.payRate / 2080 : e.payRate) * (1 + settings.laborBurdenPct / 100)) : "—"; } },
            { key: "x", header: "", cell: (t) => <button onClick={() => remove("timeEntries", t.id)} className="text-[11px] text-slate-400 hover:text-red-600">remove</button> },
          ]}
        />
      </Card>
      <div className="space-y-3">
        <Card title="Totals">
          <KV cols={2} items={[["Travel", hours(tot("travel"))], ["On site", hours(tot("job"))], ["Estimated", `${job.estimatedLaborHours} h`], ["Variance", <span key="v" className={cn((tot("job") + tot("travel")) > job.estimatedLaborHours ? "text-red-600" : "text-emerald-700")}>{(tot("job") + tot("travel") - job.estimatedLaborHours).toFixed(1)} h</span>]]} />
        </Card>
        <Card title="Add time manually">
          <div className="space-y-2">
            <EmployeePicker value={add.employeeId} onChange={(v) => setAdd({ ...add, employeeId: v })} allowNone={false} />
            <Select value={add.type} onChange={(e) => setAdd({ ...add, type: e.target.value as "job" })} options={TIME_TYPES.filter((t) => t.id !== "shift").map((t) => ({ value: t.id, label: t.label }))} />
            <Input type="datetime-local" value={add.start} onChange={(e) => setAdd({ ...add, start: e.target.value })} />
            <Input type="datetime-local" value={add.end} onChange={(e) => setAdd({ ...add, end: e.target.value })} />
            <Button className="w-full" disabled={!add.start || !add.end || !add.employeeId} onClick={() => { insert("timeEntries", { id: `tim_${Date.now()}`, employeeId: add.employeeId, jobId: job.id, type: add.type, start: new Date(add.start).toISOString(), end: new Date(add.end).toISOString(), notes: "Manual entry" }); setAdd({ ...add, start: "", end: "" }); }}>Add entry</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CostingPanel({ job, costing: c }: { job: Job; costing: ReturnType<ReturnType<typeof crmIndex>["costing"]> }) {
  const { update } = useCrm();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Job["otherCosts"][number]["kind"]>("subcontract");
  const marginDelta = c.margin - c.est.margin;
  const rows: [string, number, number][] = [
    ["Revenue", c.est.revenue, c.revenue],
    ["Materials", c.est.materialCost, c.materialCost],
    ["Labor", c.est.laborCost, c.laborCost],
    ["Equipment", c.est.equipmentCost, c.equipmentCost],
    ["Subcontractors", 0, c.subcontractCost],
    ["Other", 0, c.otherCost],
    ["Gross profit", c.est.grossProfit, c.grossProfit],
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11.5px] text-slate-500">Estimated margin</div>
            <div className="tabular text-[24px] font-semibold text-slate-900">{c.est.revenue ? pct(c.est.margin) : "—"}</div>
          </div>
          <div className={cn("rounded-xl border bg-white p-3.5", marginDelta < -0.05 ? "border-red-200" : "border-emerald-200")}>
            <div className="text-[11.5px] text-slate-500">Actual margin</div>
            <div className={cn("tabular text-[24px] font-semibold", marginDelta < -0.05 ? "text-red-600" : "text-emerald-700")}>{pct(c.margin)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11.5px] text-slate-500">Gross profit</div>
            <div className="tabular text-[24px] font-semibold text-slate-900">{money0(c.grossProfit)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11.5px] text-slate-500">Labor hours</div>
            <div className="tabular text-[24px] font-semibold text-slate-900">{(c.laborHours + c.travelHours).toFixed(1)}<span className="text-[13px] font-normal text-slate-500"> / {c.est.laborHours} est</span></div>
          </div>
        </div>
        {c.reasons.length > 0 && (
          <Card title="Why actual differs from estimate" icon={<AlertTriangle size={14} />}>
            <ul className="space-y-1">
              {c.reasons.map((r) => <li key={r} className="flex items-center gap-2 text-[13px] text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{r}</li>)}
            </ul>
          </Card>
        )}
        <Card title="Estimated vs actual" pad={false}>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500"><th className="px-4 py-2 font-medium">Line</th><th className="px-2 text-right font-medium">Estimated</th><th className="px-2 text-right font-medium">Actual</th><th className="px-4 text-right font-medium">Variance</th></tr></thead>
            <tbody>
              {rows.map(([l, e, a]) => {
                const v = a - e;
                const good = l === "Revenue" || l === "Gross profit" ? v >= 0 : v <= 0;
                return (
                  <tr key={l} className={cn("border-b border-slate-50", l === "Gross profit" && "font-semibold")}>
                    <td className="px-4 py-2">{l}</td>
                    <td className="tabular px-2 text-right text-slate-500">{money(e)}</td>
                    <td className="tabular px-2 text-right">{money(a)}</td>
                    <td className={cn("tabular px-4 text-right", Math.abs(v) < 1 ? "text-slate-400" : good ? "text-emerald-700" : "text-red-600")}>{v >= 0 ? "+" : ""}{money(v)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Cost breakdown">
          <CompareBar a={c.est.materialCost + c.est.laborCost + c.est.equipmentCost} b={c.totalCost} labelA="Est. cost" labelB="Actual" format={money0} />
        </Card>
      </div>
      <Card title="Unplanned costs" sub="subs, rentals, dump fees, permits">
        <div className="space-y-1.5">
          {job.otherCosts.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px]">
              <span>{o.label} <span className="text-slate-400">· {o.kind}</span></span>
              <span className="flex items-center gap-2"><b className="tabular">{money(o.amount)}</b><button onClick={() => update("jobs", job.id, (j) => ({ ...j, otherCosts: j.otherCosts.filter((x) => x.id !== o.id) }))} className="text-slate-400 hover:text-red-600">×</button></span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_90px] gap-1.5">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Description" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" inputMode="decimal" />
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={["subcontract", "equipment", "dump", "permit", "other"].map((v) => ({ value: v, label: v }))} />
          <Button disabled={!label || !Number(amount)} onClick={() => { update("jobs", job.id, (j) => ({ ...j, otherCosts: [...j.otherCosts, { id: `cst_${Date.now()}`, kind, label, amount: Number(amount) }] })); setLabel(""); setAmount(""); }}>Add</Button>
        </div>
        <p className="mt-3 text-[11.5px] text-slate-500">Labor cost = recorded travel + job hours × wage × (1 + {useCrm.getState().settings.laborBurdenPct}% burden). Materials use quantities actually used. Revenue comes from the job&apos;s invoice (or job price before invoicing).</p>
      </Card>
    </div>
  );
}


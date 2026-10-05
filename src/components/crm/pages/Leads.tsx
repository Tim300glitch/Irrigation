"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Phone, Mail, MapPin, Clock, CalendarClock, ArrowRight, FileText, UserCheck, LayoutGrid, List, Flame, MessageSquare } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Employee, Lead, LeadSource, LeadStage, ServiceType } from "@/lib/crm/types";
import { LEAD_STAGES, LEAD_SOURCES, SERVICE_TYPES, serviceLabel, sourceLabel, statusTone } from "@/lib/crm/constants";
import { addressLine, fullName, money0, relative, pct, moneyK, date } from "@/lib/crm/format";
import { leadSourceStats, rangePreset } from "@/lib/crm/metrics";
import { Page, PageHeader, Button, Badge, Avatar, SlideOver, Field, Input, Select, Textarea, KV, cn, Segmented, SearchBox, Card, useQuery, setQueryParam, useLocalState, StatusBadge } from "../ui";
import { DataTable } from "../DataTable";
import { useQuickCreate } from "../QuickCreate";
import { Timeline, Conversation } from "../widgets";
import { EmployeePicker } from "../pickers";

export function LeadsPage() {
  const { data, moveLead, now } = useCrm();
  const q = useQuery();
  const openId = q.get("open");
  const openQuick = useQuickCreate((s) => s.open);
  const [view, setView] = useLocalState<"board" | "list" | "sources">("leads-view", "board");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ stage: LeadStage; before?: string } | null>(null);
  const emp = byId(data.employees);
  const recentCut = now - 120 * 86400000;
  const leads = useMemo(
    () =>
      data.leads.filter((l) => {
        // closed (won/lost) leads only show for 120 days on the board
        if ((l.stage === "approved" || l.stage === "lost") && new Date(l.convertedAt ?? l.createdAt).getTime() < recentCut && view === "board") return false;
        if (source && l.source !== source) return false;
        if (search && !`${l.firstName} ${l.lastName} ${l.phone} ${l.email} ${l.address.street} ${l.description}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [data.leads, source, search, view, recentCut],
  );
  const openLead = data.leads.find((l) => l.id === openId);
  const pipelineValue = leads.filter((l) => !["approved", "lost"].includes(l.stage)).reduce((s, l) => s + l.estimatedValue, 0);
  const stats = useMemo(() => leadSourceStats(data, rangePreset("last365", now)), [data, now]);
  const year = data.leads.filter((l) => new Date(l.createdAt).getTime() > now - 365 * 86400000);
  const won = year.filter((l) => l.stage === "approved").length;
  const lost = year.filter((l) => l.stage === "lost").length;

  return (
    <Page wide>
      <PageHeader
        title="Leads"
        subtitle={
          <>
            {leads.filter((l) => !["approved", "lost"].includes(l.stage)).length} open · {money0(pipelineValue)} pipeline · {pct(won / Math.max(1, won + lost))} conversion (12 mo)
          </>
        }
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "board", label: <span className="flex items-center gap-1"><LayoutGrid size={13} /> Board</span> },
                { id: "list", label: <span className="flex items-center gap-1"><List size={13} /> List</span> },
                { id: "sources", label: "Sources" },
              ]}
            />
            <Button variant="primary" onClick={() => openQuick("lead")}>
              <Plus size={15} /> New lead
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search leads…" className="w-64" />
        <Select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} options={[{ value: "", label: "All sources" }, ...LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label }))]} className="w-40" />
      </div>

      {view === "board" && (
        <div className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-4 sm:-mx-5 sm:px-5">
          {LEAD_STAGES.map((st) => {
            const col = leads.filter((l) => l.stage === st.id).sort((a, b) => a.sort - b.sort || b.createdAt.localeCompare(a.createdAt));
            const total = col.reduce((s, l) => s + l.estimatedValue, 0);
            return (
              <div
                key={st.id}
                className={cn("flex w-[272px] shrink-0 flex-col rounded-xl border bg-slate-50/70 transition-colors", over?.stage === st.id ? "border-brand-300 bg-brand-50/40" : "border-slate-200")}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over?.stage !== st.id || over.before) setOver({ stage: st.id });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag) moveLead(drag, st.id, over?.before);
                  setDrag(null);
                  setOver(null);
                }}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                    <span className="tabular text-[12px] text-slate-500">{col.length}</span>
                  </div>
                  <span className="tabular text-[11.5px] text-slate-500">{moneyK(total)}</span>
                </div>
                <div className="flex max-h-[calc(100vh-250px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {col.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        setDrag(l.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (over?.before !== l.id) setOver({ stage: st.id, before: l.id });
                      }}
                      onClick={() => setQueryParam("open", l.id)}
                      className={cn("group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition-all hover:border-slate-300 hover:shadow", drag === l.id && "opacity-40", over?.before === l.id && "border-t-2 border-t-brand-500")}
                    >
                      <LeadCard lead={l} emp={emp.get(l.assignedTo ?? "")} now={now} />
                    </div>
                  ))}
                  {!col.length && <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-[12px] text-slate-400">Drop leads here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <Card pad={false}>
          <DataTable
            rows={leads}
            onRowClick={(l) => setQueryParam("open", l.id)}
            initialSort={{ key: "created", dir: "desc" }}
            columns={[
              { key: "name", header: "Name", mobile: true, sort: (l) => fullName(l), cell: (l) => <div><div className="font-medium text-slate-900">{fullName(l)}</div><div className="text-[11.5px] text-slate-500">{l.phone}</div></div> },
              { key: "stage", header: "Stage", mobile: true, sort: (l) => LEAD_STAGES.findIndex((s) => s.id === l.stage), cell: (l) => <StatusBadge list={LEAD_STAGES} value={l.stage} /> },
              { key: "svc", header: "Service", mobile: true, cell: (l) => serviceLabel(l.serviceType), hideBelow: "md" },
              { key: "addr", header: "Address", cell: (l) => <span className="text-slate-600">{addressLine(l.address)}</span>, hideBelow: "lg" },
              { key: "src", header: "Source", sort: (l) => l.source, cell: (l) => sourceLabel(l.source), hideBelow: "md" },
              { key: "val", header: "Value", align: "right", sort: (l) => l.estimatedValue, cell: (l) => (l.estimatedValue ? money0(l.estimatedValue) : "—") },
              { key: "owner", header: "Assigned", cell: (l) => <Avatar e={emp.get(l.assignedTo ?? "")} size={22} />, hideBelow: "md" },
              { key: "next", header: "Next follow-up", sort: (l) => l.nextFollowUpAt ?? "", cell: (l) => <span className={cn(l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !["approved", "lost"].includes(l.stage) ? "font-medium text-red-600" : "text-slate-600")}>{l.nextFollowUpAt ? relative(l.nextFollowUpAt, now) : "—"}</span>, hideBelow: "lg" },
              { key: "created", header: "Created", sort: (l) => l.createdAt, cell: (l) => <span className="text-slate-500">{date(l.createdAt)}</span> },
            ]}
          />
        </Card>
      )}

      {view === "sources" && (
        <Card title="Lead source performance" sub="last 12 months — conversion and revenue by source" pad={false}>
          <DataTable
            rows={stats.map((s) => ({ ...s, id: s.source }))}
            initialSort={{ key: "rev", dir: "desc" }}
            columns={[
              { key: "src", header: "Source", mobile: true, cell: (s) => <span className="font-medium">{sourceLabel(s.source)}</span> },
              { key: "leads", header: "Leads", align: "right", sort: (s) => s.leads, cell: (s) => s.leads },
              { key: "won", header: "Won", align: "right", sort: (s) => s.won, cell: (s) => s.won },
              { key: "lost", header: "Lost", align: "right", sort: (s) => s.lost, cell: (s) => s.lost },
              { key: "rate", header: "Conversion", align: "right", mobile: true, sort: (s) => s.closeRate, cell: (s) => pct(s.closeRate) },
              { key: "jobs", header: "Jobs", align: "right", sort: (s) => s.jobs, cell: (s) => s.jobs },
              { key: "rev", header: "Revenue", align: "right", sort: (s) => s.revenue, cell: (s) => money0(s.revenue) },
              { key: "spend", header: "Spend", align: "right", sort: (s) => s.spend, cell: (s) => (s.spend ? money0(s.spend) : "—") },
              { key: "cpl", header: "Cost / lead", align: "right", sort: (s) => s.cpl, cell: (s) => (s.spend ? money0(s.cpl) : "—") },
            ]}
          />
        </Card>
      )}

      {openLead && <LeadPanel lead={openLead} onClose={() => setQueryParam("open", null)} />}
    </Page>
  );
}

function LeadCard({ lead: l, emp, now }: { lead: Lead; emp?: Employee; now: number }) {
  const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !["approved", "lost"].includes(l.stage);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-900">
            {(l.urgency === "emergency" || l.urgency === "high") && <Flame size={13} className={l.urgency === "emergency" ? "text-red-500" : "text-amber-500"} />}
            {fullName(l)}
          </div>
          <div className="truncate text-[12px] text-slate-600">{serviceLabel(l.serviceType)}</div>
        </div>
        {l.estimatedValue > 0 && <span className="tabular shrink-0 text-[12.5px] font-semibold text-slate-900">{money0(l.estimatedValue)}</span>}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-500">
        {l.address.street && (
          <div className="flex items-center gap-1 truncate">
            <MapPin size={11} className="shrink-0" />
            {addressLine(l.address)}
          </div>
        )}
        <div className="flex items-center gap-1 truncate">
          <Phone size={11} className="shrink-0" /> {l.phone || l.email}
        </div>
      </div>
      {l.description && <p className="mt-1.5 line-clamp-2 text-[11.5px] text-slate-600">{l.description}</p>}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
        <span className="text-[10.5px] font-medium text-slate-500">{sourceLabel(l.source)}</span>
        <span className="flex items-center gap-1.5">
          {l.nextFollowUpAt && !["approved", "lost"].includes(l.stage) ? (
            <span className={cn("flex items-center gap-0.5 text-[10.5px]", overdue ? "font-semibold text-red-600" : "text-slate-500")}>
              <CalendarClock size={10} /> {relative(l.nextFollowUpAt, now)}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10.5px] text-slate-400">
              <Clock size={10} /> {relative(l.lastContactAt ?? l.createdAt, now)}
            </span>
          )}
          <Avatar e={emp} size={18} />
        </span>
      </div>
    </>
  );
}

function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data, update, moveLead, convertLead, log, now } = useCrm();
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const [tab, setTab] = useState<"details" | "activity" | "messages">("details");
  const est = data.estimates.find((e) => e.id === lead.estimateId);
  const set = (p: Partial<Lead>) => update("leads", lead.id, p);
  return (
    <SlideOver
      open
      onClose={onClose}
      width={560}
      title={
        <span className="flex items-center gap-2">
          {fullName(lead)} <Badge tone={statusTone(LEAD_STAGES, lead.stage)}>{LEAD_STAGES.find((s) => s.id === lead.stage)?.label}</Badge>
        </span>
      }
      subtitle={`${serviceLabel(lead.serviceType)} · ${sourceLabel(lead.source)} · created ${relative(lead.createdAt, now)}`}
      footer={
        <>
          {lead.customerId ? (
            <Button onClick={() => router.push(`/customers/${lead.customerId}`)}>
              <UserCheck size={14} /> Customer
            </Button>
          ) : (
            <Button
              onClick={() => {
                const r = convertLead(lead.id);
                router.push(`/customers/${r.customerId}`);
              }}
            >
              <UserCheck size={14} /> Convert to customer
            </Button>
          )}
          {est ? (
            <Button variant="primary" onClick={() => router.push(`/estimates/${est.id}`)}>
              <FileText size={14} /> Estimate #{est.number}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                const r = convertLead(lead.id);
                openQuick("estimate", { customerId: r.customerId, propertyId: r.propertyId, leadId: lead.id });
              }}
            >
              <FileText size={14} /> Create estimate
            </Button>
          )}
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} onClick={() => (set({ lastContactAt: new Date().toISOString() }), log({ type: "call", message: "Called lead", entityType: "lead", entityId: lead.id, customerId: lead.customerId }))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-medium hover:bg-slate-50">
            <Phone size={13} /> Call
          </a>
        )}
        {lead.phone && (
          <a href={`sms:${lead.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-medium hover:bg-slate-50">
            <MessageSquare size={13} /> Text
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-medium hover:bg-slate-50">
            <Mail size={13} /> Email
          </a>
        )}
        <Select className="ml-auto w-44" value={lead.stage} onChange={(e) => moveLead(lead.id, e.target.value as LeadStage)} options={LEAD_STAGES.map((s) => ({ value: s.id, label: `Move to: ${s.label}` }))} />
      </div>
      <div className="mb-3 flex gap-1 border-b border-slate-200">
        {(["details", "activity", "messages"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 py-1.5 text-[12.5px] font-medium capitalize", tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "details" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="First name">
              <Input value={lead.firstName} onChange={(e) => set({ firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input value={lead.lastName} onChange={(e) => set({ lastName: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={lead.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={lead.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Street" className="col-span-2">
              <Input value={lead.address.street} onChange={(e) => set({ address: { ...lead.address, street: e.target.value } })} />
            </Field>
            <Field label="City">
              <Input value={lead.address.city} onChange={(e) => set({ address: { ...lead.address, city: e.target.value } })} />
            </Field>
            <Field label="ZIP">
              <Input value={lead.address.zip} onChange={(e) => set({ address: { ...lead.address, zip: e.target.value } })} />
            </Field>
            <Field label="Service requested">
              <Select value={lead.serviceType} onChange={(e) => set({ serviceType: e.target.value as ServiceType })} options={SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label }))} />
            </Field>
            <Field label="Lead source">
              <Select value={lead.source} onChange={(e) => set({ source: e.target.value as LeadSource })} options={LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label }))} />
            </Field>
            <Field label="Estimated value">
              <Input type="number" value={lead.estimatedValue} onChange={(e) => set({ estimatedValue: Number(e.target.value) })} />
            </Field>
            <Field label="Assigned to">
              <EmployeePicker value={lead.assignedTo} onChange={(v) => set({ assignedTo: v || undefined })} roles={["owner", "admin", "estimator", "office", "crew_lead"]} />
            </Field>
            <Field label="Next follow-up">
              <Input type="datetime-local" value={lead.nextFollowUpAt ? toLocalInput(lead.nextFollowUpAt) : ""} onChange={(e) => set({ nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            </Field>
            <Field label="Urgency">
              <Select value={lead.urgency} onChange={(e) => set({ urgency: e.target.value as Lead["urgency"] })} options={["low", "normal", "high", "emergency"].map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }))} />
            </Field>
          </div>
          <Field label="Request">
            <Textarea value={lead.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={lead.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          {lead.stage === "lost" && (
            <Field label="Lost reason">
              <Input value={lead.lostReason ?? ""} onChange={(e) => set({ lostReason: e.target.value })} />
            </Field>
          )}
          <KV
            cols={3}
            items={[
              ["Last contact", lead.lastContactAt ? relative(lead.lastContactAt, now) : "—"],
              ["Preferred dates", lead.preferredDates],
              ["Converted", lead.convertedAt ? date(lead.convertedAt) : "—"],
            ]}
          />
          {est && (
            <Link href={`/estimates/${est.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <span className="text-[12.5px]">
                Estimate #{est.number} · {est.title}
              </span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
          )}
        </div>
      )}
      {tab === "activity" && <Timeline entries={data.activity.filter((a) => a.entityId === lead.id || (lead.customerId && a.customerId === lead.customerId))} />}
      {tab === "messages" && (lead.customerId ? <Conversation customerId={lead.customerId} /> : <p className="text-[12.5px] text-slate-500">Convert the lead to a customer to start a message thread.</p>)}
    </SlideOver>
  );
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

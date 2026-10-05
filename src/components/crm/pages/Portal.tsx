"use client";
/** Customer portal + public online service request form. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Droplets, FileText, CalendarDays, Receipt, Camera, Map as MapIcon, ClipboardCheck, MessageSquarePlus, CheckCircle2, CreditCard, Phone, Mail, Upload, ChevronRight, Lock, Sun, Moon, Star } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import type { LeadSource, ServiceType } from "@/lib/crm/types";
import { SERVICE_TYPES, LEAD_SOURCES, serviceLabel, JOB_STATUSES } from "@/lib/crm/constants";
import { addressFull, customerName, date, money, time, fullName, phone } from "@/lib/crm/format";
import { auditScore, invoiceTotals, optionTotals } from "@/lib/crm/calc";
import { crmRepo } from "@/lib/crm/repository";
import { uid } from "@/lib/crm/workflows";
import { Button, Badge, cn, Field, Input, Select, Textarea, Modal, StatusBadge, useQuery, setQueryParam, Empty } from "../ui";
import { useCrmBoot, useTheme } from "../Shell";
import { Toasts } from "../Toasts";
import { SignaturePad } from "../widgets";
import { PhotoGallery } from "../Photos";
import { SystemMap } from "../SystemMap";
import { ZoneMiniTable } from "./Customers";
import { AskHost } from "@/components/AskHost";
import { toast } from "@/lib/crm/toast";

function Brand({ children }: { children?: ReactNode }) {
  const s = useCrm((x) => x.settings);
  const { dark, toggle } = useTheme();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><Droplets size={18} /></span>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-slate-900">{s.businessName}</div>
          <div className="text-[11.5px] text-slate-500">{s.phone} · {s.license}</div>
        </div>
        {children}
        <button onClick={toggle} className="rounded-lg p-2 text-slate-500" aria-label="Theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
      </div>
    </header>
  );
}

type Tab = "home" | "estimates" | "appointments" | "invoices" | "photos" | "system" | "audits" | "request";

export function PortalPage() {
  useCrmBoot();
  const st = useCrm();
  const { data, ready, now } = st;
  const q = useQuery();
  const cid = q.get("c");
  const tab = (q.get("tab") as Tab) ?? (q.get("estimate") ? "estimates" : q.get("invoice") ? "invoices" : "home");
  const c = data.customers.find((x) => x.id === cid);
  if (!ready) return <div className="py-24 text-center text-slate-500">Loading…</div>;
  if (!c)
    return (
      <div className="min-h-screen bg-canvas">
        <Brand />
        <div className="mx-auto max-w-md px-4 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Lock size={22} className="mx-auto mb-2 text-slate-400" />
            <h1 className="text-[18px] font-semibold">Customer portal</h1>
            <p className="mb-4 mt-1 text-[13px] text-slate-500">Customers sign in with a secure magic link sent by email / text. For this demo, open the portal as one of these customers:</p>
            <div className="space-y-1.5 text-left">
              {data.customers.filter((x) => data.estimates.some((e) => e.customerId === x.id && ["sent", "viewed"].includes(e.status)) || x.tags.includes("VIP")).slice(0, 8).map((x) => (
                <button key={x.id} onClick={() => setQueryParam("c", x.id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-[13px] hover:bg-slate-50">{customerName(x)}<ChevronRight size={14} className="text-slate-400" /></button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  const props = data.properties.filter((p) => p.customerId === c.id);
  const estimates = data.estimates.filter((e) => e.customerId === c.id && e.status !== "draft");
  const jobs = data.jobs.filter((j) => j.customerId === c.id);
  const upcoming = jobs.filter((j) => j.scheduledStart && new Date(j.scheduledStart).getTime() > now - 3 * 3600000 && j.status !== "completed" && j.status !== "cancelled").sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
  const invoices = data.invoices.filter((i) => i.customerId === c.id && i.status !== "draft" && i.status !== "void");
  const balance = invoices.reduce((s, i) => s + invoiceTotals(i, data.payments, now).balance, 0);
  const photos = data.photos.filter((p) => p.customerId === c.id && p.category !== "problem");
  const audits = data.audits.filter((a) => props.some((p) => p.id === a.propertyId) && a.status === "complete");
  const pending = estimates.filter((e) => ["sent", "viewed"].includes(e.status));
  const tabs: { id: Tab; label: string; icon: typeof FileText; n?: number }[] = [
    { id: "home", label: "Overview", icon: Droplets },
    { id: "estimates", label: "Estimates", icon: FileText, n: pending.length },
    { id: "appointments", label: "Appointments", icon: CalendarDays, n: upcoming.length },
    { id: "invoices", label: "Invoices", icon: Receipt, n: invoices.filter((i) => invoiceTotals(i, data.payments, now).balance > 0).length },
    { id: "photos", label: "Photos", icon: Camera },
    { id: "system", label: "My system", icon: MapIcon },
    { id: "audits", label: "Audit results", icon: ClipboardCheck },
    { id: "request", label: "Request service", icon: MessageSquarePlus },
  ];
  return (
    <div className="min-h-screen bg-canvas">
      <Brand><span className="hidden text-right text-[12.5px] sm:block"><span className="block font-medium text-slate-800">{customerName(c)}</span><span className="text-slate-500">{c.email}</span></span></Brand>
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setQueryParam("tab", t.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium", tab === t.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
              <t.icon size={14} /> {t.label} {t.n ? <span className={cn("rounded-full px-1.5 text-[11px]", tab === t.id ? "bg-white/25" : "bg-slate-100")}>{t.n}</span> : null}
            </button>
          ))}
        </div>
        {tab === "home" && (
          <div className="grid gap-3 md:grid-cols-3">
            <PortalCard title="Hi, welcome back" className="md:col-span-3">
              <p className="text-[14px] text-slate-700">{customerName(c)} · {props.map((p) => addressFull(p.address)).join(" · ")}</p>
            </PortalCard>
            <PortalCard title="Estimates awaiting your approval">
              {pending.length ? pending.map((e) => <button key={e.id} onClick={() => { setQueryParam("tab", "estimates"); setQueryParam("estimate", e.id); }} className="mb-1.5 flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-left text-[13px]"><span>{e.title}</span><ChevronRight size={14} /></button>) : <p className="text-[13px] text-slate-500">Nothing to approve.</p>}
            </PortalCard>
            <PortalCard title="Next appointment">
              {upcoming[0] ? <div className="text-[13px]"><div className="text-[15px] font-semibold">{new Date(upcoming[0].scheduledStart!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div><div className="text-slate-600">Arrival window {upcoming[0].arrivalWindow}</div><div className="mt-1 text-slate-600">{upcoming[0].title}</div></div> : <p className="text-[13px] text-slate-500">No upcoming appointments.</p>}
            </PortalCard>
            <PortalCard title="Balance due">
              <div className="text-[24px] font-semibold">{money(balance)}</div>
              {balance > 0 && <Button variant="primary" className="mt-2" onClick={() => setQueryParam("tab", "invoices")}><CreditCard size={14} /> Pay now</Button>}
            </PortalCard>
          </div>
        )}
        {tab === "estimates" && <PortalEstimates customerId={c.id} />}
        {tab === "appointments" && (
          <PortalCard title="Appointments">
            {[...upcoming, ...jobs.filter((j) => j.status === "completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 8)].map((j) => (
              <div key={j.id} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
                <div><div className="text-[14px] font-medium">{j.title}</div><div className="text-[12.5px] text-slate-500">{j.scheduledStart ? `${new Date(j.scheduledStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${j.status === "completed" ? `completed ${date(j.completedAt)}` : j.arrivalWindow}` : "Being scheduled"} · {fullName(data.employees.find((e) => e.id === j.assignedTo))}</div></div>
                <StatusBadge list={JOB_STATUSES} value={j.status} />
              </div>
            ))}
            {!jobs.length && <p className="text-[13px] text-slate-500">No appointments yet.</p>}
          </PortalCard>
        )}
        {tab === "invoices" && <PortalInvoices customerId={c.id} />}
        {tab === "photos" && <PortalCard title="Photos from your service visits"><PhotoGallery photos={photos} /></PortalCard>}
        {tab === "system" && (
          <div className="space-y-3">
            {props.map((p) => {
              const sys = data.systems.find((s) => s.propertyId === p.id);
              const zones = data.zones.filter((z) => z.systemId === sys?.id).sort((a, b) => a.number - b.number);
              return (
                <PortalCard key={p.id} title={addressFull(p.address)} pad={false}>
                  {sys && data.components.some((x) => x.systemId === sys.id) && <div className="p-3"><SystemMap system={sys} property={p} readOnly height={460} /></div>}
                  <ZoneMiniTable zones={zones} />
                </PortalCard>
              );
            })}
          </div>
        )}
        {tab === "audits" && (
          <div className="space-y-3">
            {audits.map((a) => { const r = auditScore(a); return (
              <PortalCard key={a.id} title={`Irrigation audit — ${date(a.date)}`}>
                <div className="flex flex-wrap gap-6"><div><div className="text-[12px] text-slate-500">System score</div><div className="text-[26px] font-semibold">{r.overall} <span className="text-[14px]">({r.grade})</span></div></div><div><div className="text-[12px] text-slate-500">Water efficiency</div><div className="text-[26px] font-semibold">{r.efficiency}</div></div><div><div className="text-[12px] text-slate-500">Potential savings</div><div className="text-[26px] font-semibold">{r.savingsPct}%</div></div></div>
                <div className="mt-3 text-[13px] font-semibold">Recommendations</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-slate-700">{[...r.repairs, ...r.upgrades].map((x, i) => <li key={i}>{x.text}</li>)}</ul>
              </PortalCard>
            ); })}
            {!audits.length && <PortalCard title="Audit results"><p className="text-[13px] text-slate-500">No audits yet — ask us about an irrigation efficiency audit.</p></PortalCard>}
          </div>
        )}
        {tab === "request" && <ServiceRequestForm customerId={c.id} />}
      </div>
      <Toasts />
      <AskHost />
    </div>
  );
}

function PortalCard({ title, children, className, pad = true }: { title: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white", className)}>
      <h2 className="border-b border-slate-100 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800">{title}</h2>
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

function PortalEstimates({ customerId }: { customerId: string }) {
  const st = useCrm();
  const q = useQuery();
  const list = st.data.estimates.filter((e) => e.customerId === customerId && e.status !== "draft").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = list.find((e) => e.id === q.get("estimate")) ?? list.find((e) => ["sent", "viewed"].includes(e.status));
  const [choice, setChoice] = useState<string>();
  const [signing, setSigning] = useState(false);
  useEffect(() => {
    if (open) st.markEstimateViewed(open.id);
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return <PortalCard title="Estimates"><Empty title="No estimates" /></PortalCard>;
  const sel = choice ?? open.selectedOptionId ?? (open.options.find((o) => o.tier === "better") ?? open.options[0]).id;
  const actionable = ["sent", "viewed"].includes(open.status);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
      <PortalCard title={<span className="flex items-center justify-between gap-2">Estimate #{open.number} — {open.title}<Badge tone={open.status === "approved" ? "green" : open.status === "declined" ? "red" : "amber"}>{open.status === "viewed" || open.status === "sent" ? "Awaiting approval" : open.status}</Badge></span>}>
        {open.options.length > 1 && <p className="mb-3 text-[13px] text-slate-600">Choose the option that fits your property and budget:</p>}
        <div className={cn("grid gap-3", open.options.length > 1 && "md:grid-cols-3")}>
          {open.options.map((o) => {
            const t = optionTotals(open, o);
            const active = sel === o.id;
            return (
              <button key={o.id} disabled={!actionable} onClick={() => setChoice(o.id)} className={cn("relative rounded-2xl border p-4 text-left transition-all", active ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500" : "border-slate-200 hover:border-slate-300")}>
                {o.tier === "better" && open.options.length > 1 && <span className="absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10.5px] font-bold text-amber-950"><Star size={10} className="fill-current" /> Recommended</span>}
                <div className="text-[14px] font-semibold text-slate-900">{o.name}</div>
                <div className="mt-1 text-[22px] font-semibold">{money(t.total)}</div>
                {t.deposit > 0 && <div className="text-[12px] text-slate-500">{money(t.deposit)} deposit to schedule</div>}
                <p className="mt-2 text-[12.5px] text-slate-600">{o.description}</p>
                <ul className="mt-2 space-y-0.5 text-[12px] text-slate-600">{o.items.slice(0, 8).map((i) => <li key={i.id}>• {i.qty > 1 ? `${i.qty} ${i.unit} ` : ""}{i.name}</li>)}{o.items.length > 8 && <li className="text-slate-400">+ {o.items.length - 8} more</li>}</ul>
              </button>
            );
          })}
        </div>
        {open.customerNotes && <p className="mt-3 text-[13px] text-slate-700">{open.customerNotes}</p>}
        <p className="mt-3 text-[11.5px] text-slate-500">{open.terms}</p>
        {actionable ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" variant="primary" onClick={() => setSigning(true)}><CheckCircle2 size={16} /> Approve & sign</Button>
            <Button size="lg" onClick={() => { st.sendMessage({ customerId, channel: "portal", direction: "in", body: `Question about estimate #${open.number}`, status: "received" }); st.notify({ type: "customer_reply", title: `Question from ${customerName(st.data.customers.find((x) => x.id === customerId))}`, body: `Estimate #${open.number}`, link: `/estimates/${open.id}` }); toast("We'll reach out shortly", "success"); }}>I have a question</Button>
          </div>
        ) : open.signature ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">Approved by {open.signature.name} on {date(open.signature.signedAt)}. Thank you!</div>
        ) : null}
      </PortalCard>
      <PortalCard title="All estimates">
        {list.map((e) => <button key={e.id} onClick={() => setQueryParam("estimate", e.id)} className={cn("mb-1 block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px]", e.id === open.id ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50")}><div className="font-medium">#{e.number} {e.title}</div><div className="text-slate-500">{date(e.createdAt)} · {e.status}</div></button>)}
      </PortalCard>
      {signing && (
        <Modal open onClose={() => setSigning(false)} title="Approve estimate" subtitle={open.options.find((o) => o.id === sel)?.name} width={560}>
          <SignaturePad name={fullName(st.data.customers.find((x) => x.id === customerId))} onSave={(sig) => { st.approveEstimate(open.id, sel, sig); setSigning(false); toast("Approved — we'll be in touch to schedule!", "success"); }} />
        </Modal>
      )}
    </div>
  );
}

function PortalInvoices({ customerId }: { customerId: string }) {
  const st = useCrm();
  const { data, now } = st;
  const q = useQuery();
  const list = data.invoices.filter((i) => i.customerId === customerId && i.status !== "draft" && i.status !== "void").sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const [paying, setPaying] = useState<string | null>(q.get("invoice"));
  const inv = list.find((i) => i.id === paying);
  useEffect(() => {
    if (inv && !inv.viewedAt) st.update("invoices", inv.id, { viewedAt: new Date().toISOString(), status: inv.status === "sent" ? "viewed" : inv.status });
  }, [inv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PortalCard title="Invoices" pad={false}>
      <div className="divide-y divide-slate-100">
        {list.map((i) => {
          const t = invoiceTotals(i, data.payments, now);
          return (
            <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">INV-{i.number}{i.kind === "deposit" ? " · Deposit" : ""}</div><div className="text-[12.5px] text-slate-500">{date(i.issueDate)} · {i.notes}</div></div>
              <div className="text-right"><div className="text-[14px] font-semibold">{money(t.balance > 0 ? t.balance : t.total)}</div><div className={cn("text-[12px]", t.status === "overdue" ? "text-red-600" : t.balance > 0 ? "text-amber-700" : "text-emerald-700")}>{t.balance > 0 ? (t.status === "overdue" ? "Overdue" : `Due ${date(i.dueDate)}`) : "Paid"}</div></div>
              {t.balance > 0 && <Button variant="primary" onClick={() => setPaying(i.id)}><CreditCard size={14} /> Pay</Button>}
            </div>
          );
        })}
        {!list.length && <p className="px-4 py-6 text-[13px] text-slate-500">No invoices.</p>}
      </div>
      {inv && <PayModal invoiceId={inv.id} onClose={() => setPaying(null)} />}
    </PortalCard>
  );
}

function PayModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const st = useCrm();
  const inv = st.data.invoices.find((i) => i.id === invoiceId)!;
  const t = invoiceTotals(inv, st.data.payments);
  const [method, setMethod] = useState<"card" | "ach">("card");
  const [card, setCard] = useState("");
  return (
    <Modal open onClose={onClose} title={`Pay INV-${inv.number}`} width={440} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={method === "card" && card.replace(/\D/g, "").length < 12} onClick={() => { st.recordPayment({ invoiceId, customerId: inv.customerId, amount: t.balance, method, reference: method === "card" ? `•••• ${card.replace(/\D/g, "").slice(-4)}` : "Portal ACH", isDeposit: inv.kind === "deposit", note: "Paid in customer portal", processor: { provider: "stripe", fee: Math.round((t.balance * (method === "card" ? 0.029 : 0.008) + (method === "card" ? 0.3 : 0)) * 100) / 100 } }); toast("Payment received — thank you!", "success"); onClose(); }}>Pay {money(t.balance)}</Button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">{(["card", "ach"] as const).map((m) => <button key={m} onClick={() => setMethod(m)} className={cn("flex-1 rounded-xl border py-2.5 text-[13px] font-semibold", method === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200")}>{m === "card" ? "Card" : "Bank (ACH)"}</button>)}</div>
        {method === "card" ? <Field label="Card number"><Input value={card} onChange={(e) => setCard(e.target.value)} placeholder="4242 4242 4242 4242" inputMode="numeric" /></Field> : <p className="text-[13px] text-slate-600">You'll be redirected to link your bank securely.</p>}
        <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500"><Lock size={12} /> Demo checkout — live payments run through Stripe once connected.</p>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Service request (portal + public booking) ───────────────────────── */

export function ServiceRequestForm({ customerId, onDone }: { customerId?: string; onDone?: () => void }) {
  const st = useCrm();
  const c = st.data.customers.find((x) => x.id === customerId);
  const p = st.data.properties.find((x) => x.customerId === customerId);
  const [f, setF] = useState({ firstName: c?.firstName ?? "", lastName: c?.lastName ?? "", phone: c?.phone ?? "", email: c?.email ?? "", street: p?.address.street ?? "", city: p?.address.city ?? "", zip: p?.address.zip ?? "", serviceType: "sprinkler_repair" as ServiceType, description: "", urgency: "normal" as "normal" | "low" | "high" | "emergency", preferredDates: "", source: (customerId ? "repeat" : "google") as LeadSource });
  const [photos, setPhotos] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const outOfArea = f.zip.length === 5 && !st.settings.serviceAreas.some((a) => a.zips.includes(f.zip));
  if (done)
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-600" />
        <h2 className="text-[18px] font-semibold">Request received!</h2>
        <p className="mt-1 text-[14px] text-slate-600">Thanks {f.firstName} — we&apos;ll call or text you within one business hour{f.urgency === "emergency" ? " (emergencies are prioritized)" : ""}.</p>
        <p className="mt-3 text-[13px] text-slate-500">Need us now? Call <a href={`tel:${st.settings.phone}`} className="font-medium text-brand-700">{st.settings.phone}</a></p>
      </div>
    );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-[17px] font-semibold text-slate-900">Request irrigation service</h2>
      <p className="mb-4 text-[13px] text-slate-500">Tell us what&apos;s going on — photos help us bring the right parts.</p>
      <div className="space-y-3">
        {!customerId && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="First name" required><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className="h-10" /></Field>
            <Field label="Last name"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className="h-10" /></Field>
            <Field label="Phone" required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" className="h-10" /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" className="h-10" /></Field>
          </div>
        )}
        <div className="grid grid-cols-6 gap-2">
          <Field label="Service address" required className="col-span-6"><Input value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} className="h-10" /></Field>
          <Field label="City" className="col-span-4"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="h-10" /></Field>
          <Field label="ZIP" className="col-span-2"><Input value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} inputMode="numeric" className="h-10" /></Field>
        </div>
        {outOfArea && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">This ZIP is outside our usual service area — we&apos;ll confirm availability.</p>}
        <Field label="What do you need?" required>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SERVICE_TYPES.filter((s) => !["upgrade", "trenching", "winterization"].includes(s.id)).map((s) => (
              <button key={s.id} type="button" onClick={() => setF({ ...f, serviceType: s.id })} className={cn("rounded-lg border px-2.5 py-2 text-left text-[12.5px]", f.serviceType === s.id ? "border-brand-500 bg-brand-50 font-medium text-brand-800" : "border-slate-200 hover:border-slate-300")}>{s.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Describe the problem"><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Water bubbling up near the driveway, zone 3 won't turn off…" /></Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Urgency">
            <div className="grid grid-cols-4 gap-1">{(["low", "normal", "high", "emergency"] as const).map((u) => <button key={u} type="button" onClick={() => setF({ ...f, urgency: u })} className={cn("rounded-lg border py-2 text-[12px] capitalize", f.urgency === u ? (u === "emergency" ? "border-red-500 bg-red-50 font-semibold text-red-700" : "border-brand-500 bg-brand-50 font-semibold text-brand-700") : "border-slate-200")}>{u}</button>)}</div>
          </Field>
          <Field label="Preferred dates / times"><Input value={f.preferredDates} onChange={(e) => setF({ ...f, preferredDates: e.target.value })} placeholder="Weekday mornings, not Friday" className="h-10" /></Field>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Photos</div>
          <div className="flex flex-wrap gap-2">
            {photos.map((u, i) => <img key={i} src={u} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />)}
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-[11px] text-slate-500 hover:border-brand-400"><Upload size={16} /> Add</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={async (e) => { const out: string[] = []; for (const file of [...(e.target.files ?? [])]) out.push(await crmRepo.uploadFile(file, `requests/${Date.now()}-${file.name}`)); setPhotos([...photos, ...out]); }} />
          </div>
        </div>
        {!customerId && <Field label="How did you hear about us?"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })} options={LEAD_SOURCES.filter((s) => s.id !== "repeat").map((s) => ({ value: s.id, label: s.label }))} className="h-10" /></Field>}
        <Button
          size="lg"
          variant="primary"
          className="h-12 w-full text-[15px]"
          disabled={!f.firstName || !f.phone || !f.street}
          onClick={() => {
            const lead = st.createLead({ firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email, address: { street: f.street, city: f.city, state: "CA", zip: f.zip }, serviceType: f.serviceType, description: f.description, urgency: f.urgency, preferredDates: f.preferredDates, source: customerId ? "repeat" : f.source, customerId, propertyId: p?.id, estimatedValue: 0, notes: outOfArea ? "Outside service area" : "" });
            for (const url of photos) st.insert("photos", { id: uid("pho"), url, caption: "Customer photo", category: "problem", entityType: "lead", entityId: lead.id, customerId, propertyId: p?.id, takenAt: new Date().toISOString(), annotations: [] });
            if (photos.length) st.update("leads", lead.id, { photoIds: photos.map((_, i) => `${lead.id}-${i}`) });
            setDone(true);
            onDone?.();
          }}
        >
          Submit request
        </Button>
        <p className="text-center text-[11.5px] text-slate-500">By submitting you agree to be contacted by {st.settings.businessName} by phone, text or email.</p>
      </div>
    </div>
  );
}

export function BookingPage() {
  useCrmBoot();
  const ready = useCrm((s) => s.ready);
  const s = useCrm((x) => x.settings);
  return (
    <div className="min-h-screen bg-canvas">
      <Brand />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1fr_300px]">
        {ready ? <ServiceRequestForm /> : <div className="py-20 text-center text-slate-500">Loading…</div>}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px]">
            <div className="mb-2 font-semibold">Why homeowners choose us</div>
            <ul className="space-y-1.5 text-slate-600">{["Licensed C-27 contractor", "Same-week repairs", "Upfront, option-based pricing", "1-year labor warranty", "Smart controller rebate experts"].map((x) => <li key={x} className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" />{x}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px]">
            <div className="mb-1 font-semibold">Talk to a person</div>
            <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-brand-700"><Phone size={14} /> {phone(s.phone)}</a>
            <a href={`mailto:${s.email}`} className="mt-1 flex items-center gap-1.5 text-brand-700"><Mail size={14} /> {s.email}</a>
            <div className="mt-2 text-slate-500">Serving {s.serviceAreas.map((a) => a.name).join(", ")}</div>
          </div>
          <Link href="/portal" className="block rounded-2xl border border-slate-200 bg-white p-4 text-[13px] font-medium text-brand-700 hover:bg-slate-50">Existing customer? Open your portal →</Link>
        </aside>
      </div>
      <Toasts />
    </div>
  );
}


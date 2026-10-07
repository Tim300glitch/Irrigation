"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, CheckCircle2, XCircle, Wrench, Printer, Copy, Trash2, ExternalLink, RefreshCw, LayoutTemplate, Star, PenLine, Eye, Download } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Estimate, EstimateOption, Signature, ServiceType } from "@/lib/crm/types";
import { ESTIMATE_STATUSES, SERVICE_TYPES, serviceLabel, statusTone } from "@/lib/crm/constants";
import { addressFull, customerName, date, money, money0, pct, relative, phone } from "@/lib/crm/format";
import { estimateTotal, optionTotals, primaryOption, type OptionTotals } from "@/lib/crm/calc";
import { optionsFromTemplate, repriceLines, uid } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Button, Badge, Tabs, SearchBox, Select, Field, Input, Textarea, Modal, cn, StatusBadge, useQuery, setQueryParam, Empty, NumberInput, KV } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { LineItemsEditor } from "../LineItems";
import { SignaturePad, Timeline } from "../widgets";
import { saveFile } from "@/lib/saveFile";
import { estimatePdf, pdfName } from "@/lib/pdf/crmPdf";
import { useQuickCreate } from "../QuickCreate";
import { ask } from "@/components/AskHost";
import { toast } from "@/lib/crm/toast";

export function EstimatesPage() {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const status = q.get("status") ?? "open";
  const [search, setSearch] = useState("");
  const cust = byId(data.customers);
  const jobs = byId(data.jobs);
  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return data.estimates
      .filter((e) => {
        if (status === "open" && !["sent", "viewed"].includes(e.status)) return false;
        if (status === "approved_unscheduled" && !(e.status === "approved" && (!e.jobId || jobs.get(e.jobId)?.status === "unscheduled"))) return false;
        if (!["all", "open", "approved_unscheduled"].includes(status) && e.status !== status) return false;
        if (t && !`${e.number} ${e.title} ${customerName(cust.get(e.customerId))}`.toLowerCase().includes(t)) return false;
        return true;
      })
      .map((e) => ({ ...e, total: estimateTotal(e) }));
  }, [data.estimates, status, search, cust, jobs]);
  const count = (f: (e: Estimate) => boolean) => data.estimates.filter(f).length;
  const sum = rows.reduce((s, e) => s + e.total, 0);
  return (
    <Page>
      <PageHeader
        title="Estimates"
        subtitle={`${rows.length} shown · ${money0(sum)}`}
        actions={
          <>
            <Button onClick={() => downloadText("estimates.csv", toCsv(rows, [{ header: "Number", value: (e) => e.number }, { header: "Title", value: (e) => e.title }, { header: "Customer", value: (e) => customerName(cust.get(e.customerId)) }, { header: "Status", value: (e) => e.status }, { header: "Total", value: (e) => e.total.toFixed(2) }, { header: "Created", value: (e) => e.createdAt.slice(0, 10) }]))}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => openQuick("estimate")}>
              <Plus size={15} /> New estimate
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-3"
        value={status}
        onChange={(s) => setQueryParam("status", s)}
        tabs={[
          { id: "open", label: "Awaiting approval", count: count((e) => ["sent", "viewed"].includes(e.status)) },
          { id: "draft", label: "Drafts", count: count((e) => e.status === "draft") },
          { id: "approved_unscheduled", label: "Approved, not scheduled", count: count((e) => e.status === "approved" && (!e.jobId || jobs.get(e.jobId)?.status === "unscheduled")) },
          { id: "approved", label: "Approved" },
          { id: "declined", label: "Declined" },
          { id: "all", label: "All" },
        ]}
      />
      <Card pad={false}>
        <div className="border-b border-slate-100 p-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Search estimates…" className="w-full sm:w-72" />
        </div>
        <DataTable
          rows={rows}
          onRowClick={(e) => router.push(`/estimates/${e.id}`)}
          initialSort={{ key: "created", dir: "desc" }}
          empty={<Empty title="No estimates here" />}
          columns={[
            { key: "num", header: "Estimate", mobile: true, sort: (e) => e.number, cell: (e) => <div><div className="font-medium text-slate-900">#{e.number} {e.title}</div><div className="text-[11.5px] text-slate-500">{serviceLabel(e.serviceType)}{e.options.length > 1 ? ` · ${e.options.length} options` : ""}</div></div> },
            { key: "total", header: "Total", align: "right", mobile: true, sort: (e) => e.total, cell: (e) => <span className="font-medium">{money0(e.total)}</span> },
            { key: "cust", header: "Customer", mobile: true, sort: (e) => customerName(cust.get(e.customerId)), cell: (e) => customerName(cust.get(e.customerId)) },
            { key: "status", header: "Status", sort: (e) => e.status, cell: (e) => <StatusBadge list={ESTIMATE_STATUSES} value={e.status} /> },
            { key: "sent", header: "Sent", hideBelow: "md", sort: (e) => e.sentAt ?? "", cell: (e) => <span className="text-slate-500">{e.sentAt ? relative(e.sentAt, now) : "—"}</span> },
            { key: "fu", header: "Last follow-up", hideBelow: "lg", cell: (e) => <span className="text-slate-500">{e.lastFollowUpAt ? relative(e.lastFollowUpAt, now) : "—"}</span> },
            { key: "created", header: "Created", hideBelow: "md", sort: (e) => e.createdAt, cell: (e) => <span className="text-slate-500">{date(e.createdAt)}</span> },
          ]}
        />
      </Card>
    </Page>
  );
}

export function EstimateBuilder({ id }: { id: string }) {
  const st = useCrm();
  const { data, settings, update, now } = st;
  const router = useRouter();
  const e = data.estimates.find((x) => x.id === id);
  const [optId, setOptId] = useState<string | undefined>();
  const [signing, setSigning] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  if (!e) return <Page><Empty title="Estimate not found" /></Page>;
  const c = data.customers.find((x) => x.id === e.customerId);
  const p = data.properties.find((x) => x.id === e.propertyId);
  const opt = e.options.find((o) => o.id === optId) ?? e.options.find((o) => o.id === e.selectedOptionId) ?? e.options[0];
  const totals = opt ? optionTotals(e, opt) : undefined;
  const locked = e.status === "approved" || e.status === "declined";
  const set = (patch: Partial<Estimate>) => update("estimates", id, patch);
  const setOpt = (o: EstimateOption) => set({ options: e.options.map((x) => (x.id === o.id ? o : x)) });
  const job = e.jobId ? data.jobs.find((j) => j.id === e.jobId) : undefined;
  const itemMap = new Map(data.items.map((i) => [i.id, i]));

  return (
    <Page wide>
      <PageHeader
        back={{ href: "/estimates", label: "Estimates" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">#{e.number}</span>
            <input value={e.title} disabled={locked} onChange={(ev) => set({ title: ev.target.value })} style={{ width: `${Math.max(12, e.title.length + 2)}ch` }} className="max-w-full rounded-md border border-transparent bg-transparent px-1 text-[19px] font-semibold tracking-tight text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:outline-none disabled:hover:border-transparent" />
            <StatusBadge list={ESTIMATE_STATUSES} value={e.status} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-3">
            <Link href={`/customers/${c?.id}`} className="font-medium text-slate-700 hover:text-brand-700">{customerName(c)}</Link>
            <Link href={`/properties/${p?.id}`} className="hover:text-brand-700">{addressFull(p?.address)}</Link>
            <span>Created {date(e.createdAt)}</span>
            {e.sentAt && <span>Sent {relative(e.sentAt, now)}</span>}
            {e.viewedAt && <span className="flex items-center gap-1"><Eye size={12} /> Viewed {relative(e.viewedAt, now)}</span>}
          </span>
        }
        actions={
          <>
            <Button onClick={() => saveFile(estimatePdf(e, c, p, settings), pdfName(`Estimate ${e.number} ${customerName(c)}`))}><Printer size={14} /> Download PDF</Button>
            <Button onClick={() => { const n = st.duplicateEstimate(id); router.push(`/estimates/${n.id}`); }}><Copy size={14} /> Duplicate</Button>
            <Link href={`/portal?c=${e.customerId}&estimate=${e.id}`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><ExternalLink size={13} /> Customer view</Link>
            {!locked && <Button onClick={() => st.sendEstimate(id)}><Send size={14} /> {e.sentAt ? "Resend" : "Send"}</Button>}
            {!locked && (
              <Button variant="danger" onClick={async () => { const r = await ask.prompt("Reason for decline (optional)", ""); if (r !== null) st.declineEstimate(id, r || undefined); }}>
                <XCircle size={14} /> Decline
              </Button>
            )}
            {!locked && <Button variant="primary" onClick={() => setSigning(true)}><CheckCircle2 size={14} /> Approve</Button>}
            {e.status === "approved" && (job ? <Button variant="primary" onClick={() => router.push(`/jobs/${job.id}`)}><Wrench size={14} /> Job #{job.number}</Button> : <Button variant="primary" onClick={() => router.push(`/jobs/${st.convertEstimateToJob(id)}`)}><Wrench size={14} /> Convert to job</Button>)}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-3">
          <Card pad={false}>
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 pt-2">
              {e.options.map((o, i) => {
                const t = optionTotals(e, o);
                const active = o.id === opt?.id;
                return (
                  <button key={o.id} onClick={() => setOptId(o.id)} className={cn("-mb-px min-w-[150px] rounded-t-lg border border-b-0 px-3 py-2 text-left", active ? "border-slate-200 bg-white" : "border-transparent text-slate-500 hover:bg-slate-50")}>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800">
                      {e.selectedOptionId === o.id && e.status === "approved" && <CheckCircle2 size={13} className="text-emerald-600" />}
                      {o.tier === "better" && e.options.length > 1 && <Star size={12} className="fill-amber-400 text-amber-400" />}
                      Option {i + 1}{o.tier ? ` · ${o.tier[0].toUpperCase()}${o.tier.slice(1)}` : ""}
                    </div>
                    <div className="tabular text-[12px] text-slate-500">{money0(t.total)} · {pct(t.marginPct)} margin</div>
                  </button>
                );
              })}
              {!locked && (
                <button onClick={() => { const o: EstimateOption = { id: uid("opt"), name: `Option ${e.options.length + 1}`, description: "", tier: (["good", "better", "best"] as const)[e.options.length] ?? undefined, items: (opt?.items ?? []).map((l) => ({ ...l, id: uid("li") })) }; set({ options: [...e.options, o] }); setOptId(o.id); }} className="mb-1 ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-50">
                  <Plus size={13} /> Add option
                </button>
              )}
            </div>
            {opt && (
              <div className="p-4">
                <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_140px]">
                  <Field label="Option name"><Input disabled={locked} value={opt.name} onChange={(ev) => setOpt({ ...opt, name: ev.target.value })} placeholder="Repair existing system" /></Field>
                  <Field label="Tier"><Select disabled={locked} value={opt.tier ?? ""} onChange={(ev) => setOpt({ ...opt, tier: (ev.target.value || undefined) as EstimateOption["tier"] })} options={[{ value: "", label: "—" }, { value: "good", label: "Good" }, { value: "better", label: "Better (recommended)" }, { value: "best", label: "Best" }]} /></Field>
                  <Field label="Description shown to customer" className="sm:col-span-2"><Textarea disabled={locked} value={opt.description} onChange={(ev) => setOpt({ ...opt, description: ev.target.value })} rows={2} /></Field>
                </div>
                <LineItemsEditor items={opt.items} readOnly={locked} onChange={(items) => setOpt({ ...opt, items })} serviceType={e.serviceType} />
                {!locked && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Button size="sm" variant="ghost" onClick={() => setTplOpen(true)}><LayoutTemplate size={13} /> Load template</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setOpt({ ...opt, items: repriceLines(opt.items, itemMap) }); toast("Prices updated from price book", "success"); }}><RefreshCw size={13} /> Reprice from price book</Button>
                    {e.options.length > 1 && <Button size="sm" variant="ghost" onClick={async () => { if (await ask.confirm(`Remove ${opt.name}?`, true)) { set({ options: e.options.filter((x) => x.id !== opt.id) }); setOptId(undefined); } }}><Trash2 size={13} /> Remove option</Button>}
                  </div>
                )}
              </div>
            )}
          </Card>
          {e.options.length > 1 && <OptionCompare e={e} />}
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Customer notes"><Textarea disabled={locked} value={e.customerNotes} onChange={(ev) => set({ customerNotes: ev.target.value })} rows={4} placeholder="Shown on the estimate" /></Card>
            <Card title="Internal notes"><Textarea value={e.internalNotes} onChange={(ev) => set({ internalNotes: ev.target.value })} rows={4} placeholder="Only visible to your team" /></Card>
          </div>
          <Card title="Terms"><Textarea disabled={locked} value={e.terms} onChange={(ev) => set({ terms: ev.target.value })} rows={3} /></Card>
        </div>

        <div className="space-y-3">
          {totals && <TotalsCard e={e} t={totals} />}
          <Card title="Pricing settings">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Service type" className="col-span-2"><Select disabled={locked} value={e.serviceType} onChange={(ev) => set({ serviceType: ev.target.value as ServiceType })} options={SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label }))} /></Field>
              <Field label="Tax %"><NumberInput disabled={locked} value={e.taxPct} onChange={(v) => set({ taxPct: v })} step={0.25} min={0} /></Field>
              <Field label="Deposit %"><NumberInput disabled={locked} value={e.depositPct} onChange={(v) => set({ depositPct: v })} step={5} min={0} max={100} /></Field>
              <Field label="Discount">
                <div className="flex gap-1">
                  <NumberInput disabled={locked} value={e.discount.value} onChange={(v) => set({ discount: { ...e.discount, value: v } })} min={0} className="flex-1" />
                  <Select disabled={locked} value={e.discount.type} onChange={(ev) => set({ discount: { ...e.discount, type: ev.target.value as "pct" } })} options={[{ value: "amount", label: "$" }, { value: "pct", label: "%" }]} className="w-16 px-2" />
                </div>
              </Field>
              <Field label="Valid until"><Input disabled={locked} type="date" value={e.validUntil ?? ""} onChange={(ev) => set({ validUntil: ev.target.value })} /></Field>
              <Field label="Trip charge"><NumberInput disabled={locked} value={e.tripCharge} onChange={(v) => set({ tripCharge: v })} min={0} /></Field>
              <Field label="Diagnostic fee"><NumberInput disabled={locked} value={e.diagnosticFee} onChange={(v) => set({ diagnosticFee: v })} min={0} /></Field>
            </div>
            {!locked && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] hover:bg-slate-200" onClick={() => set({ diagnosticFee: settings.diagnosticFee })}>+ Diagnostic {money0(settings.diagnosticFee)}</button>
                <button className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] hover:bg-slate-200" onClick={() => set({ depositPct: settings.defaultDepositPct })}>{settings.defaultDepositPct}% deposit</button>
                <button className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] hover:bg-slate-200" onClick={() => set({ discount: { type: "pct", value: 10, reason: "Maintenance plan member" } })}>10% plan discount</button>
              </div>
            )}
          </Card>
          {e.signature && (
            <Card title="Customer approval">
              {e.signature.dataUrl ? <img src={e.signature.dataUrl} alt="Signature" className="h-16 rounded border border-slate-200" style={{ backgroundColor: "#ffffff" }} /> : null}
              <KV cols={2} className="mt-2" items={[["Signed by", e.signature.name], ["Date", date(e.signature.signedAt)], ["Option", e.options.find((o) => o.id === e.selectedOptionId)?.name]]} />
            </Card>
          )}
          <Card title="Activity"><Timeline entries={data.activity.filter((a) => a.entityId === id)} limit={10} /></Card>
          {c && (
            <Card title="Customer">
              <KV cols={1} items={[["Name", customerName(c)], ["Phone", phone(c.phone)], ["Email", c.email]]} />
            </Card>
          )}
        </div>
      </div>

      {signing && (
        <Modal open onClose={() => setSigning(false)} title="Customer approval" subtitle="Choose the option the customer approved and capture their signature." width={620}>
          <ApproveForm
            e={e}
            onDone={(optionId, sig) => {
              const jobId = st.approveEstimate(id, optionId, sig);
              setSigning(false);
              toast(`Estimate approved — job created`, "success", jobId ? { label: "Open job", href: `/jobs/${jobId}` } : undefined);
            }}
          />
        </Modal>
      )}
      {tplOpen && (
        <Modal open onClose={() => setTplOpen(false)} title="Load template" subtitle="Replaces the line items of the current option (multi-option templates add all options)." width={640}>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.estimateTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  const opts = optionsFromTemplate(t, itemMap);
                  if (opts.length > 1) set({ options: opts, serviceType: t.serviceType, title: e.title === "Irrigation estimate" ? t.name : e.title });
                  else if (opt) setOpt({ ...opt, items: opts[0].items, description: opt.description || opts[0].description });
                  setOptId(undefined);
                  setTplOpen(false);
                }}
                className="rounded-lg border border-slate-200 p-3 text-left hover:border-brand-400 hover:bg-brand-50/40"
              >
                <div className="text-[13px] font-medium text-slate-900">{t.name}</div>
                <div className="text-[12px] text-slate-500">{t.description}</div>
                <div className="mt-1 text-[11.5px] text-slate-400">{t.options.length} option{t.options.length > 1 ? "s" : ""}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </Page>
  );
}

function TotalsCard({ e, t }: { e: Estimate; t: OptionTotals }) {
  const row = (l: string, v: string, cls = "") => (
    <div className={cn("flex items-center justify-between py-1 text-[12.5px]", cls)}>
      <span className="text-slate-600">{l}</span>
      <span className="tabular text-slate-900">{v}</span>
    </div>
  );
  const marginTone = t.marginPct >= 0.45 ? "text-emerald-700" : t.marginPct >= 0.3 ? "text-amber-700" : "text-red-600";
  return (
    <Card title="Totals" sub={primaryOption(e)?.name}>
      <div className="divide-y divide-slate-100">
        <div className="pb-1.5">
          {row("Materials", money(t.materialPrice))}
          {row("Labor", `${money(t.laborPrice)}${t.laborHours ? ` · ${t.laborHours} h` : ""}`)}
          {t.equipmentPrice > 0 && row("Equipment", money(t.equipmentPrice))}
          {t.feePrice + t.otherPrice > 0 && row("Fees & other", money(t.feePrice + t.otherPrice))}
        </div>
        <div className="py-1.5">
          {row("Subtotal", money(t.subtotal))}
          {t.discount > 0 && row(`Discount${e.discount.type === "pct" ? ` (${e.discount.value}%)` : ""}`, `−${money(t.discount)}`, "text-emerald-700")}
          {e.tripCharge > 0 && row("Trip charge", money(e.tripCharge))}
          {e.diagnosticFee > 0 && row("Diagnostic fee", money(e.diagnosticFee))}
          {row(`Tax (${e.taxPct}% on taxable)`, money(t.tax))}
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[13px] font-semibold text-slate-900">Total</span>
          <span className="tabular text-[20px] font-semibold tracking-tight text-slate-900">{money(t.total)}</span>
        </div>
        {t.deposit > 0 && row(`Deposit (${e.depositPct}%)`, money(t.deposit))}
      </div>
      <div className="mt-2 rounded-lg bg-slate-50 p-3">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Internal — profitability</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          <span className="text-slate-500">Material cost</span><span className="tabular text-right">{money(t.materialCost)}</span>
          <span className="text-slate-500">Labor cost</span><span className="tabular text-right">{money(t.laborCost)}</span>
          {t.equipmentCost > 0 && <><span className="text-slate-500">Equipment cost</span><span className="tabular text-right">{money(t.equipmentCost)}</span></>}
          <span className="text-slate-500">Total cost</span><span className="tabular text-right">{money(t.cost)}</span>
          <span className="font-medium text-slate-700">Gross profit</span><span className="tabular text-right font-semibold">{money(t.grossProfit)}</span>
          <span className="font-medium text-slate-700">Margin</span><span className={cn("tabular text-right font-semibold", marginTone)}>{pct(t.marginPct, 1)}</span>
          <span className="text-slate-500">Markup</span><span className="tabular text-right">{pct(t.markupPct, 0)}</span>
        </div>
      </div>
    </Card>
  );
}

function OptionCompare({ e }: { e: Estimate }) {
  const rows = e.options.map((o) => ({ o, t: optionTotals(e, o) }));
  return (
    <Card title="Good / Better / Best comparison" pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-medium">Option</th>
              <th className="px-2 text-right font-medium">Price</th>
              <th className="px-2 text-right font-medium">Cost</th>
              <th className="px-2 text-right font-medium">Profit</th>
              <th className="px-2 text-right font-medium">Margin</th>
              <th className="px-4 text-right font-medium">Labor hrs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, t }) => (
              <tr key={o.id} className="border-b border-slate-50">
                <td className="px-4 py-2"><div className="font-medium text-slate-900">{o.name}</div><div className="line-clamp-1 text-[11.5px] text-slate-500">{o.description}</div></td>
                <td className="tabular px-2 text-right font-medium">{money0(t.total)}</td>
                <td className="tabular px-2 text-right text-slate-500">{money0(t.cost)}</td>
                <td className="tabular px-2 text-right">{money0(t.grossProfit)}</td>
                <td className={cn("tabular px-2 text-right font-medium", t.marginPct >= 0.45 ? "text-emerald-700" : t.marginPct >= 0.3 ? "text-amber-700" : "text-red-600")}>{pct(t.marginPct)}</td>
                <td className="tabular px-4 text-right">{t.laborHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ApproveForm({ e, onDone }: { e: Estimate; onDone: (optionId: string, sig: Signature) => void }) {
  const c = useCrm((s) => s.data.customers.find((x) => x.id === e.customerId));
  const [optionId, setOptionId] = useState(e.selectedOptionId ?? (e.options.find((o) => o.tier === "better") ?? e.options[0]).id);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {e.options.map((o) => {
          const t = optionTotals(e, o);
          return (
            <button key={o.id} onClick={() => setOptionId(o.id)} className={cn("rounded-xl border p-3 text-left transition-colors", optionId === o.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300")}>
              <div className="text-[12.5px] font-semibold text-slate-900">{o.name}</div>
              <div className="tabular mt-1 text-[17px] font-semibold text-slate-900">{money(t.total)}</div>
              {t.deposit > 0 && <div className="text-[11.5px] text-slate-500">{money(t.deposit)} deposit</div>}
              {o.description && <div className="mt-1 line-clamp-3 text-[11.5px] text-slate-500">{o.description}</div>}
            </button>
          );
        })}
      </div>
      <SignaturePad name={c ? `${c.firstName} ${c.lastName}` : ""} onSave={(sig) => onDone(optionId, sig)} />
    </div>
  );
}



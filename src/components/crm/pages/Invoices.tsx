"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, Printer, CreditCard, Ban, ExternalLink, Download, Bell, Link2 } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Invoice, PaymentMethod } from "@/lib/crm/types";
import { INVOICE_STATUSES } from "@/lib/crm/constants";
import { addressFull, customerName, date, money, money0, relative, dateTime } from "@/lib/crm/format";
import { invoiceTotals } from "@/lib/crm/calc";
import { crmIndex } from "@/lib/crm/metrics";
import { providers } from "@/lib/crm/integrations";
import { Page, PageHeader, Card, Button, Badge, Tabs, SearchBox, Select, Field, Input, Textarea, Modal, cn, StatusBadge, useQuery, setQueryParam, Empty, KV, StatTile, NumberInput } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { LineItemsEditor } from "../LineItems";
import { Timeline, usePrint } from "../widgets";
import { useQuickCreate } from "../QuickCreate";
import { ask } from "@/components/AskHost";
import { toast } from "@/lib/crm/toast";

export function InvoicesPage() {
  const data = useCrm((s) => s.data);
  const settings = useCrm((s) => s.settings);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const status = q.get("status") ?? "open";
  const [search, setSearch] = useState("");
  const cust = byId(data.customers);
  const idx = crmIndex(data, settings);
  const all = useMemo(() => data.invoices.map((i) => ({ ...i, t: invoiceTotals(i, idx.paymentsByInvoice.get(i.id) ?? [], now) })), [data.invoices, idx, now]);
  const rows = all.filter((i) => {
    if (status === "open" && !(i.t.balance > 0 && !["void", "draft"].includes(i.status))) return false;
    if (!["open", "all"].includes(status) && i.t.status !== status) return false;
    if (search && !`inv-${i.number} ${customerName(cust.get(i.customerId))}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const sum = (f: (x: (typeof all)[number]) => boolean, v: (x: (typeof all)[number]) => number) => all.filter(f).reduce((s, x) => s + v(x), 0);
  const ar = sum((i) => i.t.balance > 0 && !["void", "draft"].includes(i.status), (i) => i.t.balance);
  const overdue = sum((i) => i.t.status === "overdue", (i) => i.t.balance);
  const aged = (min: number, max: number) => sum((i) => i.t.status === "overdue" && i.t.daysOverdue > min && i.t.daysOverdue <= max, (i) => i.t.balance);
  return (
    <Page>
      <PageHeader
        title="Invoices"
        actions={
          <>
            <Button onClick={() => downloadText("invoices.csv", toCsv(rows, [{ header: "Invoice", value: (i) => `INV-${i.number}` }, { header: "Customer", value: (i) => customerName(cust.get(i.customerId)) }, { header: "Issued", value: (i) => i.issueDate }, { header: "Due", value: (i) => i.dueDate }, { header: "Status", value: (i) => i.t.status }, { header: "Total", value: (i) => i.t.total.toFixed(2) }, { header: "Paid", value: (i) => i.t.paid.toFixed(2) }, { header: "Balance", value: (i) => i.t.balance.toFixed(2) }]))}><Download size={14} /> Export</Button>
            <Button variant="primary" onClick={() => openQuick("invoice")}><Plus size={15} /> New invoice</Button>
          </>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Accounts receivable" value={money0(ar)} />
        <StatTile label="Overdue" value={money0(overdue)} tone={overdue ? "bad" : "default"} />
        <StatTile label="1–30 days" value={money0(aged(0, 30))} />
        <StatTile label="31–60 days" value={money0(aged(30, 60))} />
        <StatTile label="60+ days" value={money0(aged(60, 9999))} tone={aged(60, 9999) ? "warn" : "default"} />
      </div>
      <Tabs className="mb-3" value={status} onChange={(s) => setQueryParam("status", s)} tabs={[{ id: "open", label: "Outstanding", count: all.filter((i) => i.t.balance > 0 && !["void", "draft"].includes(i.status)).length }, { id: "overdue", label: "Overdue", count: all.filter((i) => i.t.status === "overdue").length }, { id: "draft", label: "Draft", count: all.filter((i) => i.status === "draft").length }, { id: "partial", label: "Partial" }, { id: "paid", label: "Paid" }, { id: "void", label: "Void" }, { id: "all", label: "All" }]} />
      <Card pad={false}>
        <div className="border-b border-slate-100 p-3"><SearchBox value={search} onChange={setSearch} placeholder="Invoice # or customer…" className="w-full sm:w-72" /></div>
        <DataTable
          rows={rows}
          onRowClick={(i) => router.push(`/invoices/${i.id}`)}
          initialSort={{ key: "issued", dir: "desc" }}
          empty={<Empty title="No invoices here" />}
          columns={[
            { key: "num", header: "Invoice", mobile: true, sort: (i) => i.number, cell: (i) => <span className="font-medium text-slate-900">INV-{i.number}{i.kind === "deposit" && <Badge className="ml-1.5" tone="violet">Deposit</Badge>}</span> },
            { key: "bal", header: "Balance", align: "right", mobile: true, sort: (i) => i.t.balance, cell: (i) => <span className={cn("font-medium", i.t.balance > 0 ? "text-slate-900" : "text-slate-400")}>{money(i.t.balance)}</span> },
            { key: "cust", header: "Customer", mobile: true, sort: (i) => customerName(cust.get(i.customerId)), cell: (i) => customerName(cust.get(i.customerId)) },
            { key: "status", header: "Status", cell: (i) => <span className="flex items-center gap-1.5"><StatusBadge list={INVOICE_STATUSES} value={i.t.status} />{i.t.daysOverdue > 0 && <span className="text-[11px] text-red-600">{i.t.daysOverdue}d</span>}</span> },
            { key: "total", header: "Total", align: "right", sort: (i) => i.t.total, cell: (i) => money(i.t.total) },
            { key: "issued", header: "Issued", hideBelow: "md", sort: (i) => i.issueDate, cell: (i) => <span className="text-slate-500">{date(i.issueDate)}</span> },
            { key: "due", header: "Due", hideBelow: "md", sort: (i) => i.dueDate, cell: (i) => <span className={cn(i.t.status === "overdue" ? "text-red-600" : "text-slate-500")}>{date(i.dueDate)}</span> },
          ]}
        />
      </Card>
    </Page>
  );
}

export function InvoiceDetail({ id }: { id: string }) {
  const st = useCrm();
  const { data, update, now } = st;
  const [payOpen, setPayOpen] = useState(false);
  const { print, portal } = usePrint();
  const inv = data.invoices.find((x) => x.id === id);
  if (!inv) return <Page><Empty title="Invoice not found" /></Page>;
  const c = data.customers.find((x) => x.id === inv.customerId);
  const p = data.properties.find((x) => x.id === inv.propertyId);
  const job = data.jobs.find((x) => x.id === inv.jobId);
  const pays = data.payments.filter((x) => x.invoiceId === id).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const t = invoiceTotals(inv, pays, now);
  const locked = inv.status === "void" || t.status === "paid";
  const set = (patch: Partial<Invoice>) => update("invoices", id, patch);
  return (
    <Page>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={<span className="flex items-center gap-2">INV-{inv.number} <StatusBadge list={INVOICE_STATUSES} value={t.status} />{inv.kind === "deposit" && <Badge tone="violet">Deposit</Badge>}</span>}
        subtitle={<span className="flex flex-wrap gap-x-3"><Link href={`/customers/${c?.id}`} className="font-medium text-slate-700 hover:text-brand-700">{customerName(c)}</Link>{p && <span>{addressFull(p.address)}</span>}{job && <Link href={`/jobs/${job.id}`} className="hover:text-brand-700">Job #{job.number}</Link>}{inv.sentAt && <span>Sent {relative(inv.sentAt, now)}</span>}{inv.lastReminderAt && <span className="flex items-center gap-1"><Bell size={11} /> reminded {relative(inv.lastReminderAt, now)}</span>}</span>}
        actions={
          <>
            <Button onClick={() => print(<InvoiceDocument invoice={inv} />)}><Printer size={14} /> PDF</Button>
            <Button onClick={async () => { const link = await providers.payments.createPaymentLink(id, t.balance, `INV-${inv.number}`); try { await navigator.clipboard.writeText(link); } catch {} toast("Payment link copied", "success"); }}><Link2 size={14} /> Payment link</Button>
            <Link href={`/portal?c=${inv.customerId}&invoice=${id}`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><ExternalLink size={13} /> Customer view</Link>
            {inv.status !== "void" && t.balance > 0 && <Button onClick={() => st.sendInvoice(id)}><Send size={14} /> {inv.sentAt ? "Send reminder" : "Send"}</Button>}
            {inv.status !== "void" && t.balance > 0 && <Button variant="primary" onClick={() => setPayOpen(true)}><CreditCard size={14} /> Record payment</Button>}
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Card title="Line items">
            <LineItemsEditor items={inv.items} readOnly={locked} onChange={(items) => set({ items })} />
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Notes"><Textarea disabled={locked} value={inv.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} /></Card>
            <Card title="Terms"><Textarea disabled={locked} value={inv.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} /></Card>
          </div>
          <Card title="Payments" pad={false}>
            <DataTable rows={pays} empty={<Empty title="No payments yet" />} columns={[{ key: "d", header: "Date", mobile: true, cell: (x) => dateTime(x.receivedAt) }, { key: "a", header: "Amount", align: "right", mobile: true, cell: (x) => <span className="font-medium">{money(x.amount)}</span> }, { key: "m", header: "Method", cell: (x) => <Badge>{x.method.toUpperCase()}</Badge> }, { key: "r", header: "Reference", cell: (x) => x.reference || "—" }, { key: "f", header: "Fee", align: "right", hideBelow: "md", cell: (x) => (x.processor?.fee ? money(x.processor.fee) : "—") }]} />
          </Card>
          <Card title="Activity"><Timeline entries={data.activity.filter((a) => a.entityId === id)} limit={20} /></Card>
        </div>
        <div className="space-y-3">
          <Card title="Summary">
            <div className="space-y-1 text-[13px]">
              {[["Subtotal", t.subtotal], ...(t.discount ? [["Discount", -t.discount]] : []), [`Tax (${inv.taxPct}%)`, t.tax]].map(([k, v]) => <div key={k as string} className="flex justify-between"><span className="text-slate-600">{k}</span><span className="tabular">{money(v as number)}</span></div>)}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold"><span>Total</span><span className="tabular">{money(t.total)}</span></div>
              {t.depositCredit > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit credit</span><span className="tabular">−{money(t.depositCredit)}</span></div>}
              {t.paid > 0 && <div className="flex justify-between text-emerald-700"><span>Payments</span><span className="tabular">−{money(t.paid)}</span></div>}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span className="font-semibold">Balance due</span><span className={cn("tabular text-[20px] font-semibold", t.balance > 0 ? "text-slate-900" : "text-emerald-700")}>{money(t.balance)}</span></div>
            </div>
          </Card>
          <Card title="Details">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Issue date"><Input disabled={locked} type="date" value={inv.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></Field>
              <Field label="Due date"><Input disabled={locked} type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
              <Field label="Tax %"><NumberInput disabled={locked} value={inv.taxPct} onChange={(v) => set({ taxPct: v })} step={0.25} /></Field>
              <Field label="Discount $"><NumberInput disabled={locked} value={inv.discount.value} onChange={(v) => set({ discount: { type: "amount", value: v } })} /></Field>
              <Field label="Deposit credit" className="col-span-2"><NumberInput disabled={locked} value={inv.depositCredit} onChange={(v) => set({ depositCredit: v })} /></Field>
            </div>
            {inv.status !== "void" && !pays.length && (
              <Button variant="danger" size="sm" className="mt-3" onClick={async () => { if (await ask.confirm(`Void INV-${inv.number}?`, true)) set({ status: "void" }); }}><Ban size={13} /> Void invoice</Button>
            )}
          </Card>
          <Card title="Customer"><KV cols={1} items={[["Name", customerName(c)], ["Email", c?.email], ["Phone", c?.phone], ["Billing", addressFull(c?.billingAddress)]]} /></Card>
        </div>
      </div>
      {payOpen && <PaymentModal invoice={inv} balance={t.balance} onClose={() => setPayOpen(false)} />}
      {portal}
    </Page>
  );
}

export function PaymentModal({ invoice, balance, onClose }: { invoice: Invoice; balance: number; onClose: () => void }) {
  const st = useCrm();
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [reference, setReference] = useState("");
  return (
    <Modal open onClose={onClose} title={`Record payment — INV-${invoice.number}`} width={460} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={amount <= 0} onClick={() => { st.recordPayment({ invoiceId: invoice.id, customerId: invoice.customerId, amount, method, reference, isDeposit: invoice.kind === "deposit", note: "", processor: method === "card" ? { provider: "manual" } : { provider: "manual" } }); toast(`Payment of ${money(amount)} recorded`, "success"); onClose(); }}>Record {money(amount)}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {(["card", "cash", "check", "ach", "other"] as PaymentMethod[]).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={cn("rounded-lg border py-2 text-[12.5px] font-medium uppercase", method === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{m}</button>
          ))}
        </div>
        <Field label="Amount"><NumberInput value={amount} onChange={setAmount} min={0} step={10} /></Field>
        <div className="flex gap-1.5">
          <button onClick={() => setAmount(balance)} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px]">Full {money(balance)}</button>
          <button onClick={() => setAmount(Math.round(balance * 50) / 100)} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px]">50%</button>
        </div>
        <Field label={method === "check" ? "Check #" : "Reference"}><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "card" ? "Last 4 / auth code" : ""} /></Field>
        {method === "card" && <p className="text-[11.5px] text-slate-500">Card processing runs through Stripe / Square once connected in Settings → Integrations. Until then this records an externally processed payment.</p>}
      </div>
    </Modal>
  );
}

export function InvoiceDocument({ invoice: inv }: { invoice: Invoice }) {
  const s = useCrm.getState();
  const c = s.data.customers.find((x) => x.id === inv.customerId);
  const p = s.data.properties.find((x) => x.id === inv.propertyId);
  const t = invoiceTotals(inv, s.data.payments);
  const set = s.settings;
  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", color: "#0f172a", fontSize: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #0f6490", paddingBottom: 10 }}>
        <div><div style={{ fontSize: 20, fontWeight: 700, color: "#0f6490" }}>{set.businessName}</div><div>{addressFull(set.address)}</div><div>{set.phone} · {set.email}</div><div>{set.license}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 700 }}>{inv.kind === "deposit" ? "DEPOSIT INVOICE" : "INVOICE"}</div><div>INV-{inv.number}</div><div>Issued {date(inv.issueDate)}</div><div>Due {date(inv.dueDate)}</div></div>
      </div>
      <div style={{ display: "flex", gap: 40, margin: "12px 0" }}>
        <div><div style={{ fontWeight: 700, fontSize: 9, color: "#64748b" }}>BILL TO</div><div style={{ fontWeight: 600 }}>{customerName(c)}</div><div>{addressFull(c?.billingAddress)}</div><div>{c?.email}</div></div>
        {p && <div><div style={{ fontWeight: 700, fontSize: 9, color: "#64748b" }}>SERVICE ADDRESS</div><div>{addressFull(p.address)}</div></div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #94a3b8", fontSize: 9, color: "#64748b" }}><th>Description</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Rate</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
        <tbody>{inv.items.map((l) => <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "3px 0" }}>{l.name}</td><td style={{ textAlign: "right" }}>{l.qty} {l.unit}</td><td style={{ textAlign: "right" }}>{money(l.unitPrice)}</td><td style={{ textAlign: "right" }}>{money(l.qty * l.unitPrice)}</td></tr>)}</tbody>
      </table>
      <div style={{ marginLeft: "auto", width: 240, marginTop: 8 }}>
        {[["Subtotal", t.subtotal], ...(t.discount ? [["Discount", -t.discount]] : []), ["Tax", t.tax], ["Total", t.total], ...(t.depositCredit ? [["Deposit received", -t.depositCredit]] : []), ...(t.paid ? [["Payments", -t.paid]] : [])].map(([k, v]) => <div key={k as string} style={{ display: "flex", justifyContent: "space-between" }}><span>{k}</span><span>{money(v as number)}</span></div>)}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, borderTop: "1px solid #0f172a", marginTop: 3, paddingTop: 3 }}><span>Balance due</span><span>{money(t.balance)}</span></div>
      </div>
      {inv.notes && <div style={{ marginTop: 10 }}>{inv.notes}</div>}
      <div style={{ fontSize: 9, color: "#475569", marginTop: 8 }}>{inv.terms}</div>
      <div style={{ marginTop: 10, fontSize: 10 }}>Pay online: {typeof location !== "undefined" ? location.origin : ""}/portal · Checks payable to {set.legalName}</div>
    </div>
  );
}

export function PaymentsPage() {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const [range, setRange] = useState("30");
  const [method, setMethod] = useState("");
  const cust = byId(data.customers);
  const inv = byId(data.invoices);
  const rows = data.payments.filter((p) => (range === "all" || new Date(p.receivedAt).getTime() > now - Number(range) * 86400000) && (!method || p.method === method));
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const by = (m: string) => rows.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
  const fees = rows.reduce((s, p) => s + (p.processor?.fee ?? 0), 0);
  return (
    <Page>
      <PageHeader title="Payments" subtitle="Cash, card, ACH and check payments — deposits included" actions={<Button onClick={() => downloadText("payments.csv", toCsv(rows, [{ header: "Date", value: (p) => p.receivedAt.slice(0, 10) }, { header: "Customer", value: (p) => customerName(cust.get(p.customerId)) }, { header: "Invoice", value: (p) => (p.invoiceId ? `INV-${inv.get(p.invoiceId)?.number}` : "") }, { header: "Method", value: (p) => p.method }, { header: "Amount", value: (p) => p.amount.toFixed(2) }, { header: "Reference", value: (p) => p.reference }]))}><Download size={14} /> Export</Button>} />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-6">
        <StatTile label="Collected" value={money0(total)} sub={`${rows.length} payments`} />
        <StatTile label="Card" value={money0(by("card"))} />
        <StatTile label="Check" value={money0(by("check"))} />
        <StatTile label="ACH" value={money0(by("ach"))} />
        <StatTile label="Cash" value={money0(by("cash"))} />
        <StatTile label="Processing fees" value={money0(fees)} />
      </div>
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <Select value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "365", label: "Last 12 months" }, { value: "all", label: "All time" }]} className="w-44" />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: "", label: "All methods" }, ...["card", "check", "ach", "cash", "other"].map((m) => ({ value: m, label: m.toUpperCase() }))]} className="w-36" />
        </div>
        <DataTable
          rows={rows}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "d", header: "Received", mobile: true, sort: (p) => p.receivedAt, cell: (p) => dateTime(p.receivedAt) },
            { key: "a", header: "Amount", align: "right", mobile: true, sort: (p) => p.amount, cell: (p) => <span className="font-medium">{money(p.amount)}</span> },
            { key: "c", header: "Customer", mobile: true, cell: (p) => <Link href={`/customers/${p.customerId}`} className="hover:text-brand-700">{customerName(cust.get(p.customerId))}</Link> },
            { key: "i", header: "Invoice", cell: (p) => (p.invoiceId ? <Link href={`/invoices/${p.invoiceId}`} className="text-brand-700 hover:underline">INV-{inv.get(p.invoiceId)?.number}</Link> : "—") },
            { key: "m", header: "Method", cell: (p) => <span className="flex items-center gap-1.5"><Badge>{p.method.toUpperCase()}</Badge>{p.isDeposit && <Badge tone="violet">Deposit</Badge>}</span> },
            { key: "r", header: "Reference", hideBelow: "md", cell: (p) => <span className="text-slate-500">{p.reference || "—"}</span> },
          ]}
        />
      </Card>
    </Page>
  );
}

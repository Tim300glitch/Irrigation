"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Phone, Mail, MessageSquare, MapPin, Pencil, FileText, Wrench, Receipt, House, Download, Droplets, Star, Trash2 } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { Customer, CrmData, CustomerType, LeadSource } from "@/lib/crm/types";
import { CUSTOMER_TAGS, CUSTOMER_TYPES, ESTIMATE_STATUSES, INVOICE_STATUSES, JOB_STATUSES, LEAD_SOURCES, sourceLabel, serviceLabel, REPAIR_TYPES } from "@/lib/crm/constants";
import { addressFull, addressLine, customerName, date, money, money0, phone, relative } from "@/lib/crm/format";
import { estimateTotal, invoiceTotals, lineTotals } from "@/lib/crm/calc";
import { isRevenueInvoice, invoiceRevenue } from "@/lib/crm/metrics";
import { Page, PageHeader, Button, Card, Tabs, Badge, KV, StatTile, SearchBox, Select, SlideOver, Field, Input, Textarea, Check, cn, useQuery, setQueryParam, StatusBadge, Avatar, Empty } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { Timeline, Conversation, Recommendations, TagList } from "../widgets";
import { PhotoGallery, PhotoUploadButton } from "../Photos";
import { useQuickCreate } from "../QuickCreate";
import { DocumentsList, DocumentUpload } from "./Documents";
import { ask } from "@/components/AskHost";

export function customerStats(d: CrmData, customerId: string, now = Date.now()) {
  const invoices = d.invoices.filter((i) => i.customerId === customerId);
  const lifetime = invoices.filter(isRevenueInvoice).reduce((s, i) => s + invoiceRevenue(i), 0);
  const outstanding = invoices.filter((i) => i.status !== "void" && i.status !== "draft").reduce((s, i) => s + invoiceTotals(i, d.payments, now).balance, 0);
  const jobs = d.jobs.filter((j) => j.customerId === customerId);
  const done = jobs.filter((j) => j.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const last = done[0]?.completedAt;
  const sub = d.planSubscriptions.find((s) => s.customerId === customerId && s.status === "active");
  const repairs12 = done.filter((j) => REPAIR_TYPES.includes(j.serviceType) && new Date(j.completedAt!).getTime() > now - 365 * 86400000).length;
  let next: string;
  if (sub) next = `${d.servicePlans.find((p) => p.id === sub.planId)?.name} — ${date(sub.nextVisitDate)}`;
  else if (repairs12 >= 3) next = "Zone rebuild consultation (repeat repairs)";
  else if (last && now - new Date(last).getTime() > 300 * 86400000) next = "Annual system check-up (overdue)";
  else if (last) next = `Seasonal check — ${date(new Date(last).getTime() + 180 * 86400000)}`;
  else next = "Initial system inspection";
  return { lifetime, outstanding, jobs: jobs.length, completed: done.length, last, next, sub };
}

export function CustomersPage() {
  const data = useCrm((s) => s.data);
  const now = useCrm((s) => s.now);
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const rows = useMemo(() => {
    const revenue = new Map<string, number>();
    const balance = new Map<string, number>();
    const lastJob = new Map<string, string>();
    for (const i of data.invoices) {
      if (isRevenueInvoice(i)) revenue.set(i.customerId, (revenue.get(i.customerId) ?? 0) + invoiceRevenue(i));
      if (i.status !== "void" && i.status !== "draft" && i.status !== "paid") balance.set(i.customerId, (balance.get(i.customerId) ?? 0) + invoiceTotals(i, data.payments, now).balance);
    }
    for (const j of data.jobs) if (j.completedAt && (lastJob.get(j.customerId) ?? "") < j.completedAt) lastJob.set(j.customerId, j.completedAt);
    const propCount = new Map<string, number>();
    for (const p of data.properties) propCount.set(p.customerId, (propCount.get(p.customerId) ?? 0) + 1);
    const t = q.toLowerCase();
    return data.customers
      .filter((c) => (!type || c.type === type) && (!tag || c.tags.includes(tag)) && (!t || `${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.phone} ${c.phone.replace(/\D/g, "")} ${c.email} ${c.billingAddress.street} ${c.billingAddress.city}`.toLowerCase().includes(t)))
      .map((c) => ({ ...c, revenue: revenue.get(c.id) ?? 0, balance: balance.get(c.id) ?? 0, last: lastJob.get(c.id), props: propCount.get(c.id) ?? 0 }));
  }, [data, q, type, tag, now]);
  return (
    <Page>
      <PageHeader
        title="Customers"
        subtitle={`${data.customers.length} customers · ${data.properties.length} properties`}
        actions={
          <>
            <Button onClick={() => downloadText("customers.csv", toCsv(rows, [{ header: "Name", value: (c) => customerName(c) }, { header: "Phone", value: (c) => c.phone }, { header: "Email", value: (c) => c.email }, { header: "Address", value: (c) => addressFull(c.billingAddress) }, { header: "Type", value: (c) => c.type }, { header: "Source", value: (c) => sourceLabel(c.leadSource) }, { header: "Tags", value: (c) => c.tags.join("; ") }, { header: "Lifetime revenue", value: (c) => c.revenue.toFixed(2) }, { header: "Balance", value: (c) => c.balance.toFixed(2) }]))}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => openQuick("customer")}>
              <Plus size={15} /> New customer
            </Button>
          </>
        }
      />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchBox value={q} onChange={setQ} placeholder="Name, phone, email, address…" className="w-full sm:w-72" />
          <Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "", label: "All types" }, ...CUSTOMER_TYPES.map((t) => ({ value: t.id, label: t.label }))]} className="w-40" />
          <Select value={tag} onChange={(e) => setTag(e.target.value)} options={[{ value: "", label: "All tags" }, ...CUSTOMER_TAGS.map((t) => ({ value: t, label: t }))]} className="w-44" />
          <span className="ml-auto text-[12px] text-slate-500">{rows.length} shown</span>
        </div>
        <DataTable
          rows={rows}
          onRowClick={(c) => router.push(`/customers/${c.id}`)}
          initialSort={{ key: "last", dir: "desc" }}
          columns={[
            { key: "name", header: "Customer", mobile: true, sort: (c) => customerName(c), cell: (c) => <div className="min-w-0"><div className="font-medium text-slate-900">{customerName(c)}</div>{c.type !== "residential" && <div className="text-[11.5px] text-slate-500">{c.firstName} {c.lastName}</div>}</div> },
            { key: "bal", header: "Balance", align: "right", mobile: true, sort: (c) => c.balance, cell: (c) => (c.balance > 0 ? <span className="font-medium text-amber-700">{money0(c.balance)}</span> : <span className="text-slate-400">—</span>) },
            { key: "contact", header: "Contact", mobile: true, cell: (c) => <span className="text-slate-600">{phone(c.phone)}</span> },
            { key: "addr", header: "Address", hideBelow: "lg", cell: (c) => <span className="text-slate-600">{addressLine(c.billingAddress)}{c.props > 1 && <Badge className="ml-1.5">{c.props} properties</Badge>}</span> },
            { key: "tags", header: "Tags", hideBelow: "xl", cell: (c) => <TagList tags={c.tags.slice(0, 3)} /> },
            { key: "src", header: "Source", hideBelow: "xl", sort: (c) => c.leadSource, cell: (c) => <span className="text-slate-600">{sourceLabel(c.leadSource)}</span> },
            { key: "rev", header: "Lifetime", align: "right", sort: (c) => c.revenue, cell: (c) => money0(c.revenue) },
            { key: "last", header: "Last service", hideBelow: "md", sort: (c) => c.last ?? "", cell: (c) => <span className="text-slate-500">{c.last ? relative(c.last, now) : "—"}</span> },
          ]}
        />
      </Card>
    </Page>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const { data, now, update, remove } = useCrm();
  const router = useRouter();
  const openQuick = useQuickCreate((s) => s.open);
  const q = useQuery();
  const tab = q.get("tab") ?? "overview";
  const [editing, setEditing] = useState(false);
  const c = data.customers.find((x) => x.id === id);
  const stats = useMemo(() => (c ? customerStats(data, c.id, now) : null), [data, c, now]);
  if (!c || !stats) return <Page><Empty title="Customer not found" action={<Link href="/customers" className="text-brand-700">Back to customers</Link>} /></Page>;
  const props = data.properties.filter((p) => p.customerId === id);
  const estimates = data.estimates.filter((e) => e.customerId === id);
  const jobs = data.jobs.filter((j) => j.customerId === id);
  const invoices = data.invoices.filter((i) => i.customerId === id);
  const payments = data.payments.filter((p) => p.customerId === id);
  const photos = data.photos.filter((p) => p.customerId === id);
  const docs = data.documents.filter((d) => d.customerId === id);
  const msgs = data.messages.filter((m) => m.customerId === id);
  const sysIds = new Set(data.systems.filter((s) => props.some((p) => p.id === s.propertyId)).map((s) => s.id));
  const zones = data.zones.filter((z) => sysIds.has(z.systemId));
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "properties", label: "Properties", count: props.length },
    { id: "estimates", label: "Estimates", count: estimates.length },
    { id: "jobs", label: "Jobs", count: jobs.length },
    { id: "invoices", label: "Invoices", count: invoices.length },
    { id: "payments", label: "Payments", count: payments.length },
    { id: "messages", label: "Messages", count: msgs.length },
    { id: "system", label: "System info", count: zones.length },
    { id: "photos", label: "Photos", count: photos.length },
    { id: "documents", label: "Documents", count: docs.length },
    { id: "activity", label: "Activity" },
  ];
  return (
    <Page>
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {customerName(c)}
            <TagList tags={c.tags} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {c.type !== "residential" && <span>{c.firstName} {c.lastName} · {CUSTOMER_TYPES.find((t) => t.id === c.type)?.label}</span>}
            <span className="flex items-center gap-1"><MapPin size={12} /> {addressFull(c.billingAddress)}</span>
            <span>Customer since {date(c.createdAt)} · {sourceLabel(c.leadSource)}</span>
          </span>
        }
        actions={
          <>
            <a href={`tel:${c.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50"><Phone size={13} /> {phone(c.phone)}</a>
            <Button onClick={() => setQueryParam("tab", "messages")}><MessageSquare size={13} /> Message</Button>
            <Button onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
            <Button variant="primary" onClick={() => openQuick("estimate", { customerId: c.id, propertyId: props[0]?.id })}><FileText size={14} /> Estimate</Button>
            <Button variant="primary" onClick={() => openQuick("job", { customerId: c.id, propertyId: props[0]?.id })}><Wrench size={14} /> Job</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Lifetime revenue" value={money0(stats.lifetime)} sub={`${stats.completed} jobs completed`} />
        <StatTile label="Outstanding balance" value={money0(stats.outstanding)} tone={stats.outstanding > 0 ? "warn" : "default"} href={`/customers/${id}?tab=invoices`} />
        <StatTile label="Last service" value={stats.last ? date(stats.last) : "—"} sub={stats.last ? relative(stats.last, now) : "never"} />
        <StatTile label="Open estimates" value={estimates.filter((e) => ["draft", "sent", "viewed"].includes(e.status)).length} sub={money0(estimates.filter((e) => ["sent", "viewed"].includes(e.status)).reduce((s, e) => s + estimateTotal(e), 0))} />
        <div className="col-span-2 md:col-span-1">
          <StatTile label="Next recommended service" value={<span className="text-[13.5px] font-semibold">{stats.next}</span>} />
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => setQueryParam("tab", t === "overview" ? null : t)} className="mb-4" />

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            <Card title="Properties" actions={<Button size="sm" variant="ghost" onClick={() => openQuick("property", { customerId: c.id })}><Plus size={13} /> Add</Button>}>
              <div className="grid gap-2 sm:grid-cols-2">
                {props.map((p) => {
                  const sys = data.systems.find((s) => s.propertyId === p.id);
                  const zs = data.zones.filter((z) => z.systemId === sys?.id);
                  const issues = zs.filter((z) => z.statuses.some((s) => s !== "working")).length;
                  const ctrl = data.controllers.find((x) => x.systemId === sys?.id);
                  return (
                    <Link key={p.id} href={`/properties/${p.id}`} className="rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-slate-900">{p.address.street}</div>
                          <div className="truncate text-[12px] text-slate-500">{p.name !== "Home" ? `${p.name} · ` : ""}{p.address.city}</div>
                        </div>
                        <House size={15} className="shrink-0 text-slate-400" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                        <Badge>{zs.length} zones</Badge>
                        {ctrl && <Badge tone={ctrl.smart ? "green" : "slate"}>{ctrl.manufacturer} {ctrl.model}</Badge>}
                        {issues > 0 && <Badge tone="amber">{issues} zone issues</Badge>}
                        {p.gateCode && <Badge tone="violet">Gate {p.gateCode}</Badge>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
            <Card title="Recent work" pad={false} actions={<Link href={`/customers/${id}?tab=jobs`} className="text-[12px] text-brand-700 hover:underline">All jobs</Link>}>
              <JobRows jobs={jobs.slice().sort((a, b) => (b.scheduledStart ?? b.createdAt).localeCompare(a.scheduledStart ?? a.createdAt)).slice(0, 6)} />
            </Card>
            <Card title="Activity">
              <Timeline entries={data.activity.filter((a) => a.customerId === id)} limit={15} />
            </Card>
          </div>
          <div className="space-y-3">
            <Card title="Contact">
              <KV
                cols={1}
                items={[
                  ["Phone", <a key="p" href={`tel:${c.phone}`} className="text-brand-700 hover:underline">{phone(c.phone)}</a>],
                  ...(c.altPhone ? [["Alt phone", c.altPhone] as [string, string]] : []),
                  ["Email", <a key="e" href={`mailto:${c.email}`} className="break-all text-brand-700 hover:underline">{c.email}</a>],
                  ["Billing address", addressFull(c.billingAddress)],
                  ["Preferred contact", c.preferredContact],
                  ["Customer portal", c.portalEnabled ? <Link key="pt" href={`/portal?c=${c.id}`} className="text-brand-700 hover:underline">Enabled — open portal</Link> : "Disabled"],
                ]}
              />
              {c.notes && <div className="mt-3 rounded-lg bg-amber-50/70 p-2.5 text-[12.5px] text-slate-700">{c.notes}</div>}
            </Card>
            <Card title="Suggestions">
              <Recommendations customerId={id} limit={5} />
            </Card>
            {stats.sub && (
              <Card title="Service plan">
                <div className="text-[13px] font-medium">{data.servicePlans.find((p) => p.id === stats.sub!.planId)?.name}</div>
                <div className="text-[12px] text-slate-500">Next visit {date(stats.sub.nextVisitDate)} · auto-renew {stats.sub.autoRenew ? "on" : "off"}</div>
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === "properties" && (
        <Card pad={false} actions={<Button size="sm" onClick={() => openQuick("property", { customerId: c.id })}><Plus size={13} /> Add property</Button>} title="Properties">
          <DataTable rows={props} onRowClick={(p) => router.push(`/properties/${p.id}`)} columns={[{ key: "a", header: "Address", mobile: true, cell: (p) => <span className="font-medium">{addressLine(p.address)}</span> }, { key: "n", header: "Name", cell: (p) => p.name }, { key: "z", header: "Zones", align: "right", cell: (p) => data.zones.filter((z) => z.systemId === data.systems.find((s) => s.propertyId === p.id)?.id).length }, { key: "g", header: "Gate code", cell: (p) => p.gateCode || "—" }, { key: "y", header: "System age", cell: (p) => (p.systemInstalledYear ? `${new Date().getFullYear() - p.systemInstalledYear} yrs` : "—") }]} />
        </Card>
      )}
      {tab === "estimates" && (
        <Card pad={false}>
          <DataTable rows={estimates} onRowClick={(e) => router.push(`/estimates/${e.id}`)} initialSort={{ key: "d", dir: "desc" }} empty={<Empty title="No estimates" />} columns={[{ key: "n", header: "#", mobile: true, cell: (e) => <span className="font-medium">#{e.number} {e.title}</span> }, { key: "s", header: "Status", mobile: true, cell: (e) => <StatusBadge list={ESTIMATE_STATUSES} value={e.status} /> }, { key: "t", header: "Total", align: "right", sort: (e) => estimateTotal(e), cell: (e) => money(estimateTotal(e)) }, { key: "d", header: "Created", sort: (e) => e.createdAt, cell: (e) => date(e.createdAt) }]} />
        </Card>
      )}
      {tab === "jobs" && <Card pad={false}><JobRows jobs={jobs.slice().sort((a, b) => (b.scheduledStart ?? b.createdAt).localeCompare(a.scheduledStart ?? a.createdAt))} /></Card>}
      {tab === "invoices" && (
        <Card pad={false}>
          <DataTable rows={invoices} onRowClick={(i) => router.push(`/invoices/${i.id}`)} initialSort={{ key: "d", dir: "desc" }} columns={[{ key: "n", header: "Invoice", mobile: true, cell: (i) => <span className="font-medium">INV-{i.number}{i.kind === "deposit" && <Badge className="ml-1.5" tone="violet">Deposit</Badge>}</span> }, { key: "s", header: "Status", mobile: true, cell: (i) => <StatusBadge list={INVOICE_STATUSES} value={invoiceTotals(i, data.payments, now).status} /> }, { key: "t", header: "Total", align: "right", cell: (i) => money(invoiceTotals(i, data.payments, now).total) }, { key: "b", header: "Balance", align: "right", cell: (i) => money(invoiceTotals(i, data.payments, now).balance) }, { key: "d", header: "Issued", sort: (i) => i.issueDate, cell: (i) => date(i.issueDate) }]} />
        </Card>
      )}
      {tab === "payments" && (
        <Card pad={false}>
          <DataTable rows={payments} initialSort={{ key: "d", dir: "desc" }} columns={[{ key: "d", header: "Date", mobile: true, sort: (p) => p.receivedAt, cell: (p) => date(p.receivedAt) }, { key: "a", header: "Amount", align: "right", mobile: true, cell: (p) => <span className="font-medium">{money(p.amount)}</span> }, { key: "m", header: "Method", cell: (p) => p.method.toUpperCase() }, { key: "r", header: "Reference", cell: (p) => p.reference || "—" }, { key: "i", header: "Invoice", cell: (p) => (p.invoiceId ? <Link className="text-brand-700 hover:underline" href={`/invoices/${p.invoiceId}`}>INV-{data.invoices.find((i) => i.id === p.invoiceId)?.number}</Link> : "—") }]} />
        </Card>
      )}
      {tab === "messages" && <Card title="Communication history" sub="SMS · email · calls · notes"><Conversation customerId={id} /></Card>}
      {tab === "system" && (
        <div className="space-y-3">
          {props.map((p) => {
            const sys = data.systems.find((s) => s.propertyId === p.id);
            const zs = data.zones.filter((z) => z.systemId === sys?.id).sort((a, b) => a.number - b.number);
            const ctrl = data.controllers.find((x) => x.systemId === sys?.id);
            return (
              <Card key={p.id} title={p.address.street} sub={ctrl ? `${ctrl.manufacturer} ${ctrl.model} · ${zs.length} zones` : undefined} actions={<Link href={`/properties/${p.id}?tab=system`} className="text-[12px] text-brand-700 hover:underline">Open system</Link>} pad={false}>
                <ZoneMiniTable zones={zs} />
              </Card>
            );
          })}
        </div>
      )}
      {tab === "photos" && <Card><PhotoGallery photos={photos} upload={<PhotoUploadButton entityType="customer" entityId={id} customerId={id} />} /></Card>}
      {tab === "documents" && <Card title="Documents" actions={<DocumentUpload entityType="customer" entityId={id} customerId={id} />} pad={false}><DocumentsList docs={docs} /></Card>}
      {tab === "activity" && <Card><Timeline entries={data.activity.filter((a) => a.customerId === id)} limit={80} /></Card>}

      {editing && (
        <EditCustomer
          c={c}
          onClose={() => setEditing(false)}
          onSave={(p) => update("customers", c.id, p)}
          onDelete={async () => {
            if (jobs.length || invoices.length) return ask.alert("This customer has jobs or invoices and can't be deleted. Tag them instead.");
            if (!(await ask.confirm(`Delete ${customerName(c)} and their properties?`, true))) return;
            remove("properties", props.map((p) => p.id));
            remove("customers", c.id);
            router.push("/customers");
          }}
        />
      )}
    </Page>
  );
}

export function JobRows({ jobs }: { jobs: import("@/lib/crm/types").Job[] }) {
  const data = useCrm((s) => s.data);
  const router = useRouter();
  const emp = byId(data.employees);
  const prop = byId(data.properties);
  return (
    <DataTable
      rows={jobs}
      onRowClick={(j) => router.push(`/jobs/${j.id}`)}
      empty={<Empty title="No jobs yet" />}
      columns={[
        { key: "n", header: "Job", mobile: true, cell: (j) => <div><div className="font-medium text-slate-900">#{j.number} {j.title}</div><div className="text-[11.5px] text-slate-500">{serviceLabel(j.serviceType)} · {prop.get(j.propertyId)?.address.street}</div></div> },
        { key: "s", header: "Status", mobile: true, cell: (j) => <StatusBadge list={JOB_STATUSES} value={j.status} /> },
        { key: "d", header: "Date", mobile: true, cell: (j) => <span className="text-slate-600">{j.scheduledStart ? date(j.scheduledStart) : "Unscheduled"}</span> },
        { key: "t", header: "Tech", hideBelow: "md", cell: (j) => <Avatar e={emp.get(j.assignedTo ?? "")} size={22} /> },
        { key: "v", header: "Value", align: "right", cell: (j) => money0(lineTotals(j.items).subtotal) },
      ]}
    />
  );
}

export function ZoneMiniTable({ zones }: { zones: import("@/lib/crm/types").Zone[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-1.5 font-medium">Zone</th>
            <th className="px-2 font-medium">Type</th>
            <th className="px-2 font-medium">Equipment</th>
            <th className="px-2 font-medium">Valve</th>
            <th className="px-2 text-right font-medium">Heads</th>
            <th className="px-2 text-right font-medium">GPM</th>
            <th className="px-4 font-medium">Condition</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-b border-slate-50">
              <td className="px-4 py-1.5 font-medium text-slate-900">
                {z.number}. {z.name}
              </td>
              <td className="px-2 text-slate-600">{z.sprinklerType}</td>
              <td className="px-2 text-slate-600">{z.manufacturer} {z.model}</td>
              <td className="px-2 text-slate-600">{z.valveType} {z.valveSize}</td>
              <td className="tabular px-2 text-right">{z.headCount || "—"}</td>
              <td className="tabular px-2 text-right">{z.flowGpm ?? "—"}</td>
              <td className="px-4">
                <ZoneStatusBadges statuses={z.statuses} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ZoneStatusBadges({ statuses }: { statuses: import("@/lib/crm/types").ZoneStatus[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {statuses.map((s) => {
        const tone = s === "working" ? "green" : ["leaking", "broken"].includes(s) ? "red" : ["valve_issue", "wiring_issue", "controller_issue"].includes(s) ? "violet" : "amber";
        return (
          <Badge key={s} tone={tone} dot>
            {s.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase())}
          </Badge>
        );
      })}
    </span>
  );
}

function EditCustomer({ c, onClose, onSave, onDelete }: { c: Customer; onClose: () => void; onSave: (p: Partial<Customer>) => void; onDelete: () => void }) {
  const [f, setF] = useState(c);
  return (
    <SlideOver
      open
      onClose={onClose}
      title="Edit customer"
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={13} />
          </Button>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(f);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Last name"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Company"><Input value={f.company ?? ""} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomerType })} options={CUSTOMER_TYPES.map((t) => ({ value: t.id, label: t.label }))} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Alt phone"><Input value={f.altPhone ?? ""} onChange={(e) => setF({ ...f, altPhone: e.target.value })} /></Field>
          <Field label="Email" className="col-span-2"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Street" className="col-span-2"><Input value={f.billingAddress.street} onChange={(e) => setF({ ...f, billingAddress: { ...f.billingAddress, street: e.target.value } })} /></Field>
          <Field label="City"><Input value={f.billingAddress.city} onChange={(e) => setF({ ...f, billingAddress: { ...f.billingAddress, city: e.target.value } })} /></Field>
          <Field label="ZIP"><Input value={f.billingAddress.zip} onChange={(e) => setF({ ...f, billingAddress: { ...f.billingAddress, zip: e.target.value } })} /></Field>
          <Field label="Lead source"><Select value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value as LeadSource })} options={LEAD_SOURCES.map((s) => ({ value: s.id, label: s.label }))} /></Field>
          <Field label="Preferred contact"><Select value={f.preferredContact} onChange={(e) => setF({ ...f, preferredContact: e.target.value as Customer["preferredContact"] })} options={["call", "text", "email"].map((v) => ({ value: v, label: v }))} /></Field>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Tags</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {CUSTOMER_TAGS.map((t) => (
              <Check key={t} label={t} checked={f.tags.includes(t)} onChange={(v) => setF({ ...f, tags: v ? [...f.tags, t] : f.tags.filter((x) => x !== t) })} />
            ))}
          </div>
        </div>
        <Check label="Customer portal access" checked={f.portalEnabled} onChange={(v) => setF({ ...f, portalEnabled: v })} />
        <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={4} /></Field>
      </div>
    </SlideOver>
  );
}


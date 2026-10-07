"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Truck, Package, AlertTriangle, ArrowRightLeft, Repeat, CalendarPlus, Download, Clock, LogIn, LogOut, ShoppingCart, Pencil, Phone, Mail, Globe, BadgeCheck, Trash2 } from "lucide-react";
import { useCrm, byId, canDeleteEmployee, employeeHasHistory } from "@/store/crmStore";
import { ask } from "@/components/AskHost";
import type { Employee, InventoryItem, ItemCategory, PricingRule, Role, ServicePlan, Vendor, PlanSubscription } from "@/lib/crm/types";
import { ITEM_CATEGORIES, ROLES, TIME_TYPES, roleLabel, PERMISSIONS } from "@/lib/crm/constants";
import { customerName, date, dateTime, fullName, hours, money, money0, pct, phone, isoDate, relative, time } from "@/lib/crm/format";
import { describeRule, entryHours, marginOf, priceFromRule, burdenedRate } from "@/lib/crm/calc";
import { employeeStats, rangePreset } from "@/lib/crm/metrics";
import { uid, checklistFor } from "@/lib/crm/workflows";
import { Page, PageHeader, Card, Button, Badge, Tabs, SearchBox, Select, Field, Input, Textarea, Modal, SlideOver, cn, useQuery, setQueryParam, Empty, KV, StatTile, Avatar, Check, NumberInput, Segmented } from "../ui";
import { DataTable, downloadText, toCsv } from "../DataTable";
import { CustomerPicker, PropertyPicker } from "../pickers";
import { toast } from "@/lib/crm/toast";

/* ───────────────────────── Service plans ───────────────────────── */

export function ServicePlansPage() {
  const st = useCrm();
  const { data, now } = st;
  const router = useRouter();
  const [tab, setTab] = useState<"subs" | "plans">("subs");
  const [editPlan, setEditPlan] = useState<ServicePlan | null>(null);
  const [newSub, setNewSub] = useState(false);
  const cust = byId(data.customers);
  const prop = byId(data.properties);
  const plans = byId(data.servicePlans);
  const active = data.planSubscriptions.filter((s) => s.status === "active");
  const annual = (s: PlanSubscription) => { const p = plans.get(s.planId); if (!p) return 0; const price = s.priceOverride ?? p.price; return p.billing === "monthly" ? price * 12 : p.billing === "annual" ? price : price * p.visitsPerYear; };
  const mrr = active.reduce((s, x) => s + annual(x), 0) / 12;
  const due = active.filter((s) => new Date(s.nextVisitDate + "T12:00:00").getTime() - now < 14 * 86400000);
  const createVisit = (s: PlanSubscription) => {
    const p = plans.get(s.planId)!;
    const existing = data.jobs.find((j) => j.planSubscriptionId === s.id && j.status !== "completed" && j.status !== "cancelled");
    if (existing) return router.push(`/jobs/${existing.id}`);
    const price = s.priceOverride ?? p.price;
    const chk = data.checklistTemplates.find((c) => c.id === p.checklistTemplateId);
    const job = st.createJob({ customerId: s.customerId, propertyId: s.propertyId, title: `${p.name} visit`, serviceType: "maintenance", planSubscriptionId: s.id, durationHrs: 1.5, items: [{ id: uid("ji"), kind: "labor", name: p.name, description: p.includedServices.join(" · "), qty: 1, unit: "visit", unitCost: 35, unitPrice: p.billing === "per_visit" ? price : 0, taxable: false }], checklist: chk ? chk.items.map((label, i) => ({ id: `chk_${Date.now()}_${i}`, label, done: false })) : checklistFor("maintenance", data.checklistTemplates).items, scope: p.description });
    toast("Maintenance visit created — schedule it from Dispatch", "success", { label: "Open", href: `/jobs/${job.id}` });
  };
  return (
    <Page>
      <PageHeader title="Service plans" subtitle="Recurring maintenance agreements" actions={<><Button onClick={() => setEditPlan({ id: uid("pln"), name: "", description: "", price: 99, billing: "per_visit", frequency: "quarterly", visitsPerYear: 4, includedServices: [], discountPct: 10, active: true })}><Plus size={14} /> New plan</Button><Button variant="primary" onClick={() => setNewSub(true)}><Plus size={15} /> Enroll customer</Button></>} />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Active members" value={active.length} />
        <StatTile label="Recurring revenue" value={`${money0(mrr)}/mo`} sub={`${money0(mrr * 12)} / yr`} />
        <StatTile label="Visits due (14d)" value={due.length} tone={due.some((s) => s.nextVisitDate < isoDate(now)) ? "warn" : "default"} />
        <StatTile label="Auto-renew" value={pct(active.filter((s) => s.autoRenew).length / Math.max(1, active.length))} />
      </div>
      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ id: "subs", label: "Members", count: data.planSubscriptions.length }, { id: "plans", label: "Plans", count: data.servicePlans.length }]} />
      {tab === "subs" ? (
        <Card pad={false}>
          <DataTable
            rows={data.planSubscriptions}
            initialSort={{ key: "next", dir: "asc" }}
            columns={[
              { key: "c", header: "Customer", mobile: true, sort: (s) => customerName(cust.get(s.customerId)), cell: (s) => <div><Link href={`/customers/${s.customerId}`} className="font-medium text-slate-900 hover:text-brand-700">{customerName(cust.get(s.customerId))}</Link><div className="text-[11.5px] text-slate-500">{prop.get(s.propertyId)?.address.street}</div></div> },
              { key: "p", header: "Plan", mobile: true, cell: (s) => plans.get(s.planId)?.name },
              { key: "next", header: "Next visit", mobile: true, sort: (s) => s.nextVisitDate, cell: (s) => <span className={cn(s.nextVisitDate < isoDate(now) ? "font-medium text-red-600" : new Date(s.nextVisitDate).getTime() - now < 14 * 86400000 ? "font-medium text-amber-700" : "text-slate-700")}>{date(s.nextVisitDate)} <span className="text-[11px] font-normal text-slate-400">({relative(s.nextVisitDate + "T09:00:00", now)})</span></span> },
              { key: "last", header: "Last visit", hideBelow: "md", cell: (s) => (s.lastVisitDate ? date(s.lastVisitDate) : "—") },
              { key: "v", header: "Value / yr", align: "right", sort: annual, cell: (s) => money0(annual(s)) },
              { key: "r", header: "Auto-renew", hideBelow: "md", cell: (s) => <Check checked={s.autoRenew} onChange={(v) => st.update("planSubscriptions", s.id, { autoRenew: v })} /> },
              { key: "st", header: "Status", cell: (s) => <Select value={s.status} onChange={(e) => st.update("planSubscriptions", s.id, { status: e.target.value as PlanSubscription["status"] })} options={["active", "paused", "cancelled"].map((v) => ({ value: v, label: v }))} className="h-7 w-28 text-[12px]" /> },
              { key: "a", header: "", cell: (s) => s.status === "active" && <Button size="sm" onClick={() => createVisit(s)}><CalendarPlus size={13} /> Visit</Button> },
            ]}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.servicePlans.map((p) => (
            <Card key={p.id} title={p.name} actions={<button onClick={() => setEditPlan(p)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>}>
              <div className="flex items-baseline gap-1"><span className="tabular text-[22px] font-semibold">{money0(p.price)}</span><span className="text-[12px] text-slate-500">/ {p.billing === "per_visit" ? "visit" : p.billing === "monthly" ? "month" : "year"}</span></div>
              <p className="mt-1 text-[12.5px] text-slate-600">{p.description}</p>
              <ul className="mt-2 space-y-0.5 text-[12.5px] text-slate-700">{p.includedServices.map((s) => <li key={s} className="flex items-center gap-1.5"><BadgeCheck size={13} className="text-emerald-600" />{s}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-1.5"><Badge>{p.frequency}</Badge><Badge>{p.visitsPerYear} visits/yr</Badge><Badge tone="green">{p.discountPct}% off repairs</Badge><Badge tone="brand">{data.planSubscriptions.filter((s) => s.planId === p.id && s.status === "active").length} members</Badge></div>
            </Card>
          ))}
        </div>
      )}
      {editPlan && <PlanEditor plan={editPlan} onClose={() => setEditPlan(null)} />}
      {newSub && <EnrollModal onClose={() => setNewSub(false)} />}
    </Page>
  );
}

function PlanEditor({ plan, onClose }: { plan: ServicePlan; onClose: () => void }) {
  const st = useCrm();
  const [f, setF] = useState(plan);
  const exists = st.data.servicePlans.some((p) => p.id === plan.id);
  return (
    <SlideOver open onClose={onClose} title={exists ? "Edit plan" : "New plan"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name} onClick={() => { if (exists) st.update("servicePlans", f.id, f); else st.insert("servicePlans", f); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Price"><NumberInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></Field>
          <Field label="Billing"><Select value={f.billing} onChange={(e) => setF({ ...f, billing: e.target.value as ServicePlan["billing"] })} options={[{ value: "per_visit", label: "Per visit" }, { value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" }]} /></Field>
          <Field label="Frequency"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as ServicePlan["frequency"] })} options={["monthly", "quarterly", "semiannual", "annual", "seasonal"].map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="Visits / year"><NumberInput value={f.visitsPerYear} onChange={(v) => setF({ ...f, visitsPerYear: v })} min={1} /></Field>
          <Field label="Repair discount %"><NumberInput value={f.discountPct} onChange={(v) => setF({ ...f, discountPct: v })} /></Field>
          <Field label="Checklist"><Select value={f.checklistTemplateId ?? ""} onChange={(e) => setF({ ...f, checklistTemplateId: e.target.value || undefined })} options={[{ value: "", label: "Default" }, ...st.data.checklistTemplates.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
        </div>
        <Field label="Included services (one per line)"><Textarea rows={5} value={f.includedServices.join("\n")} onChange={(e) => setF({ ...f, includedServices: e.target.value.split("\n").filter(Boolean) })} /></Field>
        <Check label="Active (available for enrollment)" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      </div>
    </SlideOver>
  );
}

function EnrollModal({ onClose }: { onClose: () => void }) {
  const st = useCrm();
  const [customerId, setC] = useState<string>();
  const [propertyId, setP] = useState<string>();
  const [planId, setPlan] = useState(st.data.servicePlans[0]?.id);
  const [next, setNext] = useState(isoDate(Date.now() + 14 * 86400000));
  return (
    <Modal open onClose={onClose} title="Enroll in service plan" width={520} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!propertyId || !planId} onClick={() => { st.insert("planSubscriptions", { id: uid("sub"), planId: planId!, customerId: customerId!, propertyId: propertyId!, startDate: isoDate(), nextVisitDate: next, autoRenew: true, status: "active" }); st.update("customers", customerId!, (c) => ({ ...c, tags: c.tags.includes("Maintenance Plan") ? c.tags : [...c.tags, "Maintenance Plan"] })); st.log({ type: "note", message: `Enrolled in ${st.data.servicePlans.find((p) => p.id === planId)?.name}`, entityType: "customer", entityId: customerId!, customerId }); onClose(); }}>Enroll</Button></>}>
      <div className="space-y-3">
        <Field label="Customer"><CustomerPicker value={customerId} onChange={setC} autoFocus /></Field>
        <Field label="Property"><PropertyPicker customerId={customerId} value={propertyId} onChange={setP} /></Field>
        <Field label="Plan"><Select value={planId} onChange={(e) => setPlan(e.target.value)} options={st.data.servicePlans.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} — ${money0(p.price)}/${p.billing === "per_visit" ? "visit" : p.billing === "monthly" ? "mo" : "yr"}` }))} /></Field>
        <Field label="First visit"><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Inventory & price book ───────────────────────── */

export function InventoryPage() {
  const st = useCrm();
  const { data } = st;
  const q = useQuery();
  const tab = q.get("tab") ?? (q.get("item") ? "pricebook" : "warehouse");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<InventoryItem | null>(null);
  const [transfer, setTransfer] = useState(false);
  const [truckId, setTruckId] = useState(data.trucks[0]?.id ?? "");
  const vendors = byId(data.vendors);
  const items = byId(data.items);
  const focus = q.get("item");
  const filtered = data.items.filter((i) => (!cat || i.category === cat) && (!search || `${i.name} ${i.sku} ${i.manufacturer}`.toLowerCase().includes(search.toLowerCase())) && (!focus || i.id === focus || tab !== "pricebook"));
  const stocked = filtered.filter((i) => i.stocked);
  const low = data.items.filter((i) => i.stocked && i.active && i.warehouseQty <= i.minQty);
  const truckTotals = data.trucks.map((t) => ({ t, value: data.truckStock.filter((s) => s.truckId === t.id).reduce((s, x) => s + x.qty * (items.get(x.itemId)?.cost ?? 0), 0), low: data.truckStock.filter((s) => s.truckId === t.id && s.qty < s.minQty).length }));
  const whValue = data.items.filter((i) => i.stocked).reduce((s, i) => s + i.warehouseQty * i.cost, 0);
  return (
    <Page>
      <PageHeader
        title="Inventory & price book"
        actions={
          <>
            <Button onClick={() => setTransfer(true)}><ArrowRightLeft size={14} /> Transfer / adjust</Button>
            <Button variant="primary" onClick={() => setEdit({ id: uid("itm"), name: "", sku: "", category: "fittings", manufacturer: "", description: "", unit: "ea", cost: 0, pricing: st.settings.defaultPricing, taxable: true, stocked: true, warehouseQty: 0, minQty: 0, reorderQty: 0, active: true })}><Plus size={15} /> New item</Button>
          </>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <StatTile label="Warehouse value" value={money0(whValue)} sub="at cost" />
        {truckTotals.map(({ t, value, low: l }) => <StatTile key={t.id} label={`${t.name} stock`} value={money0(value)} sub={l ? <span className="text-amber-700">{l} below min</span> : "all stocked"} />)}
        <StatTile label="Below minimum" value={low.length} tone={low.length ? "warn" : "default"} href="/inventory?tab=reorder" />
      </div>
      <Tabs className="mb-3" value={tab} onChange={(t) => setQueryParam("tab", t)} tabs={[{ id: "warehouse", label: "Warehouse" }, { id: "trucks", label: "Truck inventory" }, { id: "pricebook", label: "Price book", count: data.items.length }, { id: "reorder", label: "Reorder", count: low.length }, { id: "txns", label: "Transactions" }]} />
      {tab !== "trucks" && tab !== "txns" && tab !== "reorder" && (
        <div className="mb-3 flex flex-wrap gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Item, SKU, manufacturer…" className="w-full sm:w-72" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "", label: "All categories" }, ...ITEM_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} className="w-44" />
          {focus && <Button size="sm" variant="ghost" onClick={() => setQueryParam("item", null)}>Clear item filter</Button>}
        </div>
      )}
      {tab === "warehouse" && (
        <Card pad={false}>
          <DataTable
            rows={stocked}
            onRowClick={setEdit}
            initialSort={{ key: "name", dir: "asc" }}
            columns={[
              { key: "name", header: "Item", mobile: true, sort: (i) => i.name, cell: (i) => <div><div className="font-medium text-slate-900">{i.name}</div><div className="text-[11.5px] text-slate-500">{i.sku} · {ITEM_CATEGORIES.find((c) => c.id === i.category)?.label}</div></div> },
              { key: "qty", header: "Warehouse", align: "right", mobile: true, sort: (i) => i.warehouseQty, cell: (i) => <span className={cn("font-medium", i.warehouseQty <= i.minQty ? "text-red-600" : "text-slate-900")}>{i.warehouseQty} {i.unit}</span> },
              { key: "trucks", header: "On trucks", align: "right", hideBelow: "md", cell: (i) => data.truckStock.filter((s) => s.itemId === i.id).reduce((s, x) => s + x.qty, 0) },
              { key: "min", header: "Min / reorder", align: "right", hideBelow: "md", cell: (i) => <span className="text-slate-500">{i.minQty} / {i.reorderQty}</span> },
              { key: "cost", header: "Cost", align: "right", sort: (i) => i.cost, cell: (i) => money(i.cost) },
              { key: "value", header: "Value", align: "right", hideBelow: "lg", sort: (i) => i.cost * i.warehouseQty, cell: (i) => money0(i.cost * i.warehouseQty) },
              { key: "vendor", header: "Supplier", hideBelow: "lg", cell: (i) => <span className="text-slate-600">{vendors.get(i.preferredVendorId ?? "")?.name ?? "—"}</span> },
            ]}
          />
        </Card>
      )}
      {tab === "pricebook" && (
        <Card pad={false}>
          <DataTable
            rows={filtered}
            onRowClick={setEdit}
            initialSort={{ key: "cat", dir: "asc" }}
            pageSize={100}
            columns={[
              { key: "name", header: "Item", mobile: true, sort: (i) => i.name, cell: (i) => <div><div className="font-medium text-slate-900">{i.name}</div><div className="text-[11.5px] text-slate-500">{i.sku}{i.manufacturer ? ` · ${i.manufacturer}` : ""}</div></div> },
              { key: "price", header: "Price", align: "right", mobile: true, sort: (i) => priceFromRule(i.cost, i.pricing), cell: (i) => <span className="font-medium">{money(priceFromRule(i.cost, i.pricing))}<span className="text-[11px] font-normal text-slate-400">/{i.unit}</span></span> },
              { key: "cat", header: "Category", sort: (i) => i.category, cell: (i) => <Badge>{ITEM_CATEGORIES.find((c) => c.id === i.category)?.label}</Badge> },
              { key: "cost", header: "Cost", align: "right", sort: (i) => i.cost, cell: (i) => money(i.cost) },
              { key: "rule", header: "Pricing rule", hideBelow: "md", cell: (i) => <span className="text-slate-600">{describeRule(i.pricing)}</span> },
              { key: "margin", header: "Margin", align: "right", sort: (i) => marginOf(priceFromRule(i.cost, i.pricing), i.cost), cell: (i) => { const m = marginOf(priceFromRule(i.cost, i.pricing), i.cost); return <span className={cn(m < 0.3 ? "text-red-600" : m < 0.45 ? "text-amber-700" : "text-emerald-700")}>{pct(m)}</span>; } },
              { key: "tax", header: "Taxable", hideBelow: "lg", cell: (i) => (i.taxable ? "Yes" : "No") },
              { key: "vendor", header: "Supplier", hideBelow: "xl", cell: (i) => <span className="text-slate-600">{vendors.get(i.preferredVendorId ?? "")?.name ?? "—"}</span> },
            ]}
          />
        </Card>
      )}
      {tab === "trucks" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Segmented value={truckId} onChange={setTruckId} options={data.trucks.map((t) => ({ id: t.id, label: t.name }))} />
            <span className="text-[12.5px] text-slate-500">{data.trucks.find((t) => t.id === truckId)?.vehicle} · {fullName(data.employees.find((e) => e.id === data.trucks.find((t) => t.id === truckId)?.employeeId))}</span>
          </div>
          <Card pad={false}>
            <DataTable
              rows={data.truckStock.filter((s) => s.truckId === truckId)}
              initialSort={{ key: "item", dir: "asc" }}
              columns={[
                { key: "item", header: "Item", mobile: true, sort: (s) => items.get(s.itemId)?.name ?? "", cell: (s) => <span className="font-medium">{items.get(s.itemId)?.name}</span> },
                { key: "qty", header: "On truck", align: "right", mobile: true, sort: (s) => s.qty, cell: (s) => <span className={cn("font-medium", s.qty < s.minQty ? "text-red-600" : "")}>{s.qty} {items.get(s.itemId)?.unit}</span> },
                { key: "min", header: "Min", align: "right", cell: (s) => s.minQty },
                { key: "need", header: "To restock", align: "right", cell: (s) => (s.qty < s.minQty ? <Badge tone="amber">{s.minQty * 2 - s.qty}</Badge> : "—") },
                { key: "adj", header: "", cell: (s) => <span className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => st.update("truckStock", s.id, { qty: Math.max(0, s.qty - 1) })}>−1</Button><Button size="sm" variant="ghost" onClick={() => st.update("truckStock", s.id, { qty: s.qty + 1 })}>+1</Button></span> },
              ]}
            />
          </Card>
          <div className="mt-3 flex justify-end"><Button onClick={() => { const need = data.truckStock.filter((s) => s.truckId === truckId && s.qty < s.minQty); for (const s of need) { const add = s.minQty * 2 - s.qty; const it = items.get(s.itemId)!; st.update("truckStock", s.id, { qty: s.qty + add }); st.update("items", it.id, { warehouseQty: it.warehouseQty - add }); st.insert("inventoryTxns", { id: uid("txn"), itemId: it.id, location: truckId, qty: add, reason: "transfer", note: "Truck restock", at: new Date().toISOString(), employeeId: st.session?.employeeId }); } toast(`${need.length} items restocked from warehouse`, "success"); }}><Truck size={14} /> Restock truck to 2× minimum</Button></div>
        </>
      )}
      {tab === "reorder" && (
        <Card pad={false} title="Purchase alerts" sub="items at or below minimum — grouped by preferred supplier" actions={<Button size="sm" onClick={() => downloadText("purchase-order.csv", toCsv(low, [{ header: "Supplier", value: (i) => vendors.get(i.preferredVendorId ?? "")?.name ?? "" }, { header: "SKU", value: (i) => i.vendorSku ?? i.sku }, { header: "Item", value: (i) => i.name }, { header: "Qty", value: (i) => i.reorderQty }, { header: "Unit cost", value: (i) => i.cost }, { header: "Extended", value: (i) => (i.cost * i.reorderQty).toFixed(2) }]))}><Download size={13} /> Export PO</Button>}>
          {[...new Set(low.map((i) => i.preferredVendorId ?? ""))].map((vid) => {
            const list = low.filter((i) => (i.preferredVendorId ?? "") === vid);
            return (
              <div key={vid} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-[12.5px] font-semibold text-slate-700"><span className="flex items-center gap-2"><ShoppingCart size={13} />{vendors.get(vid)?.name ?? "No preferred supplier"}</span><span className="tabular">{money0(list.reduce((s, i) => s + i.cost * i.reorderQty, 0))}</span></div>
                {list.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                    <AlertTriangle size={13} className="text-amber-500" />
                    <span className="flex-1 font-medium text-slate-900">{i.name}</span>
                    <span className="text-slate-500">{i.warehouseQty} on hand · min {i.minQty}</span>
                    <span className="tabular w-24 text-right">order {i.reorderQty} {i.unit}</span>
                    <Button size="sm" onClick={() => { st.update("items", i.id, { warehouseQty: i.warehouseQty + i.reorderQty }); st.insert("inventoryTxns", { id: uid("txn"), itemId: i.id, location: "warehouse", qty: i.reorderQty, reason: "received", note: `Received from ${vendors.get(vid)?.name ?? "supplier"}`, at: new Date().toISOString(), employeeId: st.session?.employeeId }); toast(`${i.name}: received ${i.reorderQty}`, "success"); }}>Mark received</Button>
                  </div>
                ))}
              </div>
            );
          })}
          {!low.length && <Empty title="Nothing to reorder" />}
        </Card>
      )}
      {tab === "txns" && (
        <Card pad={false}>
          <DataTable
            rows={data.inventoryTxns}
            initialSort={{ key: "at", dir: "desc" }}
            columns={[
              { key: "at", header: "When", mobile: true, sort: (t) => t.at, cell: (t) => dateTime(t.at) },
              { key: "item", header: "Item", mobile: true, cell: (t) => items.get(t.itemId)?.name },
              { key: "qty", header: "Qty", align: "right", mobile: true, cell: (t) => <span className={cn("font-medium", t.qty < 0 ? "text-red-600" : "text-emerald-700")}>{t.qty > 0 ? "+" : ""}{t.qty}</span> },
              { key: "loc", header: "Location", cell: (t) => (t.location === "warehouse" ? "Warehouse" : data.trucks.find((x) => x.id === t.location)?.name) },
              { key: "r", header: "Reason", cell: (t) => <Badge tone={t.reason === "used" ? "slate" : t.reason === "received" ? "green" : "blue"}>{t.reason}</Badge> },
              { key: "n", header: "Note", hideBelow: "md", cell: (t) => (t.jobId ? <Link href={`/jobs/${t.jobId}`} className="text-brand-700 hover:underline">{t.note}</Link> : <span className="text-slate-500">{t.note}</span>) },
            ]}
          />
        </Card>
      )}
      {edit && <ItemEditor item={edit} onClose={() => setEdit(null)} />}
      {transfer && <TransferModal onClose={() => setTransfer(false)} />}
    </Page>
  );
}

function ItemEditor({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const st = useCrm();
  const [f, setF] = useState(item);
  const exists = st.data.items.some((i) => i.id === item.id);
  const price = priceFromRule(f.cost, f.pricing);
  const setRule = (type: PricingRule["type"], value: number) => setF({ ...f, pricing: { type, value } as PricingRule });
  return (
    <SlideOver open onClose={onClose} title={exists ? f.name : "New item"} subtitle={exists ? f.sku : undefined} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name} onClick={() => { if (exists) st.update("items", f.id, f); else st.insert("items", f); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="SKU"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ItemCategory })} options={ITEM_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} /></Field>
          <Field label="Manufacturer"><Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Field>
          <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label="Preferred supplier" className="col-span-2"><Select value={f.preferredVendorId ?? ""} onChange={(e) => setF({ ...f, preferredVendorId: e.target.value || undefined })} options={[{ value: "", label: "—" }, ...st.data.vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pricing</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cost"><NumberInput value={f.cost} onChange={(v) => setF({ ...f, cost: v })} step={0.1} min={0} /></Field>
            <Field label="Rule"><Select value={f.pricing.type} onChange={(e) => setRule(e.target.value as PricingRule["type"], e.target.value === "multiplier" ? 2.5 : e.target.value === "margin" ? 35 : e.target.value === "markup" ? 60 : price)} options={[{ value: "multiplier", label: "Cost × multiplier" }, { value: "markup", label: "Markup %" }, { value: "margin", label: "Target margin %" }, { value: "flat", label: "Flat installed price" }]} /></Field>
            <Field label={f.pricing.type === "multiplier" ? "Multiplier" : f.pricing.type === "flat" ? "Price" : "Percent"}><NumberInput value={f.pricing.value} onChange={(v) => setRule(f.pricing.type, v)} step={f.pricing.type === "multiplier" ? 0.1 : 1} /></Field>
            <Field label="Selling price"><div className="tabular pt-1.5 text-[15px] font-semibold">{money(price)} <span className="text-[12px] font-normal text-slate-500">· {pct(marginOf(price, f.cost))} margin</span></div></Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-4"><Check label="Taxable" checked={f.taxable} onChange={(v) => setF({ ...f, taxable: v })} /><Check label="Stocked item" checked={f.stocked} onChange={(v) => setF({ ...f, stocked: v })} /><Check label="Active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} /></div>
        </div>
        {f.stocked && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Warehouse qty"><NumberInput value={f.warehouseQty} onChange={(v) => setF({ ...f, warehouseQty: v })} /></Field>
            <Field label="Minimum"><NumberInput value={f.minQty} onChange={(v) => setF({ ...f, minQty: v })} /></Field>
            <Field label="Reorder qty"><NumberInput value={f.reorderQty} onChange={(v) => setF({ ...f, reorderQty: v })} /></Field>
          </div>
        )}
        <Field label="Install labor per unit (hours)" hint="Used to suggest labor on estimates"><NumberInput value={f.laborHrsPerUnit} allowEmpty onChange={(v) => setF({ ...f, laborHrsPerUnit: Number.isNaN(v) ? undefined : v })} step={0.05} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </SlideOver>
  );
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const st = useCrm();
  const [itemId, setItem] = useState(st.data.items.find((i) => i.stocked)?.id ?? "");
  const [from, setFrom] = useState("warehouse");
  const [to, setTo] = useState(st.data.trucks[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const locs = [{ value: "warehouse", label: "Warehouse" }, ...st.data.trucks.map((t) => ({ value: t.id, label: t.name })), { value: "adjust", label: "Adjustment (count correction)" }];
  const move = (loc: string, delta: number) => {
    if (loc === "adjust") return;
    if (loc === "warehouse") { const it = st.data.items.find((i) => i.id === itemId)!; st.update("items", itemId, { warehouseQty: it.warehouseQty + delta }); }
    else { const ts = st.data.truckStock.find((s) => s.truckId === loc && s.itemId === itemId); if (ts) st.update("truckStock", ts.id, { qty: Math.max(0, ts.qty + delta) }); else st.insert("truckStock", { id: uid("tsk"), truckId: loc, itemId, qty: Math.max(0, delta), minQty: 0 }); }
    st.insert("inventoryTxns", { id: uid("txn"), itemId, location: loc, qty: delta, reason: from === "adjust" || to === "adjust" ? "adjustment" : "transfer", note: "Manual", at: new Date().toISOString(), employeeId: st.session?.employeeId });
  };
  return (
    <Modal open onClose={onClose} title="Transfer / adjust stock" width={480} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { move(from, -qty); move(to, qty); toast("Stock updated", "success"); onClose(); }}>Apply</Button></>}>
      <div className="space-y-3">
        <Field label="Item"><Select value={itemId} onChange={(e) => setItem(e.target.value)} options={st.data.items.filter((i) => i.stocked).map((i) => ({ value: i.id, label: i.name }))} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From"><Select value={from} onChange={(e) => setFrom(e.target.value)} options={locs} /></Field>
          <Field label="To"><Select value={to} onChange={(e) => setTo(e.target.value)} options={locs} /></Field>
        </div>
        <Field label="Quantity"><NumberInput value={qty} onChange={setQty} min={0} /></Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Employees & time ───────────────────────── */

export function EmployeesPage() {
  const st = useCrm();
  const { data, settings, now } = st;
  const q = useQuery();
  const open = q.get("open");
  const [tab, setTab] = useState<"team" | "time" | "permissions">("team");
  const [range, setRange] = useState<"week" | "month" | "last90" | "year">("month");
  const stats = useMemo(() => employeeStats(data, settings, rangePreset(range, now)), [data, settings, range, now]);
  const emp = data.employees.find((e) => e.id === open);
  return (
    <Page>
      <PageHeader title="Employees" subtitle={`${data.employees.filter((e) => e.active).length} active team members`} actions={<Button variant="primary" onClick={() => { const e: Employee = { id: uid("emp"), firstName: "New", lastName: "Employee", role: "technician", phone: "", email: "", color: "#0891b2", payType: "hourly", payRate: 25, commissionPct: 0, certifications: [], hireDate: isoDate(), active: true, workDays: [1, 2, 3, 4, 5], shiftStart: "07:00", shiftEnd: "15:30" }; st.insert("employees", e); setQueryParam("open", e.id); }}><Plus size={15} /> Add employee</Button>} />
      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ id: "team", label: "Team & productivity" }, { id: "time", label: "Time tracking" }, { id: "permissions", label: "Roles & permissions" }]} />
      {tab === "team" && (
        <>
          <div className="mb-3"><Segmented size="sm" value={range} onChange={setRange} options={[{ id: "week", label: "This week" }, { id: "month", label: "This month" }, { id: "last90", label: "90 days" }, { id: "year", label: "This year" }]} /></div>
          <Card pad={false}>
            <DataTable
              rows={stats.filter((s) => !s.employee.archived).map((s) => ({ ...s, id: s.employee.id }))}
              onRowClick={(s) => setQueryParam("open", s.id)}
              columns={[
                { key: "n", header: "Employee", mobile: true, cell: (s) => <span className="flex items-center gap-2.5"><Avatar e={s.employee} size={30} /><span><span className="block font-medium text-slate-900">{fullName(s.employee)}</span><span className="text-[11.5px] text-slate-500">{roleLabel(s.employee.role)} · {s.employee.phone}</span></span></span> },
                { key: "j", header: "Jobs", align: "right", mobile: true, sort: (s) => s.jobs, cell: (s) => s.jobs },
                { key: "r", header: "Revenue", align: "right", mobile: true, sort: (s) => s.revenue, cell: (s) => money0(s.revenue) },
                { key: "h", header: "Hours", align: "right", sort: (s) => s.hours, cell: (s) => hours(s.hours) },
                { key: "rph", header: "Rev / hr", align: "right", hideBelow: "md", sort: (s) => s.revPerHour, cell: (s) => (s.hours ? money0(s.revPerHour) : "—") },
                { key: "t", header: "Avg ticket", align: "right", hideBelow: "md", sort: (s) => s.avgTicket, cell: (s) => (s.jobs ? money0(s.avgTicket) : "—") },
                { key: "cb", header: "Callbacks", align: "right", hideBelow: "lg", sort: (s) => s.callbacks, cell: (s) => <span className={cn(s.callbackRate > 0.05 && "font-medium text-red-600")}>{s.callbacks}</span> },
                { key: "ph", header: "Photos", align: "right", hideBelow: "lg", cell: (s) => s.photos },
                { key: "pay", header: "Pay", align: "right", hideBelow: "xl", cell: (s) => (s.employee.payType === "salary" ? `${money0(s.employee.payRate)}/yr` : `${money(s.employee.payRate)}/hr`) },
              ]}
            />
          </Card>
        </>
      )}
      {tab === "time" && <TimeTracking />}
      {tab === "permissions" && <PermissionsMatrix />}
      {emp && <EmployeeProfile e={emp} stats={stats.find((s) => s.employee.id === emp.id)} onClose={() => setQueryParam("open", null)} />}
    </Page>
  );
}

function EmployeeProfile({ e, stats, onClose }: { e: Employee; stats?: ReturnType<typeof employeeStats>[number]; onClose: () => void }) {
  const st = useCrm();
  const set = (p: Partial<Employee>) => st.update("employees", e.id, p);
  const [cert, setCert] = useState("");
  const confirmDelete = useDeleteEmployee();
  const remove = async () => {
    if (await confirmDelete(e)) onClose();
  };
  return (
    <SlideOver open onClose={onClose} width={600} title={<span className="flex items-center gap-2"><Avatar e={e} size={28} />{fullName(e)}</span>} subtitle={`${roleLabel(e.role)} · since ${date(e.hireDate)}`} footer={<div className="flex justify-start"><Button variant="danger" onClick={() => void remove()}><Trash2 size={14} /> Delete employee</Button></div>}>
      {stats && <div className="mb-4 grid grid-cols-3 gap-2"><StatTile label="Jobs" value={stats.jobs} /><StatTile label="Revenue" value={money0(stats.revenue)} /><StatTile label="Rev / hour" value={stats.hours ? money0(stats.revPerHour) : "—"} /><StatTile label="Hours" value={hours(stats.hours)} /><StatTile label="Callbacks" value={stats.callbacks} /><StatTile label="Photos" value={stats.photos} /></div>}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name"><Input value={e.firstName} onChange={(ev) => set({ firstName: ev.target.value })} /></Field>
          <Field label="Last name"><Input value={e.lastName} onChange={(ev) => set({ lastName: ev.target.value })} /></Field>
          <Field label="Role"><Select value={e.role} onChange={(ev) => set({ role: ev.target.value as Role })} options={ROLES.map((r) => ({ value: r.id, label: r.label }))} /></Field>
          <Field label="Color"><Input type="color" value={e.color} onChange={(ev) => set({ color: ev.target.value })} className="h-8 p-0.5" /></Field>
          <Field label="Phone"><Input value={e.phone} onChange={(ev) => set({ phone: ev.target.value })} /></Field>
          <Field label="Email"><Input value={e.email} onChange={(ev) => set({ email: ev.target.value })} /></Field>
          <Field label="Pay type"><Select value={e.payType} onChange={(ev) => set({ payType: ev.target.value as Employee["payType"] })} options={[{ value: "hourly", label: "Hourly" }, { value: "salary", label: "Salary" }]} /></Field>
          <Field label={e.payType === "hourly" ? "Pay rate ($/hr)" : "Salary ($/yr)"} hint={`Burdened cost ${money(burdenedRate(e, st.settings))}/hr`}><NumberInput value={e.payRate} onChange={(v) => set({ payRate: v })} /></Field>
          <Field label="Commission %"><NumberInput value={e.commissionPct} onChange={(v) => set({ commissionPct: v })} step={0.5} /></Field>
          <Field label="Truck"><Select value={e.truckId ?? ""} onChange={(ev) => set({ truckId: ev.target.value || undefined })} options={[{ value: "", label: "—" }, ...st.data.trucks.map((t) => ({ value: t.id, label: t.name }))]} /></Field>
          <Field label="Shift start"><Input type="time" value={e.shiftStart} onChange={(ev) => set({ shiftStart: ev.target.value })} /></Field>
          <Field label="Shift end"><Input type="time" value={e.shiftEnd} onChange={(ev) => set({ shiftEnd: ev.target.value })} /></Field>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Work days</div>
          <div className="flex gap-1">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <button key={i} onClick={() => set({ workDays: e.workDays.includes(i) ? e.workDays.filter((x) => x !== i) : [...e.workDays, i].sort() })} className={cn("h-8 w-8 rounded-full text-[12px] font-medium", e.workDays.includes(i) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>{d}</button>)}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Certifications</div>
          <ul className="space-y-1">{e.certifications.map((c, i) => <li key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px]"><span className="flex items-center gap-1.5"><BadgeCheck size={13} className="text-emerald-600" />{c.name}{c.number ? ` #${c.number}` : ""}</span><span className={cn("text-[11.5px]", c.expires && c.expires < isoDate() ? "text-red-600" : "text-slate-500")}>{c.expires ? `exp. ${date(c.expires)}` : ""} <button onClick={() => set({ certifications: e.certifications.filter((_, j) => j !== i) })} className="ml-1 text-slate-400 hover:text-red-600">×</button></span></li>)}</ul>
          <div className="mt-1.5 flex gap-1.5"><Input value={cert} onChange={(ev) => setCert(ev.target.value)} placeholder="Add certification…" className="h-7 text-[12px]" /><Button size="sm" onClick={() => { if (cert) set({ certifications: [...e.certifications, { name: cert }] }); setCert(""); }}>Add</Button></div>
        </div>
        <Check label="Active" checked={e.active} onChange={(v) => set({ active: v })} />
      </div>
    </SlideOver>
  );
}

function TimeTracking() {
  const st = useCrm();
  const { data, now, settings } = st;
  const [weekOf, setWeekOf] = useState(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); });
  const days = Array.from({ length: 7 }, (_, i) => weekOf + i * 86400000);
  const people = data.employees.filter((e) => e.active && e.payType === "hourly");
  const sum = (empId: string, from: number, to: number, types?: string[]) => data.timeEntries.filter((t) => t.employeeId === empId && new Date(t.start).getTime() >= from && new Date(t.start).getTime() < to && (!types || types.includes(t.type))).reduce((s, t) => s + entryHours(t, now), 0);
  return (
    <div className="space-y-3">
      <Card title="Clock in / out" sub="live status">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {people.map((e) => {
            const open = data.timeEntries.find((t) => t.employeeId === e.id && t.type === "shift" && !t.end);
            const activity = data.timeEntries.find((t) => t.employeeId === e.id && t.type !== "shift" && !t.end);
            return (
              <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5">
                <Avatar e={e} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{fullName(e)}</div>
                  <div className="text-[11.5px] text-slate-500">{open ? <span className="text-emerald-700">In since {time(open.start)}{activity ? ` · ${TIME_TYPES.find((x) => x.id === activity.type)?.label}` : ""}</span> : "Clocked out"}</div>
                </div>
                {open ? <Button size="sm" onClick={() => st.stopTimers(e.id)}><LogOut size={13} /> Out</Button> : <Button size="sm" variant="primary" onClick={() => st.startTimer(e.id, "shift")}><LogIn size={13} /> In</Button>}
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Weekly timesheet" actions={<span className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setWeekOf(weekOf - 7 * 86400000)}>‹</Button><span className="text-[12px] text-slate-600">{date(weekOf)} – {date(weekOf + 6 * 86400000)}</span><Button size="sm" variant="ghost" onClick={() => setWeekOf(weekOf + 7 * 86400000)}>›</Button></span>} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead><tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500"><th className="px-4 py-2 font-medium">Employee</th>{days.map((d) => <th key={d} className="px-2 text-right font-medium">{new Date(d).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</th>)}<th className="px-2 text-right font-medium">Job</th><th className="px-2 text-right font-medium">Travel</th><th className="px-2 text-right font-medium">Total</th><th className="px-4 text-right font-medium">Labor cost</th></tr></thead>
            <tbody>
              {people.map((e) => {
                const total = sum(e.id, weekOf, weekOf + 7 * 86400000, ["job", "travel", "shop", "material_pickup"]);
                return (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar e={e} size={20} />{fullName(e)}</span></td>
                    {days.map((d) => { const h = sum(e.id, d, d + 86400000, ["job", "travel", "shop", "material_pickup"]); return <td key={d} className="tabular px-2 text-right text-slate-600">{h ? h.toFixed(1) : "—"}</td>; })}
                    <td className="tabular px-2 text-right">{sum(e.id, weekOf, weekOf + 7 * 86400000, ["job"]).toFixed(1)}</td>
                    <td className="tabular px-2 text-right">{sum(e.id, weekOf, weekOf + 7 * 86400000, ["travel"]).toFixed(1)}</td>
                    <td className={cn("tabular px-2 text-right font-semibold", total > 40 && "text-amber-700")}>{total.toFixed(1)}</td>
                    <td className="tabular px-4 text-right">{money0(total * burdenedRate(e, settings))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Recent entries" pad={false}>
        <DataTable
          rows={data.timeEntries.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 200)}
          columns={[
            { key: "e", header: "Employee", mobile: true, cell: (t) => fullName(data.employees.find((e) => e.id === t.employeeId)) },
            { key: "t", header: "Type", mobile: true, cell: (t) => <Badge>{TIME_TYPES.find((x) => x.id === t.type)?.label}</Badge> },
            { key: "s", header: "Start", cell: (t) => dateTime(t.start) },
            { key: "h", header: "Hours", align: "right", mobile: true, cell: (t) => (t.end ? hours(entryHours(t, now)) : <Badge tone="green" dot>Running</Badge>) },
            { key: "j", header: "Job", cell: (t) => (t.jobId ? <Link href={`/jobs/${t.jobId}`} className="text-brand-700 hover:underline">#{data.jobs.find((j) => j.id === t.jobId)?.number}</Link> : "—") },
          ]}
        />
      </Card>
    </div>
  );
}

/** Confirm (explaining what happens to open work and history), then delete. */
export function useDeleteEmployee() {
  const st = useCrm();
  return async (e: Employee): Promise<boolean> => {
    const check = canDeleteEmployee(st.data, e.id, st.session?.employeeId);
    if (!check.ok) {
      toast(check.message, "error");
      return false;
    }
    const now = new Date().toISOString();
    const jobs = st.data.jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled" && (j.assignedTo === e.id || j.crew.includes(e.id))).length;
    const appts = st.data.appointments.filter((a) => a.end > now && a.employeeIds.includes(e.id)).length;
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const open = [jobs && plural(jobs, "open job"), appts && plural(appts, "upcoming appointment")].filter(Boolean).join(" and ");
    const msg = [
      `Delete ${fullName(e)}?`,
      open ? `They'll be taken off ${open}, which will need reassigning.` : "",
      employeeHasHistory(st.data, e.id) ? "Their past jobs, hours and pay history stay in your records under their name." : "",
    ].filter(Boolean).join(" ");
    if (!(await ask.confirm(msg, true))) return false;
    const r = st.deleteEmployee(e.id);
    toast(r.message, r.ok ? "success" : "error");
    return r.ok;
  };
}

/** Team list for Settings → Employees & permissions: role changes and delete. */
export function TeamList() {
  const st = useCrm();
  const router = useRouter();
  const confirmDelete = useDeleteEmployee();
  const team = st.data.employees.filter((e) => !e.archived);
  return (
    <Card
      pad={false}
      title="Employees"
      sub={`${team.length} on the team`}
      actions={<Button size="sm" onClick={() => router.push("/employees")}><Pencil size={13} /> Edit details</Button>}
    >
      <ul className="divide-y divide-slate-100">
        {team.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2">
            <Avatar e={e} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-slate-900">{fullName(e)}{e.id === st.session?.employeeId && <span className="ml-1.5 text-[11px] font-normal text-slate-500">(you)</span>}{!e.active && <Badge className="ml-1.5">Inactive</Badge>}</div>
              <div className="truncate text-[11.5px] text-slate-500">{[e.email, e.phone].filter(Boolean).join(" · ") || "No contact info"}</div>
            </div>
            <Select value={e.role} onChange={(ev) => st.update("employees", e.id, { role: ev.target.value as Role })} options={ROLES.map((r) => ({ value: r.id, label: r.label }))} className="h-8 w-36 text-[12.5px]" aria-label={`Role for ${fullName(e)}`} />
            <button onClick={() => void confirmDelete(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${fullName(e)}`} title="Delete employee"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PermissionsMatrix() {
  const st = useCrm();
  const perms = st.settings.rolePermissions;
  return (
    <Card pad={false} title="Role permissions" sub="controls navigation and access for each role (enforced server-side by row-level security)">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12.5px]">
          <thead><tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-wide text-slate-500"><th className="px-4 py-2 font-medium">Area</th>{ROLES.map((r) => <th key={r.id} className="px-2 text-center font-medium">{r.label}</th>)}</tr></thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-1.5">{p.label}</td>
                {ROLES.map((r) => (
                  <td key={r.id} className="px-2 text-center">
                    <input type="checkbox" disabled={r.id === "owner"} checked={(perms[r.id] ?? []).includes(p.id)} onChange={(e) => st.saveSettings({ rolePermissions: { ...perms, [r.id]: e.target.checked ? [...(perms[r.id] ?? []), p.id] : (perms[r.id] ?? []).filter((x) => x !== p.id) } })} className="h-4 w-4 accent-[var(--color-brand-600)]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ───────────────────────── Vendors ───────────────────────── */

export function VendorsPage() {
  const st = useCrm();
  const [edit, setEdit] = useState<Vendor | null>(null);
  const items = st.data.items;
  return (
    <Page>
      <PageHeader title="Vendors" subtitle="Suppliers, rental houses and subcontractors" actions={<Button variant="primary" onClick={() => setEdit({ id: uid("ven"), name: "", contactName: "", phone: "", email: "", website: "", accountNumber: "", address: "", categories: [], paymentTerms: "Net 30", notes: "" })}><Plus size={15} /> Add vendor</Button>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {st.data.vendors.map((v) => {
          const supplied = items.filter((i) => i.preferredVendorId === v.id);
          return (
            <Card key={v.id} title={v.name} actions={<button onClick={() => setEdit(v)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>}>
              <div className="space-y-1 text-[12.5px] text-slate-600">
                <div>{v.contactName} · Acct {v.accountNumber}</div>
                <div className="flex flex-wrap gap-3">
                  <a href={`tel:${v.phone}`} className="flex items-center gap-1 hover:text-brand-700"><Phone size={12} />{phone(v.phone)}</a>
                  <a href={`mailto:${v.email}`} className="flex items-center gap-1 hover:text-brand-700"><Mail size={12} />{v.email}</a>
                  {v.website && <a href={`https://${v.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-brand-700"><Globe size={12} />{v.website}</a>}
                </div>
                <div>{v.address}</div>
                <div>Terms: {v.paymentTerms}</div>
                {v.notes && <p className="text-slate-500">{v.notes}</p>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{v.categories.slice(0, 6).map((c) => <Badge key={c}>{ITEM_CATEGORIES.find((x) => x.id === c)?.label}</Badge>)}</div>
              <div className="mt-2 text-[11.5px] text-slate-500">Preferred supplier for {supplied.length} price-book items · {money0(supplied.filter((i) => i.warehouseQty <= i.minQty && i.stocked).reduce((s, i) => s + i.cost * i.reorderQty, 0))} on reorder</div>
            </Card>
          );
        })}
      </div>
      {edit && (
        <SlideOver open onClose={() => setEdit(null)} title={edit.name || "New vendor"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!edit.name} onClick={() => { if (st.data.vendors.some((x) => x.id === edit.id)) st.update("vendors", edit.id, edit); else st.insert("vendors", edit); setEdit(null); }}>Save</Button></>}>
          <div className="grid grid-cols-2 gap-2">
            {(["name", "contactName", "phone", "email", "website", "accountNumber", "paymentTerms"] as const).map((k) => <Field key={k} label={k.replace(/([A-Z])/g, " $1")} className={k === "name" ? "col-span-2" : ""}><Input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
            <Field label="Address" className="col-span-2"><Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1">{ITEM_CATEGORIES.map((c) => <Check key={c.id} label={c.label} checked={edit.categories.includes(c.id)} onChange={(v) => setEdit({ ...edit, categories: v ? [...edit.categories, c.id] : edit.categories.filter((x) => x !== c.id) })} />)}</div>
            <Field label="Notes" className="col-span-2"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        </SlideOver>
      )}
    </Page>
  );
}


"use client";
/**
 * Purchase orders: pick any supplier, add parts (low-stock items for that
 * supplier are suggested), adjust quantities and costs, download a PDF, then
 * mark ordered / received. Receiving adds the stock to the warehouse or a truck.
 */
import { useState } from "react";
import { Download, PackageCheck, Plus, Send, ShoppingCart, Trash2 } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import type { InventoryItem, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from "@/lib/crm/types";
import { date, money } from "@/lib/crm/format";
import { uid } from "@/lib/crm/workflows";
import { saveFile } from "@/lib/saveFile";
import { pdfName, purchaseOrderPdf } from "@/lib/pdf/crmPdf";
import { toast } from "@/lib/crm/toast";
import { ask } from "@/components/AskHost";
import { Badge, Button, Card, Empty, Field, Input, Modal, NumberInput, Select, Textarea, cn } from "../ui";
import { DataTable } from "../DataTable";
import { ItemPicker } from "../pickers";

const STATUS: Record<PurchaseOrderStatus, { label: string; tone: "slate" | "blue" | "green" | "red" }> = {
  draft: { label: "Draft", tone: "slate" },
  ordered: { label: "Ordered", tone: "blue" },
  received: { label: "Received", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export const poTotal = (po: Pick<PurchaseOrder, "items">) => po.items.reduce((t, l) => t + l.qty * l.unitCost, 0);

export function poLine(i: InventoryItem, qty = i.reorderQty || 1): PurchaseOrderLine {
  return { id: uid("pol"), itemId: i.id, name: i.name, sku: i.vendorSku || i.sku, qty, unit: i.unit, unitCost: i.cost };
}

/** Items at or below minimum whose preferred supplier is `vendorId`. */
export function lowStockFor(items: InventoryItem[], vendorId?: string) {
  return items.filter((i) => i.stocked && i.active && i.warehouseQty <= i.minQty && (i.preferredVendorId ?? "") === (vendorId ?? ""));
}

export function downloadPo(po: PurchaseOrder) {
  const { data, settings } = useCrm.getState();
  const v = data.vendors.find((x) => x.id === po.vendorId);
  const to = po.deliverTo === "warehouse" ? "Warehouse" : data.trucks.find((t) => t.id === po.deliverTo)?.name ?? "Truck";
  void saveFile(purchaseOrderPdf(po, v, to, settings), pdfName(`PO-${po.number} ${v?.name ?? "supplier"}`));
}

const NEW_SUPPLIER = "__new__";

/** Supplier dropdown with an inline "Add new supplier…" so a blank CRM isn't a dead end. */
export function SupplierSelect({ value, onChange, disabled, placeholder = "Choose supplier…" }: { value?: string; onChange: (id: string | undefined) => void; disabled?: boolean; placeholder?: string }) {
  const st = useCrm();
  return (
    <Select
      disabled={disabled}
      value={value ?? ""}
      onChange={async (e) => {
        if (e.target.value !== NEW_SUPPLIER) return onChange(e.target.value || undefined);
        const name = (await ask.prompt("Supplier name"))?.trim();
        if (!name) return;
        const id = uid("ven");
        st.insert("vendors", { id, name, contactName: "", phone: "", email: "", website: "", accountNumber: "", address: "", categories: [], paymentTerms: "Net 30", notes: "" });
        onChange(id);
        toast(`${name} added. Fill in contact details under Vendors.`, "success");
      }}
      options={[{ value: "", label: placeholder }, ...st.data.vendors.map((v) => ({ value: v.id, label: v.name })), { value: NEW_SUPPLIER, label: "+ Add new supplier…" }]}
    />
  );
}

export function PurchaseOrdersPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const st = useCrm();
  const { data } = st;
  const vendors = new Map(data.vendors.map((v) => [v.id, v]));
  return (
    <Card
      pad={false}
      title="Purchase orders"
      actions={<Button size="sm" variant="primary" onClick={() => onOpen(st.createPurchaseOrder().id)}><Plus size={13} /> New purchase order</Button>}
    >
      <DataTable
        rows={data.purchaseOrders}
        onRowClick={(po) => onOpen(po.id)}
        initialSort={{ key: "n", dir: "desc" }}
        empty={<Empty icon={<ShoppingCart size={18} />} title="No purchase orders yet">Create one here, or from the Reorder tab to order everything that&apos;s low for a supplier.</Empty>}
        columns={[
          { key: "n", header: "PO", mobile: true, sort: (p) => p.number, cell: (p) => <span className="font-medium text-slate-900">PO-{p.number}</span> },
          { key: "v", header: "Supplier", mobile: true, sort: (p) => vendors.get(p.vendorId ?? "")?.name ?? "", cell: (p) => vendors.get(p.vendorId ?? "")?.name ?? <span className="text-slate-400">No supplier</span> },
          { key: "s", header: "Status", mobile: true, sort: (p) => p.status, cell: (p) => <Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge> },
          { key: "i", header: "Lines", align: "right", hideBelow: "md", cell: (p) => p.items.length },
          { key: "t", header: "Total", align: "right", sort: (p) => poTotal(p), cell: (p) => money(poTotal(p)) },
          { key: "d", header: "Created", hideBelow: "md", sort: (p) => p.createdAt, cell: (p) => date(p.createdAt) },
          { key: "pdf", header: "", cell: (p) => <button onClick={(e) => { e.stopPropagation(); downloadPo(p); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700" title="Download PDF" aria-label={`Download PO-${p.number} PDF`}><Download size={14} /></button> },
        ]}
      />
    </Card>
  );
}

export function PurchaseOrderEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const st = useCrm();
  const po = st.data.purchaseOrders.find((p) => p.id === id);
  const [onlySupplier, setOnlySupplier] = useState(true);
  if (!po) return null;
  const locked = po.status === "received" || po.status === "cancelled";
  const set = (patch: Partial<PurchaseOrder>) => st.update("purchaseOrders", id, patch);
  const setLine = (lid: string, patch: Partial<PurchaseOrderLine>) => set({ items: po.items.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const low = lowStockFor(st.data.items, po.vendorId).filter((i) => !po.items.some((l) => l.itemId === i.id));
  const vendor = st.data.vendors.find((v) => v.id === po.vendorId);
  const addItem = (i: InventoryItem) => {
    const ex = po.items.find((l) => l.itemId === i.id);
    if (ex) setLine(ex.id, { qty: ex.qty + (i.reorderQty || 1) });
    else set({ items: [...po.items, poLine(i)] });
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={900}
      title={`Purchase order PO-${po.number}`}
      subtitle={vendor ? `${vendor.name}${vendor.accountNumber ? ` · account ${vendor.accountNumber}` : ""}` : "Choose a supplier"}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button variant="danger" onClick={async () => { if (await ask.confirm(`Delete PO-${po.number}? Stock already received stays in inventory.`, true)) { st.remove("purchaseOrders", id); onClose(); } }}><Trash2 size={14} /> Delete</Button>
          <span className="flex-1" />
          <Button onClick={() => downloadPo(po)} disabled={!po.items.length}><Download size={14} /> Download PDF</Button>
          {po.status === "draft" && <Button variant="primary" disabled={!po.items.length || !po.vendorId} onClick={() => { set({ status: "ordered", orderedAt: new Date().toISOString() }); toast(`PO-${po.number} marked as ordered`, "success"); }}><Send size={14} /> Mark ordered</Button>}
          {(po.status === "draft" || po.status === "ordered") && <Button variant={po.status === "ordered" ? "primary" : "secondary"} disabled={!po.items.length} onClick={async () => { if (await ask.confirm(`Receive PO-${po.number}? Quantities are added to ${po.deliverTo === "warehouse" ? "the warehouse" : "the truck"}.`)) st.receivePurchaseOrder(id); }}><PackageCheck size={14} /> Mark received</Button>}
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Supplier" className="sm:col-span-2">
            <SupplierSelect disabled={locked} value={po.vendorId} onChange={(vendorId) => set({ vendorId })} />
          </Field>
          <Field label="Deliver to">
            <Select disabled={locked} value={po.deliverTo} onChange={(e) => set({ deliverTo: e.target.value })} options={[{ value: "warehouse", label: "Warehouse" }, ...st.data.trucks.map((t) => ({ value: t.id, label: t.name }))]} />
          </Field>
          <Field label="Needed by">
            <Input type="date" disabled={locked} value={po.neededBy ?? ""} onChange={(e) => set({ neededBy: e.target.value || undefined })} />
          </Field>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="w-32 px-2 font-medium">Supplier SKU</th>
                <th className="w-24 px-2 text-right font-medium">Qty</th>
                <th className="w-14 px-2 font-medium">Unit</th>
                <th className="w-28 px-2 text-right font-medium">Unit cost</th>
                <th className="w-24 px-2 text-right font-medium">Total</th>
                {!locked && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {po.items.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1.5">{locked ? l.name : <Input value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} className="h-7" />}</td>
                  <td className="px-2">{locked ? l.sku : <Input value={l.sku} onChange={(e) => setLine(l.id, { sku: e.target.value })} className="h-7" />}</td>
                  <td className="px-2">{locked ? <div className="text-right">{l.qty}</div> : <NumberInput value={l.qty} min={0} onChange={(v) => setLine(l.id, { qty: v })} inputClassName="h-7 text-right" />}</td>
                  <td className="px-2 text-slate-500">{l.unit}</td>
                  <td className="px-2">{locked ? <div className="text-right">{money(l.unitCost)}</div> : <NumberInput value={l.unitCost} min={0} step={0.01} onChange={(v) => setLine(l.id, { unitCost: v })} inputClassName="h-7 text-right" />}</td>
                  <td className="tabular px-2 text-right font-medium">{money(l.qty * l.unitCost)}</td>
                  {!locked && <td><button onClick={() => set({ items: po.items.filter((x) => x.id !== l.id) })} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${l.name}`}><Trash2 size={13} /></button></td>}
                </tr>
              ))}
              {!po.items.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-[12.5px] text-slate-500">No parts yet: add them from the price book below.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200"><td colSpan={5} className="px-3 py-2 text-right text-[12.5px] font-medium text-slate-600">Order total</td><td className="tabular px-2 text-right font-semibold">{money(poTotal(po))}</td>{!locked && <td />}</tr>
            </tfoot>
          </table>
        </div>

        {!locked && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1"><ItemPicker placeholder="Add a part from the price book…" filter={po.vendorId && onlySupplier ? (i) => i.preferredVendorId === po.vendorId : undefined} onPick={addItem} /></div>
              {po.vendorId && (
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input type="checkbox" checked={onlySupplier} onChange={(e) => setOnlySupplier(e.target.checked)} /> Only this supplier&apos;s parts
                </label>
              )}
              <Button size="sm" variant="ghost" onClick={() => set({ items: [...po.items, { id: uid("pol"), name: "Custom part", sku: "", qty: 1, unit: "ea", unitCost: 0 }] })}><Plus size={13} /> Custom line</Button>
            </div>
            {low.length > 0 && (
              <div className={cn("flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900")}>
                <span className="flex-1">{low.length} low-stock item{low.length === 1 ? "" : "s"} from {vendor?.name ?? "no preferred supplier"} not on this PO yet.</span>
                <Button size="sm" onClick={() => set({ items: [...po.items, ...low.map((i) => poLine(i))] })}>Add all</Button>
              </div>
            )}
          </div>
        )}

        <Field label="Notes to supplier"><Textarea disabled={locked} value={po.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Will-call pickup, job reference, delivery instructions…" /></Field>
        <p className="text-[12px] text-slate-500">
          Status: <Badge tone={STATUS[po.status].tone} dot>{STATUS[po.status].label}</Badge>
          {po.orderedAt && <> · ordered {date(po.orderedAt)}</>}
          {po.receivedAt && <> · received {date(po.receivedAt)}</>}
        </p>
      </div>
    </Modal>
  );
}

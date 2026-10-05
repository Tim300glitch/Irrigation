"use client";
import { Plus, Trash2, Clock, Wrench } from "lucide-react";
import type { ItemKind, LineItem } from "@/lib/crm/types";
import { lineFromItem, customLine, uid } from "@/lib/crm/workflows";
import { marginOf, r2 } from "@/lib/crm/calc";
import { money, pct } from "@/lib/crm/format";
import { useCrm } from "@/store/crmStore";
import { ItemPicker } from "./pickers";
import { Button, cn, NumberInput } from "./ui";

const KINDS: { value: ItemKind; label: string }[] = [
  { value: "material", label: "Material" },
  { value: "labor", label: "Labor" },
  { value: "equipment", label: "Equipment" },
  { value: "fee", label: "Fee" },
  { value: "subcontract", label: "Sub" },
  { value: "other", label: "Other" },
];
const KIND_DOT: Record<ItemKind, string> = { material: "bg-sky-500", labor: "bg-violet-500", equipment: "bg-amber-500", fee: "bg-slate-400", subcontract: "bg-orange-500", other: "bg-slate-400" };

export function LineItemsEditor<T extends LineItem>({ items, onChange, showCost = true, readOnly, usedQty, compact }: { items: T[]; onChange: (items: T[]) => void; showCost?: boolean; readOnly?: boolean; usedQty?: boolean; compact?: boolean }) {
  const settings = useCrm((s) => s.settings);
  const upd = (id: string, patch: Partial<LineItem> & { usedQty?: number }) => onChange(items.map((i) => (i.id === id ? ({ ...i, ...patch } as T) : i)));
  const add = (l: LineItem) => onChange([...items, l as T]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pl-1 font-medium">Item</th>
              <th className="w-[92px] px-1 font-medium">Type</th>
              <th className="w-[76px] px-1 text-right font-medium">Qty</th>
              {usedQty && <th className="w-[76px] px-1 text-right font-medium">Used</th>}
              <th className="w-[52px] px-1 font-medium">Unit</th>
              {showCost && <th className="w-[88px] px-1 text-right font-medium">Cost</th>}
              <th className="w-[92px] px-1 text-right font-medium">Price</th>
              <th className="w-[36px] px-1 text-center font-medium" title="Taxable">Tax</th>
              <th className="w-[92px] px-1 text-right font-medium">Total</th>
              {showCost && !compact && <th className="w-[58px] px-1 text-right font-medium">Margin</th>}
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const total = r2(i.qty * i.unitPrice);
              const m = marginOf(i.unitPrice, i.unitCost);
              return (
                <tr key={i.id} className="group border-b border-slate-100 align-top">
                  <td className="py-1 pl-1 pr-1">
                    {readOnly ? (
                      <div className="py-1">
                        <div className="text-slate-900">{i.name}</div>
                        {i.description && <div className="text-[11.5px] text-slate-500">{i.description}</div>}
                      </div>
                    ) : (
                      <>
                        <input value={i.name} onChange={(e) => upd(i.id, { name: e.target.value })} className="h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-[13px] text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none" />
                        <input value={i.description} placeholder="Description (optional)" onChange={(e) => upd(i.id, { description: e.target.value })} className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 text-[11.5px] text-slate-500 placeholder:text-slate-300 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none" />
                      </>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    {readOnly ? (
                      <span className="inline-flex items-center gap-1.5 py-1 text-[12px] text-slate-600">
                        <span className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[i.kind])} />
                        {KINDS.find((k) => k.value === i.kind)?.label}
                      </span>
                    ) : (
                      <select value={i.kind} onChange={(e) => upd(i.id, { kind: e.target.value as ItemKind })} className="h-7 w-full rounded border border-slate-200 bg-white px-1 text-[12px]">
                        {KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-1 py-1">{readOnly ? <div className="tabular py-1 text-right">{i.qty}</div> : <NumberInput value={i.qty} onChange={(v) => upd(i.id, { qty: v })} min={0} step={i.unit === "ft" ? 10 : 1} inputClassName="h-7 text-right" />}</td>
                  {usedQty && <td className="px-1 py-1">{readOnly ? <div className="tabular py-1 text-right">{(i as LineItem & { usedQty?: number }).usedQty ?? "—"}</div> : i.kind === "material" ? <NumberInput value={(i as LineItem & { usedQty?: number }).usedQty} allowEmpty onChange={(v) => upd(i.id, { usedQty: Number.isNaN(v) ? undefined : v })} min={0} inputClassName="h-7 text-right" /> : null}</td>}
                  <td className="px-1 py-1">{readOnly ? <div className="py-1 text-slate-600">{i.unit}</div> : <input value={i.unit} onChange={(e) => upd(i.id, { unit: e.target.value })} className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[12px]" />}</td>
                  {showCost && <td className="px-1 py-1">{readOnly ? <div className="tabular py-1 text-right text-slate-600">{money(i.unitCost)}</div> : <NumberInput value={i.unitCost} onChange={(v) => upd(i.id, { unitCost: v })} min={0} step={0.5} inputClassName="h-7 text-right" />}</td>}
                  <td className="px-1 py-1">{readOnly ? <div className="tabular py-1 text-right">{money(i.unitPrice)}</div> : <NumberInput value={i.unitPrice} onChange={(v) => upd(i.id, { unitPrice: v })} min={0} step={0.5} inputClassName="h-7 text-right" />}</td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" disabled={readOnly} checked={i.taxable} onChange={(e) => upd(i.id, { taxable: e.target.checked })} className="mt-2 h-3.5 w-3.5 accent-[var(--color-brand-600)]" />
                  </td>
                  <td className="tabular px-1 py-2 text-right font-medium text-slate-900">{money(total)}</td>
                  {showCost && !compact && <td className={cn("tabular px-1 py-2 text-right text-[12px]", m < 0.3 ? "text-red-600" : m < 0.45 ? "text-amber-700" : "text-emerald-700")}>{i.unitPrice ? pct(m) : "—"}</td>}
                  {!readOnly && (
                    <td className="py-1 pl-1">
                      <button onClick={() => onChange(items.filter((x) => x.id !== i.id))} className="mt-0.5 rounded p-1 text-slate-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" aria-label="Remove line">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-[12.5px] text-slate-500">
                  No line items yet — add from the price book below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[260px] flex-1">
            <ItemPicker onPick={(it) => add(lineFromItem(it, it.unit === "ft" ? 10 : 1))} />
          </div>
          <Button size="sm" variant="ghost" onClick={() => add({ ...customLine("labor", "Technician labor", 1, settings.laborRate, 38, "hr", false) })}>
            <Clock size={13} /> Labor
          </Button>
          <Button size="sm" variant="ghost" onClick={() => add({ ...customLine("material", "Custom item", 1, 0), id: uid("li") })}>
            <Plus size={13} /> Custom line
          </Button>
          <Button size="sm" variant="ghost" onClick={() => add(customLine("fee", "Diagnostic fee", 1, settings.diagnosticFee, 0, "ea", false))}>
            <Wrench size={13} /> Fee
          </Button>
        </div>
      )}
    </div>
  );
}

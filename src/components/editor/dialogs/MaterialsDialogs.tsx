"use client";
import { saveFile } from "@/lib/saveFile";
import { useState } from "react";
import { Plus, Trash2, RotateCcw, Download, FileDown } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useAppStore } from "@/store/appStore";
import { useAnalysis } from "@/store/analysisStore";
import { useEditorStore } from "@/store/editorStore";
import { Badge, Button, Field, Modal, NumberInput, Stat, Toggle, cn } from "../../ui";
import { formatCurrency } from "@/lib/units/units";
import { uid } from "@/lib/model/factory";
import type { CostItem } from "@/lib/model/types";

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  saveFile(new Blob([csv], { type: "text/csv" }), name);
}

export function MaterialsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const [showRemoved, setShowRemoved] = useState(false);
  if (!analysis) return null;
  const est = project.estimate;
  const items = analysis.takeoff;
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <Modal
      open
      onClose={onClose}
      title="Material takeoff"
      subtitle="Calculated from the design — updates automatically. Override quantities or add items; overrides are kept per project."
      width={980}
      footer={
        <>
          <Button onClick={() => downloadCsv(`${project.meta.name} - materials.csv`, [["Category", "Item", "Description", "Net qty", "Order qty", "Unit"], ...items.filter((i) => !est.removedKeys.includes(i.key)).map((i) => [i.category, i.item, i.description, i.quantity, est.qtyOverrides[i.key] ?? i.orderQty, i.unit]), ...est.manualItems.map((m) => [m.category, m.item, m.description, m.quantity, m.quantity, m.unit])])}>
            <Download size={14} /> CSV
          </Button>
          <Button variant="primary" onClick={() => useEditorStore.getState().set({ dialog: "estimate" })}>
            Open estimate →
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <Field label="Pipe waste allowance" className="w-44">
          <NumberInput value={est.pipeWastePct} suffix="%" step={1} min={0} max={50} onChange={(v) => apply((d) => void (d.estimate.pipeWastePct = v))} />
        </Field>
        <div className="pb-1">
          <Toggle checked={showRemoved} onChange={setShowRemoved} label={<span className="text-[12px]">Show removed items ({est.removedKeys.length})</span>} />
        </div>
        <div className="flex-1" />
        <div className="pb-1 text-[12px] text-slate-500">{items.length} line items · fittings inferred from the pipe network (tees, ells, couplings, caps, adapters)</div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Description</th>
              <th className="px-2 py-2 text-right font-medium">Net qty</th>
              <th className="px-2 py-2 text-right font-medium">Order qty</th>
              <th className="px-2 py-2 font-medium">Unit</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="tabular">
            {cats.map((c) => (
              <CategoryRows key={c} cat={c} items={items.filter((i) => i.category === c && (showRemoved || !est.removedKeys.includes(i.key)))} />
            ))}
            <tr className="bg-slate-50">
              <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Manual additions
              </td>
            </tr>
            {est.manualItems.map((m) => (
              <ManualRow key={m.id} item={m} />
            ))}
            <tr>
              <td colSpan={6} className="px-3 py-2">
                <Button
                  size="sm"
                  onClick={() =>
                    apply((d) => {
                      d.estimate.manualItems.push({ id: uid("ci"), category: "Misc", item: "New item", description: "", quantity: 1, unit: "ea", unitCost: 0 });
                    })
                  }
                >
                  <Plus size={13} /> Add item
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CategoryRows({ cat, items }: { cat: string; items: ReturnType<typeof useAnalysis> extends infer A ? (A extends { takeoff: infer T } ? T : never) : never }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const est = project.estimate;
  if (!items.length) return null;
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {cat}
        </td>
      </tr>
      {items.map((i) => {
        const removed = est.removedKeys.includes(i.key);
        const ov = est.qtyOverrides[i.key];
        return (
          <tr key={i.key} className={cn("border-t border-slate-100", removed && "opacity-40")}>
            <td className="px-3 py-1.5 font-medium text-slate-900">{i.item}</td>
            <td className="px-2 text-slate-600">{i.description}</td>
            <td className="px-2 text-right">{i.quantity}</td>
            <td className="px-2 text-right">
              <div className="ml-auto flex w-28 items-center gap-1">
                <NumberInput value={ov ?? i.orderQty} step={1} min={0} onChange={(v) => apply((d) => void (d.estimate.qtyOverrides[i.key] = v))} className={ov !== undefined ? "ring-2 ring-amber-200 rounded-md" : ""} />
                {ov !== undefined && (
                  <button title="Reset to calculated" className="text-slate-400 hover:text-slate-700" onClick={() => apply((d) => void delete d.estimate.qtyOverrides[i.key])}>
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </td>
            <td className="px-2 text-slate-600">{i.unit}</td>
            <td className="px-2 text-right">
              <button
                className="text-slate-400 hover:text-red-600"
                title={removed ? "Restore" : "Remove"}
                onClick={() =>
                  apply((d) => {
                    d.estimate.removedKeys = removed ? d.estimate.removedKeys.filter((k) => k !== i.key) : [...d.estimate.removedKeys, i.key];
                  })
                }
              >
                {removed ? <RotateCcw size={13} /> : <Trash2 size={13} />}
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function ManualRow({ item, priced }: { item: CostItem; priced?: boolean }) {
  const apply = useProjectStore((s) => s.apply);
  const up = (fn: (m: CostItem) => void) => apply((d) => fn(d.estimate.manualItems.find((x) => x.id === item.id)!));
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-1">
        <input className="h-7 w-full rounded border border-slate-200 px-1.5" value={item.item} onChange={(e) => up((m) => void (m.item = e.target.value))} />
      </td>
      <td className="px-2">
        <input className="h-7 w-full rounded border border-slate-200 px-1.5" value={item.description} onChange={(e) => up((m) => void (m.description = e.target.value))} />
      </td>
      <td className="px-2" colSpan={priced ? 1 : 2}>
        <NumberInput value={item.quantity} step={1} min={0} onChange={(v) => up((m) => void (m.quantity = v))} className="ml-auto w-24" />
      </td>
      <td className="px-2">
        <input className="h-7 w-14 rounded border border-slate-200 px-1.5" value={item.unit} onChange={(e) => up((m) => void (m.unit = e.target.value))} />
      </td>
      {priced && (
        <td className="px-2">
          <NumberInput value={item.unitCost} step={0.5} min={0} onChange={(v) => up((m) => void (m.unitCost = v))} className="ml-auto w-24" />
        </td>
      )}
      <td className="px-2 text-right" colSpan={priced ? 2 : 1}>
        <button className="text-slate-400 hover:text-red-600" onClick={() => apply((d) => void (d.estimate.manualItems = d.estimate.manualItems.filter((x) => x.id !== item.id)))}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

export function EstimateDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const products = useAppStore((s) => s.products);
  const setProducts = useAppStore((s) => s.setProducts);
  if (!analysis) return null;
  const est = project.estimate;
  const e = analysis.estimate;
  const customer = est.customerMode;
  const mk = 1 + est.markupPct / 100;
  const lines = e.lines;
  const cats = [...new Set(lines.map((l) => l.category))];
  const savePrice = async (key: string, price: number) => {
    const existing = products.find((p) => p.matchKey === key);
    const next = existing ? products.map((p) => (p.matchKey === key ? { ...p, price, updatedAt: new Date().toISOString() } : p)) : [...products, { id: uid("mp"), brand: "Generic", sku: "", category: "misc" as const, description: lines.find((l) => l.key === key)?.item ?? key, unit: lines.find((l) => l.key === key)?.unit ?? "ea", price, supplier: "", notes: "Added from estimate", matchKey: key, updatedAt: new Date().toISOString() }];
    await setProducts(next);
    apply((d) => void delete d.estimate.priceOverrides[key]);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? "Customer proposal" : "Cost estimate (contractor view)"}
      subtitle={customer ? "Markup is folded into prices; internal costs are hidden." : "Prices from your material database. Edit a unit cost to override it for this project, or save it to the database."}
      width={1040}
      footer={
        <>
          <Button onClick={() => downloadCsv(`${project.meta.name} - estimate.csv`, [["Category", "Item", "Qty", "Unit", "Unit cost", "Total"], ...lines.map((l) => [l.category, l.item, l.orderQty, l.unit, (l.unitCost * (customer ? mk : 1)).toFixed(2), ((l.total + l.wasteCost) * (customer ? mk : 1)).toFixed(2)])])}>
            <Download size={14} /> CSV
          </Button>
          <Button variant="primary" onClick={() => useEditorStore.getState().set({ dialog: "export" })}>
            <FileDown size={14} /> Export proposal PDF
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_280px] gap-4">
        <div className="max-h-[62vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 text-right font-medium">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {cats.map((c) => (
                <FragmentRows key={c} title={c}>
                  {lines
                    .filter((l) => l.category === c)
                    .map((l) => (
                      <tr key={l.key} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-slate-900">{l.item}</div>
                          {!customer && l.description && <div className="text-[11px] text-slate-500">{l.description}</div>}
                          {!l.priced && <Badge tone="amber">no price</Badge>}
                        </td>
                        <td className="px-2 text-right">{l.orderQty}</td>
                        <td className="px-2">{l.unit}</td>
                        <td className="px-2 text-right">
                          {customer || l.manual ? (
                            formatCurrency(l.unitCost * (customer ? mk : 1))
                          ) : (
                            <div className="ml-auto flex w-32 items-center justify-end gap-1">
                              <NumberInput value={+l.unitCost.toFixed(2)} step={0.05} min={0} onChange={(v) => apply((d) => void (d.estimate.priceOverrides[l.key] = v))} className={est.priceOverrides[l.key] !== undefined ? "rounded-md ring-2 ring-amber-200" : ""} />
                              {est.priceOverrides[l.key] !== undefined && (
                                <button className="text-[10px] text-brand-700 hover:underline" title="Save this price to the material database" onClick={() => savePrice(l.key, est.priceOverrides[l.key])}>
                                  save
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 text-right font-medium">{formatCurrency((l.total + l.wasteCost) * (customer ? mk : 1))}</td>
                      </tr>
                    ))}
                </FragmentRows>
              ))}
              {!customer && (
                <FragmentRows title="Manual line items">
                  {est.manualItems.map((m) => (
                    <ManualRow key={m.id} item={m} priced />
                  ))}
                  <tr>
                    <td colSpan={5} className="px-3 py-2">
                      <Button size="sm" onClick={() => apply((d) => void d.estimate.manualItems.push({ id: uid("ci"), category: "Other", item: "New line item", description: "", quantity: 1, unit: "ea", unitCost: 0 }))}>
                        <Plus size={13} /> Add line item
                      </Button>
                    </td>
                  </tr>
                </FragmentRows>
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <Toggle checked={customer} onChange={(v) => apply((d) => void (d.estimate.customerMode = v))} label={<span className="font-medium">Customer-facing mode</span>} />
            <p className="text-[11px] text-slate-500">Hides markup, labor rate and internal costs on screen and in exported proposals.</p>
          </div>
          {!customer && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
              <Field label="Labor rate">
                <NumberInput value={est.laborRate} suffix="$/h" step={5} min={0} onChange={(v) => apply((d) => void (d.estimate.laborRate = v))} />
              </Field>
              <Field label="Labor hours" hint={`auto ${e.laborHoursAuto.toFixed(1)} h`}>
                <NumberInput value={est.laborHoursOverride ?? +e.laborHoursAuto.toFixed(1)} suffix="h" step={0.5} min={0} onChange={(v) => apply((d) => void (d.estimate.laborHoursOverride = v))} />
              </Field>
              <Field label="Equipment">
                <NumberInput value={est.equipmentCost} suffix="$" step={25} min={0} onChange={(v) => apply((d) => void (d.estimate.equipmentCost = v))} />
              </Field>
              <Field label="Markup">
                <NumberInput value={est.markupPct} suffix="%" step={1} min={0} onChange={(v) => apply((d) => void (d.estimate.markupPct = v))} />
              </Field>
              <Field label="Sales tax (materials)">
                <NumberInput value={est.taxPct} suffix="%" step={0.25} min={0} onChange={(v) => apply((d) => void (d.estimate.taxPct = v))} />
              </Field>
              <Field label="Pipe waste">
                <NumberInput value={est.pipeWastePct} suffix="%" step={1} min={0} onChange={(v) => apply((d) => void (d.estimate.pipeWastePct = v))} />
              </Field>
              {est.laborHoursOverride !== undefined && (
                <button className="col-span-2 text-left text-[11px] text-brand-700 hover:underline" onClick={() => apply((d) => void (d.estimate.laborHoursOverride = undefined))}>
                  Use auto labor estimate
                </button>
              )}
            </div>
          )}
          <div className="rounded-lg border border-slate-200 p-3 text-[12.5px] tabular">
            {(customer
              ? [
                  ["Materials", (e.materialSubtotal + e.waste) * mk],
                  ["Installation labor", (e.labor + e.equipment) * mk],
                  ["Sales tax", e.tax],
                ]
              : [
                  ["Material subtotal", e.materialSubtotal],
                  [`Waste (${est.pipeWastePct}% pipe)`, e.waste],
                  [`Labor (${e.laborHours.toFixed(1)} h × $${est.laborRate})`, e.labor],
                  ["Equipment", e.equipment],
                  [`Markup (${est.markupPct}%)`, e.markup],
                  [`Tax (${est.taxPct}%)`, e.tax],
                ]
            ).map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-600">{l as string}</span>
                <span>{formatCurrency(v as number)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-[15px] font-semibold">
              <span>Total project cost</span>
              <span>{formatCurrency(e.total)}</span>
            </div>
            {e.missingPrices > 0 && <p className="mt-2 text-[11px] text-amber-700">{e.missingPrices} item(s) have no price — add them in Materials → Pricing.</p>}
          </div>
          {!customer && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Labor breakdown (planning)</div>
              {e.laborBreakdown.map((r) => (
                <div key={r.task} className="flex justify-between text-[11.5px] text-slate-600">
                  <span>
                    {r.task} ({r.qty} {r.unit})
                  </span>
                  <span className="tabular">{r.hours.toFixed(1)} h</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
            <Stat label="Zones" value={project.zones.length} />
            <Stat label="Heads" value={project.sprinklers.length} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function FragmentRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}

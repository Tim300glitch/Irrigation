"use client";
import { searchParams } from "@/lib/nav";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Printer, Save } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { Button, Field, NumberInput, Select, TextInput } from "@/components/ui";
import type { CostItem, QuickEstimate } from "@/lib/model/types";
import { uid } from "@/lib/model/factory";
import { simpleEstimate } from "@/lib/materials/estimate";
import { formatCurrency } from "@/lib/units/units";

export default function QuickEstimatePage() {
  return (
    <AppShell title="Quick estimate">
      <QuickEstimateEditor />
    </AppShell>
  );
}

const PRESETS: Record<string, CostItem[]> = {
  repair: [
    { id: "", category: "Service", item: "Service call / diagnostic", description: "", quantity: 1, unit: "ea", unitCost: 85 },
    { id: "", category: "Sprinklers", item: "Replace spray head", description: "incl. nozzle", quantity: 1, unit: "ea", unitCost: 9.75 },
  ],
  install: [],
  other: [],
};

function QuickEstimateEditor() {
  const router = useRouter();
  const products = useAppStore((s) => s.products);
  const quick = useAppStore((s) => s.quickEstimates);
  const setQuick = useAppStore((s) => s.setQuickEstimates);
  const profile = useAppStore((s) => s.profile);
  const customers = useAppStore((s) => s.customers);
  const [q, setQ] = useState<QuickEstimate | null>(null);
  const [pick, setPick] = useState("");
  useEffect(() => {
    const p = searchParams();
    const id = p.get("id");
    const existing = id ? quick.find((x) => x.id === id) : undefined;
    if (existing) setQ(structuredClone(existing));
    else {
      const kind = (p.get("kind") as QuickEstimate["kind"]) ?? "install";
      const now = new Date().toISOString();
      setQ({ id: uid("qe"), name: kind === "repair" ? "Repair quote" : "Quick estimate", customer: "", address: "", kind, items: (PRESETS[kind] ?? []).map((i) => ({ ...i, id: uid("ci") })), laborHours: kind === "repair" ? 1 : 4, laborRate: profile.defaultLaborRate, taxPct: profile.defaultTaxPct, markupPct: profile.defaultMarkupPct, status: "draft", createdAt: now, updatedAt: now });
    }
  }, [quick, profile]);
  const totals = useMemo(() => (q ? simpleEstimate(q.items, q.laborHours, q.laborRate, q.taxPct, q.markupPct) : null), [q]);
  if (!q || !totals) return null;
  const up = (patch: Partial<QuickEstimate>) => setQ({ ...q, ...patch });
  const upItem = (id: string, patch: Partial<CostItem>) => setQ({ ...q, items: q.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const save = async () => {
    const next = { ...q, updatedAt: new Date().toISOString() };
    const list = quick.some((x) => x.id === q.id) ? quick.map((x) => (x.id === q.id ? next : x)) : [next, ...quick];
    await setQuick(list);
    router.push("/estimates");
  };
  const mk = 1 + q.markupPct / 100;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <h2 className="text-lg font-semibold">{q.kind === "repair" ? "Repair quote" : "Quick estimate"}</h2>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => window.print()}>
            <Printer size={14} /> Print / PDF
          </Button>
          <Button variant="primary" onClick={save}>
            <Save size={14} /> Save estimate
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
            <Field label="Estimate name" className="col-span-2">
              <TextInput value={q.name} onChange={(v) => up({ name: v })} />
            </Field>
            <Field label="Type">
              <Select value={q.kind} onChange={(v) => up({ kind: v })} options={[{ value: "repair", label: "Repair" }, { value: "install", label: "Installation" }, { value: "other", label: "Other" }]} />
            </Field>
            <Field label="Status">
              <Select value={q.status} onChange={(v) => up({ status: v })} options={[{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" }]} />
            </Field>
            <Field label="Customer" className="col-span-2">
              <input list="qe-cust" className="h-8 w-full rounded-md border border-slate-300 px-2 text-[13px]" value={q.customer} onChange={(e) => {
                const c = customers.find((x) => x.name === e.target.value);
                up({ customer: e.target.value, address: c?.address ?? q.address });
              }} />
              <datalist id="qe-cust">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Address" className="col-span-2">
              <TextInput value={q.address} onChange={(v) => up({ address: v })} />
            </Field>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5 print:hidden">
              <Select className="w-80" value={pick} onChange={setPick} options={[{ value: "", label: "Add item from price database…" }, ...products.map((p) => ({ value: p.id, label: `${p.description} — ${formatCurrency(p.price)}/${p.unit}` }))]} />
              <Button
                size="sm"
                disabled={!pick}
                onClick={() => {
                  const p = products.find((x) => x.id === pick);
                  if (!p) return;
                  setQ({ ...q, items: [...q.items, { id: uid("ci"), category: p.category, item: p.description, description: p.sku, quantity: 1, unit: p.unit, unitCost: p.price }] });
                  setPick("");
                }}
              >
                <Plus size={13} /> Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setQ({ ...q, items: [...q.items, { id: uid("ci"), category: "Other", item: "Custom item", description: "", quantity: 1, unit: "ea", unitCost: 0 }] })}>
                <Plus size={13} /> Custom line
              </Button>
            </div>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-2 text-right font-medium">Qty</th>
                  <th className="px-2 font-medium">Unit</th>
                  <th className="px-2 text-right font-medium">Unit cost</th>
                  <th className="px-2 text-right font-medium">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="tabular">
                {q.items.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="px-4 py-1.5">
                      <input className="h-7 w-full rounded border border-transparent px-1 hover:border-slate-200 focus:border-brand-400" value={i.item} onChange={(e) => upItem(i.id, { item: e.target.value })} />
                    </td>
                    <td className="px-2">
                      <NumberInput className="ml-auto w-20" value={i.quantity} step={1} min={0} onChange={(v) => upItem(i.id, { quantity: v })} />
                    </td>
                    <td className="px-2">{i.unit}</td>
                    <td className="px-2">
                      <NumberInput className="ml-auto w-24" value={i.unitCost} step={0.25} min={0} onChange={(v) => upItem(i.id, { unitCost: v })} />
                    </td>
                    <td className="px-2 text-right font-medium">{formatCurrency(i.quantity * i.unitCost)}</td>
                    <td className="px-2 print:hidden">
                      <button className="text-slate-400 hover:text-red-600" onClick={() => setQ({ ...q, items: q.items.filter((x) => x.id !== i.id) })} aria-label="Remove">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!q.items.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Add parts from your price database or custom lines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
            <Field label="Labor hours">
              <NumberInput value={q.laborHours} step={0.5} min={0} suffix="h" onChange={(v) => up({ laborHours: v })} />
            </Field>
            <Field label="Labor rate">
              <NumberInput value={q.laborRate} step={5} min={0} suffix="$/h" onChange={(v) => up({ laborRate: v })} />
            </Field>
            <Field label="Markup">
              <NumberInput value={q.markupPct} step={1} min={0} suffix="%" onChange={(v) => up({ markupPct: v })} />
            </Field>
            <Field label="Tax">
              <NumberInput value={q.taxPct} step={0.25} min={0} suffix="%" onChange={(v) => up({ taxPct: v })} />
            </Field>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13px] tabular">
            {[
              ["Materials", totals.materials * mk],
              ["Labor", totals.labor * mk],
              ["Tax", totals.tax],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-slate-100 py-1.5">
                <span className="text-slate-600">{l as string}</span>
                <span>{formatCurrency(v as number)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-[16px] font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 print:hidden">Customer prices include {q.markupPct}% markup. Internal cost: {formatCurrency(totals.materials + totals.labor)}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

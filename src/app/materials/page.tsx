"use client";
import { saveFile } from "@/lib/saveFile";
import { searchParams } from "@/lib/nav";
import { ask } from "@/components/AskHost";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, Download, Upload, Percent } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { Button, Field, NumberInput, Select, cn, LengthInput } from "@/components/ui";
import type { MaterialProduct } from "@/lib/model/types";
import { uid } from "@/lib/model/factory";
import { defaultMaterialProducts, findPrice } from "@/lib/materials/pricing";
import { formatCurrency, pipeSizeLabel } from "@/lib/units/units";
import { sizesFor, PIPE_SPECS } from "@/lib/hydraulics/pipes";
import { stationsFor } from "@/lib/materials/takeoff";

export default function MaterialsPage() {
  const [tab, setTab] = useState<"pricing" | "calculator">("pricing");
  useEffect(() => {
    if (searchParams().get("tab") === "calculator") setTab("calculator");
  }, []);
  return (
    <AppShell title="Materials">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="mb-4 flex gap-1">
          {(
            [
              ["pricing", "Pricing database"],
              ["calculator", "Material calculator"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
              {l}
            </button>
          ))}
        </div>
        {tab === "pricing" ? <Pricing /> : <Calculator />}
      </div>
    </AppShell>
  );
}

const CATS: MaterialProduct["category"][] = ["pipe", "sprinklers", "nozzles", "valves", "fittings", "drip", "wire", "controllers", "backflow", "boxes", "misc", "labor"];

function Pricing() {
  const products = useAppStore((s) => s.products);
  const setProducts = useAppStore((s) => s.setProducts);
  const profile = useAppStore((s) => s.profile);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [pct, setPct] = useState(0);
  const [rows, setRows] = useState(products);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setRows(products);
    setDirty(false);
  }, [products]);
  const list = rows.filter((p) => (cat === "all" || p.category === cat) && (!q || `${p.description} ${p.sku} ${p.brand} ${p.supplier}`.toLowerCase().includes(q.toLowerCase())));
  const up = (id: string, patch: Partial<MaterialProduct>) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)));
    setDirty(true);
  };
  const exportCsv = () => {
    const head = ["id", "brand", "sku", "category", "description", "pipeSize", "unit", "price", "supplier", "notes", "matchKey"];
    const csv = [head.join(","), ...rows.map((r) => head.map((h) => `"${String((r as unknown as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    saveFile(new Blob([csv], { type: "text/csv" }), "deltaline-prices.csv");
  };
  const importCsv = async (f: File) => {
    const text = await f.text();
    const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const cols = header.split(",").map((c) => c.replace(/"/g, "").trim());
    const parse = (line: string) => {
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out;
    };
    const next = [...rows];
    let n = 0;
    for (const l of lines) {
      const v = parse(l);
      const o: Record<string, string> = {};
      cols.forEach((c, i) => (o[c] = v[i] ?? ""));
      const existing = next.find((r) => (o.id && r.id === o.id) || (o.matchKey && r.matchKey === o.matchKey) || (o.sku && r.sku === o.sku));
      const rec: MaterialProduct = { ...(existing ?? { id: uid("mp"), brand: "", sku: "", category: "misc", description: "", unit: "ea", price: 0, supplier: "", notes: "", updatedAt: "" }), ...(o as unknown as Partial<MaterialProduct>), price: parseFloat(o.price) || existing?.price || 0, updatedAt: new Date().toISOString() } as MaterialProduct;
      if (existing) next[next.indexOf(existing)] = rec;
      else next.push(rec);
      n++;
    }
    setRows(next);
    setDirty(true);
    ask.alert(`${n} rows imported. Review them and click Save prices.`);
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, SKU, brand, supplier" className="h-8 w-72 rounded-md border border-slate-300 px-2 text-[13px]" />
        <Select className="w-40" value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, ...CATS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))]} />
        <div className="flex items-center gap-1">
          <NumberInput className="w-24" value={pct} step={1} suffix="%" onChange={setPct} />
          <Button
            size="sm"
            onClick={() => {
              if (!pct) return;
              const ids = new Set(list.map((l) => l.id));
              setRows(rows.map((r) => (ids.has(r.id) ? { ...r, price: +(r.price * (1 + pct / 100)).toFixed(2), updatedAt: new Date().toISOString() } : r)));
              setDirty(true);
            }}
            title="Adjust the filtered prices by a percentage"
          >
            <Percent size={13} /> Adjust {list.length}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-slate-500">Last updated {profile.pricesUpdatedAt ? new Date(profile.pricesUpdatedAt).toLocaleDateString() : "—"}</span>
          <Button size="sm" onClick={exportCsv}>
            <Download size={13} /> CSV
          </Button>
          <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50">
            <Upload size={13} /> Import
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          </label>
          <Button
            size="sm"
            onClick={() => {
              setRows([{ id: uid("mp"), brand: "", sku: "", category: cat === "all" ? "misc" : (cat as MaterialProduct["category"]), description: "New product", unit: "ea", price: 0, supplier: "", notes: "", updatedAt: new Date().toISOString() }, ...rows]);
              setDirty(true);
            }}
          >
            <Plus size={13} /> Add product
          </Button>
          <Button variant="primary" size="sm" disabled={!dirty} onClick={() => setProducts(rows)}>
            Save prices
          </Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Brand", "SKU", "Category", "Description", "Pipe size", "Unit", "Price", "Supplier", "Notes", "Takeoff key", ""].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-1 py-1">
                  <Cell value={p.brand} onChange={(v) => up(p.id, { brand: v })} w="w-24" />
                </td>
                <td className="px-1">
                  <Cell value={p.sku} onChange={(v) => up(p.id, { sku: v })} w="w-24" />
                </td>
                <td className="px-1">
                  <select className="h-7 rounded border border-slate-200 px-1 text-[12px]" value={p.category} onChange={(e) => up(p.id, { category: e.target.value as MaterialProduct["category"] })}>
                    {CATS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1">
                  <Cell value={p.description} onChange={(v) => up(p.id, { description: v })} w="w-72" />
                </td>
                <td className="px-1">
                  <Cell value={p.pipeSize ?? ""} onChange={(v) => up(p.id, { pipeSize: v })} w="w-16" />
                </td>
                <td className="px-1">
                  <Cell value={p.unit} onChange={(v) => up(p.id, { unit: v })} w="w-12" />
                </td>
                <td className="px-1">
                  <NumberInput className="w-24" inputClassName="h-7 text-right" value={p.price} step={0.01} min={0} onChange={(v) => up(p.id, { price: v })} />
                </td>
                <td className="px-1">
                  <Cell value={p.supplier} onChange={(v) => up(p.id, { supplier: v })} w="w-24" />
                </td>
                <td className="px-1">
                  <Cell value={p.notes} onChange={(v) => up(p.id, { notes: v })} w="w-32" />
                </td>
                <td className="px-1">
                  <Cell value={p.matchKey ?? ""} onChange={(v) => up(p.id, { matchKey: v || undefined })} w="w-40" mono />
                </td>
                <td className="whitespace-nowrap px-1">
                  <button className="p-1 text-slate-400 hover:text-slate-700" title="Duplicate" onClick={() => (setRows([...rows.slice(0, rows.indexOf(p) + 1), { ...p, id: uid("mp"), description: `${p.description} (copy)`, matchKey: undefined }, ...rows.slice(rows.indexOf(p) + 1)]), setDirty(true))}>
                    <Copy size={13} />
                  </button>
                  <button className="p-1 text-slate-400 hover:text-red-600" title="Delete" onClick={() => (setRows(rows.filter((r) => r.id !== p.id)), setDirty(true))}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[11.5px] text-slate-500">
        <span>
          {list.length} of {rows.length} products. The takeoff key links a product to calculated items (a trailing <code>:*</code> matches any size/nozzle).
        </span>
        <button className="text-brand-700 hover:underline" onClick={async () => (await ask.confirm("Reset the price database to defaults?")) && (setRows(defaultMaterialProducts()), setDirty(true))}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function Cell({ value, onChange, w, mono }: { value: string; onChange: (v: string) => void; w: string; mono?: boolean }) {
  return <input className={cn("h-7 rounded border border-transparent px-1 hover:border-slate-200 focus:border-brand-400 focus:outline-none", w, mono && "font-mono text-[11px]")} value={value} onChange={(e) => onChange(e.target.value)} />;
}

interface CalcPipe {
  id: string;
  material: keyof typeof PIPE_SPECS;
  size: number;
  length: number;
}

function Calculator() {
  const products = useAppStore((s) => s.products);
  const [pipes, setPipes] = useState<CalcPipe[]>([
    { id: "a", material: "pvc-sch40", size: 1, length: 150 },
    { id: "b", material: "pvc-sch40", size: 0.75, length: 250 },
  ]);
  const [rotors, setRotors] = useState(12);
  const [sprays, setSprays] = useState(10);
  const [valves, setValves] = useState(4);
  const [wire, setWire] = useState(60);
  const [waste, setWaste] = useState(10);
  const [backflow, setBackflow] = useState<"none" | "pvb" | "rp">("pvb");
  const rows = useMemo(() => {
    const out: { key: string; item: string; qty: number; unit: string }[] = [];
    const add = (key: string, item: string, qty: number, unit = "ea") => qty > 0 && out.push({ key, item, qty: Math.ceil(qty - 1e-6), unit });
    for (const p of pipes) add(`pipe:${p.material}:${p.size}`, `${pipeSizeLabel(p.size)} ${PIPE_SPECS[p.material].label}`, p.length * (1 + waste / 100), "ft");
    const totalFt = pipes.reduce((a, p) => a + p.length, 0);
    const lat = pipes.find((p) => p.size <= 0.75)?.size ?? 0.75;
    add("head:gen-rotor-4:*", 'Gear rotor 4" (with nozzle)', rotors);
    add("body:gen-spray-4-prs", '4" spray body PRS', sprays);
    add("nozzle:gen-spray-4-prs:*", "Spray nozzle (VAN)", sprays);
    add("fitting:swing-joint:0.75", '3/4" swing joint', rotors);
    add("pipe:funny-pipe:0.5", "Funny pipe", sprays * 1.5, "ft");
    add("fitting:barb-ell:0.5", "Barbed ell", sprays * 2);
    add(`fitting:tee-fpt:${lat}`, `${pipeSizeLabel(lat)} tee slip×slip×FPT`, (rotors + sprays) * 0.7);
    add(`fitting:ell-fpt:${lat}`, `${pipeSizeLabel(lat)} ell slip×FPT`, (rotors + sprays) * 0.3);
    add(`fitting:elbow90:${lat}`, `${pipeSizeLabel(lat)} ell 90°`, totalFt / 40);
    add(`fitting:coupling:${lat}`, `${pipeSizeLabel(lat)} coupling`, totalFt / 20);
    add("valve:electric:1", '1" electric valve', valves);
    add("fitting:male-adapter:1", '1" male adapter', valves * 2);
    add("box:standard", "Valve box", Math.ceil(valves / 2));
    add(`wire:multi:${valves + 2}`, `${valves + 2}-conductor wire`, wire * 1.1, "ft");
    add("wire:connector", "Waterproof connector", valves * 2);
    add(`eq:smart-controller:${stationsFor(valves)}`, `${stationsFor(valves)}-station smart controller`, valves ? 1 : 0);
    if (backflow !== "none") add(`eq:backflow:${backflow}:1`, `1" ${backflow.toUpperCase()} backflow`, 1);
    add("misc:primer-cement", "Primer & cement", totalFt / 300, "set");
    return out.map((r) => {
      const p = findPrice(r.key, products);
      return { ...r, price: p?.price ?? 0, priced: !!p };
    });
  }, [pipes, rotors, sprays, valves, wire, waste, backflow, products]);
  const total = rows.reduce((a, r) => a + r.qty * r.price, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[13px] font-semibold">Inputs</div>
        {pipes.map((p) => (
          <div key={p.id} className="grid grid-cols-[1.4fr_0.8fr_1fr_auto] items-end gap-1.5">
            <Field label="Pipe">
              <Select value={p.material} onChange={(v) => setPipes(pipes.map((x) => (x.id === p.id ? { ...x, material: v, size: sizesFor(v).includes(x.size) ? x.size : sizesFor(v)[0] } : x)))} options={(Object.keys(PIPE_SPECS) as (keyof typeof PIPE_SPECS)[]).map((m) => ({ value: m, label: PIPE_SPECS[m].label }))} />
            </Field>
            <Field label="Size">
              <Select value={p.size} onChange={(v) => setPipes(pipes.map((x) => (x.id === p.id ? { ...x, size: v } : x)))} options={sizesFor(p.material).map((s) => ({ value: s, label: pipeSizeLabel(s) }))} />
            </Field>
            <Field label="Length">
              <LengthInput value={p.length} min={0} onChange={(v) => setPipes(pipes.map((x) => (x.id === p.id ? { ...x, length: v } : x)))} />
            </Field>
            <button className="mb-1.5 p-1 text-slate-400 hover:text-red-600" onClick={() => setPipes(pipes.filter((x) => x.id !== p.id))} aria-label="Remove pipe">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button size="sm" onClick={() => setPipes([...pipes, { id: uid("cp"), material: "pvc-sch40", size: 0.75, length: 100 }])}>
          <Plus size={13} /> Add pipe
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Rotors">
            <NumberInput value={rotors} step={1} min={0} onChange={setRotors} />
          </Field>
          <Field label="Spray heads">
            <NumberInput value={sprays} step={1} min={0} onChange={setSprays} />
          </Field>
          <Field label="Valves / zones">
            <NumberInput value={valves} step={1} min={0} onChange={setValves} />
          </Field>
          <Field label="Wire run">
            <LengthInput value={wire} min={0} onChange={setWire} />
          </Field>
          <Field label="Pipe waste">
            <NumberInput value={waste} suffix="%" step={1} min={0} onChange={setWaste} />
          </Field>
          <Field label="Backflow">
            <Select value={backflow} onChange={setBackflow} options={[{ value: "none", label: "None" }, { value: "pvb", label: "PVB" }, { value: "rp", label: "RP" }]} />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">Fittings use rules of thumb for quick quoting. For an exact takeoff with inferred fittings, draw the system in the designer.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-2 text-right font-medium">Qty</th>
              <th className="px-2 font-medium">Unit</th>
              <th className="px-2 text-right font-medium">Unit price</th>
              <th className="px-4 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="px-4 py-1.5">
                  {r.item} {!r.priced && <span className="text-[11px] text-amber-700">(no price)</span>}
                </td>
                <td className="px-2 text-right">{r.qty}</td>
                <td className="px-2">{r.unit}</td>
                <td className="px-2 text-right">{formatCurrency(r.price)}</td>
                <td className="px-4 text-right font-medium">{formatCurrency(r.qty * r.price)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200">
              <td className="px-4 py-2 font-semibold" colSpan={4}>
                Material total (before tax)
              </td>
              <td className="px-4 text-right text-[15px] font-semibold">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

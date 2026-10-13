"use client";
/**
 * Price-book item extras: options picked per line (size, zone count, wire
 * type…), reference links, and job types the item is added to by default.
 */
import { useState } from "react";
import { ExternalLink, Link2, Plus, X } from "lucide-react";
import type { InventoryItem, ItemCategory, ItemLink, ItemOption, LineItem, ServiceType } from "@/lib/crm/types";
import { SERVICE_TYPES } from "@/lib/crm/constants";
import { lineCostFor } from "@/lib/crm/itemOptions";
import { money } from "@/lib/crm/format";
import { Button, Input, NumberInput, Select, cn } from "./ui";

const SIZES = ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"'];
const opt = (name: string, labels: string[]): ItemOption => ({ name, values: labels.map((label) => ({ label })) });

/** Sensible starting options per category; every value can be edited or removed. */
export const OPTION_PRESETS: Partial<Record<ItemCategory, ItemOption[]>> = {
  controllers: [opt("Zones", ["4", "6", "8", "12", "16", "24", "32", "48"]), opt("Mount", ["Indoor", "Outdoor"])],
  wire: [opt("Conductors / zones", ["2", "3", "5", "7", "9", "13"]), opt("Wire type", ["Multi-strand direct burial", "Single-strand UF", "Two-wire decoder cable"]), opt("Gauge", ["18 AWG", "14 AWG", "12 AWG"])],
  pvc: [opt("Size", SIZES), opt("Schedule", ["Class 200", "Class 315", "Sch 40", "Sch 80"])],
  fittings: [opt("Size", SIZES)],
  valves: [opt("Size", SIZES.slice(1, 6)), opt("Flow control", ["Yes", "No"])],
  backflow: [opt("Size", SIZES.slice(1, 7))],
  drip: [opt("Size", ['1/4"', '1/2"', '3/4"']), opt("Emitter spacing", ['6"', '12"', '18"'])],
  sprinklers: [opt("Pop-up height", ['2"', '4"', '6"', '12"'])],
  rotors: [opt("Pop-up height", ['4"', '6"', '12"'])],
  nozzles: [opt("Pattern", ["Quarter", "Half", "Full", "Adjustable"]), opt("Radius", ["8 ft", "10 ft", "12 ft", "15 ft"])],
};

export function OptionsEditor({ item, onChange }: { item: InventoryItem; onChange: (options: ItemOption[]) => void }) {
  const options = item.options ?? [];
  const [draft, setDraft] = useState<Record<number, string>>({});
  const preset = OPTION_PRESETS[item.category];
  const set = (i: number, o: ItemOption) => onChange(options.map((x, j) => (j === i ? o : x)));
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2">
          <div className="mb-1.5 flex items-center gap-2">
            <Input value={o.name} onChange={(e) => set(i, { ...o, name: e.target.value })} className="h-7 flex-1 font-medium" aria-label="Option name" />
            <button onClick={() => onChange(options.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove option ${o.name}`}><X size={14} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {o.values.map((v, k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-[12px]">
                {v.label}
                <span className="text-slate-400">·</span>
                <span className="w-16"><NumberInput value={v.cost} allowEmpty min={0} step={0.01} onChange={(n) => set(i, { ...o, values: o.values.map((x, m) => (m === k ? { ...x, cost: Number.isNaN(n) ? undefined : n } : x)) })} inputClassName="h-5 px-1 text-[11px]" /></span>
                <button onClick={() => set(i, { ...o, values: o.values.filter((_, m) => m !== k) })} className="rounded-full p-0.5 text-slate-400 hover:text-red-600" aria-label={`Remove ${v.label}`}><X size={11} /></button>
              </span>
            ))}
            <form
              className="inline-flex"
              onSubmit={(e) => {
                e.preventDefault();
                const label = (draft[i] ?? "").trim();
                if (!label) return;
                set(i, { ...o, values: [...o.values, { label }] });
                setDraft({ ...draft, [i]: "" });
              }}
            >
              <Input value={draft[i] ?? ""} onChange={(e) => setDraft({ ...draft, [i]: e.target.value })} placeholder="Add value + Enter" className="h-6 w-32 text-[12px]" />
            </form>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">The number after each value is an optional cost for that choice (e.g. a 12-zone controller costs more than a 4-zone). Leave it blank to use the item cost.</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => onChange([...options, { name: "Size", values: [] }])}><Plus size={13} /> Add option</Button>
        {preset && preset.some((p) => !options.some((o) => o.name === p.name)) && (
          <Button size="sm" variant="ghost" onClick={() => onChange([...options, ...preset.filter((p) => !options.some((o) => o.name === p.name))])}><Plus size={13} /> Use {item.category} presets ({preset.map((p) => p.name).join(", ")})</Button>
        )}
      </div>
    </div>
  );
}

export function LinksEditor({ links, onChange }: { links: ItemLink[]; onChange: (links: ItemLink[]) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    const u = url.trim();
    if (!u) return;
    onChange([...links, { label: label.trim() || hostOf(u), url: /^https?:\/\//i.test(u) ? u : `https://${u}` }]);
    setLabel("");
    setUrl("");
  };
  return (
    <div className="space-y-1.5">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-[12.5px]">
          <Link2 size={13} className="shrink-0 text-slate-400" />
          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-700 hover:underline">{l.label}</a>
          <span className="hidden truncate text-[11px] text-slate-400 sm:block sm:max-w-[200px]">{l.url}</span>
          <button onClick={() => onChange(links.filter((_, j) => j !== i))} className="rounded p-0.5 text-slate-400 hover:text-red-600" aria-label={`Remove link ${l.label}`}><X size={13} /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (Supplier page, spec sheet…)" className="h-8 min-w-[140px] flex-1" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="https://…" className="h-8 min-w-[180px] flex-[2]" />
        <Button size="sm" onClick={add} disabled={!url.trim()}><Plus size={13} /> Add link</Button>
      </div>
    </div>
  );
}

function hostOf(u: string) {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function DefaultForEditor({ value, onChange }: { value: { serviceType: ServiceType; qty: number }[]; onChange: (v: { serviceType: ServiceType; qty: number }[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SERVICE_TYPES.map((t) => {
        const on = value.find((v) => v.serviceType === t.id);
        return (
          <span key={t.id} className={cn("inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-[12px]", on ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-600")}>
            <button onClick={() => onChange(on ? value.filter((v) => v.serviceType !== t.id) : [...value, { serviceType: t.id, qty: 1 }])} className="py-0.5">{t.short}</button>
            {on ? (
              <span className="w-12"><NumberInput value={on.qty} min={0} step={1} onChange={(n) => onChange(value.map((v) => (v.serviceType === t.id ? { ...v, qty: n } : v)))} inputClassName="h-5 px-1 text-[11px]" /></span>
            ) : (
              <span className="pr-1.5" />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Option selects shown on a line that came from an item with options. */
export function LineOptions({ line, item, onChange, readOnly }: { line: LineItem; item?: InventoryItem; onChange: (patch: Partial<LineItem>) => void; readOnly?: boolean }) {
  if (!item?.options?.length) return null;
  const chosen = line.options ?? {};
  if (readOnly) return Object.keys(chosen).length ? <div className="px-1.5 text-[11.5px] text-slate-500">{Object.entries(chosen).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div> : null;
  return (
    <div className="flex flex-wrap gap-1 px-1 pb-1">
      {item.options.map((o) => (
        <Select
          key={o.name}
          value={chosen[o.name] ?? ""}
          onChange={(e) => {
            const next = { ...chosen, [o.name]: e.target.value };
            if (!e.target.value) delete next[o.name];
            onChange({ options: next, ...lineCostFor(item, next) });
          }}
          options={[{ value: "", label: `${o.name}…` }, ...o.values.map((v) => ({ value: v.label, label: v.cost != null ? `${v.label} (${money(v.cost)})` : v.label }))]}
          className={cn("h-6 w-auto max-w-[180px] px-1.5 text-[11.5px]", !chosen[o.name] && "border-amber-300 text-amber-800")}
          aria-label={o.name}
        />
      ))}
    </div>
  );
}

export function ItemLinks({ links }: { links?: ItemLink[] }) {
  if (!links?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[11.5px] text-brand-700 hover:underline">
          <ExternalLink size={11} />{l.label}
        </a>
      ))}
    </span>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Check as CheckIcon } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import { cn, inputCls, Select } from "./ui";
import { addressLine, customerName, money } from "@/lib/crm/format";
import { priceFromRule } from "@/lib/crm/calc";
import type { InventoryItem } from "@/lib/crm/types";

export interface ComboOption {
  value: string;
  label: string;
  sub?: string;
  search?: string;
  right?: ReactNode;
}

/** Searchable combobox with keyboard navigation. */
export function Combo({ value, onChange, options, placeholder = "Select…", className, autoFocus, emptyText = "No matches", renderValue }: { value: string | undefined; onChange: (v: string) => void; options: ComboOption[]; placeholder?: string; className?: string; autoFocus?: boolean; emptyText?: string; renderValue?: (o: ComboOption) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sel = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = t.length ? options.filter((o) => t.every((x) => (o.search ?? `${o.label} ${o.sub ?? ""}`).toLowerCase().includes(x))) : options;
    return out.slice(0, 80);
  }, [q, options]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  useEffect(() => {
    if (autoFocus) {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [autoFocus]);
  const choose = (o: ComboOption) => {
    onChange(o.value);
    setOpen(false);
    setQ("");
  };
  return (
    <div className={cn("relative", className)} ref={ref}>
      {open ? (
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          placeholder={sel?.label ?? placeholder}
          className={inputCls}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(filtered.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[hi]) choose(filtered[hi]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      ) : (
        <button type="button" className={cn(inputCls, "flex items-center justify-between gap-2 text-left")} onClick={() => setOpen(true)}>
          <span className={cn("truncate", !sel && "text-slate-400")}>{sel ? (renderValue ? renderValue(sel) : sel.label) : placeholder}</span>
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        </button>
      )}
      {open && (
        <div className="animate-in absolute z-50 mt-1 max-h-72 w-full min-w-[260px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {filtered.map((o, i) => (
            <button key={o.value} type="button" onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", i === hi ? "bg-slate-100" : "")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-900">{o.label}</span>
                {o.sub && <span className="block truncate text-[11.5px] text-slate-500">{o.sub}</span>}
              </span>
              {o.right}
              {o.value === value && <CheckIcon size={14} className="text-brand-600" />}
            </button>
          ))}
          {!filtered.length && <div className="px-2 py-3 text-center text-[12.5px] text-slate-500">{emptyText}</div>}
        </div>
      )}
    </div>
  );
}

export function CustomerPicker({ value, onChange, autoFocus }: { value?: string; onChange: (id: string) => void; autoFocus?: boolean }) {
  const customers = useCrm((s) => s.data.customers);
  const options = useMemo(() => customers.map((c) => ({ value: c.id, label: customerName(c), sub: `${c.phone} · ${addressLine(c.billingAddress)}`, search: `${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.phone} ${c.email} ${c.billingAddress.street}` })), [customers]);
  return <Combo value={value} onChange={onChange} options={options} placeholder="Search customers by name, phone, address…" autoFocus={autoFocus} />;
}

export function PropertyPicker({ customerId, value, onChange }: { customerId?: string; value?: string; onChange: (id: string) => void }) {
  const properties = useCrm((s) => s.data.properties);
  const list = properties.filter((p) => p.customerId === customerId);
  useEffect(() => {
    if (customerId && list.length && !list.some((p) => p.id === value)) onChange(list[0].id);
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!customerId) return <Select disabled options={[{ value: "", label: "Choose a customer first" }]} />;
  return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} options={list.length ? list.map((p) => ({ value: p.id, label: `${p.name !== "Home" ? p.name + " — " : ""}${addressLine(p.address)}` })) : [{ value: "", label: "No properties" }]} />;
}

export function ItemPicker({ onPick, placeholder = "Add from price book…", filter }: { onPick: (item: InventoryItem) => void; placeholder?: string; filter?: (i: InventoryItem) => boolean }) {
  const items = useCrm((s) => s.data.items);
  const [key, setKey] = useState(0);
  const options = useMemo(
    () =>
      items
        .filter((i) => i.active && (!filter || filter(i)))
        .map((i) => ({ value: i.id, label: i.name, sub: `${i.sku} · ${i.category}${i.stocked ? ` · ${i.warehouseQty} in stock` : ""}`, search: `${i.name} ${i.sku} ${i.manufacturer} ${i.category}`, right: <span className="tabular text-[12px] text-slate-500">{money(priceFromRule(i.cost, i.pricing))}/{i.unit}</span> })),
    [items, filter],
  );
  return (
    <Combo
      key={key}
      value={undefined}
      onChange={(v) => {
        const it = items.find((i) => i.id === v);
        if (it) onPick(it);
        setKey((k) => k + 1);
      }}
      options={options}
      placeholder={placeholder}
    />
  );
}

export function EmployeePicker({ value, onChange, roles, allowNone = true, placeholder = "Unassigned" }: { value?: string; onChange: (id: string) => void; roles?: string[]; allowNone?: boolean; placeholder?: string }) {
  const employees = useCrm((s) => s.data.employees);
  const list = employees.filter((e) => e.active && (!roles || roles.includes(e.role)));
  return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} options={[...(allowNone ? [{ value: "", label: placeholder }] : []), ...list.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} />;
}

/** Assign several employees at once, with Select all / Clear. */
export function CrewPicker({ value, onChange, lead }: { value: string[]; onChange: (ids: string[]) => void; /** lead tech is shown as included */ lead?: string }) {
  const employees = useCrm((s) => s.data.employees);
  const team = employees.filter((e) => e.active && !e.archived);
  const on = (id: string) => value.includes(id) || id === lead;
  const all = team.length > 0 && team.every((e) => on(e.id));
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <button type="button" onClick={() => onChange(all ? [] : team.map((e) => e.id).filter((id) => id !== lead))} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
          {all ? "Clear all" : "Select all"}
        </button>
        <span className="text-[11.5px] text-slate-500">{team.filter((e) => on(e.id)).length} of {team.length} assigned</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {team.map((e) => (
          <button
            type="button"
            key={e.id}
            disabled={e.id === lead}
            onClick={() => onChange(value.includes(e.id) ? value.filter((x) => x !== e.id) : [...value, e.id])}
            className={cn("inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12.5px]", on(e.id) ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}
            title={e.id === lead ? "Lead technician" : undefined}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: e.color }}>{(e.firstName[0] ?? "") + (e.lastName[0] ?? "")}</span>
            {e.firstName} {e.lastName}
            {e.id === lead && <span className="text-[10.5px] font-normal text-slate-500">lead</span>}
            {on(e.id) && e.id !== lead && <CheckIcon size={12} />}
          </button>
        ))}
        {!team.length && <span className="text-[12.5px] text-slate-500">No employees yet. Add them under Employees.</span>}
      </div>
    </div>
  );
}

"use client";
import { searchParams } from "@/lib/nav";
import { ask } from "@/components/AskHost";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { Button, Field, TextInput } from "@/components/ui";
import type { Customer } from "@/lib/model/types";
import { uid } from "@/lib/model/factory";
import { formatCurrency0 } from "@/lib/units/units";
import { StatusBadge } from "@/components/app/Dashboard";

export default function CustomersPage() {
  return (
    <AppShell title="Customers">
      <Customers />
    </AppShell>
  );
}

function Customers() {
  const customers = useAppStore((s) => s.customers);
  const setCustomers = useAppStore((s) => s.setCustomers);
  const summaries = useAppStore((s) => s.summaries);
  const openNew = useAppStore((s) => s.openNewProject);
  const [sel, setSel] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (searchParams().get("new") === "1") setSel({ id: uid("cus"), name: "", email: "", phone: "", address: "", notes: "", createdAt: new Date().toISOString() });
  }, []);
  const list = customers.filter((c) => !q || `${c.name} ${c.address} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const projectsFor = (c: Customer) => summaries.filter((s) => s.client === c.name);
  const save = async () => {
    if (!sel || !sel.name.trim()) return;
    const exists = customers.some((c) => c.id === sel.id);
    await setCustomers(exists ? customers.map((c) => (c.id === sel.id ? sel : c)) : [...customers, sel]);
  };
  return (
    <div className="mx-auto grid max-w-[1300px] gap-4 px-4 py-6 md:px-6 lg:grid-cols-[1fr_380px]">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" className="h-8 w-64 rounded-md border border-slate-300 px-2 text-[13px]" />
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setSel({ id: uid("cus"), name: "", email: "", phone: "", address: "", notes: "", createdAt: new Date().toISOString() })}>
            <Plus size={13} /> Add customer
          </Button>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-2 font-medium">Contact</th>
              <th className="px-2 font-medium">Address</th>
              <th className="px-2 text-right font-medium">Projects</th>
              <th className="px-4 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const ps = projectsFor(c);
              return (
                <tr key={c.id} onClick={() => setSel(c)} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${sel?.id === c.id ? "bg-brand-50/50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-2 text-[12px] text-slate-600">
                    {c.phone}
                    <br />
                    {c.email}
                  </td>
                  <td className="px-2 text-[12px] text-slate-600">{c.address}</td>
                  <td className="tabular px-2 text-right">{ps.length}</td>
                  <td className="tabular px-4 text-right">{formatCurrency0(ps.reduce((a, s) => a + s.estimateTotal, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {sel ? (
          <div className="space-y-3">
            <div className="text-[14px] font-semibold">{customers.some((c) => c.id === sel.id) ? "Customer" : "New customer"}</div>
            <Field label="Name">
              <TextInput value={sel.name} onChange={(v) => setSel({ ...sel, name: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">
                <TextInput value={sel.phone} onChange={(v) => setSel({ ...sel, phone: v })} />
              </Field>
              <Field label="Email">
                <TextInput value={sel.email} onChange={(v) => setSel({ ...sel, email: v })} />
              </Field>
            </div>
            <Field label="Address">
              <TextInput value={sel.address} onChange={(v) => setSel({ ...sel, address: v })} />
            </Field>
            <Field label="Notes">
              <textarea className="h-20 w-full rounded-md border border-slate-300 p-2 text-[13px]" value={sel.notes} onChange={(e) => setSel({ ...sel, notes: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={save} disabled={!sel.name.trim()}>
                <Save size={14} /> Save
              </Button>
              <Button onClick={() => openNew(true)}>New project</Button>
              {customers.some((c) => c.id === sel.id) && (
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (!(await ask.confirm(`Delete ${sel.name}?`, true))) return;
                    await setCustomers(customers.filter((c) => c.id !== sel.id));
                    setSel(null);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projects</div>
              {projectsFor(sel).map((s) => (
                <Link key={s.id} href={`/design/${s.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] hover:bg-slate-50">
                  <span>{s.name}</span>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
              {!projectsFor(sel).length && <p className="text-[12px] text-slate-500">No projects yet.</p>}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Select a customer to view details, or add a new one.</p>
        )}
      </div>
    </div>
  );
}

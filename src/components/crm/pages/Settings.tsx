"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Building2, Percent, FileText, ListChecks, Shield, MapPin, MessageSquare, Workflow, Bell, PlugZap, Database, PencilRuler, Upload, Download, RotateCcw, Plus, Trash2, Play, CheckCircle2, Package, Truck, Users } from "lucide-react";
import { useCrm } from "@/store/crmStore";
import type { Automation, AutomationAction, AutomationTrigger, ChecklistTemplate, CrmSettings, MessageTemplate, PricingRule } from "@/lib/crm/types";
import { JOB_STATUSES, LEAD_STAGES, NOTIFICATION_TYPES, SERVICE_TYPES } from "@/lib/crm/constants";
import { INTEGRATIONS } from "@/lib/crm/integrations";
import { supabaseConfigured, crmRepo } from "@/lib/crm/repository";
import { describeRule } from "@/lib/crm/calc";
import { uid } from "@/lib/crm/workflows";
import { date, dateTime } from "@/lib/crm/format";
import { COLLECTIONS, type CrmData } from "@/lib/crm/types";
import { Page, PageHeader, Card, Button, Badge, Field, Input, Select, Textarea, Check, Switch, cn, useQuery, setQueryParam, NumberInput } from "../ui";
import { PermissionsMatrix } from "./Resources";
import { ask } from "@/components/AskHost";
import { toast } from "@/lib/crm/toast";

const SECTIONS = [
  { id: "business", label: "Business info", icon: Building2 },
  { id: "financial", label: "Tax, markup & pricing", icon: Percent },
  { id: "terms", label: "Terms", icon: FileText },
  { id: "statuses", label: "Job & lead statuses", icon: ListChecks },
  { id: "permissions", label: "Employees & permissions", icon: Shield },
  { id: "areas", label: "Service areas", icon: MapPin },
  { id: "templates", label: "Templates", icon: MessageSquare },
  { id: "automations", label: "Automation rules", icon: Workflow },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "data", label: "Data & backup", icon: Database },
] as const;

export function SettingsPage() {
  const q = useQuery();
  const tab = q.get("tab") ?? "business";
  return (
    <Page>
      <PageHeader title="Settings" />
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setQueryParam("tab", s.id)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium", tab === s.id ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60")}>
              <s.icon size={15} /> {s.label}
            </button>
          ))}
          <div className="my-2 hidden border-t border-slate-200 md:block" />
          <Link href="/inventory?tab=pricebook" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-white/60"><Package size={15} /> Price book</Link>
          <Link href="/vendors" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-white/60"><Truck size={15} /> Suppliers</Link>
          <Link href="/employees" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-white/60"><Users size={15} /> Employees</Link>
          <Link href="/settings/design" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-white/60"><PencilRuler size={15} /> Design Studio</Link>
        </nav>
        <div className="min-w-0 space-y-3">
          {tab === "business" && <Business />}
          {tab === "financial" && <Financial />}
          {tab === "terms" && <Terms />}
          {tab === "statuses" && <Statuses />}
          {tab === "permissions" && <PermissionsMatrix />}
          {tab === "areas" && <Areas />}
          {tab === "templates" && <Templates />}
          {tab === "automations" && <Automations />}
          {tab === "notifications" && <Notifications />}
          {tab === "integrations" && <Integrations />}
          {tab === "data" && <DataSection />}
        </div>
      </div>
    </Page>
  );
}

function useS() {
  const settings = useCrm((s) => s.settings);
  const save = useCrm((s) => s.saveSettings);
  return { s: settings, save };
}

function Business() {
  const { s, save } = useS();
  const logo = useRef<HTMLInputElement>(null);
  const t = (k: keyof CrmSettings) => <Input value={String(s[k] ?? "")} onChange={(e) => save({ [k]: e.target.value } as Partial<CrmSettings>)} />;
  return (
    <Card title="Business information">
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Business name">{t("businessName")}</Field>
          <Field label="Legal name">{t("legalName")}</Field>
          <Field label="Phone">{t("phone")}</Field>
          <Field label="Email">{t("email")}</Field>
          <Field label="Website">{t("website")}</Field>
          <Field label="Contractor license">{t("license")}</Field>
          <Field label="Street" className="col-span-2"><Input value={s.address.street} onChange={(e) => save({ address: { ...s.address, street: e.target.value } })} /></Field>
          <Field label="City"><Input value={s.address.city} onChange={(e) => save({ address: { ...s.address, city: e.target.value } })} /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="State"><Input value={s.address.state} onChange={(e) => save({ address: { ...s.address, state: e.target.value } })} /></Field><Field label="ZIP"><Input value={s.address.zip} onChange={(e) => save({ address: { ...s.address, zip: e.target.value } })} /></Field></div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Logo</div>
          <button onClick={() => logo.current?.click()} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-brand-400">
            {s.logoUrl ? <img src={s.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" /> : <span className="flex flex-col items-center gap-1 text-[12px] text-slate-500"><Upload size={18} /> Upload logo</span>}
          </button>
          <input ref={logo} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) save({ logoUrl: await crmRepo.uploadFile(f, `branding/logo-${Date.now()}`) }); }} />
        </div>
      </div>
    </Card>
  );
}

function Financial() {
  const { s, save } = useS();
  const rule = s.defaultPricing;
  return (
    <>
      <Card title="Tax, labor & fees">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Field label="Sales tax %" hint="Applied to taxable lines (materials)"><NumberInput value={s.taxPct} onChange={(v) => save({ taxPct: v })} step={0.25} /></Field>
          <Field label="Labor rate $/hr" hint="Billed rate"><NumberInput value={s.laborRate} onChange={(v) => save({ laborRate: v })} /></Field>
          <Field label="Labor burden %" hint="Payroll tax, comp, benefits"><NumberInput value={s.laborBurdenPct} onChange={(v) => save({ laborBurdenPct: v })} /></Field>
          <Field label="Default deposit %"><NumberInput value={s.defaultDepositPct} onChange={(v) => save({ defaultDepositPct: v })} /></Field>
          <Field label="Diagnostic fee"><NumberInput value={s.diagnosticFee} onChange={(v) => save({ diagnosticFee: v })} /></Field>
          <Field label="Trip charge"><NumberInput value={s.tripCharge} onChange={(v) => save({ tripCharge: v })} /></Field>
          <Field label="Estimate valid (days)"><NumberInput value={s.estimateValidDays} onChange={(v) => save({ estimateValidDays: v })} /></Field>
          <Field label="Invoice due (days)"><NumberInput value={s.invoiceDueDays} onChange={(v) => save({ invoiceDueDays: v })} /></Field>
          <Field label="Labor warranty (months)"><NumberInput value={s.laborWarrantyMonths} onChange={(v) => save({ laborWarrantyMonths: v })} /></Field>
        </div>
      </Card>
      <Card title="Default markup / pricing rule" sub="used for new price-book items">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Field label="Rule"><Select value={rule.type} onChange={(e) => save({ defaultPricing: { type: e.target.value, value: rule.value } as PricingRule })} options={[{ value: "multiplier", label: "Cost × multiplier" }, { value: "markup", label: "Markup %" }, { value: "margin", label: "Target margin %" }]} /></Field>
          <Field label="Value"><NumberInput value={rule.value} onChange={(v) => save({ defaultPricing: { ...rule, value: v } as PricingRule, defaultMarkupPct: rule.type === "markup" ? v : s.defaultMarkupPct })} step={rule.type === "multiplier" ? 0.1 : 1} /></Field>
          <Field label="Preview"><div className="pt-1.5 text-[13px] text-slate-700">{describeRule(rule)} — a $10.00 part sells for <b>${(rule.type === "multiplier" ? 10 * rule.value : rule.type === "markup" ? 10 * (1 + rule.value / 100) : 10 / (1 - rule.value / 100)).toFixed(2)}</b></div></Field>
        </div>
        <Link href="/inventory?tab=pricebook" className="mt-3 inline-block text-[12.5px] font-medium text-brand-700 hover:underline">Edit per-item pricing rules in the price book →</Link>
      </Card>
    </>
  );
}

function Terms() {
  const { s, save } = useS();
  return (
    <Card title="Default terms">
      <div className="space-y-3">
        <Field label="Estimate terms"><Textarea rows={4} value={s.estimateTerms} onChange={(e) => save({ estimateTerms: e.target.value })} /></Field>
        <Field label="Invoice terms"><Textarea rows={3} value={s.invoiceTerms} onChange={(e) => save({ invoiceTerms: e.target.value })} /></Field>
        <Field label="Payment terms (deposits)"><Textarea rows={3} value={s.paymentTerms} onChange={(e) => save({ paymentTerms: e.target.value })} /></Field>
      </div>
    </Card>
  );
}

function Statuses() {
  const { s, save } = useS();
  const row = (id: string, def: string) => (
    <div key={id} className="flex items-center gap-2"><span className="w-40 shrink-0 text-[12.5px] text-slate-500">{def}</span><Input value={(s.statusLabels as Record<string, string>)[id] ?? ""} placeholder={def} onChange={(e) => save({ statusLabels: { ...s.statusLabels, [id]: e.target.value || undefined } })} /></div>
  );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Job statuses" sub="rename to match your shop's language"><div className="space-y-1.5">{JOB_STATUSES.map((x) => row(x.id, x.label))}</div></Card>
      <Card title="Lead pipeline stages"><div className="space-y-1.5">{LEAD_STAGES.map((x) => row(x.id, x.label))}</div></Card>
    </div>
  );
}

function Areas() {
  const { s, save } = useS();
  return (
    <Card title="Service areas" actions={<Button size="sm" onClick={() => save({ serviceAreas: [...s.serviceAreas, { name: "New area", zips: [] }] })}><Plus size={13} /> Add area</Button>}>
      <div className="space-y-2">
        {s.serviceAreas.map((a, i) => (
          <div key={i} className="grid grid-cols-[200px_1fr_auto] items-center gap-2">
            <Input value={a.name} onChange={(e) => save({ serviceAreas: s.serviceAreas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <Input value={a.zips.join(", ")} placeholder="ZIP codes, comma separated" onChange={(e) => save({ serviceAreas: s.serviceAreas.map((x, j) => (j === i ? { ...x, zips: e.target.value.split(/[,\s]+/).filter(Boolean) } : x)) })} />
            <button onClick={() => save({ serviceAreas: s.serviceAreas.filter((_, j) => j !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-500">The public booking form flags requests outside these ZIP codes.</p>
    </Card>
  );
}

function Templates() {
  const st = useCrm();
  const [sel, setSel] = useState<string | null>(null);
  const [selChk, setSelChk] = useState<string | null>(null);
  const t = st.data.messageTemplates.find((x) => x.id === sel);
  const c = st.data.checklistTemplates.find((x) => x.id === selChk);
  return (
    <>
      <Card title="Message templates" sub="variables: {{first_name}} {{company}} {{tech_name}} {{eta}} {{date}} {{window}} {{link}} {{invoice_number}} {{balance}} {{estimate_total}}" actions={<Button size="sm" onClick={() => { const n: MessageTemplate = { id: uid("msg"), name: "New template", channel: "sms", subject: "", body: "", category: "general" }; st.insert("messageTemplates", n); setSel(n.id); }}><Plus size={13} /> New</Button>}>
        <div className="grid gap-3 md:grid-cols-[240px_1fr]">
          <div className="space-y-0.5">{st.data.messageTemplates.map((m) => <button key={m.id} onClick={() => setSel(m.id)} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px]", sel === m.id ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50")}>{m.name}<Badge>{m.channel}</Badge></button>)}</div>
          {t ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2"><Field label="Name"><Input value={t.name} onChange={(e) => st.update("messageTemplates", t.id, { name: e.target.value })} /></Field><Field label="Channel"><Select value={t.channel} onChange={(e) => st.update("messageTemplates", t.id, { channel: e.target.value as "sms" })} options={[{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} /></Field></div>
              {t.channel === "email" && <Field label="Subject"><Input value={t.subject} onChange={(e) => st.update("messageTemplates", t.id, { subject: e.target.value })} /></Field>}
              <Field label="Body"><Textarea rows={6} value={t.body} onChange={(e) => st.update("messageTemplates", t.id, { body: e.target.value })} /></Field>
              <Button size="sm" variant="danger" onClick={() => { st.remove("messageTemplates", t.id); setSel(null); }}><Trash2 size={13} /> Delete</Button>
            </div>
          ) : <p className="text-[12.5px] text-slate-500">Select a template to edit.</p>}
        </div>
      </Card>
      <Card title="Job checklists" actions={<Button size="sm" onClick={() => { const n: ChecklistTemplate = { id: uid("chk"), name: "New checklist", serviceTypes: [], items: [] }; st.insert("checklistTemplates", n); setSelChk(n.id); }}><Plus size={13} /> New</Button>}>
        <div className="grid gap-3 md:grid-cols-[240px_1fr]">
          <div className="space-y-0.5">{st.data.checklistTemplates.map((m) => <button key={m.id} onClick={() => setSelChk(m.id)} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px]", selChk === m.id ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50")}>{m.name}<span className="text-[11px] text-slate-400">{m.items.length}</span></button>)}</div>
          {c ? (
            <div className="space-y-2">
              <Field label="Name"><Input value={c.name} onChange={(e) => st.update("checklistTemplates", c.id, { name: e.target.value })} /></Field>
              <Field label="Steps (one per line)"><Textarea rows={10} value={c.items.join("\n")} onChange={(e) => st.update("checklistTemplates", c.id, { items: e.target.value.split("\n").filter((x) => x.trim()) })} /></Field>
              <div><div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Auto-apply to job types</div><div className="flex flex-wrap gap-x-4 gap-y-1">{SERVICE_TYPES.map((s) => <Check key={s.id} label={s.short} checked={c.serviceTypes.includes(s.id)} onChange={(v) => st.update("checklistTemplates", c.id, { serviceTypes: v ? [...c.serviceTypes, s.id] : c.serviceTypes.filter((x) => x !== s.id) })} />)}</div></div>
            </div>
          ) : <p className="text-[12.5px] text-slate-500">Select a checklist to edit.</p>}
        </div>
      </Card>
      <Card title="Estimate templates" sub={`${st.data.estimateTemplates.length} templates (Good / Better / Best supported) — create from any estimate's options`}>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{st.data.estimateTemplates.map((e) => <div key={e.id} className="rounded-lg border border-slate-200 px-3 py-2"><div className="text-[12.5px] font-medium">{e.name}</div><div className="text-[11.5px] text-slate-500">{e.options.length} option(s) · {SERVICE_TYPES.find((s) => s.id === e.serviceType)?.short}</div></div>)}</div>
      </Card>
    </>
  );
}

const TRIGGERS: { id: AutomationTrigger; label: string }[] = [
  { id: "estimate_sent", label: "Estimate sent (not approved)" },
  { id: "job_completed", label: "Job completed" },
  { id: "invoice_sent", label: "Invoice sent (unpaid)" },
  { id: "repair_completed", label: "Repair completed" },
  { id: "audit_due", label: "Annual audit due" },
  { id: "inventory_low", label: "Inventory below minimum" },
  { id: "lead_created", label: "New lead" },
  { id: "appointment_tomorrow", label: "Job scheduled tomorrow" },
  { id: "plan_visit_due", label: "Plan visit due in 7 days" },
  { id: "backflow_test_due", label: "Backflow test due" },
];
const ACTIONS: { id: AutomationAction; label: string }[] = [
  { id: "send_message", label: "Send message" },
  { id: "create_invoice", label: "Generate invoice" },
  { id: "notify", label: "Notify office" },
  { id: "create_reminder", label: "Create reminder" },
  { id: "create_purchase_alert", label: "Create purchase alert" },
];

function Automations() {
  const st = useCrm();
  const runs = st.data.automationRuns;
  return (
    <>
      <Card title="Automation rules" sub="evaluated every minute in the app — and on a schedule server-side in production" actions={<><Button size="sm" onClick={() => { const n = st.runAutomations(); toast(n ? `${n} automation action${n > 1 ? "s" : ""} executed` : "Nothing due right now", n ? "success" : "default"); }}><Play size={13} /> Run now</Button><Button size="sm" variant="primary" onClick={() => st.insert("automations", { id: uid("aut"), name: "New rule", description: "", trigger: "estimate_sent", delayDays: 3, condition: "not_approved", action: "send_message", templateId: "msg_est_fu1", enabled: false } satisfies Automation)}><Plus size={13} /> New rule</Button></>}>
        <div className="divide-y divide-slate-100">
          {st.data.automations.map((a) => (
            <div key={a.id} className="grid items-center gap-2 py-3 lg:grid-cols-[auto_1fr_auto]">
              <Switch checked={a.enabled} onChange={(v) => st.update("automations", a.id, { enabled: v })} />
              <div className="min-w-0">
                <Input value={a.name} onChange={(e) => st.update("automations", a.id, { name: e.target.value })} className="mb-1.5 h-7 border-transparent px-1 text-[13px] font-medium hover:border-slate-200" />
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                  <span>When</span>
                  <Select value={a.trigger} onChange={(e) => st.update("automations", a.id, { trigger: e.target.value as AutomationTrigger })} options={TRIGGERS.map((t) => ({ value: t.id, label: t.label }))} className="h-7 w-auto text-[12px]" />
                  <span>after</span>
                  <NumberInput value={a.delayDays} onChange={(v) => st.update("automations", a.id, { delayDays: v })} className="w-16" inputClassName="h-7" />
                  <span>days →</span>
                  <Select value={a.action} onChange={(e) => st.update("automations", a.id, { action: e.target.value as AutomationAction })} options={ACTIONS.map((t) => ({ value: t.id, label: t.label }))} className="h-7 w-auto text-[12px]" />
                  {a.action === "send_message" && <Select value={a.templateId ?? ""} onChange={(e) => st.update("automations", a.id, { templateId: e.target.value })} options={st.data.messageTemplates.map((t) => ({ value: t.id, label: t.name }))} className="h-7 w-auto text-[12px]" />}
                </div>
                {a.description && <div className="mt-1 text-[11.5px] text-slate-400">{a.description}</div>}
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
                <span>{runs.filter((r) => r.automationId === a.id).length} runs</span>
                <button onClick={() => st.remove("automations", a.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Recent automation runs" pad={false}>
        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {runs.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map((r) => <div key={r.id} className="flex items-center justify-between px-4 py-1.5 text-[12px]"><span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-600" />{st.data.automations.find((a) => a.id === r.automationId)?.name}</span><span className="text-slate-400">{r.result} · {dateTime(r.at)}</span></div>)}
          {!runs.length && <p className="px-4 py-4 text-[12.5px] text-slate-500">No runs yet.</p>}
        </div>
      </Card>
    </>
  );
}

function Notifications() {
  const { s, save } = useS();
  return (
    <Card title="Notification preferences" sub="in-app notification center (push / email delivery when integrations are connected)">
      <div className="grid gap-2 sm:grid-cols-2">
        {NOTIFICATION_TYPES.map((n) => <div key={n.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span className="text-[13px]">{n.label}</span><Switch checked={s.notificationPrefs[n.id] !== false} onChange={(v) => save({ notificationPrefs: { ...s.notificationPrefs, [n.id]: v } })} /></div>)}
      </div>
    </Card>
  );
}

function Integrations() {
  return (
    <>
      <Card title="Backend">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium">{supabaseConfigured() ? "Supabase (PostgreSQL) — connected" : "Local mode (IndexedDB on this device)"}</div>
            <div className="text-[12px] text-slate-500">{supabaseConfigured() ? "Data syncs to your Supabase project with row-level security per company." : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and run supabase/migrations to go multi-user."}</div>
          </div>
          <Badge tone={supabaseConfigured() ? "green" : "amber"} dot>{supabaseConfigured() ? "Cloud" : "Local"}</Badge>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <Card key={i.id} title={i.name} sub={i.category} actions={<Badge dot>Not connected</Badge>}>
            <p className="text-[12.5px] text-slate-600">{i.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{i.seam}</code>
              <Button size="sm" onClick={() => ask.alert(`${i.name} connects through a Supabase Edge Function that holds the API credentials (never the browser). The ${i.seam} interface in src/lib/crm/integrations.ts is the seam; register the provider with registerProvider() once the function is deployed.`)}>Connect</Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function DataSection() {
  const st = useCrm();
  const file = useRef<HTMLInputElement>(null);
  const counts = COLLECTIONS.map((c) => [c, (st.data[c] as unknown[]).length] as const);
  return (
    <>
      <Card title="Backup & restore">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { const blob = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings: st.settings, data: st.data }); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([blob], { type: "application/json" })); a.download = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }}><Download size={14} /> Export everything (JSON)</Button>
          <Button onClick={() => file.current?.click()}><Upload size={14} /> Import backup</Button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const j = JSON.parse(await f.text()) as { settings: CrmSettings; data: CrmData }; if (!(await ask.confirm("Replace all current data with this backup?", true))) return; await crmRepo.replaceAll({ data: j.data, settings: j.settings }); useCrm.setState({ data: j.data, settings: j.settings }); toast("Backup restored", "success"); }} />
          <Button variant="danger" onClick={async () => { if (await ask.confirm("Reset to the demo dataset? All local changes will be lost.", true)) await st.resetDemo(); }}><RotateCcw size={14} /> Reset demo data</Button>
        </div>
      </Card>
      <Card title="Records">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-3 lg:grid-cols-4">{counts.map(([c, n]) => <div key={c} className="flex justify-between border-b border-slate-50 py-0.5"><span className="text-slate-600">{c}</span><span className="tabular font-medium">{n.toLocaleString()}</span></div>)}</div>
        <p className="mt-3 text-[11.5px] text-slate-500">Data model: supabase/migrations/0001_core_schema.sql · security & views: 0002_security_views.sql · last opened {date(Date.now())}</p>
      </Card>
    </>
  );
}

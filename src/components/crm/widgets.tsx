"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Phone, MessageSquare, Mail, StickyNote, FileText, Wrench, Receipt, CreditCard, Camera, Bot, Activity, Package, ClipboardCheck, Filter, Send, Lightbulb, ArrowRight, Eraser } from "lucide-react";
import type { ActivityLog, ActivityType, Channel, Message } from "@/lib/crm/types";
import { useCrm } from "@/store/crmStore";
import { dateTime, relative, fullName } from "@/lib/crm/format";
import { renderTemplate } from "@/lib/crm/integrations";
import { recommendations, type Recommendation } from "@/lib/crm/recommendations";
import { Button, cn, Select, Textarea, Empty, Badge } from "./ui";

/* ───────── activity timeline ───────── */

const ACT_ICON: Record<ActivityType, typeof Phone> = { lead: Filter, call: Phone, text: MessageSquare, email: Mail, note: StickyNote, estimate: FileText, job: Wrench, status: Activity, invoice: Receipt, payment: CreditCard, photo: Camera, document: FileText, system: Activity, automation: Bot, inventory: Package, audit: ClipboardCheck };
const ACT_TONE: Partial<Record<ActivityType, string>> = { payment: "bg-emerald-50 text-emerald-700", estimate: "bg-violet-50 text-violet-700", invoice: "bg-sky-50 text-sky-700", automation: "bg-amber-50 text-amber-700", lead: "bg-brand-50 text-brand-700" };

export function Timeline({ entries, limit = 40, empty = "No activity yet." }: { entries: ActivityLog[]; limit?: number; empty?: string }) {
  const employees = useCrm((s) => s.data.employees);
  const [n, setN] = useState(limit);
  const sorted = useMemo(() => entries.slice().sort((a, b) => b.at.localeCompare(a.at)), [entries]);
  if (!sorted.length) return <p className="py-4 text-center text-[12.5px] text-slate-500">{empty}</p>;
  let lastDay = "";
  return (
    <ol className="relative">
      {sorted.slice(0, n).map((a) => {
        const Icon = ACT_ICON[a.type] ?? Activity;
        const day = new Date(a.at).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const by = employees.find((e) => e.id === a.by);
        return (
          <li key={a.id}>
            {showDay && <div className="mb-1 mt-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 first:mt-0">{new Date(a.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: new Date(a.at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}</div>}
            <div className="relative flex gap-2.5 pb-2.5">
              <span className={cn("z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full", ACT_TONE[a.type] ?? "bg-slate-100 text-slate-500")}>
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="text-[12.5px] leading-snug text-slate-800">{a.message}</div>
                <div className="text-[11px] text-slate-400">
                  {new Date(a.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {by && ` · ${by.firstName}`}
                </div>
              </div>
            </div>
          </li>
        );
      })}
      {sorted.length > n && (
        <button className="text-[12px] font-medium text-brand-700 hover:underline" onClick={() => setN(n + 60)}>
          Show older ({sorted.length - n})
        </button>
      )}
    </ol>
  );
}

/* ───────── communication ───────── */

const CH_ICON: Record<Channel, typeof Phone> = { sms: MessageSquare, email: Mail, call: Phone, note: StickyNote, portal: MessageSquare };

export function Conversation({ customerId, jobId }: { customerId: string; jobId?: string }) {
  const { data, sendMessage, log, settings } = useCrm();
  const msgs = data.messages.filter((m) => m.customerId === customerId && (!jobId || !m.jobId || m.jobId === jobId)).sort((a, b) => a.at.localeCompare(b.at));
  const c = data.customers.find((x) => x.id === customerId);
  const [channel, setChannel] = useState<Channel>("sms");
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs.length]);
  const templates = data.messageTemplates.filter((t) => channel === "sms" || channel === "email" ? t.channel === channel : true);
  return (
    <div className="flex flex-col">
      <div className="max-h-[420px] min-h-[120px] space-y-2 overflow-y-auto pr-1">
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} name={m.by ? data.employees.find((e) => e.id === m.by)?.firstName : undefined} />
        ))}
        {!msgs.length && <Empty icon={<MessageSquare size={18} />} title="No messages yet">Texts, emails, calls and notes appear here.</Empty>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 p-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {(["sms", "email", "call", "note"] as Channel[]).map((ch) => {
            const I = CH_ICON[ch];
            return (
              <button key={ch} onClick={() => setChannel(ch)} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium", channel === ch ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100")}>
                <I size={12} /> {ch === "sms" ? "Text" : ch === "call" ? "Log call" : ch[0].toUpperCase() + ch.slice(1)}
              </button>
            );
          })}
          {(channel === "sms" || channel === "email") && (
            <Select
              className="ml-auto h-7 w-44 text-[12px]"
              value=""
              onChange={(e) => {
                const t = data.messageTemplates.find((x) => x.id === e.target.value);
                if (t) setBody(renderTemplate(t.body, { first_name: c?.firstName, company: settings.businessName, tech_name: "", eta: 20 }));
              }}
              options={[{ value: "", label: "Insert template…" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
            />
          )}
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={channel === "call" ? "Call summary…" : channel === "note" ? "Internal note…" : `Message ${c?.firstName ?? ""}…`} className="min-h-[56px] border-0 px-1 focus:ring-0" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{channel === "sms" ? `${c?.phone ?? ""} · via messaging provider` : channel === "email" ? c?.email : "Saved to history"}</span>
          <Button
            size="sm"
            variant="primary"
            disabled={!body.trim()}
            onClick={() => {
              sendMessage({ customerId, jobId, channel, direction: "out", body, subject: channel === "email" ? `Message from ${settings.businessName}` : undefined });
              log({ type: channel === "sms" ? "text" : channel === "call" ? "call" : channel === "email" ? "email" : "note", message: channel === "call" ? `Call logged: ${body.slice(0, 80)}` : channel === "note" ? `Note: ${body.slice(0, 80)}` : `${channel === "sms" ? "Text" : "Email"} sent: ${body.slice(0, 60)}${body.length > 60 ? "…" : ""}`, entityType: jobId ? "job" : "customer", entityId: jobId ?? customerId, customerId, jobId });
              setBody("");
            }}
          >
            <Send size={12} /> {channel === "call" || channel === "note" ? "Save" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m, name }: { m: Message; name?: string }) {
  const out = m.direction === "out";
  const I = CH_ICON[m.channel];
  if (m.channel === "call" || m.channel === "note")
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 px-2.5 py-2 text-[12.5px] text-slate-700">
        <I size={13} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="whitespace-pre-wrap">{m.body}</div>
          <div className="mt-0.5 text-[10.5px] text-slate-400">
            {m.channel === "call" ? "Call" : "Note"} · {name ?? ""} · {dateTime(m.at)}
          </div>
        </div>
      </div>
    );
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px]", out ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-800")}>
        {m.subject && <div className={cn("mb-0.5 font-semibold", out ? "text-white" : "text-slate-900")}>{m.subject}</div>}
        <div className="whitespace-pre-wrap">{m.body}</div>
        <div className={cn("mt-1 flex items-center gap-1 text-[10.5px]", out ? "text-white/70" : "text-slate-400")}>
          <I size={10} /> {dateTime(m.at)}
          {out && ` · ${m.status}`}
          {m.automationId && " · automated"}
        </div>
      </div>
    </div>
  );
}

/* ───────── signature ───────── */

export function SignaturePad({ onSave, onCancel, name: initialName = "", label = "Sign here" }: { onSave: (sig: { name: string; dataUrl: string; signedAt: string }) => void; onCancel?: () => void; name?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(initialName);
  const [drawn, setDrawn] = useState(false);
  const drawing = useRef(false);
  // The pad is "paper": always white with dark ink in both themes, and the saved
  // PNG has a white background so the signature reads on dark screens too.
  const setup = () => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    c.width = r.width * 2;
    c.height = r.height * 2;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  };
  useEffect(setup, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={ref}
          style={{ backgroundColor: "#ffffff" }}
          className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-300"
          onPointerDown={(e) => {
            // opened inside an animating dialog the first measure can be 0×0
            const c = ref.current!;
            if (!drawn && c.width !== Math.round(c.getBoundingClientRect().width * 2)) setup();
            drawing.current = true;
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            const ctx = ref.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = ref.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
            setDrawn(true);
          }}
          onPointerUp={() => (drawing.current = false)}
        />
        {!drawn && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px]" style={{ color: "#94a3b8" }}>{label}</span>}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b" style={{ borderColor: "#cbd5e1" }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Printed name" className="h-9 min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-[13px]" />
        <Button
          variant="ghost"
          onClick={() => {
            setup();
            setDrawn(false);
          }}
        >
          <Eraser size={13} /> Clear
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" disabled={!drawn || !name.trim()} onClick={() => onSave({ name, dataUrl: ref.current!.toDataURL("image/png"), signedAt: new Date().toISOString() })}>
          Accept & sign
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">By signing you agree to the scope, price and terms shown. Signature, name, time and device are recorded.</p>
    </div>
  );
}

/* ───────── smart recommendations ───────── */

export function Recommendations({ customerId, propertyId, limit = 6, title = true }: { customerId?: string; propertyId?: string; limit?: number; title?: boolean }) {
  const data = useCrm((s) => s.data);
  const settings = useCrm((s) => s.settings);
  const now = useCrm((s) => s.now);
  const recs = useMemo(() => recommendations(data, settings, now, { customerId, propertyId }), [data, settings, now, customerId, propertyId]);
  const [showAll, setShowAll] = useState(false);
  if (!recs.length) return title ? <p className="text-[12.5px] text-slate-500">No suggestions right now — everything looks on track.</p> : null;
  return (
    <div className="space-y-1.5">
      {(showAll ? recs : recs.slice(0, limit)).map((r) => (
        <RecRow key={r.id} r={r} />
      ))}
      {recs.length > limit && (
        <button onClick={() => setShowAll(!showAll)} className="text-[12px] font-medium text-brand-700 hover:underline">
          {showAll ? "Show fewer" : `Show all ${recs.length} suggestions`}
        </button>
      )}
    </div>
  );
}

function RecRow({ r }: { r: Recommendation }) {
  const tone = r.severity === "high" ? "border-l-red-500" : r.severity === "warn" ? "border-l-amber-500" : "border-l-brand-500";
  return (
    <Link href={r.link} className={cn("group flex items-start gap-2.5 rounded-lg border border-l-[3px] border-slate-200 bg-white px-3 py-2 hover:border-slate-300 hover:bg-slate-50", tone)}>
      <Lightbulb size={14} className={cn("mt-0.5 shrink-0", r.severity === "high" ? "text-red-500" : r.severity === "warn" ? "text-amber-500" : "text-brand-500")} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium leading-snug text-slate-900">{r.title}</span>
        <span className="block text-[11.5px] leading-snug text-slate-500">{r.detail}</span>
      </span>
      <ArrowRight size={13} className="mt-1 shrink-0 text-slate-300 group-hover:text-slate-500" />
    </Link>
  );
}



export function WhoBadge({ id }: { id?: string }) {
  const e = useCrm((s) => s.data.employees.find((x) => x.id === id));
  return e ? <span className="text-slate-700">{fullName(e)}</span> : <span className="text-slate-400">Unassigned</span>;
}

export function Ago({ at }: { at?: string }) {
  const now = useCrm((s) => s.now);
  return <span title={at ? dateTime(at) : ""}>{relative(at, now)}</span>;
}

export function TagList({ tags }: { tags: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t} tone={t === "VIP" ? "violet" : t === "Problem Customer" ? "red" : t === "Needs Follow-Up" ? "amber" : t === "Maintenance Plan" ? "brand" : t === "High Value" ? "green" : t === "Commercial" ? "blue" : "teal"}>
          {t}
        </Badge>
      ))}
    </span>
  );
}

/**
 * Instant client-side global search across customers, phone numbers, addresses,
 * jobs, estimates, invoices, zone/valve notes, sprinkler & controller models,
 * properties, technicians and materials. (Server-side equivalent:
 * global_search() in supabase/migrations/0002_security_views.sql.)
 *
 * All query tokens must match (AND); results rank exact/prefix matches first.
 * "Rain Bird 5000" → every property whose zones or map components use that model.
 */
import type { CrmData } from "./types";
import { addressLine, customerName, fullName } from "./format";
import { serviceLabel } from "./constants";

export type SearchKind = "customer" | "property" | "job" | "estimate" | "invoice" | "equipment" | "employee" | "item" | "lead";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  match?: string;
}

interface Doc {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  text: string;
  match?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}#.\s-]/gu, " ");
const cache = new WeakMap<CrmData, Doc[]>();

function buildIndex(d: CrmData): Doc[] {
  const hit = cache.get(d);
  if (hit) return hit;
  const docs: Doc[] = [];
  const cust = new Map(d.customers.map((c) => [c.id, c]));
  const prop = new Map(d.properties.map((p) => [p.id, p]));
  const sysProp = new Map(d.systems.map((s) => [s.id, s.propertyId]));
  for (const c of d.customers) {
    const digits = (c.phone + " " + (c.altPhone ?? "")).replace(/\D/g, " ");
    docs.push({ kind: "customer", id: c.id, title: customerName(c), subtitle: `${c.phone} · ${addressLine(c.billingAddress)}`, href: `/customers/${c.id}`, text: norm(`${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.email} ${c.phone} ${c.phone.replace(/\D/g, "")} ${digits} ${c.tags.join(" ")}`) });
  }
  for (const p of d.properties) {
    const c = cust.get(p.customerId);
    docs.push({ kind: "property", id: p.id, title: p.address.street, subtitle: `${p.address.city} · ${customerName(c)}${p.name !== "Home" ? ` · ${p.name}` : ""}`, href: `/properties/${p.id}`, text: norm(`${p.address.street} ${p.address.city} ${p.address.zip} ${p.name} ${p.gateCode} ${p.controllerLocation} ${p.valveLocations} ${p.landscapeNotes}`) });
  }
  for (const l of d.leads) if (!l.customerId) docs.push({ kind: "lead", id: l.id, title: fullName(l), subtitle: `Lead · ${serviceLabel(l.serviceType)} · ${l.phone}`, href: `/leads?open=${l.id}`, text: norm(`${l.firstName} ${l.lastName} ${l.phone} ${l.phone.replace(/\D/g, "")} ${l.email} ${l.address.street}`) });
  for (const j of d.jobs) {
    const c = cust.get(j.customerId);
    docs.push({ kind: "job", id: j.id, title: `#${j.number} ${j.title}`, subtitle: `${customerName(c)} · ${j.status.replace(/_/g, " ")}`, href: `/jobs/${j.id}`, text: norm(`#${j.number} ${j.number} job ${j.title} ${customerName(c)} ${j.scope}`) });
  }
  for (const e of d.estimates) {
    const c = cust.get(e.customerId);
    docs.push({ kind: "estimate", id: e.id, title: `Estimate #${e.number} ${e.title}`, subtitle: `${customerName(c)} · ${e.status}`, href: `/estimates/${e.id}`, text: norm(`#${e.number} ${e.number} est estimate ${e.title} ${customerName(c)}`) });
  }
  for (const i of d.invoices) {
    const c = cust.get(i.customerId);
    docs.push({ kind: "invoice", id: i.id, title: `INV-${i.number}`, subtitle: `${customerName(c)} · ${i.status}`, href: `/invoices/${i.id}`, text: norm(`inv-${i.number} inv ${i.number} invoice ${customerName(c)} ${i.notes}`) });
  }
  // equipment: zones, controllers, map components → grouped per property
  const equip = new Map<string, { models: Set<string>; text: string[] }>();
  const addEq = (pid: string | undefined, label: string, text: string) => {
    if (!pid) return;
    const e = equip.get(pid) ?? { models: new Set<string>(), text: [] };
    e.models.add(label);
    e.text.push(text);
    equip.set(pid, e);
  };
  for (const z of d.zones) addEq(sysProp.get(z.systemId), `${z.manufacturer} ${z.model} (Zone ${z.number} ${z.name})`, `${z.manufacturer} ${z.model} ${z.valveType} ${z.nozzleType} ${z.dripLineType} ${z.valveLocation} ${z.notes} ${z.problems}`);
  for (const c of d.controllers) addEq(sysProp.get(c.systemId), `${c.manufacturer} ${c.model} controller`, `${c.manufacturer} ${c.model} controller ${c.location}`);
  for (const c of d.components) if (c.model || c.notes) addEq(sysProp.get(c.systemId), `${c.manufacturer} ${c.model} ${c.label}`.trim(), `${c.manufacturer} ${c.model} ${c.notes}`);
  for (const [pid, e] of equip) {
    const p = prop.get(pid);
    if (!p) continue;
    docs.push({ kind: "equipment", id: pid, title: p.address.street, subtitle: customerName(cust.get(p.customerId)), href: `/properties/${pid}?tab=system`, text: norm(e.text.join(" | ")), match: [...e.models].join(" · ") });
  }
  for (const e of d.employees) docs.push({ kind: "employee", id: e.id, title: fullName(e), subtitle: e.role.replace("_", " "), href: `/employees?open=${e.id}`, text: norm(`${e.firstName} ${e.lastName} ${e.phone} ${e.role}`) });
  for (const i of d.items) docs.push({ kind: "item", id: i.id, title: i.name, subtitle: `${i.sku} · ${i.stocked ? `${i.warehouseQty} ${i.unit} in stock` : i.category}`, href: `/inventory?item=${i.id}`, text: norm(`${i.name} ${i.sku} ${i.manufacturer} ${i.category}`) });
  cache.set(d, docs);
  return docs;
}

export function search(d: CrmData, q: string, limit = 40): SearchResult[] {
  const query = norm(q).trim();
  if (!query) return [];
  const tokens = query.split(/\s+/).filter(Boolean);
  const out: SearchResult[] = [];
  for (const doc of buildIndex(d)) {
    if (!tokens.every((t) => doc.text.includes(t))) continue;
    const title = doc.title.toLowerCase();
    let score = 1;
    if (title === query) score += 10;
    if (title.startsWith(query)) score += 5;
    if (tokens.every((t) => title.includes(t))) score += 3;
    if (doc.kind === "customer") score += 1.5;
    let match = doc.match;
    if (doc.kind === "equipment" && match) {
      const parts = match.split(" · ").filter((m) => tokens.every((t) => norm(m).includes(t)));
      if (!parts.length && !tokens.every((t) => norm(match!).includes(t))) score -= 0.5;
      match = (parts.length ? parts : match.split(" · ")).slice(0, 3).join(" · ");
    }
    out.push({ kind: doc.kind, id: doc.id, title: doc.title, subtitle: doc.subtitle, href: doc.href, score, match });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

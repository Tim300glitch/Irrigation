/**
 * Declarative mapping between the TypeScript model (camelCase, embedded child
 * arrays, nested value objects) and the relational schema (snake_case, flattened
 * columns, child tables). Used by SupabaseCrmRepository; round-trip tested.
 */
import type { CollectionName } from "./types";

const ADDR = ["street", "city", "state", "zip"];

interface Child {
  table: string;
  fk: string;
}
interface Spec {
  table: string;
  key?: string;
  /** nested object → prefixed columns */
  flatten?: Record<string, [prefix: string, keys: string[]]>;
  /** ts path → column (path is "field" or "field.sub") */
  rename?: Record<string, string>;
  /** ts fields stored in child tables (or nowhere) */
  omit?: string[];
  /** db columns never written back (generated) */
  readonly?: string[];
  children?: Child[];
  defaults?: Record<string, unknown>;
}

export const SPEC: Record<CollectionName, Spec> = {
  employees: { table: "employees" },
  trucks: { table: "trucks" },
  customers: { table: "customers", flatten: { billingAddress: ["billing_", ADDR] } },
  properties: {
    table: "properties",
    flatten: { address: ["", ADDR], backflow: ["backflow_", ["type", "make", "size", "location", "serial", "lastTestDate"]] },
    rename: { "backflow.lastTestDate": "backflow_last_test" },
  },
  systems: { table: "irrigation_systems" },
  controllers: { table: "controllers" },
  zones: { table: "zones" },
  components: { table: "components", omit: ["valve", "sprinkler"], children: [{ table: "valves", fk: "component_id" }, { table: "sprinklers", fk: "component_id" }] },
  leads: { table: "leads", flatten: { address: ["", ADDR] }, omit: ["photoIds"], defaults: { photoIds: [] } },
  estimates: {
    table: "estimates",
    flatten: { discount: ["discount_", ["type", "value", "reason"]] },
    omit: ["options"],
    children: [
      { table: "estimate_options", fk: "estimate_id" },
      { table: "estimate_items", fk: "estimate_id" },
    ],
  },
  estimateTemplates: { table: "estimate_templates" },
  jobs: {
    table: "jobs",
    flatten: { estimated: ["est_", ["revenue", "materialCost", "laborCost", "equipmentCost"]] },
    omit: ["items", "checklist", "otherCosts", "crew", "zoneIds", "componentIds", "invoiceId"],
    children: [
      { table: "job_items", fk: "job_id" },
      { table: "job_checklist_items", fk: "job_id" },
      { table: "job_costs", fk: "job_id" },
      { table: "job_crew", fk: "job_id" },
      { table: "job_zones", fk: "job_id" },
    ],
  },
  changeOrders: { table: "change_orders" },
  appointments: { table: "appointments", rename: { start: "starts_at", end: "ends_at" }, omit: ["employeeIds"], children: [{ table: "appointment_employees", fk: "appointment_id" }] },
  checklistTemplates: { table: "checklist_templates" },
  invoices: { table: "invoices", flatten: { discount: ["discount_", ["type", "value"]] }, omit: ["items"], children: [{ table: "invoice_items", fk: "invoice_id" }] },
  payments: { table: "payments" },
  items: { table: "inventory_items", flatten: { pricing: ["pricing_", ["type", "value"]] }, rename: { "pricing.type": "pricing_rule" } },
  truckStock: { table: "truck_inventory" },
  inventoryTxns: { table: "inventory_transactions", rename: { location: "truck_id" } },
  vendors: { table: "vendors" },
  timeEntries: { table: "time_entries", rename: { start: "starts_at", end: "ends_at" } },
  servicePlans: { table: "service_plans" },
  planSubscriptions: { table: "service_plan_subscriptions" },
  audits: { table: "audit_reports" },
  photos: { table: "photos" },
  documents: { table: "documents" },
  messages: { table: "messages", rename: { by: "by_employee" } },
  messageTemplates: { table: "message_templates" },
  automations: { table: "automations" },
  automationRuns: { table: "automation_runs" },
  campaigns: { table: "marketing_sources" },
  warranties: { table: "warranties", readonly: ["labor_expires", "mfr_expires"] },
  activity: { table: "activity_logs", rename: { by: "by_employee" } },
  notifications: { table: "notifications" },
  installs: { table: "install_projects" },
  purchaseOrders: { table: "purchase_orders" },
};

/** Upsert order for a full sync (parents before children). */
export const SYNC_ORDER: CollectionName[] = [
  "employees", "trucks", "vendors", "campaigns", "customers", "properties", "systems", "controllers", "zones", "components",
  "leads", "items", "truckStock", "estimateTemplates", "checklistTemplates", "estimates", "installs", "servicePlans", "planSubscriptions",
  "jobs", "changeOrders", "appointments", "invoices", "payments", "inventoryTxns", "timeEntries", "audits", "photos", "documents",
  "messageTemplates", "automations", "automationRuns", "messages", "notifications", "warranties", "activity", "purchaseOrders",
];

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

type Row = Record<string, unknown>;

export function toRow(name: CollectionName, e: Row, orgId: string): Row {
  const spec = SPEC[name];
  const row: Row = {};
  for (const [k, v] of Object.entries(e)) {
    if (spec.omit?.includes(k)) continue;
    const flat = spec.flatten?.[k];
    if (flat) {
      const obj = (v ?? {}) as Row;
      for (const sub of flat[1]) row[spec.rename?.[`${k}.${sub}`] ?? flat[0] + snake(sub)] = obj[sub] ?? null;
      continue;
    }
    if (name === "inventoryTxns" && k === "location") {
      row.truck_id = v === "warehouse" ? null : v;
      continue;
    }
    row[spec.rename?.[k] ?? snake(k)] = v === undefined ? null : v;
  }
  row.org_id = orgId;
  for (const r of spec.readonly ?? []) delete row[r];
  return row;
}

export function fromRow(name: CollectionName, row: Row): Row {
  const spec = SPEC[name];
  const out: Row = { ...(spec.defaults ?? {}) };
  const reverse = new Map<string, string>();
  for (const [ts, col] of Object.entries(spec.rename ?? {})) if (!ts.includes(".")) reverse.set(col, ts);
  const flatCols = new Map<string, [string, string]>();
  for (const [field, [prefix, keys]] of Object.entries(spec.flatten ?? {})) {
    out[field] = {};
    for (const sub of keys) flatCols.set(spec.rename?.[`${field}.${sub}`] ?? prefix + snake(sub), [field, sub]);
  }
  const childTables = new Set((spec.children ?? []).map((c) => c.table));
  for (const [col, v] of Object.entries(row)) {
    if (col === "org_id" || col === "updated_at" || childTables.has(col) || spec.readonly?.includes(col)) continue;
    const f = flatCols.get(col);
    if (f) {
      if (v !== null) (out[f[0]] as Row)[f[1]] = v;
      continue;
    }
    if (name === "inventoryTxns" && col === "truck_id") {
      out.location = v ?? "warehouse";
      continue;
    }
    if (v === null) continue;
    out[reverse.get(col) ?? camel(col)] = v;
  }
  joinChildren(name, out, row);
  return out;
}

const itemCols = (i: Row, extra: Row) => ({
  id: i.id,
  ...extra,
  item_id: i.itemId ?? null,
  kind: i.kind,
  name: i.name,
  description: i.description ?? "",
  qty: i.qty,
  unit: i.unit,
  unit_cost: i.unitCost,
  unit_price: i.unitPrice,
  taxable: i.taxable,
});
const itemFrom = (r: Row): Row => ({
  id: r.id,
  ...(r.item_id ? { itemId: r.item_id } : {}),
  kind: r.kind,
  name: r.name,
  description: r.description ?? "",
  qty: Number(r.qty),
  unit: r.unit,
  unitCost: Number(r.unit_cost),
  unitPrice: Number(r.unit_price),
  taxable: r.taxable,
});
const bySort = (a: Row, b: Row) => Number(a.sort ?? 0) - Number(b.sort ?? 0);

/** Rows for one child table of an entity. */
export function splitChildren(name: CollectionName, table: string, e: Row): Row[] {
  const id = e.id;
  switch (`${name}:${table}`) {
    case "estimates:estimate_options":
      return (e.options as Row[]).map((o, sort) => ({ id: o.id, estimate_id: id, name: o.name, description: o.description, tier: o.tier ?? null, sort }));
    case "estimates:estimate_items":
      return (e.options as Row[]).flatMap((o) => (o.items as Row[]).map((i, sort) => itemCols(i, { estimate_id: id, option_id: o.id, sort })));
    case "invoices:invoice_items":
      return (e.items as Row[]).map((i, sort) => itemCols(i, { invoice_id: id, sort }));
    case "jobs:job_items":
      return (e.items as Row[]).map((i, sort) => ({ ...itemCols(i, { job_id: id, sort }), used_qty: i.usedQty ?? null, added_in_field: !!i.addedInField, change_order_id: i.changeOrderId ?? null }));
    case "jobs:job_checklist_items":
      return (e.checklist as Row[]).map((c, sort) => ({ id: c.id, job_id: id, label: c.label, done: c.done, done_at: c.doneAt ?? null, done_by: c.doneBy ?? null, sort }));
    case "jobs:job_costs":
      return ((e.otherCosts as Row[]) ?? []).map((c) => ({ id: c.id, job_id: id, kind: c.kind, label: c.label, amount: c.amount }));
    case "jobs:job_crew":
      return (e.crew as string[]).map((employee_id) => ({ job_id: id, employee_id }));
    case "jobs:job_zones":
      return [...(e.zoneIds as string[]).map((zone_id) => ({ job_id: id, zone_id, component_id: null })), ...(e.componentIds as string[]).map((component_id) => ({ job_id: id, zone_id: null, component_id }))];
    case "appointments:appointment_employees":
      return (e.employeeIds as string[]).map((employee_id) => ({ appointment_id: id, employee_id }));
    case "components:valves":
      return e.valve ? [{ component_id: id, ...snakeKeys(e.valve as Row) }] : [];
    case "components:sprinklers":
      return e.sprinkler ? [{ component_id: id, ...snakeKeys(e.sprinkler as Row) }] : [];
  }
  return [];
}

const snakeKeys = (o: Row) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v ?? null]));
const camelKeys = (o: Row) => Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== "component_id" && v !== null).map(([k, v]) => [camel(k), v]));

function joinChildren(name: CollectionName, out: Row, row: Row) {
  // PostgREST embeds one-to-one children (valves, sprinklers) as an object, others as arrays
  const rows = (t: string) => {
    const v = row[t] as Row[] | Row | null | undefined;
    return (Array.isArray(v) ? v : v ? [v] : []).slice().sort(bySort);
  };
  switch (name) {
    case "estimates": {
      const items = rows("estimate_items");
      out.options = rows("estimate_options").map((o) => ({ id: o.id, name: o.name, description: o.description ?? "", ...(o.tier ? { tier: o.tier } : {}), items: items.filter((i) => i.option_id === o.id).map(itemFrom) }));
      break;
    }
    case "invoices":
      out.items = rows("invoice_items").map(itemFrom);
      break;
    case "jobs":
      out.items = rows("job_items").map((r) => ({ ...itemFrom(r), ...(r.used_qty !== null && r.used_qty !== undefined ? { usedQty: Number(r.used_qty) } : {}), ...(r.added_in_field ? { addedInField: true } : {}), ...(r.change_order_id ? { changeOrderId: r.change_order_id } : {}) }));
      out.checklist = rows("job_checklist_items").map((c) => ({ id: c.id, label: c.label, done: c.done, ...(c.done_at ? { doneAt: c.done_at } : {}), ...(c.done_by ? { doneBy: c.done_by } : {}) }));
      out.otherCosts = rows("job_costs").map((c) => ({ id: c.id, kind: c.kind, label: c.label, amount: Number(c.amount) }));
      out.crew = rows("job_crew").map((c) => c.employee_id);
      out.zoneIds = rows("job_zones").filter((z) => z.zone_id).map((z) => z.zone_id);
      out.componentIds = rows("job_zones").filter((z) => z.component_id).map((z) => z.component_id);
      break;
    case "appointments":
      out.employeeIds = rows("appointment_employees").map((a) => a.employee_id);
      break;
    case "components": {
      const v = rows("valves")[0];
      const s = rows("sprinklers")[0];
      if (v) out.valve = camelKeys(v);
      if (s) out.sprinkler = camelKeys(s);
      break;
    }
  }
}

/**
 * Pure workflow transforms: price-book lines, templates → estimate options,
 * estimate → job, job → invoice, deposits, install material takeoff and
 * schematic system maps. The store wraps these with persistence + activity.
 */
import type {
  CrmSettings,
  Estimate,
  EstimateOption,
  EstimateTemplate,
  InstallDesignData,
  InventoryItem,
  Invoice,
  Job,
  LineItem,
  IrrigationSystem,
  ServiceType,
  SystemComponent,
  Zone,
  Controller,
  ChecklistTemplate,
} from "./types";
import { lineTotals, optionTotals, primaryOption, priceFromRule, r2 } from "./calc";
import { DEFAULT_ROLE_PERMISSIONS, NOTIFICATION_TYPES } from "./constants";
import { ESTIMATE_TEMPLATES_RAW } from "./catalog";
import { isoDate } from "./format";

let counter = 0;
export function uid(prefix: string) {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultSettings(): CrmSettings {
  return {
    businessName: "DeltaLine Irrigation",
    legalName: "DeltaLine Irrigation, Inc.",
    phone: "(951) 555-0142",
    email: "office@deltaline.example",
    website: "deltaline.example",
    address: { street: "3150 Chicago Ave, Suite 4", city: "Riverside", state: "CA", zip: "92507" },
    license: "CA C-27 #1048821",
    taxPct: 7.75,
    defaultMarkupPct: 60,
    defaultPricing: { type: "markup", value: 60 },
    laborRate: 95,
    laborBurdenPct: 28,
    tripCharge: 0,
    diagnosticFee: 89,
    defaultDepositPct: 50,
    estimateValidDays: 30,
    invoiceDueDays: 15,
    estimateTerms: "Estimate valid for 30 days. Price includes materials, labor and cleanup unless noted. Unforeseen conditions (rock, roots, buried debris, hidden pipe damage) may require a change order, which will be approved by you before work continues.",
    invoiceTerms: "Payment due within 15 days. A 1.5% monthly late fee applies to balances over 30 days.",
    paymentTerms: "50% deposit to schedule installs over $2,500, balance due on completion. Repairs are due on completion.",
    laborWarrantyMonths: 12,
    serviceAreas: [
      { name: "Riverside", zips: ["92501", "92503", "92504", "92505", "92506", "92507", "92508"] },
      { name: "Corona / Norco", zips: ["92879", "92880", "92881", "92882", "92860"] },
      { name: "Temecula / Murrieta", zips: ["92590", "92591", "92592", "92562", "92563"] },
      { name: "Moreno Valley / Perris", zips: ["92551", "92553", "92555", "92557", "92570", "92571"] },
    ],
    statusLabels: {},
    notificationPrefs: Object.fromEntries(NOTIFICATION_TYPES.map((n) => [n.id, true])) as CrmSettings["notificationPrefs"],
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    nextNumbers: { estimate: 1001, job: 2001, invoice: 3001, changeOrder: 1 },
  };
}

/* ───────────────────────── Lines ───────────────────────── */

export function lineFromItem(item: InventoryItem, qty: number, over: Partial<LineItem> = {}): LineItem {
  const kind = item.category === "labor" ? "labor" : item.category === "equipment" ? "equipment" : "material";
  return {
    id: uid("li"),
    itemId: item.id,
    kind,
    name: item.name,
    description: "",
    qty,
    unit: item.unit,
    unitCost: item.cost,
    unitPrice: priceFromRule(item.cost, item.pricing),
    taxable: item.taxable,
    ...over,
  };
}

export function customLine(kind: LineItem["kind"], name: string, qty: number, unitPrice: number, unitCost = 0, unit = "ea", taxable = kind === "material"): LineItem {
  return { id: uid("li"), kind, name, description: "", qty, unit, unitCost, unitPrice, taxable };
}

/** Re-price lines from the current price book (keeps manual lines). */
export function repriceLines(lines: LineItem[], items: Map<string, InventoryItem>): LineItem[] {
  return lines.map((l) => {
    const it = l.itemId ? items.get(l.itemId) : undefined;
    return it ? { ...l, unitCost: it.cost, unitPrice: priceFromRule(it.cost, it.pricing) } : l;
  });
}

/* ───────────────────────── Templates ───────────────────────── */

export function estimateTemplates(items: InventoryItem[]): EstimateTemplate[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return ESTIMATE_TEMPLATES_RAW.map((t) => ({
    id: t.id,
    name: t.name,
    serviceType: t.serviceType,
    description: t.description,
    options: t.options.map((o) => ({
      name: o.name,
      description: o.description,
      tier: o.tier,
      items: o.items.map((ti) => {
        const item = ti.itemId ? byId.get(ti.itemId) : undefined;
        const l = item ? lineFromItem(item, ti.qty) : customLine(ti.kind, ti.name, ti.qty, 0);
        const { id: _id, ...rest } = l;
        void _id;
        return rest;
      }),
    })),
  }));
}

export function optionsFromTemplate(t: EstimateTemplate, items?: Map<string, InventoryItem>): EstimateOption[] {
  return t.options.map((o) => {
    const lines = o.items.map((l) => ({ ...l, id: uid("li") }));
    return { id: uid("opt"), name: o.name, description: o.description, tier: o.tier, items: items ? repriceLines(lines, items) : lines };
  });
}

/* ───────────────────────── Estimate → job ───────────────────────── */

export function checklistFor(serviceType: ServiceType, templates: ChecklistTemplate[]) {
  const t = templates.find((x) => x.serviceTypes.includes(serviceType)) ?? templates.find((x) => x.id === "chk_repair");
  return { templateId: t?.id, items: (t?.items ?? []).map((label) => ({ id: uid("chk"), label, done: false })) };
}

export function avgLaborCost(settings: Pick<CrmSettings, "laborBurdenPct">, wage = 30) {
  return wage * (1 + settings.laborBurdenPct / 100);
}

export function estimateToJob(e: Estimate, number: number, ctx: { checklists: ChecklistTemplate[]; settings: CrmSettings; now?: string }): Job {
  const opt = primaryOption(e);
  const items = (opt?.items ?? []).map((l) => ({ ...l, id: uid("ji") }));
  const t = opt ? optionTotals(e, opt) : undefined;
  const laborHours = t?.laborHours ?? 0;
  const chk = checklistFor(e.serviceType, ctx.checklists);
  return {
    id: uid("job"),
    number,
    customerId: e.customerId,
    propertyId: e.propertyId,
    estimateId: e.id,
    installId: e.installId,
    title: e.title,
    serviceType: e.serviceType,
    status: "unscheduled",
    priority: "normal",
    crew: [],
    durationHrs: Math.max(1, Math.min(10, laborHours || 2)),
    arrivalWindow: "8:00 – 10:00 AM",
    scope: [opt?.name, opt?.description].filter(Boolean).join(" — "),
    items,
    equipment: items.filter((i) => i.kind === "equipment").map((i) => i.name).join(", "),
    internalNotes: e.internalNotes,
    customerNotes: e.customerNotes,
    checklist: chk.items,
    checklistTemplateId: chk.templateId,
    estimatedLaborHours: laborHours,
    estimated: {
      revenue: t ? t.revenue : 0,
      materialCost: t?.materialCost ?? 0,
      laborCost: t?.laborCost ?? 0,
      equipmentCost: t?.equipmentCost ?? 0,
    },
    otherCosts: [],
    zoneIds: [],
    componentIds: [],
    createdAt: ctx.now ?? new Date().toISOString(),
  };
}

/* ───────────────────────── Job → invoice ───────────────────────── */

export function jobToInvoice(job: Job, number: number, ctx: { settings: CrmSettings; depositCredit: number; approvedChangeOrderLines: LineItem[]; today?: Date }): Invoice {
  const today = ctx.today ?? new Date();
  const fromJob: LineItem[] = job.items.map((i) => ({ id: uid("ii"), itemId: i.itemId, kind: i.kind, name: i.name, description: i.description, qty: i.kind === "material" ? (i.usedQty ?? i.qty) : i.qty, unit: i.unit, unitCost: i.unitCost, unitPrice: i.unitPrice, taxable: i.taxable }));
  const co = ctx.approvedChangeOrderLines.filter((l) => !job.items.some((j) => j.changeOrderId && j.name === l.name)).map((l) => ({ ...l, id: uid("ii") }));
  return {
    id: uid("inv"),
    number,
    customerId: job.customerId,
    propertyId: job.propertyId,
    jobId: job.id,
    estimateId: job.estimateId,
    kind: "standard",
    status: "draft",
    issueDate: isoDate(today),
    dueDate: isoDate(new Date(today.getTime() + ctx.settings.invoiceDueDays * 86400000)),
    items: [...fromJob, ...co],
    taxPct: ctx.settings.taxPct,
    discount: { type: "amount", value: 0 },
    depositCredit: ctx.depositCredit,
    notes: `Job #${job.number} — ${job.title}`,
    terms: ctx.settings.invoiceTerms,
    createdAt: today.toISOString(),
  };
}

export function depositInvoice(e: Estimate, number: number, settings: CrmSettings, today = new Date()): Invoice | null {
  const opt = primaryOption(e);
  if (!opt || !e.depositPct) return null;
  const t = optionTotals(e, opt);
  return {
    id: uid("inv"),
    number,
    customerId: e.customerId,
    propertyId: e.propertyId,
    estimateId: e.id,
    kind: "deposit",
    status: "sent",
    issueDate: isoDate(today),
    dueDate: isoDate(today),
    items: [customLine("fee", `${e.depositPct}% deposit — Estimate #${e.number}: ${e.title}`, 1, t.deposit, 0, "ea", false)],
    taxPct: 0,
    discount: { type: "amount", value: 0 },
    depositCredit: 0,
    notes: "Deposit is credited on the final invoice.",
    terms: settings.paymentTerms,
    sentAt: today.toISOString(),
    createdAt: today.toISOString(),
  };
}

/* ───────────────────────── Install material takeoff ───────────────────────── */

/**
 * Rule-of-thumb takeoff from install design data (when no Design Studio plan exists):
 *  - heads: zone head counts; lawn zones > 25 GPM-ish areas use rotors, others sprays + MP rotators
 *  - swing joints: 1 per head;  fittings: 1 tee per head + 1 ell per 2 heads on laterals
 *  - valves: 1 per zone (drip zones get a drip control kit), boxes: 1 per 3 valves
 *  - main line: design.mainLineFt (default 60 + 25/zone), laterals: Σ zone lateral ft (default 18 ft/head)
 *  - wire: design.wireFt (default main length + 40) of 18/(stations+1) conductors
 *  - trenching labor: main + laterals;  install labor: 0.35 h/head + 1.25 h/valve + 2 h/controller
 */
export function generateTakeoff(d: InstallDesignData, items: InventoryItem[]): LineItem[] {
  const by = new Map(items.map((i) => [i.id, i]));
  const out: LineItem[] = [];
  const add = (id: string, qty: number) => {
    const it = by.get(id);
    if (it && qty > 0) out.push(lineFromItem(it, Math.ceil(qty)));
  };
  const zones = d.zones;
  const lawn = zones.filter((z) => z.area === "lawn" || z.area === "slope");
  const spray = zones.filter((z) => ["beds", "groundcover", "mixed"].includes(z.area));
  const drip = zones.filter((z) => z.area === "drip" || z.area === "trees");
  const rotorHeads = lawn.filter((z) => z.heads <= 16).reduce((s, z) => s + z.heads, 0);
  const lawnSprayHeads = lawn.filter((z) => z.heads > 16).reduce((s, z) => s + z.heads, 0);
  const sprayHeads = spray.reduce((s, z) => s + z.heads, 0) + lawnSprayHeads;
  add("itm_pgpu", rotorHeads);
  add("itm_sj34", rotorHeads);
  add("itm_prs40", sprayHeads);
  add("itm_mp2000", sprayHeads);
  add("itm_sj12", sprayHeads);
  const lateralFt = zones.filter((z) => !drip.includes(z)).reduce((s, z) => s + (z.lateralFt ?? z.heads * 18), 0);
  const mainFt = d.mainLineFt ?? 60 + 25 * zones.length;
  const mainId = d.mainLineSize.includes("1-1/4") ? "itm_pvc114" : "itm_pvc1";
  add(mainId, mainFt * 1.05);
  add("itm_pvc34", lateralFt * 1.08);
  add("itm_tee34", rotorHeads + sprayHeads);
  add("itm_ell34", (rotorHeads + sprayHeads) / 2);
  add("itm_tee1", zones.length);
  add("itm_ell1", Math.ceil(mainFt / 40));
  add("itm_ma1", zones.length * 2);
  add("itm_glue", Math.ceil((rotorHeads + sprayHeads) / 40) || 1);
  const sprayValves = zones.length - drip.length;
  add("itm_pgv", sprayValves);
  add("itm_xcz", drip.length);
  const dripFt = drip.reduce((s, z) => s + (z.lateralFt ?? z.heads * 12), 0);
  add("itm_xfs", dripFt);
  add("itm_poly", drip.length * 40);
  add("itm_flush", drip.length * 2);
  add("itm_vbstd", Math.ceil(zones.length / 3));
  const stations = d.controllerStations ?? zones.length;
  const wireFt = d.wireFt ?? mainFt + 40;
  add(stations + 1 <= 5 ? "itm_w185" : stations + 1 <= 7 ? "itm_w187" : "itm_w1813", wireFt);
  add("itm_dby", zones.length * 2 + 2);
  add(stations > 8 ? "itm_prohc" : "itm_hpc", 1);
  add("lab_trench", mainFt + lateralFt);
  const hrs = 0.35 * (rotorHeads + sprayHeads) + 1.25 * zones.length + 2 + dripFt / 120;
  const crew = by.get("lab_install");
  if (crew) out.push(lineFromItem(crew, r2(Math.ceil(hrs * 2) / 2)));
  if (mainFt + lateralFt > 250) add("eqp_trencher", Math.ceil((mainFt + lateralFt) / 900));
  return out;
}

export const takeoffCost = (lines: LineItem[]) => lineTotals(lines);

/* ───────────────────────── Schematic system map ───────────────────────── */

/**
 * Builds a readable schematic map from zone records (when no survey/design
 * exists yet): house footprint, front/back landscape areas, meter → backflow →
 * main line → valve manifold, and heads laid along each zone's area with a
 * lateral connecting them. Map units: 1000 × 700, 0.15 ft / unit.
 */
export function schematicMap(sys: IrrigationSystem, zones: Zone[], controller?: Controller): SystemComponent[] {
  const out: SystemComponent[] = [];
  const base = (p: Partial<SystemComponent> & Pick<SystemComponent, "type" | "x" | "y">): SystemComponent => ({ id: uid("cmp"), systemId: sys.id, label: "", size: "", manufacturer: "", model: "", condition: "good", notes: "", ...p });
  const rect = (x: number, y: number, w: number, h: number) => [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  out.push(base({ type: "structure", label: "House", x: 330, y: 250, points: rect(330, 250, 340, 200) }));
  out.push(base({ type: "hardscape", label: "Driveway", x: 690, y: 450, points: rect(690, 450, 120, 230) }));
  out.push(base({ type: "hardscape", label: "Patio", x: 420, y: 170, points: rect(420, 170, 160, 80) }));
  // front (south) and back (north) landscape regions
  const regions = [
    { x: 40, y: 480, w: 630, h: 190, name: "Front" },
    { x: 40, y: 30, w: 920, h: 130, name: "Back" },
    { x: 40, y: 175, w: 270, h: 290, name: "West side" },
    { x: 690, y: 175, w: 270, h: 260, name: "East side" },
  ];
  const meter = base({ type: "meter", label: "Water meter", x: 860, y: 670, size: "3/4\"" });
  const bf = base({ type: "backflow", label: "Backflow", x: 860, y: 600, size: "1\"" });
  const shut = base({ type: "shutoff", label: "Main shutoff", x: 860, y: 640 });
  out.push(meter, shut, bf);
  const manifoldX = 300;
  const manifoldY = 470;
  const ctrl = base({ type: "controller", label: controller ? `${controller.manufacturer} ${controller.model}` : "Controller", x: 660, y: 445, manufacturer: controller?.manufacturer ?? "", model: controller?.model ?? "" });
  out.push(ctrl);
  out.push(base({ type: "main_line", label: "Main line", x: 860, y: 600, size: "1\"", points: [{ x: 860, y: 600 }, { x: 860, y: 470 }, { x: manifoldX, y: manifoldY }] }));
  out.push(base({ type: "wire", label: "Valve wire", x: 660, y: 445, points: [{ x: 660, y: 452 }, { x: manifoldX + 10, y: 452 }] }));
  const vb = base({ type: "valve_box", label: "Valve manifold", x: manifoldX, y: manifoldY - 14 });
  out.push(vb);
  zones
    .slice()
    .sort((a, b) => a.number - b.number)
    .forEach((z, i) => {
      const r = regions[i % regions.length];
      const share = zones.filter((_, j) => j % regions.length === i % regions.length).length;
      const slot = Math.floor(i / regions.length);
      const sw = r.w / share;
      const zx = r.x + slot * sw;
      const area = z.area === "lawn" || z.area === "slope" ? "lawn" : "flower_bed";
      out.push(base({ type: area, label: `${z.name}`, x: zx, y: r.y, zoneId: z.id, points: rect(zx + 4, r.y + 4, sw - 8, r.h - 8) }));
      const vx = manifoldX - 18 * i + 20;
      const valve = base({ type: "valve", label: `V${z.number}`, x: vx, y: manifoldY, zoneId: z.id, size: z.valveSize || "1\"", manufacturer: z.manufacturer.includes("Rain") ? "Rain Bird" : "Hunter", model: z.valveType, condition: z.statuses.includes("valve_issue") ? "poor" : "good", valve: { valveType: "anti-siphon", flowControl: true, solenoid: "24VAC" } });
      out.push(valve);
      const isDrip = z.area === "drip" || z.area === "trees";
      const heads: { x: number; y: number }[] = [];
      if (isDrip) {
        out.push(base({ type: "drip_zone", label: `Drip Z${z.number}`, x: zx + sw / 2, y: r.y + r.h / 2, zoneId: z.id, manufacturer: z.manufacturer, model: z.dripLineType || z.model }));
        const pts = [];
        for (let k = 0; k < 4; k++) pts.push({ x: zx + 14 + ((sw - 28) * k) / 3, y: r.y + 20 + ((k % 2) * (r.h - 40)) });
        out.push(base({ type: "drip_line", label: `Dripline Z${z.number}`, x: pts[0].x, y: pts[0].y, zoneId: z.id, points: pts, size: "17mm" }));
        heads.push(pts[0]);
      } else {
        const n = Math.max(2, Math.min(z.headCount || 6, 14));
        const cols = Math.ceil(Math.sqrt(n * (sw / r.h)));
        const rows = Math.ceil(n / cols);
        for (let k = 0; k < n; k++) {
          const cx = zx + 12 + ((sw - 24) * (cols === 1 ? 0.5 : (k % cols) / (cols - 1)));
          const cy = r.y + 12 + ((r.h - 24) * (rows === 1 ? 0.5 : Math.floor(k / cols) / (rows - 1)));
          heads.push({ x: cx, y: cy });
          const type = /rotor|pgp|5004|5000|i-20|3504/i.test(z.sprinklerType + z.model) ? "rotor" : /mp/i.test(z.nozzleType + z.model) ? "mp_rotator" : "spray";
          out.push(base({ type, label: `Z${z.number}-${k + 1}`, x: cx, y: cy, zoneId: z.id, manufacturer: z.manufacturer, model: z.model, size: type === "rotor" ? "4\"" : "4\"", condition: z.statuses.includes("broken") && k === 0 ? "failed" : "good", sprinkler: { nozzle: z.nozzleType, arcDeg: 90, radiusFt: type === "rotor" ? 30 : 12 } }));
        }
      }
      // lateral: valve → nearest head → snake through heads
      const ordered = heads.slice().sort((a, b) => a.y - b.y || a.x - b.x);
      out.push(base({ type: "lateral", label: `Lateral Z${z.number}`, x: vx, y: manifoldY, zoneId: z.id, size: z.pipeSize || "3/4\"", points: [{ x: vx, y: manifoldY }, ...ordered.slice(0, isDrip ? 1 : ordered.length)] }));
    });
  return out;
}

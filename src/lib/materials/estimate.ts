/**
 * COST ESTIMATE.
 *   material subtotal = Σ net qty × unit cost
 *   waste             = Σ (order qty − net qty) × unit cost (pipe waste allowance)
 *   labor             = hours × rate (auto hours from quantities unless overridden)
 *   markup            = markup % × (materials + waste + labor + equipment)
 *   tax               = tax % × (materials + waste)          (materials taxable)
 *   total             = materials + waste + labor + equipment + markup + tax
 * Customer mode folds markup into line prices and hides internal cost lines.
 */
import type { CostItem, EstimateSettings, MaterialProduct, Project } from "../model/types";
import type { TakeoffItem } from "./takeoff";
import { findPrice } from "./pricing";
import { polylineLength, polygonArea } from "../geometry/geometry";

export interface EstimateLine {
  key: string;
  category: string;
  item: string;
  description: string;
  quantity: number;
  orderQty: number;
  unit: string;
  unitCost: number;
  total: number;
  wasteCost: number;
  priced: boolean;
  manual: boolean;
  overridden: boolean;
}

export interface EstimateResult {
  lines: EstimateLine[];
  materialSubtotal: number;
  waste: number;
  laborHours: number;
  laborHoursAuto: number;
  labor: number;
  equipment: number;
  markup: number;
  tax: number;
  total: number;
  missingPrices: number;
  laborBreakdown: { task: string; qty: number; unit: string; hours: number }[];
}

/**
 * Planning labor productivity (crew-hours). ASSUMPTIONS — typical residential
 * values with a machine trencher; edit via labor-hours override.
 */
export const LABOR_RATES = {
  trenchFtPerHr: 45,
  headHr: 0.3,
  valveHr: 0.9,
  controllerHr: 2,
  backflowHr: 3,
  dripSqFtPerHr: 120,
  sleeveHr: 1.5,
  wireFtPerHr: 200,
  setupHr: 2,
};

export function estimateLabor(project: Project) {
  const trench = project.pipes.filter((p) => p.kind === "mainline" || p.kind === "lateral" || p.kind === "drip").reduce((a, p) => a + polylineLength(p.points), 0);
  const heads = project.sprinklers.length;
  const valves = project.valves.length;
  const ctrl = project.equipment.filter((e) => e.type.includes("controller")).length || (project.zones.length ? 1 : 0);
  const bf = project.waterSources.filter((s) => s.backflow !== "none").length + project.equipment.filter((e) => e.type === "backflow").length;
  const drip = project.drips.reduce((a, d) => a + polygonArea(d.points), 0);
  const sleeves = project.pipes.filter((p) => p.kind === "sleeve").length;
  const wire = project.pipes.filter((p) => p.kind === "wire").reduce((a, p) => a + polylineLength(p.points), 0);
  const r = LABOR_RATES;
  const rows = [
    { task: "Mobilization & layout", qty: 1, unit: "job", hours: project.sprinklers.length || project.pipes.length ? r.setupHr : 0 },
    { task: "Trenching, pipe & backfill", qty: Math.round(trench), unit: "ft", hours: trench / r.trenchFtPerHr },
    { task: "Sprinkler heads & swing joints", qty: heads, unit: "ea", hours: heads * r.headHr },
    { task: "Valves & manifold", qty: valves, unit: "ea", hours: valves * r.valveHr },
    { task: "Controller install & programming", qty: ctrl, unit: "ea", hours: ctrl * r.controllerHr },
    { task: "Backflow / POC", qty: bf, unit: "ea", hours: bf * r.backflowHr },
    { task: "Drip installation", qty: Math.round(drip), unit: "sq ft", hours: drip / r.dripSqFtPerHr },
    { task: "Sleeves under hardscape", qty: sleeves, unit: "ea", hours: sleeves * r.sleeveHr },
    { task: "Valve wire", qty: Math.round(wire), unit: "ft", hours: wire / r.wireFtPerHr },
  ].filter((x) => x.hours > 0);
  return { rows, hours: rows.reduce((a, x) => a + x.hours, 0) };
}

export function computeEstimate(project: Project, takeoff: TakeoffItem[], products: MaterialProduct[], settings: EstimateSettings = project.estimate): EstimateResult {
  const lines: EstimateLine[] = [];
  let missing = 0;
  for (const t of takeoff) {
    if (settings.removedKeys.includes(t.key)) continue;
    const prod = findPrice(t.key, products);
    const override = settings.priceOverrides[t.key];
    const unitCost = override ?? prod?.price ?? 0;
    const priced = override !== undefined || !!prod;
    if (!priced) missing++;
    const qOverride = settings.qtyOverrides[t.key];
    const qty = qOverride ?? t.quantity;
    const orderQty = qOverride !== undefined ? qOverride : t.orderQty;
    const net = qOverride !== undefined ? qOverride : t.quantity;
    lines.push({
      key: t.key,
      category: t.category,
      item: t.item,
      description: t.description,
      quantity: qty,
      orderQty,
      unit: t.unit,
      unitCost,
      total: net * unitCost,
      wasteCost: Math.max(0, orderQty - net) * unitCost,
      priced,
      manual: false,
      overridden: qOverride !== undefined || override !== undefined,
    });
  }
  for (const m of settings.manualItems) lines.push(manualLine(m));
  const materialSubtotal = lines.reduce((a, l) => a + l.total, 0);
  const waste = lines.reduce((a, l) => a + l.wasteCost, 0);
  const lab = estimateLabor(project);
  const laborHours = settings.laborHoursOverride ?? lab.hours;
  const labor = laborHours * settings.laborRate;
  const equipment = settings.equipmentCost;
  const markup = (settings.markupPct / 100) * (materialSubtotal + waste + labor + equipment);
  const tax = (settings.taxPct / 100) * (materialSubtotal + waste);
  const total = materialSubtotal + waste + labor + equipment + markup + tax;
  return { lines, materialSubtotal, waste, laborHours, laborHoursAuto: lab.hours, labor, equipment, markup, tax, total, missingPrices: missing, laborBreakdown: lab.rows };
}

function manualLine(m: CostItem): EstimateLine {
  return { key: m.id, category: m.category || "Other", item: m.item, description: m.description, quantity: m.quantity, orderQty: m.quantity, unit: m.unit, unitCost: m.unitCost, total: m.quantity * m.unitCost, wasteCost: 0, priced: true, manual: true, overridden: false };
}

/** Totals for a simple list of cost items (quick estimates). */
export function simpleEstimate(items: CostItem[], laborHours: number, laborRate: number, taxPct: number, markupPct: number) {
  const materials = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
  const labor = laborHours * laborRate;
  const markup = (markupPct / 100) * (materials + labor);
  const tax = (taxPct / 100) * materials;
  return { materials, labor, markup, tax, total: materials + labor + markup + tax };
}

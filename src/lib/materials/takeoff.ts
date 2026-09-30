/**
 * MATERIAL TAKEOFF — derived entirely from the design + hydraulic network.
 *
 * Fittings are inferred from network topology:
 *   node with a head:     end of run → slip×FPT ell, mid-run → slip×slip×FPT tee
 *   plain node degree 1:  cap (dead end)   degree 2: ell 90 (>60° turn), ell 45
 *                         (22.5–60°), coupling or reducer (straight)
 *   degree 3: tee (reducing if sizes differ)   degree 4: cross (counted as 2 tees)
 *   valves: 2 male adapters each; PVC runs: 1 coupling per 20 ft stick
 *   (ASSUMPTION: plain-end pipe; bell-end pipe needs fewer couplings).
 * Manually placed fittings are added, and any inferred fitting within 0.75 ft
 * of a manual fitting is skipped (manual placement overrides inference).
 */
import type { Project } from "../model/types";
import { deflectionAngle, dist, polylineLength } from "../geometry/geometry";
import type { HydraulicResult } from "../hydraulics/analysis";
import { PIPE_SPECS } from "../hydraulics/pipes";
import { getProduct, getNozzle } from "../catalog/sprinklers";
import { dripCalc } from "../irrigation/drip";
import { pipeSizeLabel } from "../units/units";
import { otherEnd } from "../hydraulics/network";

export type TakeoffCategory = "Pipe" | "Sprinklers" | "Nozzles" | "Valves" | "Fittings" | "Drip" | "Wire & Electrical" | "Controllers" | "Backflow & Equipment" | "Boxes & Sleeves" | "Misc";

export interface TakeoffItem {
  key: string;
  category: TakeoffCategory;
  item: string;
  description: string;
  quantity: number; // net quantity
  orderQty: number; // incl. waste
  unit: string;
  wastePct: number;
}

export const FITTING_NAMES: Record<string, string> = {
  tee: "Tee (slip)",
  "tee-fpt": "Tee slip×slip×FPT",
  "ell-fpt": "Ell 90° slip×FPT",
  cross: "Cross",
  elbow90: "Ell 90° (slip)",
  elbow45: "Ell 45° (slip)",
  coupling: "Coupling (slip)",
  reducer: "Reducer bushing",
  cap: "Cap (slip)",
  "male-adapter": "Male adapter slip×MPT",
  "female-adapter": "Female adapter slip×FPT",
  union: "Union",
  "swing-joint": "Swing joint assembly",
};

export function computeTakeoff(project: Project, hyd: HydraulicResult): TakeoffItem[] {
  const items = new Map<string, TakeoffItem>();
  const waste = project.estimate.pipeWastePct;
  const add = (key: string, category: TakeoffCategory, item: string, description: string, qty: number, unit: string, wastePct = 0) => {
    const cur = items.get(key);
    if (cur) {
      cur.quantity += qty;
      cur.orderQty = Math.ceil(cur.quantity * (1 + cur.wastePct / 100) - 1e-6);
    } else items.set(key, { key, category, item, description, quantity: qty, orderQty: Math.ceil(qty * (1 + wastePct / 100) - 1e-6), unit, wastePct });
  };

  // ---------- Pipe (effective sizes from hydraulics) ----------
  for (const e of hyd.net.edges) {
    const r = hyd.edges.get(e.id)!;
    const spec = PIPE_SPECS[e.material];
    add(`pipe:${e.material}:${r.nominal}`, "Pipe", `${pipeSizeLabel(r.nominal)} ${spec.label}`, `${e.kind === "mainline" ? "Mainline" : e.kind === "drip" ? "Drip supply" : "Lateral"} pipe`, e.length, "ft", waste);
  }
  const sleeveFt = new Map<number, number>();
  let wireFt = 0;
  let conductors = 0;
  for (const p of project.pipes) {
    if (p.kind === "sleeve") sleeveFt.set(p.size, (sleeveFt.get(p.size) ?? 0) + polylineLength(p.points));
    if (p.kind === "wire") {
      wireFt += polylineLength(p.points);
      conductors = Math.max(conductors, p.conductors ?? project.zones.length + 2);
    }
  }
  for (const [size, ft] of sleeveFt) add(`sleeve:${size}`, "Boxes & Sleeves", `${pipeSizeLabel(size)} Sch 40 PVC sleeve`, "Sleeve under hardscape", ft, "ft", waste);

  // ---------- Heads ----------
  let rotorSwing = 0;
  let sprayCount = 0;
  const swingBySize = new Map<number, number>();
  for (const h of project.sprinklers) {
    const pr = getProduct(h.productId);
    const nz = getNozzle(pr, h.nozzleId);
    if (pr.category === "emitter") {
      add(`emitter:${pr.id}:${nz.id}`, "Drip", `${nz.name} emitter`, pr.model, 1, "ea");
      add("drip:quarter-tube", "Drip", '1/4" distribution tubing', "3 ft per emitter", 3, "ft", waste);
      add("drip:stake", "Drip", "Tubing stake", "", 1, "ea");
      continue;
    }
    if (pr.matchedPrecip) {
      add(`body:${pr.id}`, "Sprinklers", pr.model.split(" + ")[0], `${pr.manufacturer} ${pr.productLine}`, 1, "ea");
      add(`nozzle:${pr.id}:${nz.id}`, "Nozzles", `${nz.name} nozzle`, `${pr.productLine} nozzle`, 1, "ea");
    } else {
      add(`head:${pr.id}:${nz.id}`, "Sprinklers", `${pr.model} — nozzle ${nz.name}`, `${pr.manufacturer} ${pr.productLine}`, 1, "ea");
    }
    if (pr.inletSize >= 0.75) {
      rotorSwing++;
      swingBySize.set(pr.inletSize, (swingBySize.get(pr.inletSize) ?? 0) + 1);
    } else sprayCount++;
  }
  for (const [size, n] of swingBySize) add(`fitting:swing-joint:${size}`, "Fittings", `${pipeSizeLabel(size)} swing joint assembly`, "Pre-assembled, for rotors", n, "ea");
  if (sprayCount) {
    add("pipe:funny-pipe:0.5", "Pipe", '1/2" swing pipe (funny pipe)', "18 in per spray head", sprayCount * 1.5, "ft", waste);
    add("fitting:barb-ell:0.5", "Fittings", '1/2" barbed ell × MPT', "2 per spray head", sprayCount * 2, "ea");
  }
  void rotorSwing;

  // ---------- Fittings inferred from network ----------
  const manual = project.fittings;
  const nearManual = (p: { x: number; y: number }) => manual.some((f) => dist(f.position, p) < 0.75);
  const headAtNode = new Map<number, number>();
  for (const [, n] of hyd.net.headNode) headAtNode.set(n, (headAtNode.get(n) ?? 0) + 1);
  const deviceNodes = new Set<number>([...hyd.net.valveLatNode.values(), ...hyd.net.valveMainNode.values(), ...hyd.net.sourceNode.values(), ...hyd.net.dripNode.values()]);
  const pvc = (m: string) => m.startsWith("pvc");
  for (const node of hyd.net.nodes) {
    if (!node.edges.length || nearManual(node.p)) continue;
    const es = node.edges.map((id) => ({ e: hyd.net.edges[id], r: hyd.edges.get(id)! }));
    const sizes = es.map((x) => x.r.nominal);
    const maxS = Math.max(...sizes);
    const minS = Math.min(...sizes);
    const mat = es[0].e.material;
    if (!pvc(mat) && mat !== "poly-100") continue;
    const deg = es.length;
    const heads = headAtNode.get(node.id) ?? 0;
    const tag = mat === "poly-100" ? "insert " : "";
    if (heads > 0) {
      if (deg === 1) add(`fitting:ell-fpt:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}${FITTING_NAMES["ell-fpt"]}`, "Head connection, end of run", heads, "ea");
      else add(`fitting:tee-fpt:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}${FITTING_NAMES["tee-fpt"]}`, "Head connection", heads, "ea");
      if (deg >= 3) add(`fitting:tee:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Tee`, "Branch", deg - 2, "ea");
      if (maxS !== minS) add(`fitting:reducer:${maxS}x${minS}`, "Fittings", `${pipeSizeLabel(maxS)} × ${pipeSizeLabel(minS)} reducer bushing`, "Size change", 1, "ea");
      continue;
    }
    if (deviceNodes.has(node.id)) continue;
    if (deg === 1) add(`fitting:cap:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Cap`, "Dead end / future", 1, "ea");
    else if (deg === 2) {
      const [x, y] = es;
      const a = hyd.net.nodes[otherEnd(x.e, node.id)].p;
      const c = hyd.net.nodes[otherEnd(y.e, node.id)].p;
      const defl = deflectionAngle(a, node.p, c);
      if (defl > 60) add(`fitting:elbow90:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Ell 90°`, "Direction change", 1, "ea");
      else if (defl > 22.5) add(`fitting:elbow45:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Ell 45°`, "Direction change", 1, "ea");
      else if (maxS !== minS) add(`fitting:reducer:${maxS}x${minS}`, "Fittings", `${pipeSizeLabel(maxS)} × ${pipeSizeLabel(minS)} reducer bushing`, "Size change", 1, "ea");
      else add(`fitting:coupling:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Coupling`, "Pipe joint", 1, "ea");
      if (defl > 22.5 && maxS !== minS) add(`fitting:reducer:${maxS}x${minS}`, "Fittings", `${pipeSizeLabel(maxS)} × ${pipeSizeLabel(minS)} reducer bushing`, "Size change", 1, "ea");
    } else {
      const tees = deg === 3 ? 1 : deg - 2;
      add(`fitting:tee:${maxS}`, "Fittings", `${pipeSizeLabel(maxS)} ${tag}Tee${maxS !== minS ? " (reducing)" : ""}`, "Branch", tees, "ea");
      if (maxS !== minS) add(`fitting:reducer:${maxS}x${minS}`, "Fittings", `${pipeSizeLabel(maxS)} × ${pipeSizeLabel(minS)} reducer bushing`, "Size change", 1, "ea");
    }
  }
  // couplings along 20 ft sticks
  for (const e of hyd.net.edges) {
    if (!pvc(e.material)) continue;
    const n = Math.floor(e.length / 20);
    if (n > 0) {
      const s = hyd.edges.get(e.id)!.nominal;
      add(`fitting:coupling:${s}`, "Fittings", `${pipeSizeLabel(s)} Coupling`, "Pipe joint", n, "ea");
    }
  }
  for (const f of manual) {
    add(`fitting:${f.type}:${f.size}`, "Fittings", `${pipeSizeLabel(f.size)} ${FITTING_NAMES[f.type] ?? f.type}`, "Placed on plan", 1, "ea");
  }

  // ---------- Valves ----------
  const zonedValves = project.valves;
  let manifoldValves = 0;
  let standalone = 0;
  for (const v of zonedValves) {
    const t = v.type === "electric" ? "Electric control valve" : v.type === "master" ? "Master valve (normally closed)" : v.type === "drip" ? "Drip control zone kit (valve + filter + 30 psi regulator)" : v.type === "prv" ? "Pressure-reducing valve" : "Isolation ball valve";
    add(`valve:${v.type}:${v.size}`, "Valves", `${pipeSizeLabel(v.size)} ${t}`, v.type === "electric" ? "Globe, 24 VAC, flow control" : "", 1, "ea");
    if (v.type !== "isolation") add(`fitting:male-adapter:${v.size}`, "Fittings", `${pipeSizeLabel(v.size)} Male adapter slip×MPT`, "2 per valve", 2, "ea");
    if (v.type === "electric" || v.type === "drip" || v.type === "master") {
      add("wire:connector", "Wire & Electrical", "Waterproof wire connector", "2 per solenoid", 2, "ea");
      if (v.manifoldId || project.settings.valveLayout === "grouped") manifoldValves++;
      else standalone++;
    }
  }
  if (!project.equipment.some((e) => e.type === "valve-box")) {
    if (manifoldValves) add("box:standard", "Boxes & Sleeves", "Standard rectangular valve box (12\")", "1 per 2 manifold valves", Math.ceil(manifoldValves / 2), "ea");
    if (standalone) add("box:round10", "Boxes & Sleeves", '10" round valve box', "1 per standalone valve", standalone, "ea");
  }
  const zoneCount = project.zones.length;
  if (wireFt > 0) add(`wire:multi:${conductors}`, "Wire & Electrical", `18 AWG ${conductors}-conductor irrigation wire`, "Direct burial, controller to valves", wireFt, "ft", 10);
  else if (zoneCount) {
    // no wire path drawn: estimate as mainline length + 10 ft per valve
    const mainFt = project.pipes.filter((p) => p.kind === "mainline").reduce((a, p) => a + polylineLength(p.points), 0);
    if (mainFt > 0) add(`wire:multi:${zoneCount + 2}`, "Wire & Electrical", `18 AWG ${zoneCount + 2}-conductor irrigation wire`, "Estimated along mainline", mainFt + 10 * zoneCount, "ft", 10);
  }

  // ---------- Equipment ----------
  const eqNames: Record<string, string> = {
    backflow: "Backflow preventer",
    "pressure-regulator": "Pressure regulator",
    filter: "Wye filter",
    "check-valve": "Check valve",
    "quick-coupler": 'Quick coupler valve 3/4"',
    "hose-bib": "Hose bib",
    pump: "Booster pump",
    controller: "Irrigation controller",
    "smart-controller": "Smart (weather-based) controller",
    "rain-sensor": "Rain/freeze sensor",
    "flow-meter": "Flow sensor",
    "valve-box": "Valve box",
  };
  for (const e of project.equipment) {
    const cat: TakeoffCategory = e.type.includes("controller") || e.type === "rain-sensor" || e.type === "flow-meter" ? "Controllers" : e.type === "valve-box" ? "Boxes & Sleeves" : "Backflow & Equipment";
    const st = e.type.includes("controller") ? Math.max(e.stations ?? 0, stationsFor(zoneCount)) : 0;
    const key = st ? `eq:${e.type}:${st}` : `eq:${e.type}${e.size ? `:${e.size}` : ""}`;
    add(key, cat, `${st ? `${st}-station ` : e.size ? `${pipeSizeLabel(e.size)} ` : ""}${eqNames[e.type]}`, e.label ?? "", 1, "ea");
    if (e.type === "quick-coupler") {
      add("box:round10", "Boxes & Sleeves", '10" round valve box', "Quick coupler box", 1, "ea");
    }
  }
  if (zoneCount && !project.equipment.some((e) => e.type.includes("controller")))
    add(`eq:smart-controller:${stationsFor(zoneCount)}`, "Controllers", `${stationsFor(zoneCount)}-station Smart (weather-based) controller`, "Suggested — not placed on plan", 1, "ea");
  for (const src of project.waterSources) {
    if (src.backflow !== "none" && !project.equipment.some((e) => e.type === "backflow")) {
      const names = { pvb: "Pressure vacuum breaker (PVB)", rp: "Reduced pressure (RP) backflow assembly", dcva: "Double check valve assembly", avb: "Atmospheric vacuum breaker" } as const;
      add(`eq:backflow:${src.backflow}:${src.backflowSize}`, "Backflow & Equipment", `${pipeSizeLabel(src.backflowSize)} ${names[src.backflow]}`, src.name, 1, "ea");
    }
    add(`fitting:poc:${src.mainlineSize}`, "Fittings", `${pipeSizeLabel(src.mainlineSize)} Point-of-connection kit`, "Tee/saddle, isolation valve, adapters", 1, "ea");
    if (src.prvSettingPsi && !project.equipment.some((e) => e.type === "pressure-regulator"))
      add(`eq:pressure-regulator:${src.mainlineSize}`, "Backflow & Equipment", `${pipeSizeLabel(src.mainlineSize)} Pressure regulator`, `Set to ${src.prvSettingPsi} psi`, 1, "ea");
  }

  // ---------- Drip areas ----------
  for (const d of project.drips) {
    const c = dripCalc(d);
    add(`drip:dripline:${d.emitterGph}:${d.emitterSpacingIn}`, "Drip", `Dripline ${d.emitterGph} GPH @ ${d.emitterSpacingIn}"`, "17mm pressure-compensating", c.tubingFt, "ft", waste);
    add("drip:stake", "Drip", "Tubing stake", "1 per 4 ft of dripline", Math.ceil(c.tubingFt / 4), "ea");
    add("drip:fittings", "Drip", "17mm drip fittings (tee/ell/coupling)", "Allowance 1 per 40 ft", Math.ceil(c.tubingFt / 40), "ea");
    add("drip:flush", "Drip", "Flush valve / end cap", "Per drip area", 1, "ea");
    add("drip:air-relief", "Drip", "Air/vacuum relief valve", "Per drip area", 1, "ea");
  }

  // ---------- Misc consumables ----------
  const pvcFt = [...items.values()].filter((i) => i.key.startsWith("pipe:pvc")).reduce((a, i) => a + i.quantity, 0);
  if (pvcFt > 0) add("misc:primer-cement", "Misc", "PVC primer & cement (pint set)", "1 set per 300 ft", Math.ceil(pvcFt / 300), "set");
  const threaded = project.sprinklers.length + project.valves.length * 2;
  if (threaded) add("misc:ptfe-tape", "Misc", "PTFE thread tape", "1 roll per 25 threaded joints", Math.ceil(threaded / 25), "roll");

  // round quantities
  const out = [...items.values()].map((i) => ({
    ...i,
    quantity: i.unit === "ft" ? Math.round(i.quantity * 10) / 10 : Math.round(i.quantity),
    orderQty: i.unit === "ft" ? Math.ceil(i.quantity * (1 + i.wastePct / 100) - 1e-6) : Math.ceil(i.quantity - 1e-6),
  }));
  const order: TakeoffCategory[] = ["Pipe", "Sprinklers", "Nozzles", "Valves", "Fittings", "Drip", "Wire & Electrical", "Controllers", "Backflow & Equipment", "Boxes & Sleeves", "Misc"];
  out.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.item.localeCompare(b.item, undefined, { numeric: true }));
  return out;
}

export function stationsFor(zones: number): number {
  for (const s of [4, 6, 8, 12, 16, 24, 32, 48]) if (s >= zones) return s;
  return zones;
}

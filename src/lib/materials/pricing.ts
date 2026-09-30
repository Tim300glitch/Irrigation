/**
 * Default material price database (user-editable; stored locally).
 * Prices are PLANNING PLACEHOLDERS in USD — contractors should update them
 * to their supplier pricing (Materials → Update prices). The `matchKey`
 * links a product to takeoff items; a trailing ":*" matches by prefix.
 * The structure allows a future supplier-pricing integration to upsert rows.
 */
import type { MaterialProduct } from "../model/types";
import { GENERIC_SPRINKLERS } from "../catalog/sprinklers";
import { PIPE_SPECS, sizesFor } from "../hydraulics/pipes";
import { pipeSizeLabel } from "../units/units";
import { FITTING_NAMES } from "./takeoff";

const PIPE_PRICE: Record<string, Record<string, number>> = {
  "pvc-sch40": { "0.5": 0.45, "0.75": 0.55, "1": 0.8, "1.25": 1.1, "1.5": 1.35, "2": 1.8, "2.5": 2.9, "3": 3.8, "4": 5.5 },
  "pvc-cl200": { "0.75": 0.4, "1": 0.55, "1.25": 0.8, "1.5": 0.95, "2": 1.35, "2.5": 2.1, "3": 2.9, "4": 4.4 },
  "pvc-cl315": { "0.5": 0.45, "0.75": 0.55, "1": 0.8, "1.25": 1.05, "1.5": 1.3, "2": 1.8, "2.5": 2.7, "3": 3.8 },
  "poly-100": { "0.5": 0.3, "0.75": 0.4, "1": 0.6, "1.25": 0.95, "1.5": 1.2, "2": 1.9 },
  "funny-pipe": { "0.5": 0.35 },
  "drip-tubing": { "0.5": 0.25, "0.75": 0.35 },
};

const HEAD_PRICE: Record<string, number> = {
  "gen-rotor-4": 16.5,
  "gen-rotor-4-prs": 24,
  "gen-rotor-la": 17,
  "gen-rotor-sr": 14,
  "gen-spray-4": 3.25,
  "gen-spray-4-prs": 6.5,
  "gen-spray-strip": 3.25,
  "gen-rotary-prs": 7.5,
  "gen-bubbler": 2.75,
  "gen-impact": 28,
  "gen-emitter": 0.45,
  "gen-microspray": 1.8,
  "gen-custom": 10,
};
const NOZZLE_PRICE: Record<string, number> = { "gen-spray-4": 2.25, "gen-spray-4-prs": 2.25, "gen-spray-strip": 1.75, "gen-rotary-prs": 6.5, "gen-microspray": 0.6 };

const FIT_BASE: Record<string, number> = {
  tee: 1.1,
  "tee-fpt": 1.2,
  "ell-fpt": 1.0,
  elbow90: 0.95,
  elbow45: 1.05,
  coupling: 0.55,
  cap: 0.6,
  "male-adapter": 0.7,
  "female-adapter": 0.75,
  union: 4.5,
  cross: 3.5,
  poc: 35,
};
const SIZE_MULT: Record<string, number> = { "0.5": 0.5, "0.75": 0.7, "1": 1, "1.25": 1.5, "1.5": 1.9, "2": 2.8, "2.5": 6, "3": 8, "4": 14 };

let seq = 0;
const now = () => new Date().toISOString();
function p(category: MaterialProduct["category"], description: string, unit: string, price: number, matchKey: string, extra: Partial<MaterialProduct> = {}): MaterialProduct {
  seq++;
  return { id: `mp-${seq}`, brand: "Generic", sku: `DL-${String(seq).padStart(4, "0")}`, category, description, unit, price: +price.toFixed(2), supplier: "Default", notes: "", matchKey, updatedAt: now(), ...extra };
}

export function defaultMaterialProducts(): MaterialProduct[] {
  seq = 0;
  const out: MaterialProduct[] = [];
  for (const [mat, sizes] of Object.entries(PIPE_PRICE)) {
    for (const s of sizesFor(mat as keyof typeof PIPE_SPECS)) {
      const pr = sizes[String(s)];
      if (pr === undefined) continue;
      out.push(p("pipe", `${pipeSizeLabel(s)} ${PIPE_SPECS[mat as keyof typeof PIPE_SPECS].label}`, "ft", pr, `pipe:${mat}:${s}`, { pipeSize: pipeSizeLabel(s) }));
    }
  }
  for (const s of [2, 3, 4]) out.push(p("pipe", `${pipeSizeLabel(s)} Sch 40 PVC sleeve`, "ft", PIPE_PRICE["pvc-sch40"][String(s)] ?? 2, `sleeve:${s}`, { pipeSize: pipeSizeLabel(s) }));
  for (const prod of GENERIC_SPRINKLERS) {
    if (prod.category === "emitter") {
      out.push(p("drip", `${prod.model}`, "ea", HEAD_PRICE[prod.id] ?? 0.45, `emitter:${prod.id}:*`));
      continue;
    }
    if (prod.matchedPrecip) {
      out.push(p("sprinklers", prod.model.split(" + ")[0], "ea", HEAD_PRICE[prod.id] ?? 5, `body:${prod.id}`));
      out.push(p("nozzles", `${prod.productLine} nozzle (any)`, "ea", NOZZLE_PRICE[prod.id] ?? 2, `nozzle:${prod.id}:*`));
    } else out.push(p("sprinklers", `${prod.model} (any nozzle)`, "ea", HEAD_PRICE[prod.id] ?? 15, `head:${prod.id}:*`));
  }
  out.push(p("fittings", '3/4" swing joint assembly', "ea", 6.75, "fitting:swing-joint:0.75"));
  out.push(p("fittings", '1" swing joint assembly', "ea", 9.5, "fitting:swing-joint:1"));
  out.push(p("fittings", '1/2" swing joint assembly', "ea", 4.5, "fitting:swing-joint:0.5"));
  out.push(p("fittings", '1/2" barbed ell × MPT', "ea", 0.35, "fitting:barb-ell:0.5"));
  for (const [type, base] of Object.entries(FIT_BASE)) {
    for (const s of ["0.5", "0.75", "1", "1.25", "1.5", "2", "2.5", "3"]) {
      const name = type === "poc" ? "Point-of-connection kit" : FITTING_NAMES[type] ?? type;
      out.push(p("fittings", `${pipeSizeLabel(+s)} ${name}`, "ea", base * SIZE_MULT[s], `fitting:${type}:${s}`, { pipeSize: pipeSizeLabel(+s) }));
    }
  }
  out.push(p("fittings", "Reducer bushing (any size)", "ea", 0.9, "fitting:reducer:*"));
  const valves: [string, string, number][] = [
    ["electric", "0.75", 22],
    ["electric", "1", 26],
    ["electric", "1.5", 68],
    ["electric", "2", 95],
    ["master", "1", 32],
    ["master", "1.5", 72],
    ["drip", "0.75", 36],
    ["drip", "1", 42],
    ["prv", "1", 65],
    ["isolation", "0.75", 9],
    ["isolation", "1", 12],
    ["isolation", "1.5", 22],
  ];
  const vName: Record<string, string> = { electric: "Electric control valve", master: "Master valve", drip: "Drip zone kit", prv: "Pressure-reducing valve", isolation: "Isolation ball valve" };
  for (const [t, s, pr] of valves) out.push(p("valves", `${pipeSizeLabel(+s)} ${vName[t]}`, "ea", pr, `valve:${t}:${s}`, { pipeSize: pipeSizeLabel(+s) }));
  for (const c of [3, 4, 5, 7, 9, 13, 18]) out.push(p("wire", `18 AWG ${c}-conductor irrigation wire`, "ft", 0.12 + 0.06 * c, `wire:multi:${c}`));
  out.push(p("wire", "Multi-conductor wire (other counts)", "ft", 0.6, "wire:multi:*"));
  out.push(p("wire", "Waterproof wire connector", "ea", 0.85, "wire:connector"));
  out.push(p("boxes", 'Standard rectangular valve box 12"', "ea", 28, "box:standard"));
  out.push(p("boxes", '10" round valve box', "ea", 14, "box:round10"));
  const ctrl: [number, number, number][] = [
    [4, 95, 180],
    [6, 120, 200],
    [8, 150, 230],
    [12, 210, 290],
    [16, 280, 380],
    [24, 420, 520],
  ];
  for (const [st, std, smart] of ctrl) {
    out.push(p("controllers", `${st}-station controller`, "ea", std, `eq:controller:${st}`));
    out.push(p("controllers", `${st}-station smart (weather-based) controller`, "ea", smart, `eq:smart-controller:${st}`));
  }
  out.push(p("controllers", "Rain/freeze sensor", "ea", 45, "eq:rain-sensor"));
  out.push(p("controllers", "Flow sensor", "ea", 185, "eq:flow-meter:*"));
  out.push(p("controllers", "Flow sensor", "ea", 185, "eq:flow-meter"));
  const bf: [string, string, number][] = [
    ["pvb", "0.75", 125],
    ["pvb", "1", 145],
    ["pvb", "1.5", 290],
    ["rp", "0.75", 290],
    ["rp", "1", 320],
    ["rp", "1.5", 610],
    ["dcva", "1", 210],
    ["avb", "1", 45],
  ];
  const bfName: Record<string, string> = { pvb: "Pressure vacuum breaker", rp: "RP backflow assembly", dcva: "Double check valve assembly", avb: "Atmospheric vacuum breaker" };
  for (const [t, s, pr] of bf) out.push(p("backflow", `${pipeSizeLabel(+s)} ${bfName[t]}`, "ea", pr, `eq:backflow:${t}:${s}`));
  out.push(p("backflow", "Backflow preventer (placed)", "ea", 145, "eq:backflow:*"));
  out.push(p("backflow", "Backflow preventer (placed)", "ea", 145, "eq:backflow"));
  const eq: [string, string, number][] = [
    ["pressure-regulator", "Pressure regulator", 85],
    ["filter", "Wye filter", 35],
    ["check-valve", "Check valve", 18],
    ["quick-coupler", 'Quick coupler valve 3/4"', 38],
    ["hose-bib", "Hose bib", 18],
    ["pump", "Booster pump", 650],
    ["valve-box", "Valve box", 28],
  ];
  for (const [t, d, pr] of eq) {
    out.push(p("misc", d, "ea", pr, `eq:${t}`));
    out.push(p("misc", `${d} (sized)`, "ea", pr, `eq:${t}:*`));
  }
  out.push(p("drip", "Dripline (PC, any emitter)", "ft", 0.28, "drip:dripline:*"));
  out.push(p("drip", "Tubing stake", "ea", 0.18, "drip:stake"));
  out.push(p("drip", "17mm drip fittings", "ea", 1.1, "drip:fittings"));
  out.push(p("drip", "Flush valve / end cap", "ea", 4.5, "drip:flush"));
  out.push(p("drip", "Air/vacuum relief valve", "ea", 9, "drip:air-relief"));
  out.push(p("drip", '1/4" distribution tubing', "ft", 0.1, "drip:quarter-tube"));
  out.push(p("misc", "PVC primer & cement (pint set)", "set", 18, "misc:primer-cement"));
  out.push(p("misc", "PTFE thread tape", "roll", 1.5, "misc:ptfe-tape"));
  return out;
}

/** Find the price product for a takeoff key: exact match first, then longest ":*" prefix. */
export function findPrice(key: string, products: MaterialProduct[]): MaterialProduct | undefined {
  let best: MaterialProduct | undefined;
  let bestLen = -1;
  for (const pr of products) {
    const mk = pr.matchKey;
    if (!mk) continue;
    if (mk === key) return pr;
    if (mk.endsWith(":*")) {
      const pre = mk.slice(0, -1);
      if (key.startsWith(pre) && pre.length > bestLen) {
        best = pr;
        bestLen = pre.length;
      }
    }
  }
  return best;
}

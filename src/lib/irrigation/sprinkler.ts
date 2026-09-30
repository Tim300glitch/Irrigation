/**
 * Sprinkler performance calculations.
 *
 * Formulas:
 *  - Precipitation rate, head-to-head square spacing (industry standard):
 *        PR (in/hr) = 96.25 × Q_full (gpm) / (S × L)
 *    where Q_full is the flow scaled to a full circle (Q × 360/arc) and for
 *    head-to-head spacing S = L = radius.  96.25 converts gpm/ft² to in/hr.
 *  - Area method for a zone: PR = 96.25 × ΣQ / A
 *  - Orifice relation used to adjust nozzle flow for pressure:
 *        Q2 = Q1 × sqrt(P2 / P1)
 *
 * ASSUMPTION: Reducing throw with the radius-adjustment screw is assumed NOT to
 * reduce flow (conservative for hydraulic sizing; real nozzles lose a little flow).
 */
import type { Sprinkler } from "../model/types";
import { getNozzle, getProduct, type Nozzle, type SprinklerProduct } from "../catalog/sprinklers";

export const PR_CONSTANT = 96.25;

export interface HeadPerformance {
  product: SprinklerProduct;
  nozzle: Nozzle;
  radius: number; // effective throw ft
  catalogRadius: number;
  flowGpm: number; // design flow at nominal pressure
  pressure: number; // nominal/design operating pressure
  minPressure: number;
  maxPressure: number;
  prsPsi?: number;
  precipInHr: number; // head-to-head square spacing PR
  radiusReduction: number; // fraction 0..1
}

export function headFlow(product: SprinklerProduct, nozzle: Nozzle, arc: number): number {
  if (product.matchedPrecip) return nozzle.flowGpm * (Math.max(0, Math.min(360, arc)) / 360);
  return nozzle.flowGpm;
}

/** Precipitation rate for head-to-head square spacing at radius r. */
export function precipitationRate(flowGpm: number, arc: number, spacingFt: number, rowSpacingFt = spacingFt): number {
  if (arc <= 0 || spacingFt <= 0 || rowSpacingFt <= 0) return 0;
  const qFull = flowGpm * (360 / arc);
  return (PR_CONSTANT * qFull) / (spacingFt * rowSpacingFt);
}

/** Zone / area precipitation rate by the area method. */
export function areaPrecipitationRate(totalGpm: number, areaSqFt: number): number {
  if (areaSqFt <= 0) return 0;
  return (PR_CONSTANT * totalGpm) / areaSqFt;
}

export function flowAtPressure(nominalFlow: number, nominalPsi: number, actualPsi: number): number {
  if (nominalPsi <= 0 || actualPsi <= 0) return 0;
  return nominalFlow * Math.sqrt(actualPsi / nominalPsi);
}

export function headPerformance(s: Sprinkler): HeadPerformance {
  const product = getProduct(s.productId);
  let nozzle = getNozzle(product, s.nozzleId);
  let minPressure = product.minPressure;
  let maxPressure = product.maxPressure;
  if (product.category === "custom" && s.custom) {
    nozzle = { ...nozzle, radius: s.custom.radius, flowGpm: s.custom.flowGpm, pressure: s.custom.pressure };
    minPressure = s.custom.minPressure;
    maxPressure = s.custom.maxPressure;
  }
  const catalogRadius = nozzle.radius;
  const radius = s.radiusOverride && s.radiusOverride > 0 ? s.radiusOverride : catalogRadius;
  const flowGpm = headFlow(product, nozzle, s.arc);
  const precip = product.category === "emitter" || product.category === "bubbler" ? 0 : precipitationRate(flowGpm, s.arc, radius);
  return {
    product,
    nozzle,
    radius,
    catalogRadius,
    flowGpm,
    pressure: product.prsPsi ?? nozzle.pressure,
    minPressure,
    maxPressure,
    prsPsi: product.prsPsi,
    precipInHr: precip,
    radiusReduction: catalogRadius > 0 ? Math.max(0, 1 - radius / catalogRadius) : 0,
  };
}

export function isSprayType(cat: string) {
  return cat === "spray" || cat === "microspray";
}

export type PrecipClass = "rotor" | "spray" | "rotary" | "drip" | "bubbler" | "impact";

export function precipClass(cat: string): PrecipClass {
  switch (cat) {
    case "rotor":
      return "rotor";
    case "impact":
      return "impact";
    case "spray":
    case "custom":
      return "spray";
    case "rotary":
      return "rotary";
    case "bubbler":
      return "bubbler";
    default:
      return "drip";
  }
}

/** Typical distribution/application efficiency by head class (planning values). */
export const APPLICATION_EFFICIENCY: Record<PrecipClass, number> = {
  spray: 0.65,
  rotor: 0.7,
  impact: 0.7,
  rotary: 0.75,
  bubbler: 0.8,
  drip: 0.9,
};

/**
 * Choose the nozzle for a rotor-type (non-matched) product that best matches
 * a target precipitation rate at a given arc, while keeping enough throw.
 */
export function bestNozzleForPrecip(product: SprinklerProduct, arc: number, targetPr: number, minRadius: number): Nozzle {
  let best = product.nozzles[0];
  let bestScore = Infinity;
  for (const n of product.nozzles) {
    const r = Math.max(minRadius, 1);
    const pr = precipitationRate(headFlow(product, n, arc), arc, r);
    const radiusPenalty = n.radius < minRadius * 0.95 ? 1000 * (minRadius - n.radius) : 0;
    // throw that must be cut back > 25% is poor distribution
    const cutPenalty = n.radius * (1 - product.maxRadiusReduction) > minRadius ? 0.1 * (n.radius * (1 - product.maxRadiusReduction) - minRadius) : 0;
    const score = Math.abs(pr - targetPr) / Math.max(targetPr, 0.01) + radiusPenalty + cutPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

/** Choose nozzle that best matches a desired radius (smallest nozzle that reaches it). */
export function nozzleForRadius(product: SprinklerProduct, radius: number): Nozzle {
  const sorted = [...product.nozzles].sort((a, b) => a.radius - b.radius);
  for (const n of sorted) if (n.radius >= radius * 0.98 && n.radius * (1 - product.maxRadiusReduction) <= radius + 0.01) return n;
  for (const n of sorted) if (n.radius >= radius) return n;
  return sorted[sorted.length - 1];
}

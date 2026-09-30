/**
 * AUTO LAYOUT — head-to-head sprinkler placement for an irrigated polygon.
 *
 * Strategy (in priority order, matching standard design practice):
 *   1. Choose head class from the area's narrowest width (inscribed circle):
 *      narrow strips → sprays, medium → rotary nozzles, large → gear rotors.
 *   2. Corner heads at every real corner, arc = interior angle, aimed inward.
 *   3. Perimeter heads along each edge at ≤ head-to-head spacing (180° arcs).
 *   4. Heads around obstacles (hardscape/buildings inside the area), aimed away.
 *   5. Interior full-circle heads on a triangular grid aligned to the longest edge.
 *   6. Gap filling where the modelled coverage has < 2 overlapping heads.
 *   7. Redundant interior heads removed (minimise head count).
 *   8. Rotor nozzles chosen per arc to match precipitation; throw trimmed
 *      with the radius screw (≤ 25%) to the design spacing.
 * Edge/corner heads are inset slightly and aimed into the area so they do not
 * intentionally spray hardscape or buildings.
 */
import type { Area, Project, Sprinkler } from "../model/types";
import {
  add,
  angleOf,
  boundsOf,
  dist,
  distToPolygonEdge,
  ensureCW,
  fromAngle,
  inscribedRadius,
  interiorAngle,
  norm,
  normAngle,
  pointInPolygon,
  pointInRegion,
  polygonArea,
  rotate,
  scale,
  sub,
  type Vec,
} from "../geometry/geometry";
import { getProduct, type Nozzle, type SprinklerProduct } from "../catalog/sprinklers";
import { bestNozzleForPrecip, headFlow, nozzleForRadius, precipitationRate } from "./sprinkler";
import { isIrrigated, isNoSpray } from "./site";

export type LayoutHeadClass = "auto" | "rotor" | "spray" | "rotary";

export interface AutoLayoutOptions {
  headClass: LayoutHeadClass;
  productId?: string;
  /** design radius/spacing in ft; undefined = derived from area size */
  radius?: number;
  inset?: number;
  matchPrecip?: boolean;
}

export interface AutoLayoutResult {
  heads: Omit<Sprinkler, "id">[];
  product: SprinklerProduct;
  radius: number;
  headClass: Exclude<LayoutHeadClass, "auto">;
  widthFt: number;
  notes: string[];
}

interface Candidate {
  p: Vec;
  r?: number;
  arcStart: number;
  arc: number;
  kind: "corner" | "edge" | "interior" | "obstacle";
}

export function chooseHeadClass(widthFt: number): Exclude<LayoutHeadClass, "auto"> {
  if (widthFt < 16) return "spray";
  if (widthFt < 26) return "rotary";
  return "rotor";
}

const DEFAULT_PRODUCT: Record<Exclude<LayoutHeadClass, "auto">, string> = {
  rotor: "gen-rotor-4",
  spray: "gen-spray-4-prs",
  rotary: "gen-rotary-prs",
};

const MAX_RADIUS: Record<Exclude<LayoutHeadClass, "auto">, number> = { rotor: 36, spray: 15, rotary: 28 };
const MIN_RADIUS: Record<Exclude<LayoutHeadClass, "auto">, number> = { rotor: 30, spray: 5, rotary: 9 };

export function autoLayoutArea(project: Project, area: Area, opts: AutoLayoutOptions): AutoLayoutResult {
  const notes: string[] = [];
  const poly = ensureCW(area.points);
  const bb = boundsOf(poly);
  const holes = project.areas
    .filter((a) => a.id !== area.id && isNoSpray(a))
    .filter((a) => a.points.some((p) => pointInPolygon(p, poly)) || poly.some((p) => pointInPolygon(p, a.points)))
    .map((a) => ensureCW(a.points));
  const inscribed = inscribedRadius(poly, holes);
  const width = inscribed.r * 2;

  let headClass: Exclude<LayoutHeadClass, "auto"> = opts.headClass === "auto" ? chooseHeadClass(width) : opts.headClass;
  const product = getProduct(opts.productId ?? DEFAULT_PRODUCT[headClass]);
  if (opts.productId) headClass = product.category === "rotor" || product.category === "impact" ? "rotor" : product.category === "rotary" ? "rotary" : "spray";

  // design radius: divide the width into equal head-to-head spans
  let R = opts.radius;
  if (!R) {
    const maxR = Math.min(MAX_RADIUS[headClass], Math.max(...product.nozzles.map((n) => n.radius)));
    const spans = Math.max(1, Math.round(width / maxR));
    R = Math.max(MIN_RADIUS[headClass], Math.min(maxR, width / spans));
    if (headClass === "rotor" && width < MIN_RADIUS.rotor) notes.push("Area is narrow for rotors — consider rotary nozzles or sprays.");
  }
  const S = R; // head-to-head spacing
  const inset = opts.inset ?? 0.5;
  const cands: Candidate[] = [];

  // --- 1/2: corners and edges ---
  addBoundaryHeads(poly, S, inset, cands, false);
  // --- 3: obstacles (holes) inside the area: heads face away from the obstacle ---
  for (const h of holes) {
    const insideVerts = h.filter((p) => pointInPolygon(p, poly) && distToPolygonEdge(p, poly) > inset * 2);
    if (insideVerts.length === 0) continue;
    addBoundaryHeads(h, S, inset, cands, true, (p) => pointInPolygon(p, poly) && distToPolygonEdge(p, poly) > inset);
  }
  // de-duplicate candidates closer than 0.35 S (reflex corners win, then corners, then edges)
  const prio = (c: Candidate) => (c.kind === "corner" || c.kind === "obstacle" ? (c.arc > 180 ? 0 : 1) : 2);
  cands.sort((a, b) => prio(a) - prio(b));
  const heads: Candidate[] = [];
  for (const c of cands) {
    const dup = heads.find((h) => dist(h.p, c.p) < 0.35 * S);
    if (!dup) heads.push(c);
  }

  const inRegion = (p: Vec) => pointInRegion(p, poly, holes);
  const noSpray = project.areas.filter((a) => a.id !== area.id && isNoSpray(a)).map((a) => a.points);
  const otherIrrigated = project.areas.filter((a) => a.id !== area.id && isIrrigated(a)).map((a) => a.points);
  const prop = project.areas.find((a) => a.type === "property");
  /** a point may be wetted: inside the area or neighbouring irrigated areas, never on hardscape/buildings */
  const wettable = (p: Vec) =>
    !noSpray.some((n) => pointInPolygon(p, n)) && (!prop || pointInPolygon(p, prop.points)) && (inRegion(p) || otherIrrigated.some((o) => pointInPolygon(p, o)));
  /**
   * Keep a head's throw off hardscape/buildings: first trim the radius (up to the
   * product's max screw reduction), otherwise narrow the arc. Returns false when no
   * useful arc remains.
   */
  // limit relative to design spacing so the cut relative to the nozzle's catalog throw stays ≤ max
  const maxCut = Math.min(product.maxRadiusReduction, 0.2);
  const fit = (h: Candidate) => {
    const arcSafe = (r: number) => {
      const steps = Math.max(4, Math.ceil(h.arc / 5));
      for (let i = 0; i <= steps; i++) {
        const dir = fromAngle(h.arcStart + (h.arc * i) / steps);
        for (const f of [0.3, 0.55, 0.75, 0.9]) if (!wettable(add(h.p, scale(dir, r * f)))) return false;
      }
      return true;
    };
    if (arcSafe(S)) return true;
    for (let k = 1; k <= 5; k++) {
      const r = S * (1 - (maxCut * k) / 5);
      if (arcSafe(r)) {
        h.r = r;
        return true;
      }
    }
    const f = fitArc(h.p, S, (q) => wettable(q) && (h.arc >= 359.9 || normAngle(angleOf(sub(q, h.p)) - h.arcStart) <= h.arc + 0.5));
    if (!f || f.arc < 30) return h.kind !== "interior";
    h.arcStart = f.start;
    h.arc = f.arc;
    return true;
  };
  for (const h of heads) fit(h);

  // --- 4: interior triangular grid aligned with the longest edge ---
  let longest = 0;
  let axis = 0;
  let origin = poly[0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = dist(a, b);
    if (L > longest) {
      longest = L;
      axis = angleOf(sub(b, a));
      origin = a;
    }
  }
  const rowH = S * 0.866;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) + S * 2;
  for (let j = -Math.ceil(diag / rowH); j <= Math.ceil(diag / rowH); j++) {
    for (let i = -Math.ceil(diag / S); i <= Math.ceil(diag / S); i++) {
      const local = { x: i * S + (j % 2 ? S / 2 : 0), y: j * rowH };
      const p = add(origin, rotate(local, axis));
      if (p.x < bb.minX || p.x > bb.maxX || p.y < bb.minY || p.y > bb.maxY) continue;
      if (!inRegion(p)) continue;
      let dEdge = distToPolygonEdge(p, poly);
      for (const h of holes) dEdge = Math.min(dEdge, distToPolygonEdge(p, h));
      if (dEdge < 0.45 * S) continue;
      if (heads.some((h) => dist(h.p, p) < 0.7 * S)) continue;
      const c: Candidate = { p, arcStart: 0, arc: 360, kind: "interior" };
      if (fit(c) && c.arc >= 90) heads.push(c);
    }
  }

  // --- 5: gap filling (greedy set cover over candidate positions) ---
  const sampleStep = Math.max(0.5, S / 9);
  const samples: Vec[] = [];
  for (let x = bb.minX + sampleStep / 2; x < bb.maxX; x += sampleStep)
    for (let y = bb.minY + sampleStep / 2; y < bb.maxY; y += sampleStep) {
      const p = { x, y };
      if (inRegion(p)) samples.push(p);
    }
  const covers = (h: Candidate, p: Vec) => {
    const d = dist(h.p, p);
    if (d > (h.r ?? S) * 1.03) return false;
    if (h.arc >= 359.9 || d < 1e-6) return true;
    return normAngle(angleOf(sub(p, h.p)) - h.arcStart) <= h.arc + 2;
  };
  const coverCount = (p: Vec, list: Candidate[]) => {
    let c = 0;
    for (const h of list) if (covers(h, p)) c++;
    return c;
  };
  const pool: Candidate[] = [];
  const cstep = S / 3;
  for (let x = bb.minX + cstep / 2; x < bb.maxX; x += cstep)
    for (let y = bb.minY + cstep / 2; y < bb.maxY; y += cstep) {
      const p = { x, y };
      if (!inRegion(p)) continue;
      let dEdge = distToPolygonEdge(p, poly);
      for (const h of holes) dEdge = Math.min(dEdge, distToPolygonEdge(p, h));
      if (dEdge < 0.3 * S) continue;
      const c: Candidate = { p, arcStart: 0, arc: 360, kind: "interior" };
      if (fit(c)) pool.push(c);
    }
  for (const [ring, outward] of [[poly, false], ...holes.map((h) => [h, true] as const)] as [Vec[], boolean][]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const L = dist(a, b);
      const dir = norm(sub(b, a));
      const inward = outward ? { x: dir.y, y: -dir.x } : { x: -dir.y, y: dir.x };
      const n = Math.max(1, Math.floor(L / cstep));
      for (let k = 1; k < n; k++) {
        const p = add(add(a, scale(dir, (L * k) / n)), scale(inward, inset));
        if (!inRegion(p)) continue;
        const c: Candidate = { p, arcStart: normAngle(angleOf(outward ? scale(dir, -1) : dir)), arc: 180, kind: "edge" };
        fit(c);
        pool.push(c);
      }
    }
  }
  const counts = samples.map((p) => coverCount(p, heads));
  const cellA = sampleStep * sampleStep;
  const minGain = Math.max(12, 0.006 * polygonArea(poly)) / cellA;
  for (let iter = 0; iter < 40; iter++) {
    let best: Candidate | null = null;
    let bestGain = 0;
    for (const c of pool) {
      if (heads.some((h) => dist(h.p, c.p) < 0.35 * S)) continue;
      let gain = 0;
      for (let k = 0; k < samples.length; k++) if (counts[k] < 2 && covers(c, samples[k])) gain += counts[k] === 0 ? 1.5 : 1;
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
      }
    }
    if (!best || bestGain < minGain) break;
    heads.push(best);
    for (let k = 0; k < samples.length; k++) if (covers(best, samples[k])) counts[k]++;
  }

  // --- 6: remove redundant interior heads ---
  const baseline = samples.map((p) => coverCount(p, heads));
  for (let i = heads.length - 1; i >= 0; i--) {
    const h = heads[i];
    if (h.kind !== "interior") continue;
    let ok = true;
    for (let k = 0; k < samples.length; k++) {
      if (!covers(h, samples[k])) continue;
      if (baseline[k] - 1 < 2) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (let k = 0; k < samples.length; k++) if (covers(h, samples[k])) baseline[k]--;
      heads.splice(i, 1);
    }
  }

  // --- 7: nozzle selection & radius trim ---
  // Matched precipitation: for rotor-type heads the smallest nozzle that reaches R is
  // used on the smallest arc; larger arcs get proportionally larger nozzles.
  const fullNozzle = nozzleForRadius(product, R);
  // reference: the smallest nozzle reaching R on a standard 90° corner head
  const targetPr = product.matchedPrecip ? precipitationRate(headFlow(product, fullNozzle, 360), 360, R) : precipitationRate(headFlow(product, fullNozzle, 90), 90, R);
  const out: Omit<Sprinkler, "id">[] = heads.map((h) => {
    let arc = Math.round(Math.max(product.arcMin || 1, Math.min(product.arcMax, h.arc)));
    if (!product.arcAdjustable) arc = product.arcMax;
    let nozzle: Nozzle = fullNozzle;
    const rr = h.r ?? R;
    if (!product.matchedPrecip && opts.matchPrecip !== false) nozzle = bestNozzleForPrecip(product, arc, targetPr, rr);
    else nozzle = nozzleForRadius(product, rr);
    const radiusOverride = nozzle.radius > rr + 0.05 ? +rr.toFixed(1) : undefined;
    return {
      position: { x: +h.p.x.toFixed(3), y: +h.p.y.toFixed(3) },
      productId: product.id,
      nozzleId: nozzle.id,
      arcStart: +normAngle(h.arcStart).toFixed(1),
      arc,
      radiusOverride,
      elevation: 0,
      layer: "sprinklers",
    };
  });
  if (width < 4) notes.push("Very narrow area — drip irrigation is recommended instead of spray heads.");
  return { heads: out, product, radius: R, headClass, widthFt: width, notes };
}

function nearestEdge(p: Vec, poly: Vec[]): { point: Vec; dir: Vec } {
  let best = { point: poly[0], dir: { x: 1, y: 0 }, d: Infinity };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ab = sub(b, a);
    const L2 = ab.x * ab.x + ab.y * ab.y;
    const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2));
    const q = add(a, scale(ab, t));
    const d = dist(p, q);
    if (d < best.d) best = { point: q, dir: norm(ab), d };
  }
  return best;
}

/**
 * Places corner + edge heads on a CW polygon boundary.
 * `outward` = true for obstacles (heads aimed away from the polygon).
 */
function addBoundaryHeads(poly: Vec[], S: number, inset: number, out: Candidate[], outward: boolean, accept: (p: Vec) => boolean = () => true) {
  const n = poly.length;
  const corner: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const ang = interiorAngle(poly, i);
    corner.push(ang < 168 || ang > 192);
  }
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    if (corner[i]) {
      const aNext = angleOf(sub(next, cur));
      const aPrev = angleOf(sub(prev, cur));
      let start: number;
      let arc: number;
      if (!outward) {
        start = aNext;
        arc = normAngle(aPrev - aNext);
      } else {
        start = aPrev;
        arc = normAngle(aNext - aPrev);
      }
      if (arc < 1) arc = 360;
      const mid = fromAngle(start + arc / 2);
      const p = add(cur, scale(mid, inset * (arc > 180 ? 1 : 1.4)));
      if (accept(p)) out.push({ p, arcStart: normAngle(start), arc, kind: outward ? "obstacle" : "corner" });
    }
  }
  // edge heads between corners (walk runs of near-collinear vertices as one edge)
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const L = dist(a, b);
    // an edge barely longer than the spacing is covered by its corner heads
    const segs = L <= S * 1.15 ? 1 : Math.max(1, Math.ceil(L / S - 0.02));
    const dir = norm(sub(b, a));
    const inward = outward ? { x: dir.y, y: -dir.x } : { x: -dir.y, y: dir.x };
    const startAng = outward ? angleOf(scale(dir, -1)) : angleOf(dir);
    for (let k = corner[i] ? 1 : 0; k < segs; k++) {
      const t = k / segs;
      if (!corner[i] && k === 0) {
        // vertex is not a corner: still place a head at the vertex position as an edge head
      }
      const p = add(add(a, scale(sub(b, a), t)), scale(inward, inset));
      if (accept(p)) out.push({ p, arcStart: normAngle(startAng), arc: 180, kind: outward ? "obstacle" : "edge" });
    }
  }
}

/**
 * Fit a sprinkler arc so its throw stays on wettable ground: sample directions,
 * find the largest contiguous run of safe directions and return it as the arc.
 */
export function fitArc(p: Vec, r: number, wettable: (q: Vec) => boolean, stepDeg = 5): { start: number; arc: number } | null {
  const n = Math.round(360 / stepDeg);
  const ok: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const dir = fromAngle(i * stepDeg);
    let safe = true;
    for (const f of [0.3, 0.55, 0.75, 0.9]) {
      if (!wettable(add(p, scale(dir, r * f)))) {
        safe = false;
        break;
      }
    }
    ok.push(safe);
  }
  if (ok.every(Boolean)) return { start: 0, arc: 360 };
  if (!ok.some(Boolean)) return null;
  // longest circular run of true
  let bestStart = 0;
  let bestLen = 0;
  for (let i = 0; i < n; i++) {
    if (!ok[i] || ok[(i - 1 + n) % n]) continue;
    let len = 0;
    while (ok[(i + len) % n] && len < n) len++;
    if (len > bestLen) {
      bestLen = len;
      bestStart = i;
    }
  }
  if (bestLen < 2) return null;
  return { start: normAngle(bestStart * stepDeg), arc: (bestLen - 1) * stepDeg };
}

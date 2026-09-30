/**
 * Coverage analysis: heatmap, head-to-head classification, and overspray.
 *
 * MODEL / ASSUMPTIONS
 *  Each head's application-rate profile is modelled as a parabolic profile that is
 *  flat near the head and falls to zero at full throw — an idealisation of typical
 *  rotor/spray catch-can curves:
 *        p(d) = 2 × PR_avg × (1 − (d/r)²),   PR_avg = 96.25 × Q × (360/arc) / (π r²)
 *  which integrates exactly to the head's flow over its wetted sector.
 *  A point is classified:
 *    - INSUFFICIENT  reached by fewer than two heads (no head-to-head) or modelled
 *                    rate < 50% of the median rate of the irrigated area
 *    - EXCESSIVE     modelled rate > 200% of the median rate
 *    - ACCEPTABLE    otherwise
 *  The modelled lower-quarter distribution uniformity (DU_lq) is a planning
 *  indicator only, not a field catch-can audit result.
 */
import type { Area, Project, Sprinkler } from "../model/types";
import { angleOf, boundsOf, dist, fromAngle, add, normAngle, pointInPolygon, polygonArea, sub, SpatialHash, type Vec } from "../geometry/geometry";
import { headPerformance, PR_CONSTANT, type HeadPerformance } from "./sprinkler";
import { isIrrigated, isNoSpray, propertyBoundary } from "./site";

export interface CoverageGrid {
  originX: number;
  originY: number;
  step: number;
  cols: number;
  rows: number;
  rate: Float32Array;
  count: Uint8Array;
  mask: Uint8Array; // 1 = target irrigated point
  cls: Uint8Array; // 0 none, 1 insufficient, 2 acceptable, 3 excessive
  median: number;
  stats: CoverageStats;
}

export interface CoverageStats {
  targetArea: number;
  insufficientPct: number;
  acceptablePct: number;
  excessivePct: number;
  dryPct: number;
  duLq: number;
  gapClusters: { center: Vec; area: number; areaId?: string }[];
}

export function headRateAt(perf: HeadPerformance, h: Sprinkler, p: Vec): number {
  const d = dist(p, h.position);
  const r = perf.radius;
  if (d > r || r <= 0 || h.arc <= 0) return 0;
  if (h.arc < 359.9 && d > 1e-6) {
    const a = normAngle(angleOf(sub(p, h.position)) - h.arcStart);
    if (a > h.arc + 1e-6) return 0;
  }
  const prAvg = (PR_CONSTANT * perf.flowGpm * (360 / h.arc)) / (Math.PI * r * r);
  const x = d / r;
  return 2 * prAvg * (1 - x * x);
}

/** Target region: lawn areas + beds that contain spray-type heads, minus hardscape/structures & drip areas */
export function coverageTargets(project: Project): { targets: Area[]; holes: Vec[][] } {
  const sprayHeads = project.sprinklers.filter((s) => {
    const c = headPerformance(s).product.category;
    return c !== "emitter" && c !== "bubbler";
  });
  const targets = project.areas.filter((a) => {
    if (!isIrrigated(a)) return false;
    if (a.type === "lawn") return true;
    return sprayHeads.some((h) => pointInPolygon(h.position, a.points));
  });
  const holes = [...project.areas.filter(isNoSpray).map((a) => a.points), ...project.drips.map((d) => d.points)];
  return { targets, holes };
}

export function computeCoverage(project: Project, stepOverride?: number): CoverageGrid | null {
  const { targets, holes } = coverageTargets(project);
  if (!targets.length) return null;
  const heads = project.sprinklers.filter((s) => {
    const c = headPerformance(s).product.category;
    return c !== "emitter" && c !== "bubbler";
  });
  const perf = new Map(heads.map((h) => [h.id, headPerformance(h)]));
  const b = boundsOf(targets.flatMap((t) => t.points));
  const totalArea = targets.reduce((a, t) => a + polygonArea(t.points), 0);
  const step = stepOverride ?? Math.max(0.75, Math.sqrt(totalArea / 30000));
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / step));
  const rows = Math.max(1, Math.ceil((b.maxY - b.minY) / step));
  const n = cols * rows;
  const rate = new Float32Array(n);
  const count = new Uint8Array(n);
  const mask = new Uint8Array(n);
  const cls = new Uint8Array(n);
  const hash = new SpatialHash<Sprinkler>(20);
  let maxR = 1;
  for (const h of heads) {
    hash.insert(h.position, h);
    maxR = Math.max(maxR, perf.get(h.id)!.radius);
  }
  const areaIdAt: (string | undefined)[] = new Array(n);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = { x: b.minX + (i + 0.5) * step, y: b.minY + (j + 0.5) * step };
      const t = targets.find((a) => pointInPolygon(p, a.points));
      if (!t) continue;
      if (holes.some((hl) => pointInPolygon(p, hl))) continue;
      const k = j * cols + i;
      mask[k] = 1;
      areaIdAt[k] = t.id;
      let sum = 0;
      let c = 0;
      for (const { item: h } of hash.query(p, maxR)) {
        const pf = perf.get(h.id)!;
        const d = dist(p, h.position);
        if (d > pf.radius * 1.02) continue;
        if (h.arc < 359.9 && d > 1e-6) {
          const a = normAngle(angleOf(sub(p, h.position)) - h.arcStart);
          if (a > h.arc + 1) continue;
        }
        c++;
        sum += headRateAt(pf, h, p);
      }
      rate[k] = sum;
      count[k] = Math.min(255, c);
    }
  const vals: number[] = [];
  for (let k = 0; k < n; k++) if (mask[k] && rate[k] > 0) vals.push(rate[k]);
  vals.sort((a, c) => a - c);
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  let ins = 0,
    acc = 0,
    exc = 0,
    dry = 0,
    tot = 0;
  for (let k = 0; k < n; k++) {
    if (!mask[k]) continue;
    tot++;
    if (count[k] === 0) dry++;
    if (count[k] < 2 || rate[k] < 0.5 * median) {
      cls[k] = 1;
      ins++;
    } else if (rate[k] > 2.0 * median) {
      cls[k] = 3;
      exc++;
    } else {
      cls[k] = 2;
      acc++;
    }
  }
  // DU lower quarter over all target points (including dry)
  const all: number[] = [];
  for (let k = 0; k < n; k++) if (mask[k]) all.push(rate[k]);
  all.sort((a, c) => a - c);
  const mean = all.reduce((a, c) => a + c, 0) / Math.max(all.length, 1);
  const lq = all.slice(0, Math.max(1, Math.floor(all.length / 4)));
  const lqMean = lq.reduce((a, c) => a + c, 0) / Math.max(lq.length, 1);
  const duLq = mean > 0 ? lqMean / mean : 0;

  // gap clusters (connected insufficient cells), largest first
  const seen = new Uint8Array(n);
  const clusters: { center: Vec; area: number; areaId?: string }[] = [];
  for (let k = 0; k < n; k++) {
    if (cls[k] !== 1 || seen[k]) continue;
    const stack = [k];
    seen[k] = 1;
    let sx = 0,
      sy = 0,
      cnt = 0;
    const aid = areaIdAt[k];
    while (stack.length) {
      const c = stack.pop()!;
      const ci = c % cols;
      const cj = (c - ci) / cols;
      sx += ci;
      sy += cj;
      cnt++;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = ci + di,
          nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = nj * cols + ni;
        if (!seen[nk] && cls[nk] === 1) {
          seen[nk] = 1;
          stack.push(nk);
        }
      }
    }
    const area = cnt * step * step;
    if (area >= 4) clusters.push({ center: { x: b.minX + (sx / cnt + 0.5) * step, y: b.minY + (sy / cnt + 0.5) * step }, area, areaId: aid });
  }
  clusters.sort((a, c) => c.area - a.area);
  const cellA = step * step;
  return {
    originX: b.minX,
    originY: b.minY,
    step,
    cols,
    rows,
    rate,
    count,
    mask,
    cls,
    median,
    stats: {
      targetArea: tot * cellA,
      insufficientPct: tot ? (ins / tot) * 100 : 0,
      acceptablePct: tot ? (acc / tot) * 100 : 0,
      excessivePct: tot ? (exc / tot) * 100 : 0,
      dryPct: tot ? (dry / tot) * 100 : 0,
      duLq,
      gapClusters: clusters,
    },
  };
}

export interface OversprayResult {
  sprinklerId: string;
  areaId: string;
  areaName: string;
  areaType: string;
  distanceFt: number; // max throw length onto the surface
}

/** Overspray: cast rays across the head's arc and measure wetted length on no-spray surfaces. */
export function computeOverspray(project: Project, h: Sprinkler, perf?: HeadPerformance): OversprayResult[] {
  const pf = perf ?? headPerformance(h);
  if (h.oversprayOk) return [];
  const cat = pf.product.category;
  if (cat === "emitter" || cat === "bubbler") return [];
  const obstacles = project.areas.filter(isNoSpray);
  const prop = propertyBoundary(project);
  const r = pf.radius;
  const step = Math.max(0.5, r / 60);
  const rayStep = h.arc >= 359.9 ? 5 : Math.max(1, Math.min(5, h.arc / 18));
  const results = new Map<string, OversprayResult>();
  const near = obstacles.filter((o) => {
    const bb = boundsOf(o.points);
    return h.position.x + r >= bb.minX && h.position.x - r <= bb.maxX && h.position.y + r >= bb.minY && h.position.y - r <= bb.maxY;
  });
  for (let a = 0; a <= h.arc + 1e-6; a += rayStep) {
    const dir = fromAngle(h.arcStart + Math.min(a, h.arc));
    const runs = new Map<string, number>();
    let outside = 0;
    for (let d = step; d <= r; d += step) {
      const p = add(h.position, { x: dir.x * d, y: dir.y * d });
      for (const o of near) if (pointInPolygon(p, o.points)) runs.set(o.id, (runs.get(o.id) ?? 0) + step);
      if (prop && !pointInPolygon(p, prop.points)) outside += step;
    }
    for (const [id, l] of runs) {
      const o = near.find((x) => x.id === id)!;
      const cur = results.get(id);
      if (!cur || cur.distanceFt < l) results.set(id, { sprinklerId: h.id, areaId: id, areaName: o.name, areaType: o.type, distanceFt: l });
    }
    if (prop && outside > 0) {
      const cur = results.get("__property");
      if (!cur || cur.distanceFt < outside) results.set("__property", { sprinklerId: h.id, areaId: prop.id, areaName: "beyond property line", areaType: "property", distanceFt: outside });
    }
  }
  return [...results.values()];
}

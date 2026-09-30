/**
 * AUTO PIPE ROUTING.
 *
 * Lateral styles:
 *  - branched   Steiner-style tree: each head joins the existing network at the
 *               cheapest point (existing node OR perpendicular tee onto a pipe),
 *               producing shared trunks with tee branches and minimal trench length.
 *  - end-fed    a straight trunk along the zone's principal axis fed from the
 *               end nearest the valve; heads branch perpendicular to the trunk.
 *  - center-fed same trunk, fed at its midpoint (halves the flow in each half).
 *  - looped     branched tree plus a closing pipe between two far-apart branch ends.
 * Cost function: trench length × surface penalty. Buildings/pools are never
 * crossed (paths detour around them on a visibility graph); crossing hardscape
 * costs 3× and generates a sleeve. Lawn/landscape routes are preferred.
 */
import type { Area, Pipe, PipeMaterial, Project, Zone } from "../model/types";
import {
  add,
  closestOnSegment,
  dist,
  lerp,
  offsetPolygon,
  pointInPolygon,
  scale,
  segmentIntersectsPolygon,
  segmentLengthInsidePolygon,
  sub,
  type Vec,
} from "../geometry/geometry";
import { isHardscape, isStructure } from "./site";
import { dripCalc } from "./drip";

export type LateralStyle = "branched" | "end-fed" | "center-fed" | "looped";

export type NewPipe = Omit<Pipe, "id">;

interface Seg {
  a: Vec;
  b: Vec;
}

interface Ctx {
  structures: Vec[][];
  expanded: Vec[][];
  hardscape: Area[];
}

function makeCtx(project: Project): Ctx {
  const structures = project.areas.filter(isStructure).map((a) => a.points);
  return {
    structures,
    expanded: structures.map((p) => offsetPolygon(p, -1.5)),
    hardscape: project.areas.filter(isHardscape),
  };
}

function blocked(ctx: Ctx, a: Vec, b: Vec) {
  // a structure that contains an endpoint (e.g. a controller on a garage wall) does not block
  return ctx.structures.some((poly) => !pointInPolygon(a, poly) && !pointInPolygon(b, poly) && segmentIntersectsPolygon(a, b, poly));
}

/** shortest obstacle-avoiding path (visibility graph + Dijkstra) */
function detour(ctx: Ctx, a: Vec, b: Vec): Vec[] | null {
  if (!blocked(ctx, a, b)) return [a, b];
  const pts: Vec[] = [a, b, ...ctx.expanded.flat().filter((p) => !ctx.structures.some((s) => pointInPolygon(p, s)))];
  const n = pts.length;
  const d = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  d[0] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || d[u] === Infinity) break;
    if (u === 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const w = dist(pts[u], pts[v]);
      if (d[u] + w >= d[v]) continue;
      if (blocked(ctx, pts[u], pts[v])) continue;
      d[v] = d[u] + w;
      prev[v] = u;
    }
  }
  if (prev[1] < 0) return null;
  const path: Vec[] = [];
  for (let c = 1; c >= 0; c = prev[c]) {
    path.unshift(pts[c]);
    if (c === 0) break;
  }
  return path;
}

function pathCost(ctx: Ctx, path: Vec[]): number {
  let c = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const L = dist(a, b);
    let hard = 0;
    for (const h of ctx.hardscape) hard += segmentLengthInsidePolygon(a, b, h.points, 24);
    c += L + 2 * Math.min(hard, L);
  }
  return c;
}

/** cheapest connection of point p into the tree */
function bestConnection(ctx: Ctx, p: Vec, tree: Seg[], nodes: Vec[]): { path: Vec[]; cost: number; seg?: number; at: Vec } | null {
  const cands: { at: Vec; seg?: number; straight: number }[] = [];
  for (const n of nodes) cands.push({ at: n, straight: dist(p, n) });
  tree.forEach((s, i) => {
    const c = closestOnSegment(p, s.a, s.b);
    if (c.t > 0.02 && c.t < 0.98) cands.push({ at: c.point, seg: i, straight: c.d });
  });
  cands.sort((x, y) => x.straight - y.straight);
  let best: { path: Vec[]; cost: number; seg?: number; at: Vec } | null = null;
  for (const c of cands.slice(0, 14)) {
    if (best && c.straight >= best.cost) break;
    const path = detour(ctx, p, c.at);
    if (!path) continue;
    const cost = pathCost(ctx, path);
    if (!best || cost < best.cost) best = { path, cost, seg: c.seg, at: c.at };
  }
  return best;
}

function addPath(tree: Seg[], nodes: Vec[], path: Vec[], splitSeg?: number, at?: Vec) {
  if (splitSeg !== undefined && at) {
    const s = tree[splitSeg];
    tree.splice(splitSeg, 1, { a: s.a, b: at }, { a: at, b: s.b });
    nodes.push(at);
  }
  for (let i = 0; i < path.length - 1; i++) tree.push({ a: path[i], b: path[i + 1] });
  for (const p of path) nodes.push(p);
}

/** Steiner-Prim tree from root connecting all targets. */
export function steinerTree(ctx: Ctx, root: Vec, targets: Vec[]): Seg[] {
  const tree: Seg[] = [];
  const nodes: Vec[] = [root];
  const left = targets.filter((t) => dist(t, root) > 0.05);
  while (left.length) {
    let bi = -1;
    let best: ReturnType<typeof bestConnection> = null;
    for (let i = 0; i < left.length; i++) {
      const c = bestConnection(ctx, left[i], tree, nodes);
      if (c && (!best || c.cost < best.cost)) {
        best = c;
        bi = i;
      }
    }
    if (!best) break;
    addPath(tree, nodes, [...best.path].reverse(), best.seg, best.at);
    left.splice(bi, 1);
  }
  return tree;
}

function principalAxis(ps: Vec[]): { c: Vec; dir: Vec } {
  const c = scale(ps.reduce((a, p) => add(a, p), { x: 0, y: 0 }), 1 / ps.length);
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const p of ps) {
    const d = sub(p, c);
    sxx += d.x * d.x;
    syy += d.y * d.y;
    sxy += d.x * d.y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c, dir: { x: Math.cos(theta), y: Math.sin(theta) } };
}

function trunkTree(ctx: Ctx, root: Vec, targets: Vec[], centerFed: boolean): Seg[] {
  if (targets.length < 2) return steinerTree(ctx, root, targets);
  const { c, dir } = principalAxis(targets);
  const proj = targets.map((t) => (t.x - c.x) * dir.x + (t.y - c.y) * dir.y);
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  const at = (s: number) => add(c, scale(dir, s));
  const stops = new Set<number>();
  proj.forEach((s) => stops.add(+s.toFixed(2)));
  const trunkPts = [...stops].sort((a, b) => a - b).map(at);
  const tree: Seg[] = [];
  for (let i = 0; i < trunkPts.length - 1; i++) {
    const path = detour(ctx, trunkPts[i], trunkPts[i + 1]) ?? [trunkPts[i], trunkPts[i + 1]];
    for (let k = 0; k < path.length - 1; k++) tree.push({ a: path[k], b: path[k + 1] });
  }
  targets.forEach((t, i) => {
    const q = at(+proj[i].toFixed(2));
    if (dist(q, t) < 0.3) return;
    const path = detour(ctx, q, t) ?? [q, t];
    for (let k = 0; k < path.length - 1; k++) tree.push({ a: path[k], b: path[k + 1] });
  });
  const feed = centerFed ? at((lo + hi) / 2) : dist(at(lo), root) < dist(at(hi), root) ? at(lo) : at(hi);
  // split trunk at feed point if interior
  if (centerFed) {
    const idx = tree.findIndex((s) => closestOnSegment(feed, s.a, s.b).d < 0.05 && dist(s.a, feed) > 0.05 && dist(s.b, feed) > 0.05);
    if (idx >= 0) {
      const s = tree[idx];
      tree.splice(idx, 1, { a: s.a, b: feed }, { a: feed, b: s.b });
    }
  }
  const path = detour(ctx, root, feed) ?? [root, feed];
  for (let k = 0; k < path.length - 1; k++) tree.push({ a: path[k], b: path[k + 1] });
  return tree;
}

function loopTree(ctx: Ctx, root: Vec, targets: Vec[], radius: number): Seg[] {
  const tree = steinerTree(ctx, root, targets);
  // find leaf pair with highest tree-distance / straight-distance ratio
  const key = (p: Vec) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const adj = new Map<string, { p: Vec; n: { k: string; w: number }[] }>();
  for (const s of tree) {
    for (const [u, w] of [
      [s.a, s.b],
      [s.b, s.a],
    ] as const) {
      const ku = key(u);
      if (!adj.has(ku)) adj.set(ku, { p: u, n: [] });
      adj.get(ku)!.n.push({ k: key(w), w: dist(u, w) });
    }
  }
  const leaves = [...adj.entries()].filter(([, v]) => v.n.length === 1).map(([k]) => k);
  const treeDist = (from: string) => {
    const d = new Map<string, number>([[from, 0]]);
    const q = [from];
    while (q.length) {
      const u = q.shift()!;
      for (const e of adj.get(u)!.n)
        if (!d.has(e.k)) {
          d.set(e.k, d.get(u)! + e.w);
          q.push(e.k);
        }
    }
    return d;
  };
  let best: { a: Vec; b: Vec; score: number } | null = null;
  for (const la of leaves) {
    const d = treeDist(la);
    for (const lb of leaves) {
      if (la >= lb) continue;
      const pa = adj.get(la)!.p;
      const pb = adj.get(lb)!.p;
      const straight = dist(pa, pb);
      if (straight > radius * 1.6 || blocked(ctx, pa, pb)) continue;
      const score = (d.get(lb) ?? 0) / Math.max(straight, 1);
      if (!best || score > best.score) best = { a: pa, b: pb, score };
    }
  }
  if (best && best.score > 2) tree.push({ a: best.a, b: best.b });
  return tree;
}

export interface RouteZoneResult {
  pipes: NewPipe[];
  length: number;
}

export function zoneTargets(project: Project, zone: Zone): Vec[] {
  const valve = project.valves.find((v) => v.id === zone.valveId);
  const heads = project.sprinklers.filter((h) => h.zoneId === zone.id).map((h) => h.position);
  const drips = project.drips
    .filter((d) => d.zoneId === zone.id)
    .map((d) => {
      // connect at the drip-area edge closest to the valve
      if (!valve) return d.points[0];
      let best = d.points[0];
      let bd = Infinity;
      for (let i = 0; i < d.points.length; i++) {
        const c = closestOnSegment(valve.position, d.points[i], d.points[(i + 1) % d.points.length]);
        if (c.d < bd) {
          bd = c.d;
          best = c.point;
        }
      }
      void dripCalc;
      return best;
    });
  return [...heads, ...drips];
}

export function routeZone(project: Project, zone: Zone, style: LateralStyle, ctx = makeCtx(project)): RouteZoneResult {
  const valve = project.valves.find((v) => v.id === zone.valveId);
  if (!valve) return { pipes: [], length: 0 };
  const targets = zoneTargets(project, zone);
  if (!targets.length) return { pipes: [], length: 0 };
  const heads = project.sprinklers.filter((h) => h.zoneId === zone.id);
  const avgR = heads.length ? heads.reduce((a, h) => a + (h.radiusOverride ?? 30), 0) / heads.length : 20;
  let tree: Seg[];
  if (style === "end-fed" || style === "center-fed") {
    tree = trunkTree(ctx, valve.position, targets, style === "center-fed");
    // a straight trunk is only valid when it avoids structures and stays on the property
    const prop = project.areas.find((a) => a.type === "property");
    const invalid = tree.some((sg) => blocked(ctx, sg.a, sg.b) || (prop && (!pointInPolygon(sg.a, prop.points) || !pointInPolygon(sg.b, prop.points))));
    if (invalid) tree = steinerTree(ctx, valve.position, targets);
  }
  else if (style === "looped") tree = loopTree(ctx, valve.position, targets, avgR);
  else tree = steinerTree(ctx, valve.position, targets);
  const isDripZone = valve.type === "drip" || (heads.length === 0 && project.drips.some((d) => d.zoneId === zone.id));
  const material: PipeMaterial = isDripZone ? "poly-100" : project.settings.lateralMaterial;
  const pipes: NewPipe[] = tree
    .filter((s) => dist(s.a, s.b) > 0.05)
    .map((s) => ({
      kind: isDripZone ? "drip" : "lateral",
      points: [round(s.a), round(s.b)],
      material,
      size: 1,
      autoSize: true,
      zoneId: zone.id,
      layer: isDripZone ? "drip" : "laterals",
    }));
  return { pipes, length: tree.reduce((a, s) => a + dist(s.a, s.b), 0) };
}

export function routeMainline(project: Project, ctx = makeCtx(project)): NewPipe[] {
  const src = project.waterSources[0];
  if (!src) return [];
  const valveIds = new Set(project.zones.map((z) => z.valveId).filter(Boolean) as string[]);
  const targets = project.valves.filter((v) => valveIds.has(v.id) || v.type === "master").map((v) => v.position);
  project.equipment.filter((e) => e.type === "quick-coupler").forEach((e) => targets.push(e.position));
  if (!targets.length) return [];
  const tree = steinerTree(ctx, src.position, targets);
  return tree
    .filter((s) => dist(s.a, s.b) > 0.05)
    .map((s) => ({ kind: "mainline", points: [round(s.a), round(s.b)], material: project.settings.mainlineMaterial, size: src.mainlineSize || 1, autoSize: true, layer: "mainline" }));
}

export function routeWire(project: Project, ctx = makeCtx(project)): NewPipe[] {
  const ctrl = project.equipment.find((e) => e.type === "controller" || e.type === "smart-controller");
  if (!ctrl) return [];
  const targets = project.valves.filter((v) => v.type !== "isolation").map((v) => v.position);
  if (!targets.length) return [];
  // wire runs from the controller to the nearest valve, then along valve locations
  // wire may pass through walls/garage and under hardscape (in the mainline sleeve)
  const tree = steinerTree({ structures: [], expanded: [], hardscape: [] }, ctrl.position, targets);
  const conductors = project.zones.length + 2;
  return tree
    .filter((s) => dist(s.a, s.b) > 0.05)
    .map((s) => ({ kind: "wire", points: [round(s.a), round(s.b)], material: "pvc-sch40", size: 0.5, autoSize: false, layer: "electrical", conductors }));
}

/** Generate sleeves where pipes cross hardscape (2 ft beyond each edge). */
export function sleevesFor(project: Project, pipes: NewPipe[]): NewPipe[] {
  const hard = project.areas.filter(isHardscape);
  const out: NewPipe[] = [];
  for (const p of pipes) {
    if (p.kind === "wire" || p.kind === "sleeve") continue;
    for (let i = 0; i < p.points.length - 1; i++) {
      const a = p.points[i];
      const b = p.points[i + 1];
      const L = dist(a, b);
      for (const h of hard) {
        if (!segmentIntersectsPolygon(a, b, h.points) && !(pointInPolygon(a, h.points) || pointInPolygon(b, h.points))) continue;
        // find entry/exit params by sampling
        const N = Math.max(8, Math.ceil(L * 2));
        let t0 = -1,
          t1 = -1;
        for (let k = 0; k <= N; k++) {
          const t = k / N;
          if (pointInPolygon(lerp(a, b, t), h.points)) {
            if (t0 < 0) t0 = t;
            t1 = t;
          }
        }
        if (t0 < 0) continue;
        const ext = 2 / Math.max(L, 1e-6);
        const s0 = Math.max(0, t0 - ext);
        const s1 = Math.min(1, t1 + ext);
        const pa = round(lerp(a, b, s0));
        const pb = round(lerp(a, b, s1));
        const dup = out.some((o) => dist(o.points[0], pa) < 1.5 && dist(o.points[1], pb) < 1.5);
        if (!dup) out.push({ kind: "sleeve", points: [pa, pb], material: "pvc-sch40", size: p.size >= 1.5 ? 3 : 2, autoSize: false, layer: "laterals" });
      }
    }
  }
  return out;
}

function round(p: Vec): Vec {
  return { x: +p.x.toFixed(3), y: +p.y.toFixed(3) };
}

export { makeCtx };

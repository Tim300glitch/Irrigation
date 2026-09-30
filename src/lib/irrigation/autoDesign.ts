/**
 * Design operations that combine the auto modules and return a NEW project
 * (immutable updates, so every operation is a single undoable step).
 */
import { produce } from "immer";
import type { Manifold, Project, Sprinkler } from "../model/types";
import { uid } from "../model/factory";
import { pointInPolygon, centroid, add, offsetPolygon, type Vec } from "../geometry/geometry";
import { autoLayoutArea, type AutoLayoutOptions } from "./autoLayout";
import { autoZone, type AutoZoneOptions } from "./autoZone";
import { routeMainline, routeWire, routeZone, sleevesFor, makeCtx, type LateralStyle, type NewPipe } from "./autoRoute";
import { bestNozzleForPrecip, headFlow, headPerformance, precipitationRate } from "./sprinkler";
import { getProduct } from "../catalog/sprinklers";
import { analyzeHydraulics } from "../hydraulics/analysis";
import { isIrrigated } from "./site";

export function applyAutoLayout(project: Project, areaId: string, opts: AutoLayoutOptions, replaceExisting = true) {
  const area = project.areas.find((a) => a.id === areaId);
  if (!area) return { project, notes: ["Area not found"], count: 0 };
  const res = autoLayoutArea(project, area, opts);
  const next = produce(project, (d) => {
    if (replaceExisting) {
      const removed = new Set(d.sprinklers.filter((s) => pointInPolygon(s.position, area.points)).map((s) => s.id));
      d.sprinklers = d.sprinklers.filter((s) => !removed.has(s.id));
    }
    for (const h of res.heads) d.sprinklers.push({ ...h, id: uid("spk") } as Sprinkler);
  });
  return { project: next, notes: res.notes, count: res.heads.length, result: res };
}

export function applyAutoZone(project: Project, opts: AutoZoneOptions = {}) {
  const res = autoZone(project, opts, () => uid("z"));
  const next = produce(project, (d) => {
    const oldValveIds = new Set(d.zones.map((z) => z.valveId).filter(Boolean) as string[]);
    d.valves = d.valves.filter((v) => !oldValveIds.has(v.id) && !(v.type === "electric" || v.type === "drip"));
    d.valves.push(...res.valves);
    d.zones = res.zones;
    for (const s of d.sprinklers) s.zoneId = res.assignments.get(s.id);
    for (const dr of d.drips) dr.zoneId = res.assignments.get(dr.id);
    // laterals no longer match zones — remove them (re-run Auto Route)
    d.pipes = d.pipes.filter((p) => p.kind !== "lateral" && p.kind !== "drip" && p.kind !== "sleeve" && p.kind !== "wire");
    d.manifolds = [];
    if ((opts.valveLayout ?? d.settings.valveLayout) === "grouped" && res.valves.length) {
      const m: Manifold = { id: uid("man"), name: "Manifold A", valveIds: res.valves.map((v) => v.id) };
      d.manifolds.push(m);
      for (const v of d.valves) if (m.valveIds.includes(v.id)) v.manifoldId = m.id;
    }
  });
  return { project: next, notes: res.notes, zones: res.zones.length, maxZoneGpm: res.maxZoneGpm };
}

export interface AutoRouteOptions {
  style: LateralStyle | "auto";
  zoneIds?: string[];
  mainline: boolean;
  wire: boolean;
  sleeves: boolean;
}

export function applyAutoRoute(project: Project, opts: AutoRouteOptions) {
  const ctx = makeCtx(project);
  const zones = project.zones.filter((z) => !opts.zoneIds || opts.zoneIds.includes(z.id));
  const zoneSet = new Set(zones.map((z) => z.id));
  const newPipes: NewPipe[] = [];
  const chosen: Record<string, LateralStyle> = {};
  for (const z of zones) {
    let style: LateralStyle = opts.style === "auto" ? "branched" : opts.style;
    if (opts.style === "auto") {
      const cmp = compareLateralStyles(project, z.id);
      style = cmp.recommended;
    }
    chosen[z.id] = style;
    newPipes.push(...routeZone(project, z, style, ctx).pipes);
  }
  let next = produce(project, (d) => {
    d.pipes = d.pipes.filter((p) => {
      if ((p.kind === "lateral" || p.kind === "drip") && (!p.zoneId || zoneSet.has(p.zoneId))) return false;
      if (opts.mainline && p.kind === "mainline") return false;
      if (opts.sleeves && p.kind === "sleeve") return false;
      if (opts.wire && p.kind === "wire") return false;
      return true;
    });
    for (const p of newPipes) d.pipes.push({ ...p, id: uid("pipe") });
  });
  if (opts.mainline) {
    const main = routeMainline(next, ctx);
    next = produce(next, (d) => {
      for (const p of main) d.pipes.push({ ...p, id: uid("pipe") });
    });
  }
  if (opts.wire) {
    const wire = routeWire(next, ctx);
    next = produce(next, (d) => {
      for (const p of wire) d.pipes.push({ ...p, id: uid("pipe") });
    });
  }
  if (opts.sleeves) {
    const sl = sleevesFor(next, next.pipes.filter((p) => p.kind !== "sleeve"));
    next = produce(next, (d) => {
      for (const p of sl) d.pipes.push({ ...p, id: uid("pipe") });
    });
  }
  return { project: next, styles: chosen };
}

export interface StyleComparison {
  style: LateralStyle;
  pipeFt: number;
  minPressure: number;
  variationPct: number;
  maxVelocity: number;
}

/** Evaluate lateral layouts for a zone and recommend the most uniform one. */
export function compareLateralStyles(project: Project, zoneId: string): { rows: StyleComparison[]; recommended: LateralStyle } {
  const zone = project.zones.find((z) => z.id === zoneId);
  const rows: StyleComparison[] = [];
  if (!zone) return { rows, recommended: "branched" };
  const ctx = makeCtx(project);
  for (const style of ["branched", "end-fed", "center-fed", "looped"] as LateralStyle[]) {
    const r = routeZone(project, zone, style, ctx);
    const trial = produce(project, (d) => {
      d.pipes = d.pipes.filter((p) => !((p.kind === "lateral" || p.kind === "drip") && p.zoneId === zoneId));
      for (const p of r.pipes) d.pipes.push({ ...p, id: uid("tmp") });
    });
    const h = analyzeHydraulics(trial);
    const zr = h.zones.find((z) => z.zoneId === zoneId);
    rows.push({ style, pipeFt: r.length, minPressure: zr?.criticalPressure ?? 0, variationPct: zr?.pressureVariationPct ?? 0, maxVelocity: zr?.maxVelocity ?? 0 });
  }
  // pick: lowest pipe length unless another style improves pressure variation meaningfully (>5 points) at ≤ 25% more pipe
  const base = rows[0];
  let best = base;
  for (const r of rows.slice(1)) {
    if (r.variationPct + 5 < best.variationPct && r.pipeFt <= base.pipeFt * 1.25) best = r;
  }
  return { rows, recommended: best.style };
}

/** Re-select rotor nozzles so every head in the zone(s) matches the zone precipitation rate. */
export function matchNozzles(project: Project, zoneId?: string) {
  let changed = 0;
  const next = produce(project, (d) => {
    const groups = new Map<string, Sprinkler[]>();
    for (const s of d.sprinklers) {
      if (zoneId && s.zoneId !== zoneId) continue;
      const key = `${s.zoneId ?? "none"}|${s.productId}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    for (const heads of groups.values()) {
      const product = getProduct(heads[0].productId);
      if (product.matchedPrecip) continue;
      // target: PR of the full-circle heads if any, else median
      const prs = heads.map((h) => ({ h, perf: headPerformance(h) }));
      const full = prs.filter((x) => x.h.arc >= 359);
      const ref = full.length ? full : prs;
      const sorted = ref.map((x) => x.perf.precipInHr).sort((a, b) => a - b);
      const target = sorted[Math.floor(sorted.length / 2)];
      for (const { h, perf } of prs) {
        const nz = bestNozzleForPrecip(product, h.arc, target, perf.radius);
        if (nz.id !== h.nozzleId) {
          h.nozzleId = nz.id;
          changed++;
        }
        if (h.radiusOverride && h.radiusOverride >= nz.radius) h.radiusOverride = undefined;
        void headFlow;
        void precipitationRate;
      }
    }
  });
  return { project: next, changed };
}

/** Full pipeline: layout every irrigated area without heads, zone, route. */
export function autoDesignAll(project: Project, layoutOpts: AutoLayoutOptions = { headClass: "auto" }, includeBeds = true) {
  let p = project;
  const notes: string[] = [];
  if (!p.waterSources.length) {
    const b = p.areas.find((a) => a.type === "building");
    const pos: Vec = b ? add(b.points[0], { x: -2, y: -2 }) : { x: 0, y: 0 };
    p = produce(p, (d) => {
      d.waterSources.push({ id: uid("poc"), name: "POC-1", position: pos, staticPsi: 65, meterSize: "3/4", serviceLineSize: 1, serviceLineLengthFt: 50, serviceLineMaterial: "pvc-sch40", mainlineSize: 1, elevation: 0, backflow: "pvb", backflowSize: 1, layer: "mainline" });
    });
    notes.push("No water source found — a default POC (65 PSI static, 3/4\" meter) was added. Update it with site data.");
  }
  for (const a of p.areas.filter(isIrrigated)) {
    if (a.type !== "lawn" && !includeBeds) continue;
    const has = p.sprinklers.some((s) => pointInPolygon(s.position, a.points));
    const dripped = p.drips.some((d) => pointInPolygon(centroid(d.points), a.points));
    if (has || dripped) continue;
    const r = applyAutoLayout(p, a.id, a.type === "lawn" ? layoutOpts : { headClass: "auto" });
    p = r.project;
    notes.push(...r.notes.map((n) => `${a.name}: ${n}`));
  }
  const z = applyAutoZone(p);
  p = z.project;
  notes.push(...z.notes);
  if (!p.equipment.some((e) => e.type.includes("controller"))) {
    const b = p.areas.find((a) => a.type === "building");
    if (b) {
      const c = offsetPolygon(b.points, -1)[1];
      p = produce(p, (d) => {
        d.equipment.push({ id: uid("eq"), type: "smart-controller", position: c, stations: Math.max(4, p.zones.length), layer: "electrical", label: "Controller (exterior wall)" });
      });
    }
  }
  const r = applyAutoRoute(p, { style: "auto", mainline: true, wire: true, sleeves: true });
  p = r.project;
  return { project: p, notes };
}

import type { Project } from "@/lib/model/types";
import { closestOnSegment, constrainAngle, dist, snapToGrid, type Vec } from "@/lib/geometry/geometry";
import type { SnapResult } from "@/store/editorStore";

export interface SnapOptions {
  tol: number; // world ft
  grid: boolean;
  gridSize: number;
  vertex: boolean;
  edge: boolean;
  sprinkler: boolean;
  exclude?: Set<string>;
  angleFrom?: Vec;
  angleStep?: number;
}

/** Snap a world point to (priority) devices/sprinklers → vertices → edges → angle → grid. */
export function snapPoint(project: Project, p: Vec, o: SnapOptions): SnapResult {
  const ex = o.exclude ?? new Set<string>();
  let best: { point: Vec; d: number; kind: SnapResult["kind"] } | null = null;
  const take = (q: Vec, kind: SnapResult["kind"], bias = 0) => {
    const d = dist(p, q) - bias;
    if (d <= o.tol && (!best || d < best.d)) best = { point: q, d, kind };
  };
  if (o.sprinkler) {
    for (const s of project.sprinklers) if (!ex.has(s.id)) take(s.position, "sprinkler", o.tol * 0.3);
    for (const v of project.valves) if (!ex.has(v.id)) take(v.position, "device", o.tol * 0.3);
    for (const w of project.waterSources) if (!ex.has(w.id)) take(w.position, "device", o.tol * 0.3);
    for (const e of project.equipment) if (!ex.has(e.id)) take(e.position, "device", o.tol * 0.2);
    for (const f of project.fittings) if (!ex.has(f.id)) take(f.position, "device", o.tol * 0.2);
  }
  if (o.vertex) {
    for (const a of project.areas) if (!ex.has(a.id)) for (const q of a.points) take(q, "vertex", o.tol * 0.15);
    for (const l of project.lines) if (!ex.has(l.id)) for (const q of l.points) take(q, "vertex", o.tol * 0.15);
    for (const pp of project.pipes) if (!ex.has(pp.id)) for (const q of pp.points) take(q, "vertex", o.tol * 0.2);
    for (const d of project.drips) if (!ex.has(d.id)) for (const q of d.points) take(q, "vertex", o.tol * 0.1);
  }
  if (best) return { point: (best as { point: Vec }).point, kind: (best as { kind: SnapResult["kind"] }).kind };
  if (o.edge) {
    const segs = (pts: Vec[], closed: boolean, id: string) => {
      if (ex.has(id)) return;
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const c = closestOnSegment(p, pts[i], pts[(i + 1) % pts.length]);
        take(c.point, "edge");
      }
    };
    for (const pp of project.pipes) segs(pp.points, false, pp.id);
    for (const a of project.areas) segs(a.points, true, a.id);
    for (const l of project.lines) segs(l.points, false, l.id);
  }
  if (best) return { point: (best as { point: Vec }).point, kind: "edge" };
  if (o.angleFrom && o.angleStep) {
    return { point: constrainAngle(o.angleFrom, p, o.angleStep), kind: "angle" };
  }
  if (o.grid) return { point: snapToGrid(p, o.gridSize), kind: "grid" };
  return { point: p, kind: "none" };
}

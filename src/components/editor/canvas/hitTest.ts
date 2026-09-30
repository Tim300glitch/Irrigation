import type { Project } from "@/lib/model/types";
import { closestOnPolyline, dist, pointInPolygon, polygonArea, type Vec } from "@/lib/geometry/geometry";
import { dimensionGeometry } from "@/lib/plan/planSvg";
import { distToSegment } from "@/lib/geometry/geometry";

/**
 * Returns the id of the top-most selectable object under world point p.
 * `tol` is in world feet (derived from a pixel tolerance / zoom).
 */
export function hitTest(project: Project, p: Vec, tol: number, opts: { includeLocked?: boolean } = {}): string | null {
  const layer = new Map(project.layers.map((l) => [l.id, l]));
  const ok = (o: { layer: string; locked?: boolean }) => {
    const l = layer.get(o.layer as never);
    if (l && !l.visible) return false;
    if (!opts.includeLocked && (l?.locked || o.locked)) return false;
    return true;
  };
  const pt = Math.max(tol * 1.6, 0.6);
  let best: { id: string; d: number } | null = null;
  const consider = (id: string, d: number, limit: number) => {
    if (d <= limit && (!best || d < best.d)) best = { id, d };
  };
  for (const s of project.sprinklers) if (ok(s)) consider(s.id, dist(p, s.position), pt);
  for (const v of project.valves) if (ok(v)) consider(v.id, dist(p, v.position), pt * 1.2);
  for (const e of project.equipment) if (ok(e)) consider(e.id, dist(p, e.position), pt * 1.3);
  for (const w of project.waterSources) if (ok(w)) consider(w.id, dist(p, w.position), pt * 1.4);
  for (const f of project.fittings) if (ok(f)) consider(f.id, dist(p, f.position), pt);
  if (best) return (best as { id: string }).id;
  for (const t of project.labels) {
    if (!ok(t)) continue;
    const w = t.text.length * t.size * 0.58;
    const r = t.rotation * (Math.PI / 180);
    const dx = p.x - t.position.x;
    const dy = p.y - t.position.y;
    const lx = dx * Math.cos(-r) - dy * Math.sin(-r);
    const ly = dx * Math.sin(-r) + dy * Math.cos(-r);
    if (lx >= -tol && lx <= w + tol && ly <= tol && ly >= -t.size - tol) return t.id;
  }
  for (const d of project.dimensions) {
    if (!ok(d)) continue;
    const g = dimensionGeometry(d.a, d.b, d.kind, d.offset);
    consider(d.id, distToSegment(p, g.d1, g.d2), tol * 1.2);
  }
  if (best) return (best as { id: string }).id;
  for (const pipe of project.pipes) {
    if (!ok(pipe)) continue;
    const c = closestOnPolyline(p, pipe.points);
    consider(pipe.id, c.d, Math.max(tol, 0.3));
  }
  for (const l of project.lines) {
    if (!ok(l)) continue;
    consider(l.id, closestOnPolyline(p, l.points).d, Math.max(tol, 0.3));
  }
  if (best) return (best as { id: string }).id;
  for (const pl of project.plants) if (ok(pl)) consider(pl.id, dist(p, pl.position), Math.max(pl.canopyRadius, pt));
  if (best) return (best as { id: string }).id;
  // polygons: smallest containing area wins; property only near its boundary
  let area: { id: string; a: number } | null = null;
  for (const d of project.drips) {
    if (!ok(d) || !pointInPolygon(p, d.points)) continue;
    const a = polygonArea(d.points);
    if (!area || a < area.a) area = { id: d.id, a };
  }
  for (const a of project.areas) {
    if (!ok(a)) continue;
    if (a.type === "property") {
      if (closestOnPolyline(p, a.points, true).d <= Math.max(tol, 0.4) && !area) area = { id: a.id, a: Infinity };
      continue;
    }
    if (!pointInPolygon(p, a.points)) continue;
    const ar = polygonArea(a.points);
    if (!area || ar < area.a) area = { id: a.id, a: ar };
  }
  return area ? area.id : null;
}

/** Ids of objects whose reference point(s) fall inside a world rectangle. */
export function marqueeHits(project: Project, a: Vec, b: Vec): string[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside = (q: Vec) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY;
  const layer = new Map(project.layers.map((l) => [l.id, l]));
  const ok = (o: { layer: string; locked?: boolean }) => {
    const l = layer.get(o.layer as never);
    return !(l && (!l.visible || l.locked)) && !o.locked;
  };
  const ids: string[] = [];
  for (const s of [...project.sprinklers, ...project.valves, ...project.equipment, ...project.waterSources, ...project.fittings, ...project.plants, ...project.labels]) if (ok(s) && inside(s.position)) ids.push(s.id);
  for (const o of [...project.pipes, ...project.lines, ...project.drips]) if (ok(o) && o.points.every(inside)) ids.push(o.id);
  for (const o of project.areas) if (ok(o) && o.type !== "property" && o.points.every(inside)) ids.push(o.id);
  for (const d of project.dimensions) if (ok(d) && inside(d.a) && inside(d.b)) ids.push(d.id);
  return ids;
}

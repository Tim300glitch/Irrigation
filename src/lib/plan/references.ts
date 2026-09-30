/**
 * Field-location references for installers: each head is located by its
 * perpendicular distance from the two nearest permanent reference lines
 * (building walls, property lines, fences) with different orientations.
 * e.g. "12'-6" from west wall of House, 18'-3" from north fence".
 */
import type { Project } from "../model/types";
import { angleOf, centroid, dist, sub, type Vec } from "../geometry/geometry";
import { compass } from "../irrigation/labels";
import { formatFeetInches } from "../units/units";

interface RefLine {
  a: Vec;
  b: Vec;
  name: string;
  angle: number;
}

export function referenceLines(project: Project): RefLine[] {
  const out: RefLine[] = [];
  for (const area of project.areas) {
    if (area.type !== "building" && area.type !== "property") continue;
    const c = centroid(area.points);
    for (let i = 0; i < area.points.length; i++) {
      const a = area.points[i];
      const b = area.points[(i + 1) % area.points.length];
      if (dist(a, b) < 3) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const side = compass(mid.x - c.x, mid.y - c.y);
      const name = area.type === "building" ? `${side} wall of ${area.name || "building"}` : `${side} property line`;
      out.push({ a, b, name, angle: ((angleOf(sub(b, a)) % 180) + 180) % 180 });
    }
  }
  for (const l of project.lines) {
    if (l.type !== "fence" && l.type !== "wall") continue;
    const all = l.points;
    const c = centroid(project.areas.find((a) => a.type === "property")?.points ?? all);
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i];
      const b = all[i + 1];
      if (dist(a, b) < 3) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      out.push({ a, b, name: `${compass(mid.x - c.x, mid.y - c.y)} ${l.type === "fence" ? "fence" : "wall"}`, angle: ((angleOf(sub(b, a)) % 180) + 180) % 180 });
    }
  }
  return out;
}

export interface LocationRef {
  text: string;
  d1?: { dist: number; name: string; foot: Vec };
  d2?: { dist: number; name: string; foot: Vec };
}

export function locate(p: Vec, refs: RefLine[]): LocationRef {
  // perpendicular distance to the (extended) reference line — the way installers
  // measure off a wall or fence line; the foot may extend past the segment ends by
  // up to half the segment length
  const cands = refs
    .map((r) => {
      const dx = r.b.x - r.a.x;
      const dy = r.b.y - r.a.y;
      const L2 = dx * dx + dy * dy || 1;
      const t = ((p.x - r.a.x) * dx + (p.y - r.a.y) * dy) / L2;
      const foot = { x: r.a.x + dx * t, y: r.a.y + dy * t };
      return { r, d: Math.hypot(p.x - foot.x, p.y - foot.y), foot, ok: t >= -0.5 && t <= 1.5 };
    })
    .filter((c) => c.ok)
    .sort((x, y) => x.d - y.d);
  const first = cands[0];
  if (!first) return { text: "" };
  const second = cands.find((c) => {
    const da = Math.abs(c.r.angle - first.r.angle);
    return Math.min(da, 180 - da) > 45;
  });
  const t1 = `${formatFeetInches(first.d)} from ${first.r.name}`;
  const t2 = second ? `, ${formatFeetInches(second.d)} from ${second.r.name}` : "";
  return { text: t1 + t2, d1: { dist: first.d, name: first.r.name, foot: first.foot }, d2: second ? { dist: second.d, name: second.r.name, foot: second.foot } : undefined };
}

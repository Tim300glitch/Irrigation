/** Reference points: named benchmarks that field measurements are taken from. */
import type { Project, RefPoint } from "../model/types";
import { dist, type Vec } from "../geometry/geometry";
import { formatFeetInches } from "../units/units";

export function originRef(project: Project): RefPoint | undefined {
  return project.refPoints?.find((r) => r.isOrigin);
}

/** Drawing coordinates are measured from the origin reference point (or the drawing origin). */
export function originOf(project: Project): Vec {
  return originRef(project)?.position ?? { x: 0, y: 0 };
}

export interface Offset {
  dx: number; // + east
  dy: number; // + south
  direct: number;
}

export function offsetFrom(ref: Vec, p: Vec): Offset {
  return { dx: p.x - ref.x, dy: p.y - ref.y, direct: dist(ref, p) };
}

/** e.g. 12'-6" E, 4'-3" S (13'-2" direct) */
export function offsetText(ref: Vec, p: Vec): string {
  const o = offsetFrom(ref, p);
  const parts: string[] = [];
  if (Math.abs(o.dx) >= 1 / 24) parts.push(`${formatFeetInches(Math.abs(o.dx))} ${o.dx > 0 ? "E" : "W"}`);
  if (Math.abs(o.dy) >= 1 / 24) parts.push(`${formatFeetInches(Math.abs(o.dy))} ${o.dy > 0 ? "S" : "N"}`);
  if (!parts.length) return "at the point";
  return parts.length === 2 ? `${parts.join(", ")} (${formatFeetInches(o.direct)} direct)` : parts[0];
}

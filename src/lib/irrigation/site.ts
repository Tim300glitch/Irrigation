/** Site classification helpers shared by layout, routing, coverage and checks. */
import type { Area, AreaType, Project } from "../model/types";
import { pointInPolygon, type Vec } from "../geometry/geometry";

export const IRRIGATED_TYPES: AreaType[] = ["lawn", "bed", "planting"];
export const HARDSCAPE_TYPES: AreaType[] = ["driveway", "walkway", "concrete", "patio", "deck", "utility"];
export const STRUCTURE_TYPES: AreaType[] = ["building", "pool"];

export const isIrrigated = (a: Area) => IRRIGATED_TYPES.includes(a.type);
export const isHardscape = (a: Area) => HARDSCAPE_TYPES.includes(a.type);
export const isStructure = (a: Area) => STRUCTURE_TYPES.includes(a.type);
/** anything a sprinkler must not spray / be placed in */
export const isNoSpray = (a: Area) => isHardscape(a) || isStructure(a);

export function obstaclesFor(project: Project): Area[] {
  return project.areas.filter(isNoSpray);
}

export function areaAt(project: Project, p: Vec, filter: (a: Area) => boolean = () => true): Area | undefined {
  // smallest containing area wins (beds drawn on top of lawns etc.)
  let best: Area | undefined;
  let bestArea = Infinity;
  for (const a of project.areas) {
    if (!filter(a) || a.type === "property") continue;
    if (!pointInPolygon(p, a.points)) continue;
    const ar = Math.abs(a.points.reduce((s, q, i) => {
      const r = a.points[(i + 1) % a.points.length];
      return s + q.x * r.y - r.x * q.y;
    }, 0));
    if (ar < bestArea) {
      bestArea = ar;
      best = a;
    }
  }
  return best;
}

export function propertyBoundary(project: Project): Area | undefined {
  return project.areas.find((a) => a.type === "property");
}

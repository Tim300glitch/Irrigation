/** Generic operations over any canvas object (select/move/rotate/scale/delete/duplicate). */
import type { AnyObject, LayerId, ObjectCollection, Project } from "../model/types";
import { OBJECT_COLLECTIONS } from "../model/types";
import { boundsOf, rotate, type Bounds, type Vec } from "../geometry/geometry";
import { headPerformance } from "../irrigation/sprinkler";
import { uid } from "../model/factory";
import { dimensionGeometry } from "../plan/planSvg";

export interface ObjRef {
  collection: ObjectCollection;
  obj: AnyObject;
}

export function findObject(project: Project, id: string): ObjRef | undefined {
  for (const c of OBJECT_COLLECTIONS) {
    const arr = project[c] as AnyObject[];
    const obj = arr.find((o) => o.id === id);
    if (obj) return { collection: c, obj };
  }
  return undefined;
}

export function objectLayer(ref: ObjRef): LayerId {
  return (ref.obj as { layer: LayerId }).layer;
}

/** Points that define the object (for bounds/snap). */
export function objectPoints(ref: ObjRef): Vec[] {
  const o = ref.obj as unknown as Record<string, unknown>;
  if (Array.isArray(o.points)) return o.points as Vec[];
  if (o.position) return [o.position as Vec];
  if (o.a && o.b) return [o.a as Vec, o.b as Vec];
  return [];
}

export function objectBounds(ref: ObjRef): Bounds {
  if (ref.collection === "sprinklers") {
    const s = ref.obj as Project["sprinklers"][number];
    const r = 1;
    return { minX: s.position.x - r, minY: s.position.y - r, maxX: s.position.x + r, maxY: s.position.y + r };
  }
  if (ref.collection === "plants") {
    const p = ref.obj as Project["plants"][number];
    const r = p.canopyRadius;
    return { minX: p.position.x - r, minY: p.position.y - r, maxX: p.position.x + r, maxY: p.position.y + r };
  }
  if (ref.collection === "dimensions") {
    const d = ref.obj as Project["dimensions"][number];
    const g = dimensionGeometry(d.a, d.b, d.kind, d.offset);
    return boundsOf([d.a, d.b, g.d1, g.d2]);
  }
  const pts = objectPoints(ref);
  const b = boundsOf(pts);
  if (pts.length === 1) return { minX: b.minX - 1, minY: b.minY - 1, maxX: b.maxX + 1, maxY: b.maxY + 1 };
  return b;
}

export function selectionBounds(project: Project, ids: string[]): Bounds | null {
  let b: Bounds | null = null;
  for (const id of ids) {
    const r = findObject(project, id);
    if (!r) continue;
    const ob = objectBounds(r);
    b = b ? { minX: Math.min(b.minX, ob.minX), minY: Math.min(b.minY, ob.minY), maxX: Math.max(b.maxX, ob.maxX), maxY: Math.max(b.maxY, ob.maxY) } : ob;
  }
  return b;
}

/** Transform all points of an object in place (use inside an immer draft). */
export function transformObject(obj: AnyObject, fn: (p: Vec) => Vec) {
  const o = obj as unknown as Record<string, unknown>;
  if (Array.isArray(o.points)) o.points = (o.points as Vec[]).map(fn);
  if (o.position) o.position = fn(o.position as Vec);
  if (o.a && o.b) {
    o.a = fn(o.a as Vec);
    o.b = fn(o.b as Vec);
  }
}

export function moveObjects(d: Project, ids: string[], dx: number, dy: number) {
  const set = new Set(ids);
  for (const c of OBJECT_COLLECTIONS) for (const o of d[c] as AnyObject[]) if (set.has(o.id)) transformObject(o, (p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function rotateObjects(d: Project, ids: string[], deg: number, about: Vec) {
  const set = new Set(ids);
  for (const c of OBJECT_COLLECTIONS)
    for (const o of d[c] as AnyObject[]) {
      if (!set.has(o.id)) continue;
      transformObject(o, (p) => rotate(p, deg, about));
      if (c === "sprinklers") (o as Project["sprinklers"][number]).arcStart = (((o as Project["sprinklers"][number]).arcStart + deg) % 360 + 360) % 360;
      if (c === "labels") (o as Project["labels"][number]).rotation = ((o as Project["labels"][number]).rotation + deg) % 360;
      if (c === "fittings") (o as Project["fittings"][number]).rotation = ((o as Project["fittings"][number]).rotation + deg) % 360;
    }
}

export function scaleObjects(d: Project, ids: string[], sx: number, sy: number, about: Vec) {
  const set = new Set(ids);
  for (const c of OBJECT_COLLECTIONS)
    for (const o of d[c] as AnyObject[]) {
      if (!set.has(o.id)) continue;
      transformObject(o, (p) => ({ x: about.x + (p.x - about.x) * sx, y: about.y + (p.y - about.y) * sy }));
      if (c === "plants") (o as Project["plants"][number]).canopyRadius *= Math.sqrt(Math.abs(sx * sy));
    }
}

export function deleteObjects(d: Project, ids: string[]) {
  const set = new Set(ids);
  for (const c of OBJECT_COLLECTIONS) (d[c] as AnyObject[]) = (d[c] as AnyObject[]).filter((o) => !set.has(o.id));
  // clean references
  for (const z of d.zones) if (z.valveId && set.has(z.valveId)) z.valveId = undefined;
  for (const m of d.manifolds) m.valveIds = m.valveIds.filter((v) => !set.has(v));
  d.manifolds = d.manifolds.filter((m) => m.valveIds.length > 0);
}

/** Deep-copies objects with new ids, offset by (dx,dy); returns new ids. */
export function cloneObjects(d: Project, objs: ObjRef[], dx: number, dy: number): string[] {
  const ids: string[] = [];
  for (const r of objs) {
    const copy = JSON.parse(JSON.stringify(r.obj)) as AnyObject;
    copy.id = uid(r.collection.slice(0, 4));
    transformObject(copy, (p) => ({ x: p.x + dx, y: p.y + dy }));
    if (r.collection === "valves" && "manifoldId" in copy) delete (copy as { manifoldId?: string }).manifoldId;
    (d[r.collection] as AnyObject[]).push(copy);
    ids.push(copy.id);
  }
  return ids;
}

export function isLocked(project: Project, ref: ObjRef): boolean {
  const layer = project.layers.find((l) => l.id === objectLayer(ref));
  return !!(layer?.locked || (ref.obj as { locked?: boolean }).locked);
}

export function isVisible(project: Project, ref: ObjRef): boolean {
  const layer = project.layers.find((l) => l.id === objectLayer(ref));
  return layer ? layer.visible : true;
}

export function describeObject(ref: ObjRef, labels?: Map<string, string>): string {
  const o = ref.obj as unknown as Record<string, unknown>;
  switch (ref.collection) {
    case "sprinklers":
      return `${labels?.get(ref.obj.id) ?? "Head"} · ${headPerformance(ref.obj as Project["sprinklers"][number]).product.model}`;
    case "areas":
      return String(o.name ?? o.type);
    case "pipes":
      return `${o.kind} pipe`;
    case "valves":
      return `${o.name ?? "Valve"}`;
    default:
      return String(o.name ?? o.label ?? o.type ?? ref.collection);
  }
}

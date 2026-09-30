/**
 * Core 2D geometry. World coordinates are feet, +x = east, +y = SOUTH (screen
 * convention, so north is up on screen). Angles are in degrees measured from +x
 * and increase clockwise on screen (because +y points down).
 */

export interface Vec {
  x: number;
  y: number;
}

export const EPS = 1e-9;

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;
export const angleOf = (a: Vec) => rad2deg(Math.atan2(a.y, a.x));
export const fromAngle = (deg: number, r = 1): Vec => ({ x: Math.cos(deg2rad(deg)) * r, y: Math.sin(deg2rad(deg)) * r });
export const normAngle = (deg: number) => ((deg % 360) + 360) % 360;
export const rotate = (p: Vec, deg: number, about: Vec = { x: 0, y: 0 }): Vec => {
  const r = deg2rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - about.x;
  const dy = p.y - about.y;
  return { x: about.x + dx * c - dy * s, y: about.y + dx * s + dy * c };
};

/** Shoelace signed area (positive = clockwise on screen with y-down). */
export function signedArea(poly: Vec[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Polygon area in square world units (sq ft). */
export function polygonArea(poly: Vec[]): number {
  return Math.abs(signedArea(poly));
}

export function polygonPerimeter(poly: Vec[], closed = true): number {
  let p = 0;
  const n = poly.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) p += dist(poly[i], poly[(i + 1) % n]);
  return p;
}

export function polylineLength(pts: Vec[]): number {
  return polygonPerimeter(pts, false);
}

export function centroid(poly: Vec[]): Vec {
  const a = signedArea(poly);
  if (Math.abs(a) < EPS) {
    const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return scale(s, 1 / Math.max(poly.length, 1));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Even-odd ray-cast point in polygon. */
export function pointInPolygon(pt: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 0) + a.x) inside = !inside;
  }
  return inside;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(pts: Vec[]): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function pointInBounds(p: Vec, b: Bounds, pad = 0) {
  return p.x >= b.minX - pad && p.x <= b.maxX + pad && p.y >= b.minY - pad && p.y <= b.maxY + pad;
}

/** Closest point on segment AB to P, with parametric t in [0,1]. */
export function closestOnSegment(p: Vec, a: Vec, b: Vec): { point: Vec; t: number; d: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < EPS ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const point = add(a, scale(ab, t));
  return { point, t, d: dist(p, point) };
}

export function distToSegment(p: Vec, a: Vec, b: Vec) {
  return closestOnSegment(p, a, b).d;
}

/** Distance from P to polygon boundary. */
export function distToPolygonEdge(p: Vec, poly: Vec[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

export function closestOnPolyline(p: Vec, pts: Vec[], closed = false): { point: Vec; d: number; seg: number; t: number } {
  let best = { point: pts[0], d: Infinity, seg: 0, t: 0 };
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const c = closestOnSegment(p, pts[i], pts[(i + 1) % pts.length]);
    if (c.d < best.d) best = { point: c.point, d: c.d, seg: i, t: c.t };
  }
  return best;
}

/** Proper segment intersection (excluding shared endpoints within tolerance). */
export function segmentIntersection(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return null;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return add(a, scale(r, t));
}

export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec, tol = 1e-6): boolean {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return false;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  return t > tol && t < 1 - tol && u > tol && u < 1 - tol;
}

/** Does segment AB pass through the interior of polygon? */
export function segmentIntersectsPolygon(a: Vec, b: Vec, poly: Vec[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (segmentsCross(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  // fully inside or passes through with endpoints on boundary
  const mid = lerp(a, b, 0.5);
  if (pointInPolygon(mid, poly) && distToPolygonEdge(mid, poly) > 1e-3) return true;
  return false;
}

/** Length of segment AB that lies inside polygon (sampled, accurate to ~len/steps). */
export function segmentLengthInsidePolygon(a: Vec, b: Vec, poly: Vec[], steps = 64): number {
  const L = dist(a, b);
  if (L < EPS) return 0;
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    const p = lerp(a, b, (i + 0.5) / steps);
    if (pointInPolygon(p, poly)) inside++;
  }
  return (inside / steps) * L;
}

/** Interior angle at vertex i (degrees, 0..360) for a polygon. */
export function interiorAngle(poly: Vec[], i: number): number {
  const n = poly.length;
  const prev = poly[(i - 1 + n) % n];
  const cur = poly[i];
  const next = poly[(i + 1) % n];
  const a1 = angleOf(sub(prev, cur));
  const a2 = angleOf(sub(next, cur));
  // sweep from a2 to a1 clockwise (screen) for CW polygon
  let sweep = normAngle(a1 - a2);
  if (signedArea(poly) < 0) sweep = 360 - sweep;
  return sweep;
}

/** Ensure polygon has clockwise (screen, y-down) orientation => positive signed area. */
export function ensureCW(poly: Vec[]): Vec[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/** Offset polygon edges inward by distance d (simple miter offset; fine for mild concavity). */
export function offsetPolygon(poly: Vec[], d: number): Vec[] {
  const p = ensureCW(poly);
  const n = p.length;
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const prev = p[(i - 1 + n) % n];
    const cur = p[i];
    const next = p[(i + 1) % n];
    // for CW (y-down) polygons, inward normal of edge dir e is perp rotated +90 in screen => (-e.y, e.x)
    const e1 = norm(sub(cur, prev));
    const e2 = norm(sub(next, cur));
    const n1 = { x: -e1.y, y: e1.x };
    const n2 = { x: -e2.y, y: e2.x };
    const bis = norm(add(n1, n2));
    const cosHalf = dot(bis, n1);
    const m = cosHalf < 0.2 ? d : d / cosHalf;
    out.push(add(cur, scale(bis, m)));
  }
  return out;
}

/** Point-in-polygon test with holes. */
export function pointInRegion(pt: Vec, outer: Vec[], holes: Vec[][]): boolean {
  if (!pointInPolygon(pt, outer)) return false;
  for (const h of holes) if (pointInPolygon(pt, h)) return false;
  return true;
}

/** Circle sector (arc) test: is point P within radius r of C and within the sweep [start, start+arc]? */
export function pointInSector(p: Vec, c: Vec, r: number, startDeg: number, arcDeg: number): boolean {
  const d = dist(p, c);
  if (d > r) return false;
  if (arcDeg >= 359.999 || d < EPS) return true;
  const a = normAngle(angleOf(sub(p, c)) - startDeg);
  return a <= arcDeg + 1e-9;
}

/** Area of a circular sector. */
export function sectorArea(r: number, arcDeg: number) {
  return Math.PI * r * r * (arcDeg / 360);
}

/** Snap value to a grid step. */
export function snapToGrid(p: Vec, step: number): Vec {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

/** Constrain direction from origin to nearest multiple of `stepDeg` (used for 45°/90° pipe drawing). */
export function constrainAngle(origin: Vec, p: Vec, stepDeg: number): Vec {
  const d = dist(origin, p);
  const a = Math.round(angleOf(sub(p, origin)) / stepDeg) * stepDeg;
  return add(origin, fromAngle(a, d));
}

/** Angle between segments at a shared vertex, returned as the deflection (0 = straight). */
export function deflectionAngle(a: Vec, b: Vec, c: Vec): number {
  const a1 = angleOf(sub(b, a));
  const a2 = angleOf(sub(c, b));
  let d = Math.abs(normAngle(a2 - a1));
  if (d > 180) d = 360 - d;
  return d;
}

/** Hilbert-like simple spatial hash for fast neighbour lookup. */
export class SpatialHash<T> {
  private cells = new Map<string, { p: Vec; item: T }[]>();
  constructor(private cell: number) {}
  private key(x: number, y: number) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }
  insert(p: Vec, item: T) {
    const k = this.key(p.x, p.y);
    let arr = this.cells.get(k);
    if (!arr) this.cells.set(k, (arr = []));
    arr.push({ p, item });
  }
  query(p: Vec, r: number): { p: Vec; item: T }[] {
    const out: { p: Vec; item: T }[] = [];
    const x0 = Math.floor((p.x - r) / this.cell);
    const x1 = Math.floor((p.x + r) / this.cell);
    const y0 = Math.floor((p.y - r) / this.cell);
    const y1 = Math.floor((p.y + r) / this.cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const arr = this.cells.get(`${x},${y}`);
        if (arr) for (const e of arr) if (dist2(e.p, p) <= r * r) out.push(e);
      }
    return out;
  }
}

/** Largest inscribed-circle radius estimate by sampling (used to classify narrow strips). */
export function inscribedRadius(poly: Vec[], holes: Vec[][] = [], step?: number): { r: number; center: Vec } {
  const b = boundsOf(poly);
  const s = step ?? Math.max(0.5, Math.min(b.maxX - b.minX, b.maxY - b.minY) / 40);
  let best = { r: 0, center: centroid(poly) };
  for (let x = b.minX + s / 2; x < b.maxX; x += s)
    for (let y = b.minY + s / 2; y < b.maxY; y += s) {
      const p = { x, y };
      if (!pointInRegion(p, poly, holes)) continue;
      let d = distToPolygonEdge(p, poly);
      for (const h of holes) d = Math.min(d, distToPolygonEdge(p, h));
      if (d > best.r) best = { r: d, center: p };
    }
  return best;
}

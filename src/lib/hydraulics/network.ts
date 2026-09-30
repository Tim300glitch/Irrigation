/**
 * Builds a hydraulic graph from drawn geometry.
 *
 * Pipes are drawn freely on the canvas; connectivity is derived geometrically:
 *  - pipe vertices within NODE_TOL of each other are merged into a node
 *  - a pipe endpoint landing on another pipe's interior splits it (tee)
 *  - sprinklers within HEAD_TOL of a lateral attach to it (swing joint/tee)
 *  - valves join the mainline graph (inlet) and the lateral graph (outlet)
 *  - water sources attach to the nearest mainline node
 * Mainline and lateral/drip pipes form separate graphs joined only by valves.
 */
import type { DripArea, PipeKind, PipeMaterial, Project } from "../model/types";
import { closestOnSegment, dist, distToPolygonEdge, pointInPolygon, SpatialHash, type Vec } from "../geometry/geometry";

export const NODE_TOL = 0.35;
export const HEAD_TOL = 1.25;
export const VALVE_TOL = 2.0;
export const SOURCE_TOL = 3.0;

/** "main" for mainline, "lat:<zoneId>" for zoned laterals, "lat:*" for unassigned laterals */
export type GraphKind = string;

export interface NetNode {
  id: number;
  p: Vec;
  graph: GraphKind;
  edges: number[];
}

export interface NetEdge {
  id: number;
  a: number;
  b: number;
  pipeId: string;
  kind: PipeKind;
  material: PipeMaterial;
  nominal: number;
  autoSize: boolean;
  length: number;
}

export interface Network {
  nodes: NetNode[];
  edges: NetEdge[];
  headNode: Map<string, number>;
  dripNode: Map<string, number>;
  valveMainNode: Map<string, number>;
  valveLatNode: Map<string, number>;
  sourceNode: Map<string, number>;
  pipeEdges: Map<string, number[]>;
}

const graphOf = (k: PipeKind, zoneId?: string): GraphKind | null =>
  k === "mainline" ? "main" : k === "lateral" || k === "drip" ? `lat:${zoneId ?? "*"}` : null;

interface Seg {
  pipeId: string;
  kind: PipeKind;
  graph: GraphKind;
  material: PipeMaterial;
  nominal: number;
  autoSize: boolean;
  a: Vec;
  b: Vec;
  splits: number[]; // params in (0,1)
}

export function buildNetwork(project: Project): Network {
  const segs: Seg[] = [];
  for (const pipe of project.pipes) {
    const g = graphOf(pipe.kind, pipe.zoneId);
    if (!g) continue;
    for (let i = 0; i < pipe.points.length - 1; i++) {
      const a = pipe.points[i];
      const b = pipe.points[i + 1];
      if (dist(a, b) < 1e-6) continue;
      segs.push({ pipeId: pipe.id, kind: pipe.kind, graph: g, material: pipe.material, nominal: pipe.size, autoSize: pipe.autoSize, a, b, splits: [] });
    }
  }

  const splitAt = (graph: GraphKind, p: Vec, tol: number, onlyNearest = false) => {
    let best: { seg: Seg; t: number; d: number } | null = null;
    for (const s of segs) {
      if (s.graph !== graph) continue;
      const c = closestOnSegment(p, s.a, s.b);
      if (c.d > tol) continue;
      const L = dist(s.a, s.b);
      const tIn = c.t * L > NODE_TOL && (1 - c.t) * L > NODE_TOL;
      if (!onlyNearest) {
        if (tIn) s.splits.push(c.t);
      } else if (!best || c.d < best.d) best = { seg: s, t: tIn ? c.t : -1, d: c.d };
    }
    if (onlyNearest && best && best.t > 0) best.seg.splits.push(best.t);
  };

  // tees: endpoints of segments touching other segments
  for (const s of segs) {
    splitAt(s.graph, s.a, NODE_TOL);
    splitAt(s.graph, s.b, NODE_TOL);
  }
  const zoneOfValve = new Map<string, string>();
  for (const z of project.zones) if (z.valveId) zoneOfValve.set(z.valveId, z.id);
  const latGraphs = new Set(segs.filter((s) => s.graph !== "main").map((s) => s.graph));
  /** lateral graph a device belongs to: its zone's graph if present, else the unassigned graph */
  const latGraphFor = (zoneId?: string) => (zoneId && latGraphs.has(`lat:${zoneId}`) ? `lat:${zoneId}` : "lat:*");
  for (const h of project.sprinklers) splitAt(latGraphFor(h.zoneId), h.position, HEAD_TOL, true);
  for (const v of project.valves) {
    splitAt(latGraphFor(zoneOfValve.get(v.id)), v.position, VALVE_TOL, true);
    splitAt("main", v.position, VALVE_TOL, true);
  }
  for (const w of project.waterSources) splitAt("main", w.position, SOURCE_TOL, true);

  const nodes: NetNode[] = [];
  const hashes = new Map<GraphKind, SpatialHash<number>>();
  const hashFor = (g: GraphKind) => {
    let h = hashes.get(g);
    if (!h) hashes.set(g, (h = new SpatialHash(2)));
    return h;
  };
  const nodeAt = (p: Vec, graph: GraphKind): number => {
    const near = hashFor(graph).query(p, NODE_TOL);
    if (near.length) {
      let best = near[0];
      for (const n of near) if (dist(n.p, p) < dist(best.p, p)) best = n;
      return best.item;
    }
    const id = nodes.length;
    nodes.push({ id, p, graph, edges: [] });
    hashFor(graph).insert(p, id);
    return id;
  };

  const edges: NetEdge[] = [];
  const pipeEdges = new Map<string, number[]>();
  for (const s of segs) {
    const ts = [0, ...[...new Set(s.splits.map((t) => +t.toFixed(6)))].sort((x, y) => x - y), 1];
    const pts = ts.map((t) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }));
    for (let i = 0; i < pts.length - 1; i++) {
      const na = nodeAt(pts[i], s.graph);
      const nb = nodeAt(pts[i + 1], s.graph);
      if (na === nb) continue;
      const e: NetEdge = {
        id: edges.length,
        a: na,
        b: nb,
        pipeId: s.pipeId,
        kind: s.kind,
        material: s.material,
        nominal: s.nominal,
        autoSize: s.autoSize,
        length: dist(pts[i], pts[i + 1]),
      };
      edges.push(e);
      nodes[na].edges.push(e.id);
      nodes[nb].edges.push(e.id);
      const arr = pipeEdges.get(s.pipeId) ?? [];
      arr.push(e.id);
      pipeEdges.set(s.pipeId, arr);
    }
  }

  const nearestNode = (p: Vec, graph: GraphKind, tol: number): number | undefined => {
    const near = hashFor(graph).query(p, tol);
    let best: number | undefined;
    let bd = Infinity;
    for (const n of near) {
      if (nodes[n.item].edges.length === 0) continue;
      const d = dist(n.p, p);
      if (d < bd) {
        bd = d;
        best = n.item;
      }
    }
    return best;
  };

  const headNode = new Map<string, number>();
  for (const h of project.sprinklers) {
    const n = nearestNode(h.position, latGraphFor(h.zoneId), HEAD_TOL + NODE_TOL);
    if (n !== undefined) headNode.set(h.id, n);
  }
  const valveMainNode = new Map<string, number>();
  const valveLatNode = new Map<string, number>();
  for (const v of project.valves) {
    const m = nearestNode(v.position, "main", VALVE_TOL + NODE_TOL);
    if (m !== undefined) valveMainNode.set(v.id, m);
    const l = nearestNode(v.position, latGraphFor(zoneOfValve.get(v.id)), VALVE_TOL + NODE_TOL);
    if (l !== undefined) valveLatNode.set(v.id, l);
  }
  const sourceNode = new Map<string, number>();
  for (const w of project.waterSources) {
    const m = nearestNode(w.position, "main", SOURCE_TOL + NODE_TOL);
    if (m !== undefined) sourceNode.set(w.id, m);
  }
  const dripNode = new Map<string, number>();
  for (const d of project.drips) {
    const n = dripAttachNode(d, nodes, latGraphFor(d.zoneId));
    if (n !== undefined) dripNode.set(d.id, n);
  }

  return { nodes, edges, headNode, dripNode, valveMainNode, valveLatNode, sourceNode, pipeEdges };
}

function dripAttachNode(d: DripArea, nodes: NetNode[], graph: GraphKind): number | undefined {
  let best: number | undefined;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n.graph !== graph || n.edges.length === 0) continue;
    const inside = pointInPolygon(n.p, d.points);
    const de = distToPolygonEdge(n.p, d.points);
    if (!inside && de > 1.5) continue;
    // prefer pipe ends (supply header) near the area edge
    const score = de + (n.edges.length === 1 ? 0 : 5);
    if (score < bestScore) {
      bestScore = score;
      best = n.id;
    }
  }
  return best;
}

export function otherEnd(e: NetEdge, n: number) {
  return e.a === n ? e.b : e.a;
}

/** BFS connected component from a node. */
export function component(net: Network, start: number): Set<number> {
  const seen = new Set<number>([start]);
  const q = [start];
  while (q.length) {
    const n = q.shift()!;
    for (const eid of net.nodes[n].edges) {
      const o = otherEnd(net.edges[eid], n);
      if (!seen.has(o)) {
        seen.add(o);
        q.push(o);
      }
    }
  }
  return seen;
}

/** Dijkstra shortest path by length. Returns list of edge ids from start to goal. */
export function shortestPath(net: Network, start: number, goal: number): number[] | null {
  if (start === goal) return [];
  const distTo = new Map<number, number>([[start, 0]]);
  const prevEdge = new Map<number, number>();
  const open = new Set<number>([start]);
  const done = new Set<number>();
  while (open.size) {
    let cur = -1;
    let cd = Infinity;
    for (const n of open) {
      const d = distTo.get(n)!;
      if (d < cd) {
        cd = d;
        cur = n;
      }
    }
    open.delete(cur);
    if (cur === goal) break;
    done.add(cur);
    for (const eid of net.nodes[cur].edges) {
      const e = net.edges[eid];
      const o = otherEnd(e, cur);
      if (done.has(o)) continue;
      const nd = cd + e.length;
      if (nd < (distTo.get(o) ?? Infinity)) {
        distTo.set(o, nd);
        prevEdge.set(o, eid);
        open.add(o);
      }
    }
  }
  if (!prevEdge.has(goal)) return null;
  const path: number[] = [];
  let n = goal;
  while (n !== start) {
    const eid = prevEdge.get(n)!;
    path.unshift(eid);
    n = otherEnd(net.edges[eid], n);
  }
  return path;
}

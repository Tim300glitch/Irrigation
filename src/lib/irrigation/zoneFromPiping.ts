/**
 * Zone assignment that follows the piping.
 *
 * A lateral drawn from a zone's valve belongs to that zone, and so does every
 * unassigned lateral connected to it and every unassigned sprinkler the
 * laterals run through. Explicit assignments are never changed; a pipe or head
 * reachable from two different zones is left alone (ambiguous).
 */
import type { Id, Project } from "../model/types";
import { closestOnPolyline } from "../geometry/geometry";
import { HEAD_TOL, NODE_TOL, VALVE_TOL } from "../hydraulics/network";

export interface PipingZoneAssignments {
  pipes: Map<Id, Id>;
  sprinklers: Map<Id, Id>;
}

export function zonesFromPiping(project: Project): PipingZoneAssignments {
  const out: PipingZoneAssignments = { pipes: new Map(), sprinklers: new Map() };
  const lats = project.pipes.filter((p) => (p.kind === "lateral" || p.kind === "drip") && p.points.length >= 2);
  if (!lats.length) return out;
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const valvePos = new Map(project.valves.map((v) => [v.id, v.position]));

  // zones reaching each pipe
  const reach = new Map<Id, Set<Id>>(lats.map((p) => [p.id, new Set<Id>()]));
  for (const p of lats) if (p.zoneId && zoneIds.has(p.zoneId)) reach.get(p.id)!.add(p.zoneId);
  for (const z of project.zones) {
    const vp = z.valveId ? valvePos.get(z.valveId) : undefined;
    if (!vp) continue;
    // like the hydraulic network, a valve feeds the nearest lateral (valves in a manifold sit close together)
    let best: { id: Id; d: number } | null = null;
    for (const p of lats) {
      if (p.zoneId && p.zoneId !== z.id) continue;
      const d = closestOnPolyline(vp, p.points).d;
      if (d <= VALVE_TOL && (!best || d < best.d)) best = { id: p.id, d };
    }
    if (best) reach.get(best.id)!.add(z.id);
  }

  // pipe adjacency: a vertex of one lies on the other
  const touches = (a: (typeof lats)[number], b: (typeof lats)[number]) =>
    a.points.some((q) => closestOnPolyline(q, b.points).d <= NODE_TOL) || b.points.some((q) => closestOnPolyline(q, a.points).d <= NODE_TOL);
  const adj = new Map<Id, Id[]>(lats.map((p) => [p.id, []]));
  for (let i = 0; i < lats.length; i++)
    for (let j = i + 1; j < lats.length; j++) {
      const a = lats[i];
      const b = lats[j];
      // pipes of different zones never connect
      if (a.zoneId && b.zoneId && a.zoneId !== b.zoneId) continue;
      if (!touches(a, b)) continue;
      adj.get(a.id)!.push(b.id);
      adj.get(b.id)!.push(a.id);
    }

  // spread zones through unassigned pipes
  const byId = new Map(lats.map((p) => [p.id, p]));
  const queue = lats.filter((p) => reach.get(p.id)!.size).map((p) => p.id);
  while (queue.length) {
    const id = queue.shift()!;
    const from = reach.get(id)!;
    for (const nid of adj.get(id)!) {
      const n = byId.get(nid)!;
      if (n.zoneId) continue; // explicit zone: don't overwrite, don't widen
      const set = reach.get(nid)!;
      const before = set.size;
      for (const z of from) set.add(z);
      if (set.size !== before) queue.push(nid);
    }
  }

  const zoneOf = new Map<Id, Id>();
  for (const p of lats) {
    if (p.zoneId) {
      if (zoneIds.has(p.zoneId)) zoneOf.set(p.id, p.zoneId);
      continue;
    }
    const set = reach.get(p.id)!;
    if (set.size === 1) {
      const z = [...set][0];
      zoneOf.set(p.id, z);
      out.pipes.set(p.id, z);
    }
  }

  // heads the zoned laterals run through (nearest lateral wins)
  for (const h of project.sprinklers) {
    if (h.zoneId) continue;
    let best: { z: Id | undefined; d: number } | null = null;
    for (const p of lats) {
      const d = closestOnPolyline(h.position, p.points).d;
      if (d <= HEAD_TOL && (!best || d < best.d)) best = { z: zoneOf.get(p.id), d };
    }
    if (best?.z) out.sprinklers.set(h.id, best.z);
  }
  return out;
}

/** Writes piping-derived zones into the project (use inside an immer draft). Returns true if anything changed. */
export function applyZonesFromPiping(d: Project, a: PipingZoneAssignments = zonesFromPiping(d)): boolean {
  let changed = false;
  for (const p of d.pipes) {
    const z = a.pipes.get(p.id);
    if (z && !p.zoneId) {
      p.zoneId = z;
      changed = true;
    }
  }
  for (const s of d.sprinklers) {
    const z = a.sprinklers.get(s.id);
    if (z && !s.zoneId) {
      s.zoneId = z;
      changed = true;
    }
  }
  return changed;
}

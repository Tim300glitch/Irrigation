/**
 * Keeps pipe joints together when a pipe is dragged.
 *
 * Pipes that join the dragged pipe (at an elbow, tee, coupling...) keep their
 * joint end on it: they stretch or shorten to follow. Fittings at those joints
 * move along. When every joint pins the move to one direction (e.g. the run
 * between two 90° elbows can only slide along the legs), the drag is held to
 * that direction so fitting angles stay exactly as drawn.
 */
import type { Id, Pipe, PipeKind, Project } from "../model/types";
import { add, closestOnPolyline, dist, dot, scale, sub, type Vec } from "../geometry/geometry";

/** a vertex this close to a pipe is joined to it (matches drawing snap precision) */
export const JOIN_TOL = 0.3;
const FITTING_TOL = 0.5;
/** a following pipe is never shortened below this */
const MIN_LEN = 0.25;

export interface PipeMoveLinks {
  /** neighbouring pipe vertices that follow the move */
  ends: { pipeId: Id; index: number; orig: Vec; /** vertex the joint end pivots on */ anchor?: Vec }[];
  fittings: { id: Id; orig: Vec }[];
  /** unit direction the move is held to, when all joints agree on one */
  axis?: Vec;
}

const family = (k: PipeKind) => (k === "lateral" || k === "drip" ? "lat" : k);
const unit = (v: Vec): Vec | null => {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? null : { x: v.x / l, y: v.y / l };
};

export function pipeMoveLinks(project: Project, ids: Id[]): PipeMoveLinks {
  const idSet = new Set(ids);
  const moving = project.pipes.filter((p) => idSet.has(p.id) && p.points.length >= 2);
  const out: PipeMoveLinks = { ends: [], fittings: [] };
  if (!moving.length) return out;
  const dirs: Vec[] = [];
  let free = false;
  const seen = new Set<string>();

  for (const m of moving) {
    for (const n of project.pipes) {
      if (idSet.has(n.id) || family(n.kind) !== family(m.kind) || n.points.length < 2) continue;
      // n's vertices that sit on m follow it
      n.points.forEach((q, i) => {
        if (closestOnPolyline(q, m.points).d > JOIN_TOL) return;
        const key = `${n.id}:${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        const last = n.points.length - 1;
        const anchor = i === 0 ? n.points[1] : i === last ? n.points[last - 1] : undefined;
        out.ends.push({ pipeId: n.id, index: i, orig: q, anchor });
        const d = anchor && unit(sub(q, anchor));
        if (d) dirs.push(d);
        else free = true; // moving a bend in the middle of a pipe: no single direction keeps it
      });
      // m's ends tee'd into the middle of n can slide along n
      for (const e of [m.points[0], m.points[m.points.length - 1]]) {
        if (n.points.some((q) => dist(q, e) <= JOIN_TOL)) continue; // already handled as a shared joint
        const c = closestOnPolyline(e, n.points);
        if (c.d > JOIN_TOL) continue;
        const d = unit(sub(n.points[c.seg + 1], n.points[c.seg]));
        if (d) dirs.push(d);
      }
    }
  }

  for (const f of project.fittings) {
    if (idSet.has(f.id)) continue;
    if (moving.some((m) => closestOnPolyline(f.position, m.points).d <= FITTING_TOL)) out.fittings.push({ id: f.id, orig: f.position });
  }

  if (!free && dirs.length && dirs.every((d) => Math.abs(d.x * dirs[0].y - d.y * dirs[0].x) < 0.05)) out.axis = dirs[0];
  return out;
}

/** The move actually applied: held to the joint axis (unless `free`) and limited so no following pipe folds back past its other end. */
export function constrainPipeMove(links: PipeMoveLinks, delta: Vec, free = false): Vec {
  let d = links.axis && !free ? scale(links.axis, dot(delta, links.axis)) : delta;
  let k = 1;
  for (const e of links.ends) {
    if (!e.anchor) continue;
    const L = dist(e.orig, e.anchor);
    const u = unit(sub(e.orig, e.anchor));
    if (!u) continue;
    const s = dot(d, u); // change in length along the pipe
    if (L + s < MIN_LEN && s < 0) k = Math.min(k, Math.max(0, (L - MIN_LEN) / -s));
  }
  if (k < 1) d = scale(d, k);
  return d;
}

/** Apply a constrained move of the linked pipe ends and fittings (inside an immer draft). */
export function applyPipeMoveLinks(d: Project, links: PipeMoveLinks, delta: Vec) {
  const pipes = new Map<Id, Pipe>(d.pipes.map((p) => [p.id, p]));
  for (const e of links.ends) {
    const p = pipes.get(e.pipeId);
    if (p && p.points[e.index]) p.points[e.index] = add(e.orig, delta);
  }
  for (const f of links.fittings) {
    const fit = d.fittings.find((x) => x.id === f.id);
    if (fit) fit.position = add(f.orig, delta);
  }
}

import type { Project } from "@/lib/model/types";
import { findObject, selectionBounds } from "@/lib/editor/ops";
import { fromAngle, add, dist, type Vec } from "@/lib/geometry/geometry";
import { headPerformance } from "@/lib/irrigation/sprinkler";
import { dimensionGeometry } from "@/lib/plan/planSvg";

export type HandleKind = "vertex" | "mid" | "arcStart" | "arcEnd" | "radius" | "dimOffset" | "dimA" | "dimB" | "canopy" | "rotate" | "scale";

export interface Handle {
  id: string;
  kind: HandleKind;
  objId?: string;
  index?: number;
  corner?: "nw" | "ne" | "se" | "sw";
  p: Vec;
}

export function getHandles(project: Project, selection: string[], zoom: number): Handle[] {
  const out: Handle[] = [];
  if (!selection.length) return out;
  if (selection.length === 1) {
    const ref = findObject(project, selection[0]);
    if (!ref) return out;
    const o = ref.obj as unknown as Record<string, unknown>;
    if (ref.collection === "areas" || ref.collection === "lines" || ref.collection === "drips" || ref.collection === "pipes") {
      const ptsArr = o.points as Vec[];
      const closed = ref.collection === "areas" || ref.collection === "drips";
      ptsArr.forEach((p, i) => out.push({ id: `vertex:${ref.obj.id}:${i}`, kind: "vertex", objId: ref.obj.id, index: i, p }));
      const n = closed ? ptsArr.length : ptsArr.length - 1;
      for (let i = 0; i < n; i++) {
        const a = ptsArr[i];
        const b = ptsArr[(i + 1) % ptsArr.length];
        if (dist(a, b) * zoom < 28) continue;
        out.push({ id: `mid:${ref.obj.id}:${i}`, kind: "mid", objId: ref.obj.id, index: i, p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
      }
    }
    if (ref.collection === "sprinklers") {
      const s = ref.obj as Project["sprinklers"][number];
      const perf = headPerformance(s);
      const r = perf.radius;
      if (s.arc < 359.9) {
        out.push({ id: `arcStart:${s.id}`, kind: "arcStart", objId: s.id, p: add(s.position, fromAngle(s.arcStart, r)) });
        out.push({ id: `arcEnd:${s.id}`, kind: "arcEnd", objId: s.id, p: add(s.position, fromAngle(s.arcStart + s.arc, r)) });
      }
      out.push({ id: `radius:${s.id}`, kind: "radius", objId: s.id, p: add(s.position, fromAngle(s.arc >= 359.9 ? 0 : s.arcStart + s.arc / 2, r)) });
    }
    if (ref.collection === "dimensions") {
      const d = ref.obj as Project["dimensions"][number];
      const g = dimensionGeometry(d.a, d.b, d.kind, d.offset);
      out.push({ id: `dimA:${d.id}`, kind: "dimA", objId: d.id, p: d.a });
      out.push({ id: `dimB:${d.id}`, kind: "dimB", objId: d.id, p: d.b });
      out.push({ id: `dimOffset:${d.id}`, kind: "dimOffset", objId: d.id, p: { x: (g.d1.x + g.d2.x) / 2, y: (g.d1.y + g.d2.y) / 2 } });
    }
    if (ref.collection === "plants") {
      const p = ref.obj as Project["plants"][number];
      out.push({ id: `canopy:${p.id}`, kind: "canopy", objId: p.id, p: { x: p.position.x + p.canopyRadius, y: p.position.y } });
    }
  }
  // transform box: areas/lines/labels/drips or multi-selection
  const single = selection.length === 1 ? findObject(project, selection[0]) : undefined;
  const boxable = selection.length > 1 || (single && ["areas", "lines", "labels", "drips", "plants"].includes(single.collection));
  if (boxable) {
    const b = selectionBounds(project, selection);
    if (b && (b.maxX - b.minX) * zoom > 8) {
      out.push({ id: "rotate", kind: "rotate", p: { x: (b.minX + b.maxX) / 2, y: b.minY - 26 / zoom } });
      if (!(single && (single.collection === "labels" || single.collection === "plants"))) {
        out.push({ id: "scale:nw", kind: "scale", corner: "nw", p: { x: b.minX, y: b.minY } });
        out.push({ id: "scale:ne", kind: "scale", corner: "ne", p: { x: b.maxX, y: b.minY } });
        out.push({ id: "scale:se", kind: "scale", corner: "se", p: { x: b.maxX, y: b.maxY } });
        out.push({ id: "scale:sw", kind: "scale", corner: "sw", p: { x: b.minX, y: b.maxY } });
      }
    }
  }
  return out;
}

export function hitHandle(handles: Handle[], p: Vec, tol: number): Handle | null {
  let best: Handle | null = null;
  let bd = Infinity;
  for (const h of handles) {
    const d = dist(h.p, p);
    // vertices win over midpoints/box handles at the same spot
    const bias = h.kind === "vertex" ? -tol * 0.3 : h.kind === "mid" ? tol * 0.2 : 0;
    if (d <= tol && d + bias < bd) {
      bd = d + bias;
      best = h;
    }
  }
  return best;
}

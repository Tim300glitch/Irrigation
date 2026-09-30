"use client";
/**
 * Canvas interaction controller: translates pointer/wheel input into tool actions.
 * Tools: select (move/marquee/handles), pan, area/line/drip drawing, pipe drawing,
 * placement tools, measure, dimension and background calibration.
 * Panning is always available: middle-mouse drag, right-mouse drag, Space+drag,
 * wheel zoom, arrow keys — and in-progress drawings (e.g. a pipe run) are kept.
 */
import { ask } from "@/components/AskHost";
import { useCallback, useRef } from "react";
import type React from "react";
import { useEditorStore, type SnapResult } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysisStore } from "@/store/analysisStore";
import type { Project, Sprinkler, Pipe } from "@/lib/model/types";
import { makeArea, uid, LINE_DEFAULTS, makeWaterSource } from "@/lib/model/factory";
import { add, angleOf, closestOnPolyline, dist, distToPolygonEdge, fromAngle, normAngle, pointInPolygon, sub, type Vec } from "@/lib/geometry/geometry";
import { findObject, moveObjects, rotateObjects, scaleObjects, selectionBounds, isLocked } from "@/lib/editor/ops";
import { hitTest, marqueeHits } from "./hitTest";
import { snapPoint } from "./snapping";
import { toWorld, zoomAt } from "./viewport";
import { getHandles, hitHandle, type Handle } from "./handles";
import { fitArc } from "@/lib/irrigation/autoLayout";
import { isIrrigated, isNoSpray, areaAt } from "@/lib/irrigation/site";
import { getProduct } from "@/lib/catalog/sprinklers";
import { ZONE_COLORS } from "@/lib/irrigation/autoZone";
import { formatFeetInches, parseLength } from "@/lib/units/units";
import { headPerformance } from "@/lib/irrigation/sprinkler";

type Drag =
  | { type: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean; button: number }
  | { type: "marquee"; start: Vec; cur: Vec; additive: boolean }
  | { type: "move"; start: Vec; anchor: Vec; ids: string[]; moved: boolean; attached: { pipeId: string; index: number; orig: Vec }[]; base: Project }
  | { type: "handle"; h: Handle; start: Vec; moved: boolean; base: Project; attached: { pipeId: string; index: number }[] }
  | { type: "rect"; start: Vec }
  | { type: "circle"; center: Vec };

export interface MarqueeState {
  a: Vec;
  b: Vec;
}

function screenOf(e: { clientX: number; clientY: number }, el: HTMLElement): Vec {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function useCanvasController(ref: React.RefObject<HTMLDivElement | null>, setMarquee: (m: MarqueeState | null) => void) {
  const drag = useRef<Drag | null>(null);
  // active touch pointers for pinch-zoom (tablet / phone viewing)
  const touches = useRef(new Map<number, Vec>());
  const pinch = useRef<{ d: number; mid: Vec; vp: { x: number; y: number; zoom: number } } | null>(null);
  const lastClick = useRef<{ t: number; p: Vec }>({ t: 0, p: { x: 0, y: 0 } });

  const E = () => useEditorStore.getState();
  const P = () => useProjectStore.getState();

  const snapFor = useCallback((world: Vec, e: { shiftKey: boolean; altKey: boolean }, exclude?: Set<string>, angleFrom?: Vec): SnapResult => {
    const project = P().project!;
    const st = project.settings;
    const z = E().viewport.zoom;
    if (e.altKey) return { point: world, kind: "none" };
    const angleStep = angleFrom ? (e.shiftKey ? 45 : st.angleSnapDeg || 0) : 0;
    const res = snapPoint(project, world, {
      tol: 10 / z,
      grid: st.snapGrid,
      gridSize: st.gridSize,
      vertex: st.snapVertex,
      edge: st.snapEdge,
      sprinkler: st.snapSprinkler,
      exclude,
      angleFrom: angleStep ? angleFrom : undefined,
      angleStep: angleStep || undefined,
    });
    // shift-constrained angle wins over grid/edge when drawing
    if (angleFrom && e.shiftKey && (res.kind === "grid" || res.kind === "edge" || res.kind === "none")) return snapPoint(project, world, { tol: 0, grid: false, gridSize: 1, vertex: false, edge: false, sprinkler: false, angleFrom, angleStep: 45 });
    return res;
  }, []);

  const finishDraft = finishDraftAction;

  const placeAt = useCallback((world: Vec, e: React.PointerEvent) => {
    const ed = E();
    const project = P().project!;
    const snap = snapFor(world, e);
    const p = snap.point;
    const o = ed.opts;
    switch (ed.tool) {
      case "sprinkler": {
        const product = getProduct(o.sprinklerProduct);
        const nozzle = product.nozzles.find((n) => n.id === o.sprinklerNozzle) ?? product.nozzles[0];
        let arcStart = 0;
        let arc = product.arcAdjustable ? o.sprinklerArc : product.arcMax;
        let radiusOverride: number | undefined;
        if (o.sprinklerAutoArc && product.category !== "emitter" && product.category !== "bubbler" && product.arcAdjustable) {
          // the area under the cursor, or the one whose edge the head was snapped onto
          const area = areaAt(project, p, isIrrigated) ?? project.areas.filter(isIrrigated).find((a) => distToPolygonEdge(p, a.points) < 1.5);
          if (area) {
            const noSpray = project.areas.filter(isNoSpray).map((a) => a.points);
            const irrigated = project.areas.filter(isIrrigated).map((a) => a.points);
            // points on the area boundary count as wettable (heads sit on the edge)
            const wettable = (q: Vec) => !noSpray.some((n) => pointInPolygon(q, n)) && irrigated.some((i) => pointInPolygon(q, i) || distToPolygonEdge(q, i) < 0.3);
            // try the catalog throw first, then up to the product's radius reduction
            let fitted = false;
            for (const k of [1, 0.9, 0.8, 1 - product.maxRadiusReduction]) {
              const f = fitArc(p, nozzle.radius * k, wettable);
              if (f && f.arc >= 30) {
                arcStart = f.start;
                arc = Math.max(product.arcMin || 1, Math.min(360, Math.round(f.arc)));
                if (k < 1) radiusOverride = Math.round(nozzle.radius * k * 12) / 12;
                fitted = true;
                break;
              }
            }
            if (!fitted) ed.showToast(`${nozzle.name} nozzle throws ${nozzle.radius}' — too far for this spot. Choose a smaller nozzle or head type.`, "warn");
          }
        }
        const s: Sprinkler = { id: uid("spk"), position: p, productId: product.id, nozzleId: nozzle.id, arcStart, arc, radiusOverride, elevation: 0, layer: "sprinklers", zoneId: ed.activeZoneId ?? undefined };
        P().apply((d) => {
          d.sprinklers.push(s);
        });
        ed.select([s.id]);
        return;
      }
      case "valve": {
        const vid = uid("valve");
        P().apply((d) => {
          const n = d.valves.filter((v) => v.type === "electric" || v.type === "drip").length + 1;
          d.valves.push({ id: vid, type: o.valveType, position: p, size: 1, name: `V${n}`, elevation: 0, layer: "valves" });
          if (o.valveCreatesZone && (o.valveType === "electric" || o.valveType === "drip")) {
            const num = Math.max(0, ...d.zones.map((z) => z.number)) + 1;
            const zid = uid("z");
            d.zones.push({ id: zid, number: num, name: `Zone ${num}`, color: ZONE_COLORS[(num - 1) % ZONE_COLORS.length], valveId: vid, plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0, schedule: { daysPerWeek: 3 } });
            useEditorStore.setState({ activeZoneId: zid });
          }
        });
        ed.select([vid]);
        return;
      }
      case "equipment": {
        const id = uid("eq");
        P().apply((d) => {
          d.equipment.push({ id, type: o.equipmentType, position: p, layer: o.equipmentType.includes("controller") || o.equipmentType === "rain-sensor" ? "electrical" : "valves", stations: o.equipmentType.includes("controller") ? Math.max(6, d.zones.length) : undefined });
        });
        ed.select([id]);
        return;
      }
      case "source": {
        const w = makeWaterSource(p, { name: `POC-${project.waterSources.length + 1}` });
        P().apply((d) => {
          d.waterSources.push(w);
        });
        ed.select([w.id]);
        ed.set({ rightTab: "properties" });
        return;
      }
      case "refpoint": {
        const id = uid("ref");
        P().apply((d) => {
          const list = (d.refPoints ??= []);
          const n = list.length + 1;
          list.push({ id, name: `RP${n}`, position: p, isOrigin: list.length === 0 ? false : undefined, layer: "measurements" });
        });
        ed.select([id]);
        ed.set({ rightTab: "properties" });
        ed.showToast("Reference point placed — rename it or set it as the measuring origin in Properties", "success");
        return;
      }
      case "plant": {
        const id = uid("plant");
        P().apply((d) => {
          d.plants.push({ id, type: o.plantType, name: o.plantType === "tree" ? "Tree" : "Shrub", position: p, canopyRadius: o.plantType === "tree" ? 8 : 1.5, layer: "planting" });
        });
        ed.select([id]);
        return;
      }
      case "text": {
        const size = Math.max(1, 14 / ed.viewport.zoom);
        ask.prompt("Label text", "Label").then((text) => {
          if (!text) return;
          const id = uid("lbl");
          P().apply((d) => {
            d.labels.push({ id, position: p, text, size, rotation: 0, color: "#0f172a", layer: "labels" });
          });
          ed.select([id]);
          ed.setTool("select");
        });
        return;
      }
      case "fitting": {
        // snap onto the nearest pipe and align with it
        let best: { pipe: Pipe; point: Vec; seg: number; d: number } | null = null;
        for (const pipe of project.pipes) {
          if (pipe.kind === "wire" || pipe.kind === "sleeve") continue;
          const c = closestOnPolyline(world, pipe.points);
          if (!best || c.d < best.d) best = { pipe, point: c.point, seg: c.seg, d: c.d };
        }
        const z = ed.viewport.zoom;
        let pos = p;
        let rotation = 0;
        let size = 1;
        if (best && best.d < 14 / z) {
          // prefer pipe vertices (joints) when close
          const vtx = best.pipe.points.find((q) => dist(q, world) < 14 / z);
          pos = vtx ?? best.point;
          const a = best.pipe.points[best.seg];
          const b = best.pipe.points[best.seg + 1];
          rotation = angleOf(sub(b, a));
          const pr = useAnalysisStore.getState().analysis?.hyd.pipes.get(best.pipe.id);
          size = pr?.sizes[0] ?? best.pipe.size;
        }
        const id = uid("fit");
        P().apply((d) => {
          d.fittings.push({ id, type: o.fittingType, position: pos, size, rotation, layer: "laterals" });
        });
        ed.select([id]);
        return;
      }
    }
  }, [snapFor]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const ed = E();
      const project = P().project;
      if (!project) return;
      el.setPointerCapture(e.pointerId);
      const screen = screenOf(e, el);
      const world = toWorld(ed.viewport, screen);
      const z = ed.viewport.zoom;
      if (e.pointerType === "touch") {
        touches.current.set(e.pointerId, screen);
        if (touches.current.size === 2) {
          const [a, b] = [...touches.current.values()];
          pinch.current = { d: dist(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vp: { ...ed.viewport } };
          drag.current = null;
          setMarquee(null);
          return;
        }
        // one finger on empty canvas pans (selection still works by tapping objects)
        if (ed.tool === "select" && !hitTest(project, world, 14 / z) && !hitHandle(getHandles(project, ed.selection, z), world, 14 / z)) {
          drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: ed.viewport.x, vy: ed.viewport.y, moved: false, button: 0 };
          return;
        }
      }
      // --- panning: middle / right button, Space, or Pan tool ---
      if (e.button === 1 || e.button === 2 || ed.spacePan || ed.tool === "pan") {
        drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: ed.viewport.x, vy: ed.viewport.y, moved: false, button: e.button };
        return;
      }
      if (e.button !== 0) return;
      const now = Date.now();
      const isDouble = now - lastClick.current.t < 320 && dist(lastClick.current.p, screen) < 6;
      lastClick.current = { t: now, p: screen };

      switch (ed.tool) {
        case "select": {
          const handles = getHandles(project, ed.selection, z);
          const h = hitHandle(handles, world, 8 / z);
          if (h) {
            if (isDouble && h.kind === "vertex" && h.objId !== undefined) {
              // double-click a vertex removes it
              const ref2 = findObject(project, h.objId);
              const min = ref2 && (ref2.collection === "areas" || ref2.collection === "drips") ? 3 : 2;
              P().apply((d) => {
                const r = findObject(d as Project, h.objId!);
                const ptsArr = (r?.obj as { points?: Vec[] })?.points;
                if (ptsArr && ptsArr.length > min) ptsArr.splice(h.index!, 1);
              });
              return;
            }
            // pipe endpoints drag connected pipe ends with them
            const attached: { pipeId: string; index: number }[] = [];
            if (h.kind === "vertex") {
              const r = findObject(project, h.objId!);
              if (r?.collection === "pipes")
                for (const pp of project.pipes) pp.points.forEach((q, i) => pp.id !== h.objId && dist(q, h.p) < 0.05 && attached.push({ pipeId: pp.id, index: i }));
            }
            drag.current = { type: "handle", h, start: world, moved: false, base: project, attached };
            return;
          }
          const hit = hitTest(project, world, 6 / z);
          if (hit) {
            let sel = ed.selection;
            if (e.shiftKey || e.metaKey || e.ctrlKey) sel = sel.includes(hit) ? sel.filter((x) => x !== hit) : [...sel, hit];
            else if (!sel.includes(hit)) sel = [hit];
            ed.select(sel);
            if (isDouble) {
              ed.set({ rightTab: "properties" });
            }
            const ids = sel.filter((id) => {
              const r = findObject(project, id);
              return r && !isLocked(project, r);
            });
            const hr = findObject(project, hit)!;
            const anchor = "position" in hr.obj ? (hr.obj as { position: Vec }).position : world;
            // devices drag the pipe ends connected to them
            const attached: { pipeId: string; index: number; orig: Vec }[] = [];
            const selSet = new Set(ids);
            for (const id of ids) {
              const r = findObject(project, id);
              if (!r || !("position" in r.obj)) continue;
              const pos = (r.obj as { position: Vec }).position;
              for (const pp of project.pipes) {
                if (selSet.has(pp.id)) continue;
                pp.points.forEach((q, i) => dist(q, pos) < 0.3 && attached.push({ pipeId: pp.id, index: i, orig: q }));
              }
            }
            drag.current = { type: "move", start: world, anchor, ids, moved: false, attached, base: project };
          } else {
            if (!e.shiftKey) ed.select([]);
            drag.current = { type: "marquee", start: world, cur: world, additive: e.shiftKey };
          }
          return;
        }
        case "area":
        case "drip":
        case "line": {
          const shape = ed.tool === "area" ? ed.opts.areaShape : "polygon";
          const last = ed.draft[ed.draft.length - 1];
          const s = snapFor(world, e, undefined, last);
          if (shape === "rectangle") {
            drag.current = { type: "rect", start: s.point };
            ed.setDraft([s.point, s.point]);
            return;
          }
          if (shape === "circle") {
            drag.current = { type: "circle", center: s.point };
            ed.setDraft([s.point, s.point]);
            return;
          }
          if (isDouble) {
            finishDraft();
            return;
          }
          if (ed.draft.length >= 3 && ed.tool !== "line" && dist(s.point, ed.draft[0]) < 10 / z) {
            finishDraft();
            return;
          }
          ed.setDraft([...ed.draft, s.point]);
          return;
        }
        case "pipe": {
          const last = ed.draft[ed.draft.length - 1];
          const s = snapFor(world, e, undefined, last);
          // double-click ends the run (a click right after an auto-finished run starts a new one)
          if (isDouble && last && dist(last, s.point) < 0.05) {
            ed.setDraft([]);
            return;
          }
          if (!last) {
            ed.setDraft([s.point]);
            return;
          }
          if (dist(last, s.point) < 0.05) return;
          // commit a segment immediately so the run survives panning/zooming
          const o = ed.opts;
          let zoneId: string | undefined;
          if (o.pipeKind === "lateral" || o.pipeKind === "drip") zoneId = inferZone(project, last) ?? inferZone(project, s.point) ?? ed.activeZoneId ?? undefined;
          const pipe: Pipe = {
            id: uid("pipe"),
            kind: o.pipeKind,
            points: [last, s.point],
            material: o.pipeKind === "drip" ? "poly-100" : o.pipeMaterial,
            size: o.pipeKind === "sleeve" ? 2 : o.pipeSize,
            autoSize: o.pipeKind === "sleeve" || o.pipeKind === "wire" ? false : o.pipeAutoSize,
            zoneId,
            layer: o.pipeKind === "mainline" ? "mainline" : o.pipeKind === "wire" ? "electrical" : o.pipeKind === "drip" ? "drip" : "laterals",
            conductors: o.pipeKind === "wire" ? project.zones.length + 2 : undefined,
          };
          P().apply((d) => {
            d.pipes.push(pipe);
          });
          // ending on a head/valve/pipe finishes the run
          if (s.kind === "sprinkler" || s.kind === "device") ed.setDraft([]);
          else ed.setDraft([s.point]);
          return;
        }
        case "measure": {
          const s = snapFor(world, e, undefined, ed.measurePoints[ed.measurePoints.length - 1]);
          const mode = ed.opts.measureMode;
          const cap = mode === "angle" ? 3 : mode === "radius" ? 2 : Infinity;
          if (isDouble || ed.measurePoints.length >= cap) {
            ed.set({ measurePoints: isDouble ? ed.measurePoints : [s.point] });
            return;
          }
          ed.set({ measurePoints: [...ed.measurePoints, s.point] });
          return;
        }
        case "dimension": {
          const s = snapFor(world, e, undefined, ed.draft.length === 1 ? ed.draft[0] : undefined);
          if (ed.draft.length < 2) {
            ed.setDraft([...ed.draft, s.point]);
            return;
          }
          const [a, b] = ed.draft;
          const kindOpt = ed.opts.dimensionKind;
          let kind: "aligned" | "horizontal" | "vertical" = kindOpt === "auto" ? "aligned" : kindOpt;
          if (kindOpt === "auto" && e.shiftKey) kind = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "horizontal" : "vertical";
          const offset = dimOffset(a, b, kind, world);
          const id = uid("dim");
          P().apply((d) => {
            d.dimensions.push({ id, kind, a, b, offset, layer: "measurements" });
          });
          ed.setDraft([]);
          return;
        }
        case "calibrate": {
          const next = [...ed.draft, world];
          if (next.length < 2) {
            ed.setDraft(next);
            return;
          }
          ed.setDraft([]);
          const measured = dist(next[0], next[1]);
          ask.prompt(`Measured ${formatFeetInches(measured)} on the background. Enter the real distance (e.g. 45' 6"):`, formatFeetInches(measured)).then((input) => {
            if (!input) return;
            const real = parseLength(input);
            if (!isFinite(real) || real <= 0 || !project.background) {
              ed.showToast("Enter a distance such as 45' 6\" or 45.5", "warn");
              return;
            }
            const k = real / measured;
            const anchor = next[0];
            P().apply((d) => {
              const bg = d.background!;
              bg.ftPerPx *= k;
              bg.x = anchor.x - (anchor.x - bg.x) * k;
              bg.y = anchor.y - (anchor.y - bg.y) * k;
            });
            ed.showToast(`Background calibrated: ${formatFeetInches(real)} between points`, "success");
            ed.setTool("select");
          });
          return;
        }
        default:
          placeAt(world, e);
      }
    },
    [ref, snapFor, finishDraft, placeAt],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const ed = E();
      const project = P().project;
      if (!project) return;
      const screen = screenOf(e, el);
      if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, screen);
        if (pinch.current && touches.current.size >= 2) {
          const [a, b] = [...touches.current.values()];
          const d = dist(a, b);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const pv = pinch.current.vp;
          const zoom = Math.max(0.4, Math.min(120, pv.zoom * (d / Math.max(pinch.current.d, 1))));
          const anchor = { x: pinch.current.mid.x / pv.zoom + pv.x, y: pinch.current.mid.y / pv.zoom + pv.y };
          ed.setViewport({ zoom, x: anchor.x - mid.x / zoom, y: anchor.y - mid.y / zoom });
          return;
        }
      }
      const world = toWorld(ed.viewport, screen);
      const z = ed.viewport.zoom;
      const dr = drag.current;
      if (dr?.type === "pan") {
        const dx = e.clientX - dr.sx;
        const dy = e.clientY - dr.sy;
        if (Math.abs(dx) + Math.abs(dy) > 2) dr.moved = true;
        ed.setViewport({ x: dr.vx - dx / z, y: dr.vy - dy / z });
        return;
      }
      if (dr?.type === "marquee") {
        dr.cur = world;
        setMarquee({ a: dr.start, b: world });
        return;
      }
      if (dr?.type === "move") {
        if (!dr.moved && dist(dr.start, world) * z < 3) return;
        if (!dr.moved) {
          P().checkpoint();
          ed.set({ dragging: true });
          dr.moved = true;
        }
        const raw = sub(world, dr.start);
        const target = add(dr.anchor, raw);
        const s = snapFor(target, e, new Set(dr.ids));
        const delta = sub(s.point, dr.anchor);
        ed.setCursor(world, s);
        useProjectStore.setState({ project: dr.base });
        P().apply(
          (d) => {
            moveObjects(d as Project, dr.ids, delta.x, delta.y);
            for (const a of dr.attached) {
              const pp = d.pipes.find((x) => x.id === a.pipeId);
              if (pp) pp.points[a.index] = add(a.orig, delta);
            }
          },
          { history: false },
        );
        return;
      }
      if (dr?.type === "handle") {
        if (!dr.moved && dist(dr.start, world) * z < 2) return;
        if (!dr.moved) {
          P().checkpoint();
          ed.set({ dragging: true });
          dr.moved = true;
        }
        applyHandleDrag(dr, world, e, snapFor);
        return;
      }
      if (dr?.type === "rect") {
        const s = snapFor(world, e);
        const a = dr.start;
        const b = s.point;
        ed.setDraft([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
        ed.setCursor(world, s);
        return;
      }
      if (dr?.type === "circle") {
        const s = snapFor(world, e);
        const r = dist(dr.center, s.point);
        const n = 36;
        const ptsArr = Array.from({ length: n }, (_, i) => add(dr.center, fromAngle((i * 360) / n, r)));
        ed.setDraft(ptsArr);
        ed.setCursor(world, s);
        return;
      }
      // hover + snap preview
      const drawing = ["area", "line", "drip", "pipe", "dimension", "measure", "sprinkler", "valve", "equipment", "source", "fitting", "plant", "text", "refpoint"].includes(ed.tool);
      if (drawing) {
        const last = ed.tool === "measure" ? ed.measurePoints[ed.measurePoints.length - 1] : ed.draft[ed.draft.length - 1];
        const s = snapFor(world, e, undefined, ed.tool === "dimension" && ed.draft.length >= 2 ? undefined : last);
        ed.setCursor(world, s);
        // auto-pan when drawing near the canvas edge
        if ((ed.draft.length || ed.measurePoints.length) && !ed.spacePan) {
          const { w, h } = ed.canvasSize;
          const m = 28;
          let px = 0;
          let py = 0;
          if (screen.x < m) px = -(m - screen.x);
          if (screen.x > w - m) px = screen.x - (w - m);
          if (screen.y < m) py = -(m - screen.y);
          if (screen.y > h - m) py = screen.y - (h - m);
          if (px || py) ed.setViewport({ x: ed.viewport.x + (px * 0.5) / z, y: ed.viewport.y + (py * 0.5) / z });
        }
      } else {
        ed.setCursor(world, null);
      }
      if (ed.tool === "select" && !dr) {
        const hit = hitTest(project, world, 6 / z);
        if (hit !== ed.hover) ed.setHover(hit);
      }
    },
    [ref, snapFor, setMarquee],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      const ed = E();
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinch.current = null;
      const dr = drag.current;
      drag.current = null;
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!dr) return;
      if (dr.type === "pan") {
        // right-click without dragging finishes the current drawing
        if (dr.button === 2 && !dr.moved) {
          if (ed.tool === "area" || ed.tool === "line" || ed.tool === "drip") finishDraft();
          else ed.set({ draft: [], measurePoints: [] });
        }
        return;
      }
      if (dr.type === "marquee") {
        setMarquee(null);
        const project = P().project!;
        if (dist(dr.start, dr.cur) * ed.viewport.zoom > 4) {
          const ids = marqueeHits(project, dr.start, dr.cur);
          ed.select(dr.additive ? [...new Set([...ed.selection, ...ids])] : ids);
        }
        return;
      }
      if (dr.type === "move" || dr.type === "handle") {
        if (dr.moved) ed.set({ dragging: false });
        return;
      }
      if (dr.type === "rect" || dr.type === "circle") {
        const d = ed.draft;
        if (d.length >= 3 && Math.abs(d[0].x - d[2].x) + Math.abs(d[0].y - d[2].y) > 0.5) finishDraft();
        else ed.setDraft([]);
      }
    },
    [ref, finishDraft, setMarquee],
  );

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      const ed = E();
      const screen = screenOf(e, el);
      if (e.shiftKey && !e.ctrlKey) {
        ed.setViewport({ x: ed.viewport.x + (e.deltaY || e.deltaX) / ed.viewport.zoom });
        return;
      }
      const k = e.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-e.deltaY * k);
      ed.setViewport(zoomAt(ed.viewport, screen, factor));
    },
    [ref],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onWheel, finishDraft };
}

export function finishDraftAction() {
  const E = () => useEditorStore.getState();
  const P = () => useProjectStore.getState();
    const ed = E();
    const draft = ed.draft;
    const project = P().project;
    if (!project) return;
    if (ed.tool === "area" && draft.length >= 3) {
      const a = makeArea(ed.opts.areaType, draft);
      P().apply((d) => {
        d.areas.push(a);
      });
      ed.select([a.id]);
      ed.showToast(`${a.name} created`, "success");
    } else if (ed.tool === "drip" && draft.length >= 3) {
      const id = uid("drip");
      P().apply((d) => {
        d.drips.push({ id, name: `Drip area ${d.drips.length + 1}`, points: draft, productId: "gen-dripline-17", rowSpacingIn: 18, emitterSpacingIn: 12, emitterGph: 0.9, zoneId: ed.activeZoneId ?? undefined, layer: "drip" });
      });
      ed.select([id]);
    } else if (ed.tool === "line" && draft.length >= 2) {
      const def = LINE_DEFAULTS[ed.opts.lineType];
      const id = uid("line");
      P().apply((d) => {
        d.lines.push({ id, type: ed.opts.lineType, name: def.name, points: draft, style: { ...def.style }, layer: def.layer });
      });
      ed.select([id]);
    }
    ed.set({ draft: [] });
}

function inferZone(project: Project, p: Vec): string | undefined {
  const v = project.valves.find((x) => dist(x.position, p) < 0.5);
  if (v) return project.zones.find((z) => z.valveId === v.id)?.id;
  const s = project.sprinklers.find((x) => dist(x.position, p) < 0.5);
  if (s?.zoneId) return s.zoneId;
  for (const pp of project.pipes) if ((pp.kind === "lateral" || pp.kind === "drip") && pp.zoneId && closestOnPolyline(p, pp.points).d < 0.3) return pp.zoneId;
  return undefined;
}

function dimOffset(a: Vec, b: Vec, kind: "aligned" | "horizontal" | "vertical", p: Vec): number {
  if (kind === "horizontal") return p.y - Math.max(a.y, b.y);
  if (kind === "vertical") return p.x - Math.max(a.x, b.x);
  const L = dist(a, b) || 1;
  const nx = -(b.y - a.y) / L;
  const ny = (b.x - a.x) / L;
  return (p.x - a.x) * nx + (p.y - a.y) * ny;
}

function applyHandleDrag(dr: Extract<Drag, { type: "handle" }>, world: Vec, e: React.PointerEvent, snapFor: (w: Vec, e: { shiftKey: boolean; altKey: boolean }, ex?: Set<string>, from?: Vec) => SnapResult) {
  const h = dr.h;
  const P = useProjectStore.getState();
  const ed = useEditorStore.getState();
  useProjectStore.setState({ project: dr.base });
  const base = dr.base;
  switch (h.kind) {
    case "vertex": {
      const s = snapFor(world, e, new Set([h.objId!]));
      ed.setCursor(world, s);
      P.apply(
        (d) => {
          const r = findObject(d as Project, h.objId!);
          const ptsArr = (r?.obj as { points?: Vec[] })?.points;
          if (ptsArr) ptsArr[h.index!] = s.point;
          for (const a of dr.attached) {
            const pp = d.pipes.find((x) => x.id === a.pipeId);
            if (pp) pp.points[a.index] = s.point;
          }
        },
        { history: false },
      );
      return;
    }
    case "mid": {
      const s = snapFor(world, e, new Set([h.objId!]));
      P.apply(
        (d) => {
          const r = findObject(d as Project, h.objId!);
          const ptsArr = (r?.obj as { points?: Vec[] })?.points;
          if (ptsArr) ptsArr.splice(h.index! + 1, 0, s.point);
        },
        { history: false },
      );
      // subsequent moves drag the new vertex
      dr.h = { ...h, kind: "vertex", index: h.index! + 1, id: `vertex:${h.objId}:${h.index! + 1}` };
      dr.base = useProjectStore.getState().project!;
      return;
    }
    case "arcStart":
    case "arcEnd":
    case "radius": {
      const s0 = base.sprinklers.find((x) => x.id === h.objId)!;
      const ang = angleOf(sub(world, s0.position));
      const step = e.shiftKey ? 15 : 1;
      const snapA = (a: number) => Math.round(a / step) * step;
      P.apply(
        (d) => {
          const s = d.sprinklers.find((x) => x.id === h.objId)!;
          const product = getProduct(s.productId);
          if (h.kind === "arcStart") {
            const end = s0.arcStart + s0.arc;
            const ns = normAngle(snapA(ang));
            let arc = normAngle(end - ns);
            if (arc < 5) arc = 360;
            if (product.arcAdjustable) {
              s.arcStart = ns;
              s.arc = Math.max(product.arcMin || 1, Math.min(product.arcMax, arc));
            } else s.arcStart = ns;
          } else if (h.kind === "arcEnd") {
            let arc = normAngle(snapA(ang) - s0.arcStart);
            if (arc < 5) arc = 360;
            if (product.arcAdjustable) s.arc = Math.max(product.arcMin || 1, Math.min(product.arcMax, arc));
            else s.arcStart = normAngle(snapA(ang) - s0.arc);
          } else {
            // radius handle: drag to adjust the throw distance (radius screw)
            const r = dist(world, s0.position);
            const perf = headPerformance(s0);
            // 1-inch increments (Shift: whole feet)
            const snapped = e.shiftKey ? Math.round(r) : Math.round(r * 12) / 12;
            const clamped = Math.max(1, Math.min(perf.catalogRadius, snapped));
            s.radiusOverride = clamped >= perf.catalogRadius - 0.01 ? undefined : clamped;
            if (product.category === "custom" && s.custom) {
              s.custom.radius = Math.max(1, snapped);
              s.radiusOverride = undefined;
            }
          }
        },
        { history: false },
      );
      return;
    }
    case "dimA":
    case "dimB": {
      const s = snapFor(world, e, new Set([h.objId!]));
      P.apply(
        (d) => {
          const dm = d.dimensions.find((x) => x.id === h.objId)!;
          if (h.kind === "dimA") dm.a = s.point;
          else dm.b = s.point;
        },
        { history: false },
      );
      return;
    }
    case "dimOffset": {
      P.apply(
        (d) => {
          const dm = d.dimensions.find((x) => x.id === h.objId)!;
          dm.offset = dimOffset(dm.a, dm.b, dm.kind, world);
        },
        { history: false },
      );
      return;
    }
    case "canopy": {
      P.apply(
        (d) => {
          const p = d.plants.find((x) => x.id === h.objId)!;
          p.canopyRadius = Math.max(1 / 12, Math.round(dist(world, p.position) * 12) / 12);
        },
        { history: false },
      );
      return;
    }
    case "rotate": {
      const sel = ed.selection;
      const b = selectionBounds(base, sel)!;
      const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
      const a0 = angleOf(sub(dr.start, c));
      let deg = angleOf(sub(world, c)) - a0;
      deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      P.apply((d) => rotateObjects(d as Project, sel, deg, c), { history: false });
      return;
    }
    case "scale": {
      const sel = ed.selection;
      const b = selectionBounds(base, sel)!;
      const anchor = {
        x: h.corner === "nw" || h.corner === "sw" ? b.maxX : b.minX,
        y: h.corner === "nw" || h.corner === "ne" ? b.maxY : b.minY,
      };
      const s = snapFor(world, e, new Set(sel));
      const w0 = h.p.x - anchor.x || 1e-6;
      const h0 = h.p.y - anchor.y || 1e-6;
      let sx = (s.point.x - anchor.x) / w0;
      let sy = (s.point.y - anchor.y) / h0;
      if (e.shiftKey) sx = sy = Math.max(Math.abs(sx), Math.abs(sy)) * Math.sign(sx || 1);
      if (Math.abs(sx) < 0.01 || Math.abs(sy) < 0.01) return;
      P.apply((d) => scaleObjects(d as Project, sel, sx, sy, anchor), { history: false });
      return;
    }
  }
}

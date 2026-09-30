"use client";
/** Editor commands shared by the toolbar, menus and keyboard shortcuts. */
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useAppStore } from "@/store/appStore";
import type { Project } from "@/lib/model/types";
import { cloneObjects, deleteObjects, findObject, isLocked, moveObjects } from "@/lib/editor/ops";
import { fitBounds, zoomAt } from "./canvas/viewport";
import { projectBounds } from "@/lib/plan/planSvg";
import { persistProject, logActivity } from "@/lib/storage/seed";
import { repo } from "@/lib/storage/repository";
import { applyAutoLayout, applyAutoRoute, applyAutoZone, autoDesignAll, matchNozzles } from "@/lib/irrigation/autoDesign";
import type { AutoLayoutOptions } from "@/lib/irrigation/autoLayout";
import type { LateralStyle } from "@/lib/irrigation/autoRoute";
import { isIrrigated } from "@/lib/irrigation/site";

const E = () => useEditorStore.getState();
const P = () => useProjectStore.getState();

export const actions = {
  undo: () => P().undo(),
  redo: () => P().redo(),
  deleteSelection() {
    const ed = E();
    const project = P().project;
    if (!project) return;
    if (ed.vertexSel) return;
    const ids = ed.selection.filter((id) => {
      const r = findObject(project, id);
      return r && !isLocked(project, r);
    });
    if (!ids.length) return;
    P().apply((d) => deleteObjects(d as Project, ids));
    const zones = P().project?.zones ?? [];
    ed.set({ selection: [], highlight: [], activeZoneId: zones.some((z) => z.id === ed.activeZoneId) ? ed.activeZoneId : null });
  },
  copy() {
    const project = P().project;
    if (!project) return;
    const refs = E().selection.map((id) => findObject(project, id)).filter(Boolean) as NonNullable<ReturnType<typeof findObject>>[];
    E().set({ clipboard: refs.map((r) => ({ collection: r.collection, obj: JSON.parse(JSON.stringify(r.obj)) })) });
    if (refs.length) E().showToast(`Copied ${refs.length} object(s)`);
  },
  paste() {
    const clip = E().clipboard;
    if (!clip.length) return;
    let ids: string[] = [];
    P().apply((d) => {
      ids = cloneObjects(d as Project, clip, 5, 5);
    });
    E().select(ids);
    // shift clipboard so repeated pastes cascade
    E().set({ clipboard: clip.map((c) => ({ ...c, obj: shifted(c.obj, 5) })) });
  },
  duplicate() {
    const project = P().project;
    if (!project) return;
    const refs = E().selection.map((id) => findObject(project, id)).filter(Boolean) as NonNullable<ReturnType<typeof findObject>>[];
    if (!refs.length) return;
    let ids: string[] = [];
    P().apply((d) => {
      ids = cloneObjects(d as Project, refs, 3, 3);
    });
    E().select(ids);
  },
  selectAll() {
    const p = P().project;
    if (!p) return;
    const ids = [...p.sprinklers, ...p.pipes, ...p.valves, ...p.fittings, ...p.equipment, ...p.labels, ...p.dimensions, ...p.plants, ...p.lines, ...p.drips, ...p.areas.filter((a) => a.type !== "property")]
      .filter((o) => {
        const r = findObject(p, o.id);
        return r && !isLocked(p, r);
      })
      .map((o) => o.id);
    E().select(ids);
  },
  nudge(dx: number, dy: number) {
    const ids = E().selection;
    if (!ids.length) {
      const v = E().viewport;
      E().setViewport({ x: v.x + (dx * 40) / v.zoom, y: v.y + (dy * 40) / v.zoom });
      return;
    }
    P().apply((d) => moveObjects(d as Project, ids, dx, dy));
  },
  zoom(f: number) {
    const { viewport, canvasSize } = E();
    E().setViewport(zoomAt(viewport, { x: canvasSize.w / 2, y: canvasSize.h / 2 }, f));
  },
  fit() {
    const p = P().project;
    if (!p) return;
    E().setViewport(fitBounds(projectBounds(p, 4), E().canvasSize, 30));
  },
  zoomTo(ids: string[]) {
    const p = P().project;
    if (!p) return;
    const pts = ids.flatMap((id) => {
      const r = findObject(p, id);
      if (!r) {
        const z = p.zones.find((zz) => zz.id === id);
        if (z) return p.sprinklers.filter((s) => s.zoneId === z.id).map((s) => s.position);
        return [];
      }
      const o = r.obj as unknown as Record<string, unknown>;
      return (o.points as { x: number; y: number }[]) ?? (o.position ? [o.position as { x: number; y: number }] : []);
    });
    if (!pts.length) return;
    const b = pts.reduce((acc, q) => ({ minX: Math.min(acc.minX, q.x), minY: Math.min(acc.minY, q.y), maxX: Math.max(acc.maxX, q.x), maxY: Math.max(acc.maxY, q.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const pad = 25;
    const cur = E().viewport;
    const fit = fitBounds({ minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }, E().canvasSize, 40);
    E().setViewport(fit.zoom > cur.zoom * 2.5 ? { ...fit, zoom: Math.max(cur.zoom, fit.zoom * 0.6) } : fit);
  },
  async save(opts: { version?: string; silent?: boolean } = {}) {
    const p = P().project;
    if (!p) return;
    await persistProject(p, useAppStore.getState().products);
    if (opts.version) await repo.saveVersion(p, opts.version);
    P().markSaved(new Date().toISOString());
    if (!opts.silent) E().showToast(opts.version ? `Version saved: ${opts.version}` : "Project saved", "success");
    useAppStore.getState().refresh();
  },
  autoLayoutArea(areaId: string, opts: AutoLayoutOptions) {
    const p = P().project;
    if (!p) return;
    const r = applyAutoLayout(p, areaId, opts);
    P().replace(r.project);
    const area = p.areas.find((a) => a.id === areaId);
    E().showToast(`${r.count} heads placed in ${area?.name ?? "area"}${r.notes.length ? ` — ${r.notes[0]}` : ""}`, "success");
    logActivity(`Auto layout: ${r.count} heads in ${area?.name}`, p.id, p.meta.name);
  },
  autoLayoutAll(opts: AutoLayoutOptions) {
    let p = P().project;
    if (!p) return;
    let n = 0;
    for (const a of p.areas.filter(isIrrigated)) {
      const r = applyAutoLayout(p, a.id, a.type === "lawn" ? opts : { headClass: "auto" });
      p = r.project;
      n += r.count;
    }
    P().replace(p);
    E().showToast(`${n} heads placed`, "success");
  },
  autoZone() {
    const p = P().project;
    if (!p) return;
    if (!p.sprinklers.length && !p.drips.length) {
      E().showToast("Place sprinklers (or run Auto Layout) before zoning", "warn");
      return;
    }
    const r = applyAutoZone(p);
    P().replace(r.project);
    E().showToast(`${r.zones} zones created (≤ ${r.maxZoneGpm.toFixed(1)} GPM each). Run Auto Route to pipe them.`, "success");
    E().set({ rightTab: "zones" });
    logActivity(`Auto zone: ${r.zones} zones`, p.id, p.meta.name);
  },
  autoRoute(style: LateralStyle | "auto" = "auto", zoneIds?: string[]) {
    const p = P().project;
    if (!p) return;
    if (!p.zones.length) {
      E().showToast("Create zones first (Auto Zone or place valves)", "warn");
      return;
    }
    const r = applyAutoRoute(p, { style, zoneIds, mainline: !zoneIds, wire: !zoneIds, sleeves: true });
    P().replace(r.project);
    E().showToast(`Pipes routed${style === "auto" ? " (best lateral layout chosen per zone)" : ` (${style})`}`, "success");
    logActivity(`Pipe routing updated${zoneIds ? "" : " for all zones"}`, p.id, p.meta.name);
  },
  matchNozzles(zoneId?: string) {
    const p = P().project;
    if (!p) return;
    const r = matchNozzles(p, zoneId);
    P().replace(r.project);
    E().showToast(r.changed ? `${r.changed} nozzle(s) changed to match precipitation` : "Nozzles already matched", "success");
  },
  autoDesignAll(opts: AutoLayoutOptions = { headClass: "auto" }) {
    const p = P().project;
    if (!p) return;
    const r = autoDesignAll(p, opts);
    P().replace(r.project);
    E().showToast(`Auto design complete: ${r.project.sprinklers.length} heads, ${r.project.zones.length} zones`, "success");
    if (r.notes.length) setTimeout(() => E().showToast(r.notes[0], "info"), 3600);
    logActivity(`Auto design: ${r.project.zones.length} zones, ${r.project.sprinklers.length} heads`, p.id, p.meta.name);
    E().set({ rightTab: "zones" });
  },
};

function shifted<T>(obj: T, d: number): T {
  const o = JSON.parse(JSON.stringify(obj));
  if (o.points) o.points = o.points.map((p: { x: number; y: number }) => ({ x: p.x + d, y: p.y + d }));
  if (o.position) o.position = { x: o.position.x + d, y: o.position.y + d };
  if (o.a && o.b) {
    o.a = { x: o.a.x + d, y: o.a.y + d };
    o.b = { x: o.b.x + d, y: o.b.y + d };
  }
  return o;
}

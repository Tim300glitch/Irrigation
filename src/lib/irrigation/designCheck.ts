/**
 * DESIGN CHECK — rule-based validation of the design. Every rule reads real
 * design/analysis data and produces specific, actionable messages with the
 * affected object ids so the UI can highlight them.
 */
import type { Project, Sprinkler } from "../model/types";
import { centroid, dist, pointInPolygon, polylineLength, segmentIntersectsPolygon, type Vec } from "../geometry/geometry";
import type { HydraulicResult } from "../hydraulics/analysis";
import { pipeSizeLabel } from "../units/units";
import type { CoverageGrid, OversprayResult } from "./coverage";
import { computeOverspray } from "./coverage";
import { compass, headLabels } from "./labels";
import { precipClass } from "./sprinkler";
import { areaAt, isHardscape, isIrrigated, isStructure, propertyBoundary } from "./site";

export type Severity = "error" | "warning" | "recommendation";

export interface DesignWarning {
  id: string;
  severity: Severity;
  code: string;
  title: string;
  message: string;
  targets: string[];
  location?: Vec;
  zoneId?: string;
}

const oversprayCache = new WeakMap<Sprinkler, { areas: unknown; res: OversprayResult[] }>();

export function oversprayFor(project: Project, h: Sprinkler, perf?: Parameters<typeof computeOverspray>[2]): OversprayResult[] {
  const c = oversprayCache.get(h);
  if (c && c.areas === project.areas) return c.res;
  const res = computeOverspray(project, h, perf);
  oversprayCache.set(h, { areas: project.areas, res });
  return res;
}

export function runDesignCheck(project: Project, hyd: HydraulicResult, coverage: CoverageGrid | null): DesignWarning[] {
  const W: DesignWarning[] = [];
  const labels = headLabels(project);
  const lbl = (id: string) => labels.get(id) ?? "head";
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const zname = (id?: string) => (id && zoneById.get(id) ? `Zone ${zoneById.get(id)!.number}` : "unzoned");
  let n = 0;
  const push = (w: Omit<DesignWarning, "id">) => W.push({ ...w, id: `${w.code}-${n++}` });
  const maxV = project.settings.maxVelocityFps;
  const prop = propertyBoundary(project);
  const siteCenter = prop ? centroid(prop.points) : centroid(project.areas.flatMap((a) => a.points).slice(0, 400)) ?? { x: 0, y: 0 };

  // ---------- Water source / equipment ----------
  if (!project.waterSources.length && (project.sprinklers.length || project.drips.length)) {
    push({ severity: "error", code: "no-source", title: "No water source", message: "Add a Point of Connection (water source) with static pressure and available flow so hydraulics can be calculated.", targets: [] });
  }
  for (const src of project.waterSources) {
    if (src.backflow === "none" && !project.equipment.some((e) => e.type === "backflow"))
      push({ severity: "warning", code: "no-backflow", title: "No backflow prevention", message: `${src.name} has no backflow preventer. Most jurisdictions require one (PVB, RP or DCVA) on irrigation connections.`, targets: [src.id], location: src.position });
    if (!src.availableGpm && !src.flowTest)
      push({ severity: "recommendation", code: "flow-estimated", title: "Available flow is estimated", message: `${src.name}: available flow is estimated from meter/service size (${hyd.sources.get(src.id)?.availableGpm.toFixed(1) ?? "?"} GPM). A measured bucket or flow test is preferable.`, targets: [src.id], location: src.position });
    if (src.staticPsi > 80 && !src.prvSettingPsi)
      push({ severity: "recommendation", code: "high-static", title: "High static pressure", message: `${src.name} static pressure is ${src.staticPsi} PSI. Consider a pressure regulator or pressure-regulated heads to prevent misting and fitting stress.`, targets: [src.id], location: src.position });
  }
  const controllers = project.equipment.filter((e) => e.type === "controller" || e.type === "smart-controller");
  if (project.zones.length && !controllers.length)
    push({ severity: "recommendation", code: "no-controller", title: "No controller placed", message: "Place a controller (a smart/weather-based controller is recommended in water-conscious regions) so wire runs and station count can be estimated.", targets: [] });
  for (const c of controllers)
    if (c.stations && c.stations < project.zones.length)
      push({ severity: "error", code: "controller-stations", title: "Controller too small", message: `Controller has ${c.stations} stations but the design has ${project.zones.length} zones.`, targets: [c.id], location: c.position });

  // ---------- Zones ----------
  for (const z of hyd.zones) {
    const zone = zoneById.get(z.zoneId)!;
    if (!z.valveId && (z.headCount || z.dripGpm))
      push({ severity: "error", code: "missing-valve", title: "Missing valve", message: `Zone ${z.number} has ${z.headCount} heads but no valve. Assign or place a valve for this zone.`, targets: [z.zoneId], zoneId: z.zoneId });
    const avail = z.source?.availableGpm ?? 0;
    if (avail > 0 && z.gpm > avail)
      push({ severity: "error", code: "excess-gpm", title: "Zone exceeds available flow", message: `Zone ${z.number} requires ${z.gpm.toFixed(1)} GPM but your configured available flow is ${avail.toFixed(1)} GPM. Split the zone or reduce nozzle sizes.`, targets: [z.zoneId], zoneId: z.zoneId });
    else if (avail > 0 && z.gpm > (avail * project.settings.maxZoneFlowPct) / 100)
      push({ severity: "warning", code: "high-gpm", title: "Zone near flow limit", message: `Zone ${z.number} uses ${z.gpm.toFixed(1)} GPM (${z.flowPct.toFixed(0)}% of available ${avail.toFixed(1)} GPM; design limit ${project.settings.maxZoneFlowPct}%).`, targets: [z.zoneId], zoneId: z.zoneId });
    if (z.criticalHeadId && z.criticalPressure !== undefined) {
      const hr = hyd.heads.get(z.criticalHeadId)!;
      if (z.criticalPressure < hr.perf.minPressure)
        push({ severity: "error", code: "below-min-pressure", title: "Pressure below sprinkler minimum", message: `${lbl(z.criticalHeadId)} (Zone ${z.number}) receives ${z.criticalPressure.toFixed(1)} PSI, below the ${hr.perf.minPressure} PSI minimum for ${hr.perf.product.model}. Upsize the lateral/mainline or split the zone.`, targets: [z.criticalHeadId], zoneId: z.zoneId });
      else if (z.criticalPressure < hr.requiredPressure * 0.9)
        push({ severity: "warning", code: "low-pressure", title: "Insufficient pressure", message: `${lbl(z.criticalHeadId)} (Zone ${z.number}) receives ${z.criticalPressure.toFixed(1)} PSI; design pressure is ${hr.requiredPressure.toFixed(0)} PSI. Expect reduced throw — upsize pipe or reduce zone flow.`, targets: [z.criticalHeadId], zoneId: z.zoneId });
    }
    if (z.pressureVariationPct > 20)
      push({ severity: "warning", code: "pressure-variation", title: "Excessive pressure variation", message: `Pressure across Zone ${z.number} varies ${z.pressureVariationPct.toFixed(0)}% (limit 20%). Consider a center-fed or looped lateral, larger pipe, or pressure-regulated heads.`, targets: [z.zoneId], zoneId: z.zoneId });
    if (z.longestPathFt > 250)
      push({ severity: "warning", code: "long-lateral", title: "Unusually long lateral", message: `Zone ${z.number} lateral runs ${z.longestPathFt.toFixed(0)} ft to the farthest head. Consider relocating the valve closer to the zone.`, targets: [z.zoneId], zoneId: z.zoneId });
    if (z.valveId && z.mainlineAssumed && project.waterSources.length)
      push({ severity: "warning", code: "valve-no-mainline", title: "Valve not on mainline", message: `The Zone ${z.number} valve is not connected to the mainline. Draw or auto-route the mainline from the POC to the valve.`, targets: [z.valveId], zoneId: z.zoneId });
    // mixing
    const zh = project.sprinklers.filter((h) => h.zoneId === z.zoneId);
    const classes = new Set(zh.map((h) => precipClass(hyd.heads.get(h.id)!.perf.product.category)));
    const hasDrip = project.drips.some((d) => d.zoneId === z.zoneId) || classes.has("drip");
    if (classes.has("rotor") && (classes.has("spray") || classes.has("rotary")))
      push({ severity: "warning", code: "mixed-types", title: "Rotors mixed with sprays", message: `Zone ${z.number} mixes rotors with spray/rotary nozzles. Their precipitation rates differ greatly — separate them into different zones.`, targets: zh.map((h) => h.id), zoneId: z.zoneId });
    if (hasDrip && zh.some((h) => precipClass(hyd.heads.get(h.id)!.perf.product.category) !== "drip"))
      push({ severity: "warning", code: "drip-mixed", title: "Drip mixed with sprinklers", message: `Zone ${z.number} combines drip with overhead sprinklers. Drip needs filtration, pressure regulation and much longer runtimes.`, targets: [z.zoneId], zoneId: z.zoneId });
    const [lo, hi] = z.precipRange;
    if (lo > 0 && hi / lo > 1.5 && !(classes.has("rotor") && classes.has("spray")))
      push({ severity: "warning", code: "mixed-precip", title: "Mixed precipitation rates", message: `Zone ${z.number} precipitation ranges ${lo.toFixed(2)}–${hi.toFixed(2)} in/hr. Use "Match nozzles" to balance nozzle sizes to each arc.`, targets: zh.filter((h) => { const pr = hyd.heads.get(h.id)!.perf.precipInHr; return pr === lo || pr === hi; }).map((h) => h.id), zoneId: z.zoneId });
    // hydrozones
    const plantTypes = new Set(zh.map((h) => areaAt(project, h.position, isIrrigated)?.type).filter(Boolean));
    if (plantTypes.has("lawn") && (plantTypes.has("bed") || plantTypes.has("planting")))
      push({ severity: "recommendation", code: "hydrozone", title: "Zone crosses hydrozones", message: `Zone ${z.number} waters both lawn and planting beds. Turf and shrubs have different water needs — consider separate zones (hydrozoning).`, targets: [z.zoneId], zoneId: z.zoneId });
    void zone;
  }
  // similar zones (grouped): same precipitation rate (±10%) and hydrozone
  const byPr = hyd.zones.filter((z) => z.avgPrecip > 0);
  const used = new Set<string>();
  for (const a of byPr) {
    if (used.has(a.zoneId)) continue;
    const za = zoneById.get(a.zoneId)!;
    const group = byPr.filter((b) => {
      const zb = zoneById.get(b.zoneId)!;
      return !used.has(b.zoneId) && Math.abs(a.avgPrecip - b.avgPrecip) / Math.max(a.avgPrecip, b.avgPrecip) < 0.1 && za.plantType === zb.plantType && za.sun === zb.sun;
    });
    if (group.length < 2) continue;
    group.forEach((g) => used.add(g.zoneId));
    const nums = group.map((g) => g.number);
    const list = nums.length === 2 ? `${nums[0]} and ${nums[1]}` : `${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
    push({ severity: "recommendation", code: "similar-zones", title: "Zones can share a schedule", message: `Zones ${list} use the same precipitation rate (~${a.avgPrecip.toFixed(2)} in/hr) and plant type and could be scheduled similarly.`, targets: group.map((g) => g.zoneId) });
  }

  // ---------- Heads ----------
  const heads = project.sprinklers;
  for (const h of heads) {
    const hr = hyd.heads.get(h.id)!;
    const cat = hr.perf.product.category;
    const isOverhead = cat !== "emitter" && cat !== "bubbler";
    if (hr.status === "disconnected")
      push({ severity: "error", code: "disconnected-head", title: "Disconnected sprinkler", message: `${lbl(h.id)} is not connected to any lateral pipe.`, targets: [h.id], location: h.position, zoneId: h.zoneId });
    else if (hr.status === "no-zone")
      push({ severity: "warning", code: "no-zone", title: "Sprinkler not assigned to a zone", message: `${lbl(h.id)} is piped but not assigned to a zone. Assign it or run Auto Zone.`, targets: [h.id], location: h.position });
    if (!h.zoneId && hr.status === "disconnected")
      push({ severity: "warning", code: "no-zone", title: "Sprinkler not assigned to a zone", message: `${lbl(h.id)} has no zone.`, targets: [h.id], location: h.position });
    if (hr.status === "below-min" && h.zoneId && hyd.zones.find((z) => z.zoneId === h.zoneId)?.criticalHeadId !== h.id)
      push({ severity: "error", code: "below-min-pressure", title: "Pressure below sprinkler minimum", message: `${lbl(h.id)} receives ${hr.pressure?.toFixed(1)} PSI (minimum ${hr.perf.minPressure} PSI).`, targets: [h.id], location: h.position, zoneId: h.zoneId });
    if (hr.status === "high")
      push({ severity: "recommendation", code: "high-pressure", title: "Pressure above optimum", message: `${lbl(h.id)} operates at ${hr.pressure?.toFixed(1)} PSI. ${cat === "spray" ? "Sprays mist above ~45 PSI — use pressure-regulated (PRS) bodies." : `Above the ${hr.perf.maxPressure} PSI maximum — add pressure regulation.`}`, targets: [h.id], location: h.position, zoneId: h.zoneId });
    if (hr.perf.radiusReduction > hr.perf.product.maxRadiusReduction + 0.01)
      push({ severity: "warning", code: "radius-reduced", title: "Throw reduced too far", message: `${lbl(h.id)} throw is reduced ${(hr.perf.radiusReduction * 100).toFixed(0)}% (${hr.perf.catalogRadius}′ → ${hr.perf.radius.toFixed(1)}′). Reductions over ${(hr.perf.product.maxRadiusReduction * 100).toFixed(0)}% distort distribution — choose a smaller nozzle.`, targets: [h.id], location: h.position });
    // inside building/hardscape
    const inStruct = project.areas.find((a) => (isStructure(a) || isHardscape(a)) && pointInPolygon(h.position, a.points));
    if (inStruct && isOverhead)
      push({ severity: "error", code: "head-in-hardscape", title: "Sprinkler inside building/hardscape", message: `${lbl(h.id)} is located inside ${inStruct.name || inStruct.type}. Move it into the irrigated area.`, targets: [h.id], location: h.position });
    // overspray
    if (isOverhead) {
      for (const o of oversprayFor(project, h, hr.perf)) {
        const bad = o.areaType === "building" ? o.distanceFt > 1 : o.areaType === "property" ? o.distanceFt > 2 : o.distanceFt > 2;
        if (!bad) continue;
        const what = o.areaType === "building" ? "the building" : o.areaType === "property" ? "past the property line" : `the ${o.areaName || o.areaType}`;
        push({ severity: o.distanceFt > 5 || o.areaType === "building" ? "warning" : "recommendation", code: "overspray", title: "Overspray", message: `Sprinkler ${lbl(h.id)} is spraying ${o.distanceFt.toFixed(0)} feet onto ${what}. Adjust the arc, reduce the radius, or relocate the head.`, targets: [h.id, o.areaId], location: h.position, zoneId: h.zoneId });
      }
    }
  }
  // spacing & overlaps
  const overheads = heads.filter((h) => {
    const c = hyd.heads.get(h.id)!.perf.product.category;
    return c !== "emitter" && c !== "bubbler";
  });
  for (let i = 0; i < overheads.length; i++) {
    const a = overheads[i];
    const ra = hyd.heads.get(a.id)!.perf.radius;
    let nearest = Infinity;
    for (let j = 0; j < overheads.length; j++) {
      if (i === j) continue;
      const b = overheads[j];
      const d = dist(a.position, b.position);
      nearest = Math.min(nearest, d);
      if (j > i && d < 1.5) push({ severity: "warning", code: "overlap-heads", title: "Overlapping sprinklers", message: `${lbl(a.id)} and ${lbl(b.id)} are only ${d.toFixed(1)} ft apart.`, targets: [a.id, b.id], location: a.position });
    }
    if (overheads.length > 1 && nearest > ra * 1.1)
      push({ severity: "warning", code: "spacing", title: "Sprinkler spacing too far apart", message: `${lbl(a.id)} throws ${ra.toFixed(0)} ft but its nearest neighbour is ${nearest.toFixed(0)} ft away — no head-to-head coverage.`, targets: [a.id], location: a.position, zoneId: a.zoneId });
  }
  // coverage gaps
  if (coverage) {
    const big = coverage.stats.gapClusters.filter((c) => c.area >= 12);
    const byArea = new Map<string, typeof big>();
    for (const g of big) {
      const k = g.areaId ?? "?";
      byArea.set(k, [...(byArea.get(k) ?? []), g]);
    }
    for (const [aid, gs] of byArea) {
      const area = project.areas.find((a) => a.id === aid);
      const ac = area ? centroid(area.points) : siteCenter;
      const dirWords = [...new Set(gs.map((g) => compass(g.center.x - ac.x, g.center.y - ac.y)))];
      const total = gs.reduce((a, g) => a + g.area, 0);
      push({
        severity: total > 60 ? "warning" : "recommendation",
        code: "coverage-gap",
        title: "Missing head-to-head coverage",
        message: `${gs.length === 1 ? "One area" : `${gs.length} areas`} of the ${dirWords.slice(0, 2).join("/")} ${area?.name?.toLowerCase() || "lawn"} (${total.toFixed(0)} sq ft) do not have head-to-head coverage. Add heads or run Auto Design on the area.`,
        targets: area ? [area.id] : [],
        location: gs[0].center,
      });
    }
    if (coverage.stats.excessivePct > 12)
      push({ severity: "recommendation", code: "excess-overlap", title: "Excessive overlap", message: `${coverage.stats.excessivePct.toFixed(0)}% of the irrigated area receives more than 180% of the median application rate. Check nozzle sizing and spacing.`, targets: [] });
  }

  // ---------- Pipes ----------
  for (const pipe of project.pipes) {
    const pr = hyd.pipes.get(pipe.id);
    if (!pr) continue;
    if ((pipe.kind === "lateral" || pipe.kind === "mainline" || pipe.kind === "drip") && pr.maxVelocity > maxV) {
      const size = pr.sizes[0] ?? pipe.size;
      const zn = pr.zoneIds.length === 1 ? ` serving ${zname(pr.zoneIds[0])}` : "";
      push({ severity: pipe.autoSize ? "warning" : "warning", code: "velocity", title: "Excessive velocity", message: `The ${pipeSizeLabel(size).replace('"', "-inch")} ${pipe.kind}${zn} reaches ${pr.maxVelocity.toFixed(1)} ft/sec. Consider increasing this section to ${pipeSizeLabel(pr.recommendedSize).replace('"', " inch")}.`, targets: [pipe.id], location: pipe.points[0] });
    } else if (!pipe.autoSize && pr.recommendedSize > pipe.size && pr.maxFlow > 0 && pipe.kind !== "sleeve" && pipe.kind !== "wire") {
      push({ severity: "warning", code: "undersized", title: "Undersized pipe", message: `${pipeSizeLabel(pipe.size)} ${pipe.kind} carries ${pr.maxFlow.toFixed(1)} GPM; ${pipeSizeLabel(pr.recommendedSize)} recommended.`, targets: [pipe.id], location: pipe.points[0] });
    }
    if (pipe.kind === "lateral" || pipe.kind === "mainline" || pipe.kind === "drip") {
      const eids = hyd.net.pipeEdges.get(pipe.id) ?? [];
      const hasFlow = eids.some((e) => (hyd.edges.get(e)?.flow ?? 0) > 0);
      if (!hasFlow && polylineLength(pipe.points) > 0.5)
        push({ severity: "warning", code: "disconnected-pipe", title: "Disconnected pipe", message: `A ${polylineLength(pipe.points).toFixed(0)} ft ${pipe.kind} segment carries no flow — it is not connected to a valve${pipe.kind === "mainline" ? "/water source" : " or sprinkler"}.`, targets: [pipe.id], location: pipe.points[0] });
      for (const s of project.areas.filter(isStructure)) {
        for (let i = 0; i < pipe.points.length - 1; i++)
          if (segmentIntersectsPolygon(pipe.points[i], pipe.points[i + 1], s.points)) {
            push({ severity: "error", code: "pipe-through-structure", title: "Pipe crosses a structure", message: `A ${pipe.kind} passes under ${s.name || s.type}. Reroute around it.`, targets: [pipe.id, s.id], location: pipe.points[i] });
            break;
          }
      }
      const sleeves = project.pipes.filter((p) => p.kind === "sleeve");
      for (const h of project.areas.filter(isHardscape)) {
        for (let i = 0; i < pipe.points.length - 1; i++) {
          const a = pipe.points[i];
          const b = pipe.points[i + 1];
          if (!segmentIntersectsPolygon(a, b, h.points)) continue;
          const sleeved = sleeves.some((sl) => sl.points.some((p, k) => k < sl.points.length - 1 && dist(p, a) + dist(p, b) < dist(a, b) + 6));
          if (!sleeved) push({ severity: "recommendation", code: "no-sleeve", title: "Sleeve needed", message: `A ${pipe.kind} crosses ${h.name || h.type} without a sleeve. Add a sleeve (typically 2× pipe size) under the hardscape.`, targets: [pipe.id, h.id], location: a });
          break;
        }
      }
    }
  }

  // ---------- Valves ----------
  for (const v of project.valves) {
    if (v.type === "isolation" || v.type === "prv") continue;
    const zone = project.zones.find((z) => z.valveId === v.id);
    if (v.type !== "master" && !zone)
      push({ severity: "warning", code: "valve-no-zone", title: "Valve not assigned", message: `Valve ${v.name ?? ""} is not assigned to a zone.`, targets: [v.id], location: v.position });
    if (!hyd.net.valveMainNode.has(v.id) && project.pipes.some((p) => p.kind === "mainline"))
      push({ severity: "warning", code: "disconnected-valve", title: "Disconnected valve", message: `Valve ${v.name ?? ""}${zone ? ` (Zone ${zone.number})` : ""} is not connected to the mainline.`, targets: [v.id], location: v.position });
    if (zone && v.type !== "master" && !hyd.net.valveLatNode.has(v.id) && (project.sprinklers.some((h) => h.zoneId === zone.id)))
      push({ severity: "error", code: "valve-no-lateral", title: "Valve has no lateral", message: `Valve ${v.name ?? ""} (Zone ${zone.number}) has no lateral pipe leaving it. Draw laterals or run Auto Route.`, targets: [v.id], location: v.position });
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, recommendation: 2 };
  W.sort((a, b) => order[a.severity] - order[b.severity]);
  return W;
}

export function describeSide(project: Project, p: Vec): string {
  const prop = propertyBoundary(project);
  const c = prop ? centroid(prop.points) : p;
  return compass(p.x - c.x, p.y - c.y);
}

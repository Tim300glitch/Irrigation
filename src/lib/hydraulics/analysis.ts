/**
 * Zone hydraulic analysis.
 *
 * Model (one zone operating at a time, the normal residential design case):
 *   P_poc      = static − meter loss − service-line friction − backflow loss (+ pump), capped by PRV
 *                (or the measured dynamic pressure if supplied, minus backflow)
 *   P_valveIn  = P_poc − mainline friction(path, Q_zone) − elevation(valve − source)
 *   P_valveOut = P_valveIn − valve loss(Q_zone)
 *   P_head     = P_valveOut − lateral friction along path − elevation(head − valve)
 * Friction = Hazen-Williams × (1 + minor-loss allowance).
 * Head flows are taken at nominal catalog pressure (standard design practice).
 * Branched (tree) laterals: flows are exact sums of downstream demand.
 * Looped laterals: flows are balanced with the Hardy-Cross method.
 */
import type { Project, Sprinkler, Valve, WaterSource, Zone } from "../model/types";
import { dist } from "../geometry/geometry";
import { headPerformance, type HeadPerformance } from "../irrigation/sprinkler";
import { dripCalc } from "../irrigation/drip";
import { backflowLossPsi, meterLossPsi, METER_SAFE_FLOW, valveLossPsi } from "./components";
import { elevationLossPsi, flowAtVelocity, frictionLossPsi, velocityFps, bucketTestGpm, HW_EXPONENT } from "./formulas";
import { buildNetwork, component, otherEnd, shortestPath, type Network } from "./network";
import { hwC, insideDiameter, sizesFor } from "./pipes";

export type Status = "good" | "warning" | "error";

export interface EdgeResult {
  edgeId: number;
  pipeId: string;
  flow: number;
  nominal: number;
  insideDia: number;
  velocity: number;
  lossPsi: number;
  length: number;
  zoneIds: string[];
}

export interface HeadResult {
  sprinklerId: string;
  zoneId?: string;
  perf: HeadPerformance;
  connected: boolean;
  pressure?: number;
  requiredPressure: number;
  pathLength?: number;
  status: "ok" | "low" | "below-min" | "high" | "disconnected" | "no-valve" | "no-zone";
}

export interface SourceResult {
  pressure: number;
  meterLoss: number;
  serviceLoss: number;
  backflowLoss: number;
  availableGpm: number;
  availableGpmBasis: string;
}

export interface ZoneResult {
  zoneId: string;
  number: number;
  name: string;
  valveId?: string;
  sourceId?: string;
  gpm: number;
  headCount: number;
  counts: Record<string, number>;
  dripGpm: number;
  source?: SourceResult;
  mainlineLoss: number;
  mainlineLength: number;
  mainlineAssumed: boolean;
  masterValveLoss: number;
  valveLoss: number;
  valveInPressure?: number;
  valveOutPressure?: number;
  elevationLoss: number;
  maxLateralLoss: number;
  criticalHeadId?: string;
  criticalPressure?: number;
  maxHeadPressure?: number;
  avgHeadPressure?: number;
  pressureVariationPct: number;
  maxVelocity: number;
  longestPathFt: number;
  recommendedLateralSize: number;
  avgPrecip: number;
  precipRange: [number, number];
  status: Status;
  issues: string[];
  flowPct: number; // % of available
}

export interface PipeResult {
  pipeId: string;
  length: number;
  maxFlow: number;
  maxVelocity: number;
  lossPsi: number;
  sizes: number[];
  recommendedSize: number;
  zoneIds: string[];
}

export interface HydraulicResult {
  net: Network;
  edges: Map<number, EdgeResult>;
  heads: Map<string, HeadResult>;
  zones: ZoneResult[];
  pipes: Map<string, PipeResult>;
  sources: Map<string, SourceResult>;
  totalGpm: number;
  maxZoneGpm: number;
  status: Status;
}

/** Available flow determination for a source. */
export function availableFlow(src: WaterSource, maxVelocityServiceFps = 7.5): { gpm: number; basis: string } {
  if (src.availableGpm && src.availableGpm > 0) return { gpm: src.availableGpm, basis: "entered" };
  if (src.flowTest && src.flowTest.seconds > 0) return { gpm: bucketTestGpm(src.flowTest.gallons, src.flowTest.seconds), basis: "bucket test" };
  // Meter / service-line based estimate (planning only)
  const candidates: number[] = [];
  if (src.meterSize !== "none") candidates.push(0.75 * METER_SAFE_FLOW[src.meterSize]);
  const sid = insideDiameter(src.serviceLineMaterial, src.serviceLineSize);
  candidates.push(flowAtVelocity(maxVelocityServiceFps, sid));
  return { gpm: Math.min(...candidates), basis: "meter/service estimate" };
}

export function sourcePressure(src: WaterSource, q: number): SourceResult {
  const av = availableFlow(src);
  let meterLoss = 0;
  let serviceLoss = 0;
  let base: number;
  if (src.dynamicPsi && src.dynamicPsi > 0) {
    base = src.dynamicPsi;
  } else {
    meterLoss = meterLossPsi(src.meterSize, q);
    serviceLoss = frictionLossPsi(q, insideDiameter(src.serviceLineMaterial, src.serviceLineSize), hwC(src.serviceLineMaterial), src.serviceLineLengthFt);
    base = src.staticPsi - meterLoss - serviceLoss;
  }
  const backflowLoss = backflowLossPsi(src.backflow, src.backflowSize, q);
  let p = base - backflowLoss + (src.pumpBoostPsi ?? 0);
  if (src.prvSettingPsi && src.prvSettingPsi > 0) p = Math.min(p, src.prvSettingPsi);
  return { pressure: p, meterLoss, serviceLoss, backflowLoss, availableGpm: av.gpm, availableGpmBasis: av.basis };
}

export function requiredPressure(perf: HeadPerformance): number {
  return perf.prsPsi ? perf.prsPsi + 5 : perf.pressure;
}

function autoSizeFor(material: Parameters<typeof sizesFor>[0], flow: number, maxV: number, minSize = 0.5): number {
  const sizes = sizesFor(material);
  for (const s of sizes) if (s >= minSize && velocityFps(flow, insideDiameter(material, s)) <= maxV) return s;
  return sizes[sizes.length - 1];
}

export function recommendedPipeSize(material: Parameters<typeof sizesFor>[0], flow: number, maxV: number): number {
  return autoSizeFor(material, flow, maxV, material.startsWith("pvc") ? 0.75 : 0.5);
}

export function analyzeHydraulics(project: Project): HydraulicResult {
  const net = buildNetwork(project);
  const s = project.settings;
  const maxV = s.maxVelocityFps;
  const minorF = 1 + s.minorLossPct / 100;
  const edges = new Map<number, EdgeResult>();
  const heads = new Map<string, HeadResult>();
  const zones: ZoneResult[] = [];
  const sources = new Map<string, SourceResult>();

  const valveById = new Map(project.valves.map((v) => [v.id, v]));
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const perfs = new Map<string, HeadPerformance>();
  for (const h of project.sprinklers) perfs.set(h.id, headPerformance(h));

  const edgeFlowByZone = new Map<number, Map<string, number>>(); // edge -> zone -> flow
  const setEdgeFlow = (eid: number, zid: string, q: number) => {
    let m = edgeFlowByZone.get(eid);
    if (!m) edgeFlowByZone.set(eid, (m = new Map()));
    m.set(zid, q);
  };

  const effSize = (eid: number): number => {
    const e = net.edges[eid];
    if (!e.autoSize) return e.nominal;
    const flows = edgeFlowByZone.get(eid);
    const q = flows ? Math.max(0, ...[...flows.values()].map(Math.abs)) : 0;
    return autoSizeFor(e.material, q, maxV, e.kind === "mainline" ? 0.75 : e.material.startsWith("pvc") ? 0.75 : 0.5);
  };
  const edgeLoss = (eid: number, q: number) => {
    const e = net.edges[eid];
    const id = insideDiameter(e.material, effSize(eid));
    return frictionLossPsi(Math.abs(q), id, hwC(e.material), e.length) * minorF;
  };

  // ---------- Pass 1: zone flows, lateral flow distribution, mainline paths ----------
  interface ZoneWork {
    zone: Zone;
    valve?: Valve;
    zoneHeads: Sprinkler[];
    gpm: number;
    dripGpm: number;
    latStart?: number;
    demand: Map<number, number>;
    parentEdge: Map<number, number>;
    order: number[];
    loopEdges: number[];
    signedFlow: Map<number, number>; // flow in direction a->b
    mainPath: number[] | null;
    source?: WaterSource;
    headNodeOK: Set<string>;
  }
  const work: ZoneWork[] = [];
  const sortedZones = [...project.zones].sort((a, b) => a.number - b.number);
  for (const zone of sortedZones) {
    const valve = zone.valveId ? valveById.get(zone.valveId) : undefined;
    const zoneHeads = project.sprinklers.filter((h) => h.zoneId === zone.id);
    const zoneDrips = project.drips.filter((d) => d.zoneId === zone.id);
    let gpm = 0;
    for (const h of zoneHeads) gpm += perfs.get(h.id)!.flowGpm;
    let dripGpm = 0;
    for (const d of zoneDrips) dripGpm += dripCalc(d).flowGpm;
    gpm += dripGpm;
    const w: ZoneWork = {
      zone,
      valve,
      zoneHeads,
      gpm,
      dripGpm,
      demand: new Map(),
      parentEdge: new Map(),
      order: [],
      loopEdges: [],
      signedFlow: new Map(),
      mainPath: null,
      headNodeOK: new Set(),
    };
    if (valve) {
      w.latStart = net.valveLatNode.get(valve.id);
      if (w.latStart !== undefined) {
        const comp = component(net, w.latStart);
        for (const h of zoneHeads) {
          const n = net.headNode.get(h.id);
          if (n !== undefined && comp.has(n)) {
            w.demand.set(n, (w.demand.get(n) ?? 0) + perfs.get(h.id)!.flowGpm);
            w.headNodeOK.add(h.id);
          }
        }
        for (const d of zoneDrips) {
          const n = net.dripNode.get(d.id);
          if (n !== undefined && comp.has(n)) w.demand.set(n, (w.demand.get(n) ?? 0) + dripCalc(d).flowGpm);
        }
        // BFS spanning tree
        const seen = new Set<number>([w.latStart]);
        const q = [w.latStart];
        const treeEdges = new Set<number>();
        while (q.length) {
          const n = q.shift()!;
          w.order.push(n);
          for (const eid of net.nodes[n].edges) {
            const o = otherEnd(net.edges[eid], n);
            if (!seen.has(o)) {
              seen.add(o);
              w.parentEdge.set(o, eid);
              treeEdges.add(eid);
              q.push(o);
            }
          }
        }
        const allEdges = new Set<number>();
        for (const n of w.order) for (const eid of net.nodes[n].edges) allEdges.add(eid);
        w.loopEdges = [...allEdges].filter((e) => !treeEdges.has(e));
        // tree flows: post-order accumulation of downstream demand
        const acc = new Map<number, number>();
        for (let i = w.order.length - 1; i >= 0; i--) {
          const n = w.order[i];
          const total = (acc.get(n) ?? 0) + (w.demand.get(n) ?? 0);
          const pe = w.parentEdge.get(n);
          if (pe !== undefined) {
            const e = net.edges[pe];
            const parent = otherEnd(e, n);
            acc.set(parent, (acc.get(parent) ?? 0) + total);
            w.signedFlow.set(pe, e.a === parent ? total : -total);
          }
        }
        for (const le of w.loopEdges) w.signedFlow.set(le, 0);
        for (const [eid, f] of w.signedFlow) setEdgeFlow(eid, zone.id, f);
      }
      // mainline path
      const mainNode = net.valveMainNode.get(valve.id);
      for (const src of project.waterSources) {
        const sn = net.sourceNode.get(src.id);
        if (sn !== undefined && mainNode !== undefined) {
          const path = shortestPath(net, sn, mainNode);
          if (path) {
            w.mainPath = path;
            w.source = src;
            break;
          }
        }
      }
      if (!w.source) {
        // direct connection (valve right at POC) or assumed
        const near = project.waterSources.find((src) => dist(src.position, valve.position) <= 4);
        w.source = near ?? project.waterSources[0];
        if (near) w.mainPath = [];
      }
      if (w.mainPath) for (const eid of w.mainPath) setEdgeFlow(eid, zone.id, w.gpm);
    }
    work.push(w);
  }

  // ---------- Hardy-Cross balancing for looped laterals ----------
  for (const w of work) {
    if (!w.loopEdges.length || w.latStart === undefined) continue;
    const depth = new Map<number, number>();
    for (const n of w.order) {
      const pe = w.parentEdge.get(n);
      depth.set(n, pe === undefined ? 0 : depth.get(otherEnd(net.edges[pe], n))! + 1);
    }
    const pathToRoot = (n: number) => {
      const list: { eid: number; from: number; to: number }[] = [];
      let cur = n;
      while (w.parentEdge.has(cur)) {
        const eid = w.parentEdge.get(cur)!;
        const p = otherEnd(net.edges[eid], cur);
        list.push({ eid, from: p, to: cur });
        cur = p;
      }
      return list;
    };
    // build cycles: loop edge u->v, then v up to LCA, then LCA down to u
    const cycles: { eid: number; dir: 1 | -1 }[][] = [];
    for (const le of w.loopEdges) {
      const e = net.edges[le];
      if (!depth.has(e.a) || !depth.has(e.b)) continue;
      const pa = pathToRoot(e.a);
      const pb = pathToRoot(e.b);
      const setA = new Set(pa.map((x) => x.eid));
      const setB = new Set(pb.map((x) => x.eid));
      const onlyA = pa.filter((x) => !setB.has(x.eid));
      const onlyB = pb.filter((x) => !setA.has(x.eid));
      const cyc: { eid: number; dir: 1 | -1 }[] = [{ eid: le, dir: 1 }]; // traverse a->b
      // from b up to LCA: traversing child->parent (against tree direction)
      for (const x of onlyB) cyc.push({ eid: x.eid, dir: net.edges[x.eid].a === x.to ? 1 : -1 });
      // from LCA down to a: parent->child
      for (const x of [...onlyA].reverse()) cyc.push({ eid: x.eid, dir: net.edges[x.eid].a === x.from ? 1 : -1 });
      cycles.push(cyc);
    }
    for (let iter = 0; iter < 60; iter++) {
      let maxDq = 0;
      for (const cyc of cycles) {
        let num = 0;
        let den = 0;
        for (const { eid, dir } of cyc) {
          const q = (w.signedFlow.get(eid) ?? 0) * dir;
          const h = edgeLoss(eid, q) * Math.sign(q);
          num += h;
          den += Math.abs(q) > 1e-9 ? (HW_EXPONENT * Math.abs(h)) / Math.abs(q) : 0;
        }
        if (den < 1e-12) {
          // no flow yet in loop — seed with small flow on loop edge
          den = 1;
        }
        const dq = -num / den;
        maxDq = Math.max(maxDq, Math.abs(dq));
        for (const { eid, dir } of cyc) w.signedFlow.set(eid, (w.signedFlow.get(eid) ?? 0) + dq * dir);
      }
      if (maxDq < 1e-4) break;
    }
    for (const [eid, f] of w.signedFlow) setEdgeFlow(eid, w.zone.id, f);
  }

  // ---------- Pass 2: pressures ----------
  for (const w of work) {
    const issues: string[] = [];
    const counts: Record<string, number> = {};
    for (const h of w.zoneHeads) {
      const c = perfs.get(h.id)!.product.category;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    let src: SourceResult | undefined;
    let mainlineLoss = 0;
    let mainlineLength = 0;
    let elevationLoss = 0;
    let valveLoss = 0;
    let masterValveLoss = 0;
    let valveIn: number | undefined;
    let valveOut: number | undefined;
    let maxVel = 0;
    const headP: { id: string; p: number; req: number; path: number }[] = [];
    if (w.source) {
      src = sourcePressure(w.source, w.gpm);
      sources.set(w.source.id, sourcePressure(w.source, 0));
    }
    if (w.valve && src) {
      if (w.mainPath) {
        for (const eid of w.mainPath) {
          mainlineLoss += edgeLoss(eid, w.gpm);
          mainlineLength += net.edges[eid].length;
          maxVel = Math.max(maxVel, velocityFps(w.gpm, insideDiameter(net.edges[eid].material, effSize(eid))));
        }
      }
      const master = project.valves.find((v) => v.type === "master");
      if (master) masterValveLoss = master.lossOverridePsi ?? valveLossPsi(master.size, w.gpm, "electric");
      const srcElev = w.source?.elevation ?? 0;
      valveIn = src.pressure - mainlineLoss - masterValveLoss - elevationLossPsi(w.valve.elevation - srcElev);
      valveLoss = w.valve.lossOverridePsi ?? valveLossPsi(w.valve.size, w.gpm, w.valve.type);
      valveOut = valveIn - valveLoss;
      if (w.latStart !== undefined) {
        const P = new Map<number, number>([[w.latStart, valveOut]]);
        const L = new Map<number, number>([[w.latStart, 0]]);
        for (const n of w.order) {
          const pe = w.parentEdge.get(n);
          if (pe === undefined) continue;
          const e = net.edges[pe];
          const parent = otherEnd(e, n);
          const f = w.signedFlow.get(pe) ?? 0;
          const flowParentToChild = e.a === parent ? f : -f;
          const loss = edgeLoss(pe, flowParentToChild);
          P.set(n, P.get(parent)! - Math.sign(flowParentToChild) * loss);
          L.set(n, L.get(parent)! + e.length);
        }
        for (const h of w.zoneHeads) {
          if (!w.headNodeOK.has(h.id)) continue;
          const n = net.headNode.get(h.id)!;
          const perf = perfs.get(h.id)!;
          const elevL = elevationLossPsi(h.elevation - w.valve.elevation);
          const p = (P.get(n) ?? valveOut) - elevL;
          headP.push({ id: h.id, p, req: requiredPressure(perf), path: L.get(n) ?? 0 });
        }
      }
    }
    // edge results + velocities
    for (const [eid, f] of w.signedFlow) {
      maxVel = Math.max(maxVel, velocityFps(f, insideDiameter(net.edges[eid].material, effSize(eid))));
    }
    // heads
    for (const h of w.zoneHeads) {
      const perf = perfs.get(h.id)!;
      const hp = headP.find((x) => x.id === h.id);
      const req = requiredPressure(perf);
      let status: HeadResult["status"] = "ok";
      if (!net.headNode.has(h.id)) status = "disconnected";
      else if (!w.valve || !w.headNodeOK.has(h.id)) status = "no-valve";
      else if (hp) {
        if (hp.p < perf.minPressure) status = "below-min";
        else if (hp.p < req * 0.9) status = "low";
        else if (hp.p > perf.maxPressure || (perf.product.category === "spray" && !perf.prsPsi && hp.p > 45)) status = "high";
      }
      heads.set(h.id, { sprinklerId: h.id, zoneId: w.zone.id, perf, connected: net.headNode.has(h.id), pressure: hp?.p, requiredPressure: req, pathLength: hp?.path, status });
    }
    let critical: (typeof headP)[number] | undefined;
    for (const x of headP) if (!critical || x.p - x.req < critical.p - critical.req) critical = x;
    const ps = headP.map((x) => x.p);
    const maxP = ps.length ? Math.max(...ps) : undefined;
    const minP = ps.length ? Math.min(...ps) : undefined;
    const avgP = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : undefined;
    const designP = headP.length ? headP.reduce((a, b) => a + b.req, 0) / headP.length : 0;
    const variation = maxP !== undefined && minP !== undefined && designP > 0 ? ((maxP - minP) / designP) * 100 : 0;
    const longest = headP.length ? Math.max(...headP.map((x) => x.path)) : 0;
    const maxLat = headP.length && valveOut !== undefined ? Math.max(...headP.map((x) => valveOut! - x.p)) : 0;
    if (critical && w.valve) {
      const h = project.sprinklers.find((x) => x.id === critical!.id)!;
      elevationLoss = elevationLossPsi(h.elevation - (w.source?.elevation ?? 0));
    }
    const prs = w.zoneHeads.map((h) => perfs.get(h.id)!.precipInHr).filter((x) => x > 0);
    const avgPr = prs.length ? prs.reduce((a, b) => a + b, 0) / prs.length : 0;
    const available = src?.availableGpm ?? 0;
    const flowPct = available > 0 ? (w.gpm / available) * 100 : 0;
    const latMaterial = project.settings.lateralMaterial;
    const rec = recommendedPipeSize(latMaterial, w.gpm, maxV);

    let status: Status = "good";
    const bump = (st: Status) => {
      if (st === "error" || (st === "warning" && status === "good")) status = st;
    };
    if (w.zoneHeads.length === 0 && w.dripGpm === 0) {
      issues.push("Zone has no sprinklers or drip areas");
      bump("warning");
    }
    if (!w.valve) {
      issues.push("No valve assigned");
      bump("error");
    } else if (w.latStart === undefined && (w.zoneHeads.length || w.dripGpm)) {
      issues.push("Valve is not connected to a lateral pipe");
      bump("error");
    }
    if (!project.waterSources.length) {
      issues.push("No water source (point of connection) defined");
      bump("error");
    } else if (w.valve && !w.mainPath) {
      issues.push("Valve not connected to the mainline — pressure at valve assumed equal to POC pressure");
      bump("warning");
    }
    const disconnected = w.zoneHeads.filter((h) => !w.headNodeOK.has(h.id)).length;
    if (disconnected && w.valve) {
      issues.push(`${disconnected} head(s) not piped to the zone valve`);
      bump("error");
    }
    if (available > 0 && w.gpm > available * (project.settings.maxZoneFlowPct / 100)) {
      issues.push(`Zone flow ${w.gpm.toFixed(1)} GPM exceeds ${project.settings.maxZoneFlowPct}% of available ${available.toFixed(1)} GPM`);
      bump(w.gpm > available ? "error" : "warning");
    }
    if (critical && critical.p < critical.req * 0.9) {
      const below = critical.p < perfs.get(critical.id)!.minPressure;
      issues.push(`Critical head at ${critical.p.toFixed(1)} PSI (needs ${critical.req.toFixed(0)} PSI)`);
      bump(below ? "error" : "warning");
    }
    if (maxVel > maxV) {
      issues.push(`Velocity ${maxVel.toFixed(1)} ft/s exceeds ${maxV} ft/s`);
      bump("warning");
    }
    if (variation > 20) {
      issues.push(`Pressure variation ${variation.toFixed(0)}% exceeds 20%`);
      bump("warning");
    }
    zones.push({
      zoneId: w.zone.id,
      number: w.zone.number,
      name: w.zone.name,
      valveId: w.valve?.id,
      sourceId: w.source?.id,
      gpm: w.gpm,
      headCount: w.zoneHeads.length,
      counts,
      dripGpm: w.dripGpm,
      source: src,
      mainlineLoss,
      mainlineLength,
      mainlineAssumed: !w.mainPath,
      masterValveLoss,
      valveLoss,
      valveInPressure: valveIn,
      valveOutPressure: valveOut,
      elevationLoss,
      maxLateralLoss: maxLat,
      criticalHeadId: critical?.id,
      criticalPressure: critical?.p,
      maxHeadPressure: maxP,
      avgHeadPressure: avgP,
      pressureVariationPct: variation,
      maxVelocity: maxVel,
      longestPathFt: longest,
      recommendedLateralSize: rec,
      avgPrecip: avgPr,
      precipRange: prs.length ? [Math.min(...prs), Math.max(...prs)] : [0, 0],
      status,
      issues,
      flowPct,
    });
  }

  // heads without zones
  for (const h of project.sprinklers) {
    if (heads.has(h.id)) continue;
    const perf = perfs.get(h.id)!;
    heads.set(h.id, {
      sprinklerId: h.id,
      zoneId: h.zoneId && zoneById.has(h.zoneId) ? h.zoneId : undefined,
      perf,
      connected: net.headNode.has(h.id),
      requiredPressure: requiredPressure(perf),
      status: net.headNode.has(h.id) ? "no-zone" : "disconnected",
    });
  }
  for (const src of project.waterSources) if (!sources.has(src.id)) sources.set(src.id, sourcePressure(src, 0));

  // edge results (max over zones)
  for (const e of net.edges) {
    const flows = edgeFlowByZone.get(e.id);
    let q = 0;
    const zids: string[] = [];
    if (flows)
      for (const [zid, f] of flows) {
        if (Math.abs(f) > 1e-9) zids.push(zid);
        q = Math.max(q, Math.abs(f));
      }
    const nominal = effSize(e.id);
    const id = insideDiameter(e.material, nominal);
    edges.set(e.id, {
      edgeId: e.id,
      pipeId: e.pipeId,
      flow: q,
      nominal,
      insideDia: id,
      velocity: velocityFps(q, id),
      lossPsi: frictionLossPsi(q, id, hwC(e.material), e.length) * minorF,
      length: e.length,
      zoneIds: zids,
    });
  }
  const pipes = new Map<string, PipeResult>();
  for (const pipe of project.pipes) {
    const eids = net.pipeEdges.get(pipe.id) ?? [];
    const rs = eids.map((id) => edges.get(id)!);
    let length = 0;
    for (let i = 0; i < pipe.points.length - 1; i++) length += dist(pipe.points[i], pipe.points[i + 1]);
    const maxFlow = rs.length ? Math.max(...rs.map((r) => r.flow)) : 0;
    pipes.set(pipe.id, {
      pipeId: pipe.id,
      length,
      maxFlow,
      maxVelocity: rs.length ? Math.max(...rs.map((r) => r.velocity)) : 0,
      lossPsi: rs.reduce((a, r) => a + r.lossPsi, 0),
      sizes: [...new Set(rs.map((r) => r.nominal))].sort((a, b) => b - a),
      recommendedSize: recommendedPipeSize(pipe.material, maxFlow, maxV),
      zoneIds: [...new Set(rs.flatMap((r) => r.zoneIds))],
    });
  }

  const totalGpm = zones.reduce((a, z) => a + z.gpm, 0);
  const maxZoneGpm = zones.reduce((a, z) => Math.max(a, z.gpm), 0);
  const status: Status = zones.some((z) => z.status === "error") ? "error" : zones.some((z) => z.status === "warning") ? "warning" : "good";
  return { net, edges, heads, zones, pipes, sources, totalGpm, maxZoneGpm, status };
}

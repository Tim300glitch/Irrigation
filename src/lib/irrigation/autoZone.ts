/**
 * AUTO ZONE — groups heads into valves/zones.
 *
 * Rules:
 *  - Never mixes precipitation classes (rotor / spray / rotary / drip / bubbler).
 *  - Never mixes hydrozones (plant type + sun exposure of the containing area).
 *  - Zone flow ≤ available flow × max-zone-flow % (hydraulic limit).
 *  - Within a group, zones are grown as compact spatial clusters starting
 *    from the heads farthest from the valve location, with balanced flow.
 */
import type { PlantType, Project, SunExposure, SoilType, Valve, Zone } from "../model/types";
import { add, centroid, dist, pointInPolygon, scale, type Vec } from "../geometry/geometry";
import { availableFlow } from "../hydraulics/analysis";
import { headPerformance, precipClass, type PrecipClass } from "./sprinkler";
import { dripCalc } from "./drip";
import { areaAt, isIrrigated, isNoSpray } from "./site";

export const ZONE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#65a30d", "#0d9488", "#b45309"];

export interface AutoZoneOptions {
  maxZoneGpm?: number;
  valveLayout?: "grouped" | "distributed";
  manifoldPosition?: Vec;
}

export interface AutoZoneResult {
  zones: Zone[];
  valves: Valve[];
  assignments: Map<string, string>; // sprinkler/drip id -> zone id
  maxZoneGpm: number;
  notes: string[];
}

interface Item {
  id: string;
  areaId?: string;
  p: Vec;
  q: number;
  cls: PrecipClass;
  plant: PlantType;
  sun: SunExposure;
  soil: SoilType;
  slope: number;
}

export function zoneMaxGpm(project: Project): number {
  const src = project.waterSources[0];
  if (!src) return 12;
  return availableFlow(src).gpm * (project.settings.maxZoneFlowPct / 100);
}

export function autoZone(project: Project, opts: AutoZoneOptions = {}, idGen: () => string): AutoZoneResult {
  const notes: string[] = [];
  const maxGpm = opts.maxZoneGpm ?? zoneMaxGpm(project);
  const items: Item[] = [];
  for (const h of project.sprinklers) {
    const perf = headPerformance(h);
    const area = areaAt(project, h.position, isIrrigated);
    items.push({
      id: h.id,
      areaId: area?.id,
      p: h.position,
      q: perf.flowGpm,
      cls: precipClass(perf.product.category),
      plant: area?.plantType ?? (area?.type === "lawn" ? "cool-turf" : "shrubs"),
      sun: area?.sun ?? "full",
      soil: area?.soil ?? "loam",
      slope: area?.slopePct ?? 0,
    });
  }
  for (const d of project.drips) {
    const c = centroid(d.points);
    const area = areaAt(project, c, isIrrigated);
    items.push({ id: d.id, areaId: area?.id, p: c, q: dripCalc(d).flowGpm, cls: "drip", plant: area?.plantType ?? "shrubs", sun: area?.sun ?? "full", soil: area?.soil ?? "loam", slope: area?.slopePct ?? 0 });
  }
  const src = project.waterSources[0];
  const target = centroidOf(items.map((i) => i.p));
  const hub = opts.manifoldPosition ?? existingManifoldPos(project) ?? (src ? manifoldSpot(project, src.position, target) : target);

  // areas large enough to justify their own valve(s) are zoned separately so a zone
  // never jumps between e.g. the front and back yards
  const areaFlow = new Map<string, number>();
  for (const it of items) if (it.areaId) areaFlow.set(it.areaId, (areaFlow.get(it.areaId) ?? 0) + it.q);
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const own = it.areaId && (areaFlow.get(it.areaId) ?? 0) >= 0.3 * maxGpm;
    const key = `${it.cls}|${it.plant}|${it.sun}${own ? `|${it.areaId}` : ""}`;
    const g = groups.get(key) ?? [];
    g.push(it);
    groups.set(key, g);
  }
  const clusters: { items: Item[]; key: string }[] = [];
  for (const [key, g] of groups) {
    const total = g.reduce((a, i) => a + i.q, 0);
    const oversize = g.filter((i) => i.q > maxGpm);
    if (oversize.length) notes.push(`${oversize.length} item(s) exceed the ${maxGpm.toFixed(1)} GPM zone limit on their own.`);
    // Split into k compact strips along the group's principal axis with balanced flow.
    let k = Math.max(1, Math.ceil(total / maxGpm - 1e-9));
    const axis = principalAxis(g.map((i) => i.p));
    const sorted = [...g].sort((a, b) => proj(a.p, axis) - proj(b.p, axis) || proj(a.p, axis.perp) - proj(b.p, axis.perp));
    for (let attempt = 0; attempt < 8; attempt++) {
      const chunks = splitBalanced(sorted, k, maxGpm);
      if (chunks) {
        for (const c of chunks) clusters.push({ items: c, key });
        break;
      }
      k++;
      if (attempt === 7) for (const it of sorted) clusters.push({ items: [it], key });
    }
  }
  // order zones by distance from hub (far first → zone 1 nearest? use nearest first)
  clusters.sort((a, b) => dist(centroidOf(a.items.map((i) => i.p)), hub) - dist(centroidOf(b.items.map((i) => i.p)), hub));

  const zones: Zone[] = [];
  const valves: Valve[] = [];
  const assignments = new Map<string, string>();
  const layout = opts.valveLayout ?? project.settings.valveLayout;
  const rowDir = manifoldRowDir(project, hub, Math.min(6, clusters.length));
  clusters.forEach((cl, idx) => {
    const zid = idGen();
    const vid = idGen();
    const first = cl.items[0];
    const q = cl.items.reduce((a, i) => a + i.q, 0);
    const isDrip = first.cls === "drip";
    let vpos: Vec;
    if (layout === "grouped") {
      vpos = add(hub, { x: rowDir.x * (idx % 6) * 1.5 + rowDir.y * Math.floor(idx / 6) * 2, y: rowDir.y * (idx % 6) * 1.5 + rowDir.x * Math.floor(idx / 6) * 2 });
    } else {
      // distributed: valve at the cluster edge closest to the hub
      const c = centroidOf(cl.items.map((i) => i.p));
      const nearest = cl.items.reduce((b, i) => (dist(i.p, hub) < dist(b.p, hub) ? i : b), cl.items[0]);
      vpos = add(nearest.p, scale({ x: hub.x - c.x, y: hub.y - c.y }, 2 / Math.max(1, dist(hub, c))));
    }
    valves.push({
      id: vid,
      type: isDrip ? "drip" : "electric",
      position: vpos,
      size: q > 26 ? 1.5 : 1,
      name: `V${idx + 1}`,
      elevation: 0,
      layer: "valves",
    });
    zones.push({
      id: zid,
      number: idx + 1,
      name: `Zone ${idx + 1} — ${labelFor(first)}`,
      color: ZONE_COLORS[idx % ZONE_COLORS.length],
      valveId: vid,
      plantType: first.plant,
      sun: first.sun,
      soil: first.soil,
      slopePct: first.slope,
      schedule: { daysPerWeek: 3 },
    });
    for (const it of cl.items) assignments.set(it.id, zid);
  });
  return { zones, valves, assignments, maxZoneGpm: maxGpm, notes };
}

function principalAxis(ps: Vec[]) {
  const c = centroidOf(ps);
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const p of ps) {
    sxx += (p.x - c.x) ** 2;
    syy += (p.y - c.y) ** 2;
    sxy += (p.x - c.x) * (p.y - c.y);
  }
  const t = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c, dir: { x: Math.cos(t), y: Math.sin(t) }, perp: { c, dir: { x: -Math.sin(t), y: Math.cos(t) } } };
}
function proj(p: Vec, ax: { c: Vec; dir: Vec }) {
  return (p.x - ax.c.x) * ax.dir.x + (p.y - ax.c.y) * ax.dir.y;
}
/** contiguous split of an ordered list into k chunks with flow near total/k and ≤ max */
function splitBalanced(items: Item[], k: number, max: number): Item[][] | null {
  const total = items.reduce((a, i) => a + i.q, 0);
  const target = total / k;
  const out: Item[][] = [];
  let cur: Item[] = [];
  let q = 0;
  let remainingChunks = k;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (cur.length && (q + it.q > max + 1e-9 || (q >= target * 0.98 && remainingChunks > 1 && q + it.q / 2 > target))) {
      out.push(cur);
      remainingChunks--;
      cur = [];
      q = 0;
    }
    cur.push(it);
    q += it.q;
  }
  if (cur.length) out.push(cur);
  if (out.length > k || out.some((c) => c.reduce((a, i) => a + i.q, 0) > max + 1e-9 && c.length > 1)) return null;
  return out;
}

function labelFor(it: Item): string {
  const cls: Record<PrecipClass, string> = { rotor: "Rotors", spray: "Sprays", rotary: "Rotary nozzles", drip: "Drip", bubbler: "Bubblers", impact: "Impacts" };
  const plant = it.plant.includes("turf") ? "Turf" : it.plant === "shrubs" ? "Shrubs" : it.plant;
  return `${plant} ${cls[it.cls]}`;
}

function centroidOf(ps: Vec[]): Vec {
  if (!ps.length) return { x: 0, y: 0 };
  return scale(ps.reduce((a, p) => add(a, p), { x: 0, y: 0 }), 1 / ps.length);
}

const blockedAt = (project: Project, p: Vec) => project.areas.some((a) => (isNoSpray(a) || a.type === "pool") && pointInPolygon(p, a.points));
const onProperty = (project: Project, p: Vec) => {
  const prop = project.areas.find((a) => a.type === "property");
  return !prop || pointInPolygon(p, prop.points);
};

/** A valve-manifold location near the POC that is outside buildings/hardscape. */
function manifoldSpot(project: Project, src: Vec, toward: Vec): Vec {
  const cands: Vec[] = [];
  for (const r of [3, 4.5, 6, 8, 11]) for (let a = 0; a < 360; a += 30) cands.push(add(src, { x: r * Math.cos((a * Math.PI) / 180), y: r * Math.sin((a * Math.PI) / 180) }));
  const ok = cands.filter((c) => !blockedAt(project, c) && onProperty(project, c));
  if (!ok.length) return add(src, { x: 3, y: 3 });
  // prefer close to the POC and on the side facing the irrigated areas
  ok.sort((a, b) => dist(a, src) + 0.15 * dist(a, toward) - (dist(b, src) + 0.15 * dist(b, toward)));
  return ok[0];
}

function manifoldRowDir(project: Project, hub: Vec, n: number): Vec {
  for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
    let fine = true;
    for (let i = 0; i < n; i++) if (blockedAt(project, add(hub, { x: d.x * i * 1.5, y: d.y * i * 1.5 }))) fine = false;
    if (fine) return d;
  }
  return { x: 1, y: 0 };
}

function existingManifoldPos(project: Project): Vec | undefined {
  const m = project.manifolds[0];
  if (!m) return undefined;
  const v = project.valves.find((x) => m.valveIds.includes(x.id));
  return v?.position;
}

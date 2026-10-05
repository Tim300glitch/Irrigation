/**
 * Bridge between the CRM and the Design Studio (engineering plans). A property
 * can link a Design Studio project; its heads, valves, pipes, equipment and
 * site areas can then be imported onto the property's system map, and new
 * design projects can be started from a property.
 */
import type { Project } from "../model/types";
import type { IrrigationSystem, Property, SystemComponent, ComponentType, Zone, Customer } from "./types";
import { getProduct, getNozzle } from "../catalog/sprinklers";
import { projectBounds } from "../plan/planSvg";
import { uid } from "./workflows";
import { customerName } from "./format";

const AREA_MAP: Record<string, ComponentType | undefined> = { lawn: "lawn", building: "structure", driveway: "hardscape", walkway: "hardscape", concrete: "hardscape", patio: "hardscape", deck: "hardscape", pool: "hardscape", bed: "flower_bed", planting: "flower_bed" };
const PIPE_MAP: Record<string, ComponentType> = { mainline: "main_line", lateral: "lateral", drip: "drip_line", sleeve: "sleeve", wire: "wire" };
const HEAD_MAP: Record<string, ComponentType> = { rotor: "rotor", spray: "spray", rotary: "mp_rotator", bubbler: "bubbler", impact: "rotor", emitter: "drip_zone", microspray: "drip_zone", custom: "spray" };
const EQUIP_MAP: Record<string, ComponentType | undefined> = { controller: "controller", "smart-controller": "controller", backflow: "backflow", "valve-box": "valve_box", "flow-meter": "meter", "check-valve": "shutoff", "pressure-regulator": "shutoff", filter: "shutoff" };

export interface ImportResult {
  components: SystemComponent[];
  mapWidth: number;
  mapHeight: number;
  mapFtPerUnit: number;
}

/** Convert a design project into map components (map units, y-down) keeping zones by number. */
export function importDesign(project: Project, sys: IrrigationSystem, zones: Zone[]): ImportResult {
  const b = projectBounds(project, 4);
  const W = 1000;
  const scale = W / (b.maxX - b.minX); // units per ft
  const H = Math.round((b.maxY - b.minY) * scale);
  const P = (p: { x: number; y: number }) => ({ x: +((p.x - b.minX) * scale).toFixed(1), y: +((p.y - b.minY) * scale).toFixed(1) });
  const zoneByNumber = new Map(zones.map((z) => [z.number, z.id]));
  const designZone = new Map(project.zones.map((z) => [z.id, z.number]));
  const zid = (designZoneId?: string) => (designZoneId ? zoneByNumber.get(designZone.get(designZoneId) ?? -1) : undefined);
  const out: SystemComponent[] = [];
  const base = (p: Partial<SystemComponent> & Pick<SystemComponent, "type" | "x" | "y">): SystemComponent => ({ id: uid("cmp"), systemId: sys.id, label: "", size: "", manufacturer: "", model: "", condition: "good", notes: "", ...p });
  for (const a of project.areas) {
    const t = AREA_MAP[a.type];
    if (!t) continue;
    const pts = a.points.map(P);
    out.push(base({ type: t, label: a.name, x: pts[0].x, y: pts[0].y, points: pts }));
  }
  for (const pl of project.plants) if (pl.type === "tree") out.push(base({ type: "tree", label: pl.name || "Tree", ...P(pl.position) }));
  for (const p of project.pipes) {
    const pts = p.points.map(P);
    out.push(base({ type: PIPE_MAP[p.kind] ?? "lateral", label: `${p.kind} ${p.size}"`, x: pts[0].x, y: pts[0].y, points: pts, size: `${p.size}"`, model: p.material.toUpperCase(), zoneId: zid(p.zoneId) }));
  }
  for (const d of project.drips) {
    const pts = d.points.map(P);
    const c = pts.reduce((s, q) => ({ x: s.x + q.x / pts.length, y: s.y + q.y / pts.length }), { x: 0, y: 0 });
    out.push(base({ type: "drip_zone", label: d.name, x: c.x, y: c.y, zoneId: zid(d.zoneId), model: `${d.emitterGph} GPH @ ${d.emitterSpacingIn}"` }));
  }
  for (const s of project.sprinklers) {
    const prod = getProduct(s.productId);
    const noz = getNozzle(prod, s.nozzleId);
    out.push(base({ type: HEAD_MAP[prod.category] ?? "spray", label: s.label ?? "", ...P(s.position), zoneId: zid(s.zoneId), manufacturer: prod.manufacturer, model: `${prod.productLine} ${prod.model}`.trim(), size: `${prod.inletSize}"`, rotation: s.arcStart, sprinkler: { arcDeg: s.arc, radiusFt: s.radiusOverride ?? noz.radius, nozzle: noz.name ?? noz.id, flowGpm: undefined } }));
  }
  const valveZone = new Map(project.zones.filter((z) => z.valveId).map((z) => [z.valveId!, z.number]));
  for (const v of project.valves) out.push(base({ type: "valve", label: v.name ?? `Valve ${valveZone.get(v.id) ?? ""}`.trim(), ...P(v.position), size: `${v.size}"`, zoneId: zoneByNumber.get(valveZone.get(v.id) ?? -1), valve: { valveType: v.type === "master" ? "master" : v.type === "drip" ? "drip" : "inline", flowControl: true, solenoid: "24VAC" } }));
  for (const e of project.equipment) {
    const t = EQUIP_MAP[e.type];
    if (t) out.push(base({ type: t, label: e.label ?? e.type, ...P(e.position), size: e.size ? `${e.size}"` : "" }));
  }
  for (const w of project.waterSources) out.push(base({ type: "meter", label: w.name || "Point of connection", ...P(w.position), size: w.meterSize === "none" ? "" : `${w.meterSize}"` }));
  return { components: out, mapWidth: W, mapHeight: Math.max(300, H), mapFtPerUnit: +(1 / scale).toFixed(4) };
}

/** Design summaries are linked to CRM properties by client name + street. */
export function matchProperty(summaryClient: string, summaryAddress: string, properties: Property[], customers: Customer[]) {
  const street = summaryAddress.split(",")[0].trim().toLowerCase();
  const byId = new Map(customers.map((c) => [c.id, c]));
  return properties.find((p) => p.address.street.toLowerCase() === street) ?? properties.find((p) => customerName(byId.get(p.customerId)).toLowerCase() === summaryClient.toLowerCase());
}

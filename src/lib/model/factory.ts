import type {
  Area,
  AreaType,
  DesignSettings,
  EstimateSettings,
  Layer,
  LayerId,
  LineType,
  Project,
  ProjectMeta,
  Style,
  WaterSource,
} from "./types";
import type { Vec } from "../geometry/geometry";

export const SCHEMA_VERSION = 1;

export function uid(prefix = "o"): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${r}${Date.now().toString(36).slice(-3)}`;
}

export const LAYER_DEFS: { id: LayerId; name: string }[] = [
  { id: "background", name: "Background" },
  { id: "property", name: "Property" },
  { id: "buildings", name: "Buildings" },
  { id: "hardscape", name: "Hardscape" },
  { id: "landscape", name: "Landscape" },
  { id: "planting", name: "Planting" },
  { id: "drip", name: "Drip" },
  { id: "coverage", name: "Coverage" },
  { id: "laterals", name: "Laterals" },
  { id: "mainline", name: "Mainline" },
  { id: "electrical", name: "Electrical" },
  { id: "valves", name: "Valves" },
  { id: "sprinklers", name: "Sprinklers" },
  { id: "measurements", name: "Measurements" },
  { id: "labels", name: "Labels" },
];

export function defaultLayers(): Layer[] {
  return LAYER_DEFS.map((l) => ({ ...l, visible: true, locked: l.id === "background" }));
}

export const AREA_DEFAULTS: Record<AreaType, { name: string; layer: LayerId; style: Style }> = {
  property: { name: "Property boundary", layer: "property", style: { fill: "#ffffff", stroke: "#475569", opacity: 0, strokeWidth: 1.5, pattern: "none", lineStyle: "dashdot" } },
  building: { name: "House", layer: "buildings", style: { fill: "#cbd5e1", stroke: "#334155", opacity: 1, strokeWidth: 1.5, pattern: "hatch", lineStyle: "solid" } },
  lawn: { name: "Lawn", layer: "landscape", style: { fill: "#86efac", stroke: "#16a34a", opacity: 0.55, strokeWidth: 1, pattern: "grass", lineStyle: "solid" } },
  bed: { name: "Planting bed", layer: "planting", style: { fill: "#d6a36b", stroke: "#92400e", opacity: 0.45, strokeWidth: 1, pattern: "dots", lineStyle: "solid" } },
  planting: { name: "Planting area", layer: "planting", style: { fill: "#bbf7d0", stroke: "#15803d", opacity: 0.5, strokeWidth: 1, pattern: "dots", lineStyle: "dashed" } },
  driveway: { name: "Driveway", layer: "hardscape", style: { fill: "#e2e8f0", stroke: "#64748b", opacity: 1, strokeWidth: 1, pattern: "dots", lineStyle: "solid" } },
  walkway: { name: "Paver walkway", layer: "hardscape", style: { fill: "#e7d8c9", stroke: "#8b6f53", opacity: 1, strokeWidth: 1, pattern: "brick", lineStyle: "solid" } },
  concrete: { name: "Concrete", layer: "hardscape", style: { fill: "#e5e7eb", stroke: "#6b7280", opacity: 1, strokeWidth: 1, pattern: "dots", lineStyle: "solid" } },
  patio: { name: "Patio", layer: "hardscape", style: { fill: "#eadfd3", stroke: "#7c6a58", opacity: 1, strokeWidth: 1, pattern: "brick", lineStyle: "solid" } },
  deck: { name: "Deck", layer: "hardscape", style: { fill: "#d9b99b", stroke: "#7c5a3c", opacity: 1, strokeWidth: 1, pattern: "hatch", lineStyle: "solid" } },
  pool: { name: "Pool", layer: "buildings", style: { fill: "#7dd3fc", stroke: "#0369a1", opacity: 0.9, strokeWidth: 1.5, pattern: "solid", lineStyle: "solid" } },
  utility: { name: "Utility area", layer: "hardscape", style: { fill: "#f1f5f9", stroke: "#64748b", opacity: 1, strokeWidth: 1, pattern: "crosshatch", lineStyle: "dashed" } },
  custom: { name: "Area", layer: "landscape", style: { fill: "#fde68a", stroke: "#a16207", opacity: 0.4, strokeWidth: 1, pattern: "solid", lineStyle: "solid" } },
};

export const LINE_DEFAULTS: Record<LineType, { name: string; layer: LayerId; style: Style }> = {
  fence: { name: "Fence", layer: "property", style: { fill: "none", stroke: "#78716c", opacity: 1, strokeWidth: 1.5, pattern: "none", lineStyle: "dashed" } },
  wall: { name: "Retaining wall", layer: "hardscape", style: { fill: "none", stroke: "#44403c", opacity: 1, strokeWidth: 3, pattern: "none", lineStyle: "solid" } },
  hedge: { name: "Hedge", layer: "planting", style: { fill: "none", stroke: "#15803d", opacity: 1, strokeWidth: 4, pattern: "none", lineStyle: "dotted" } },
  custom: { name: "Line", layer: "labels", style: { fill: "none", stroke: "#0f172a", opacity: 1, strokeWidth: 1, pattern: "none", lineStyle: "solid" } },
  "property-line": { name: "Property line", layer: "property", style: { fill: "none", stroke: "#475569", opacity: 1, strokeWidth: 1.5, pattern: "none", lineStyle: "dashdot" } },
};

export function defaultSettings(): DesignSettings {
  return {
    unitSystem: "imperial",
    gridSize: 1,
    gridVisible: true,
    rulersVisible: true,
    snapGrid: true,
    snapVertex: true,
    snapEdge: true,
    snapSprinkler: true,
    angleSnapDeg: 0,
    maxVelocityFps: 5,
    minorLossPct: 10,
    headLabelStyle: "sequential",
    lateralMaterial: "pvc-sch40",
    mainlineMaterial: "pvc-sch40",
    valveLayout: "grouped",
    maxZoneFlowPct: 90,
    showCoverage: true,
    drawingScale: 10,
  };
}

export function defaultEstimate(): EstimateSettings {
  return {
    taxPct: 8.25,
    laborRate: 75,
    equipmentCost: 250,
    markupPct: 25,
    pipeWastePct: 10,
    manualItems: [],
    removedKeys: [],
    qtyOverrides: {},
    priceOverrides: {},
    customerMode: false,
  };
}

export function defaultMeta(partial: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    name: "Untitled Project",
    client: "",
    address: "",
    designer: "",
    company: "DeltaLine Irrigation",
    phone: "",
    email: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    status: "design",
    projectType: "new-install",
    planNotes: [
      "Verify all utility locations before trenching (call 811).",
      "Laterals 12\" min. cover; mainline 18\" min. cover.",
      "Adjust arcs and radii to minimize overspray onto hardscape.",
      "Flush all lines before installing nozzles.",
    ],
    ...partial,
  };
}

export function createProject(meta: Partial<ProjectMeta> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: uid("prj"),
    schemaVersion: SCHEMA_VERSION,
    meta: defaultMeta(meta),
    createdAt: now,
    updatedAt: now,
    settings: defaultSettings(),
    layers: defaultLayers(),
    areas: [],
    lines: [],
    plants: [],
    labels: [],
    dimensions: [],
    sprinklers: [],
    drips: [],
    pipes: [],
    valves: [],
    manifolds: [],
    fittings: [],
    equipment: [],
    waterSources: [],
    zones: [],
    estimate: defaultEstimate(),
    comparison: { currentSystemType: "spray", currentController: "timer", smartControllerSavingsPct: 15, climate: "ca-inland" },
  };
}

export function makeArea(type: AreaType, points: Vec[], name?: string): Area {
  const d = AREA_DEFAULTS[type];
  const a: Area = { id: uid("area"), type, name: name ?? d.name, points, style: { ...d.style }, layer: d.layer, showLabel: type !== "property" };
  if (type === "lawn") Object.assign(a, { plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0 });
  if (type === "bed" || type === "planting") Object.assign(a, { plantType: "shrubs", sun: "full", soil: "loam", slopePct: 0 });
  return a;
}

export function makeWaterSource(position: Vec, partial: Partial<WaterSource> = {}): WaterSource {
  return {
    id: uid("poc"),
    name: "POC-1",
    position,
    staticPsi: 65,
    meterSize: "3/4",
    serviceLineSize: 1,
    serviceLineLengthFt: 50,
    serviceLineMaterial: "pvc-sch40",
    mainlineSize: 1,
    elevation: 0,
    backflow: "pvb",
    backflowSize: 1,
    layer: "mainline",
    ...partial,
  };
}

export function rect(x: number, y: number, w: number, h: number): Vec[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Bring older saved projects up to the current schema. */
export function migrateProject(p: Project): Project {
  const base = createProject();
  const out: Project = {
    ...base,
    ...p,
    meta: { ...base.meta, ...p.meta },
    settings: { ...base.settings, ...p.settings },
    estimate: { ...base.estimate, ...p.estimate },
    comparison: { ...base.comparison, ...p.comparison },
    layers: base.layers.map((l) => p.layers?.find((x) => x.id === l.id) ?? l),
  };
  for (const k of ["areas", "lines", "plants", "labels", "dimensions", "sprinklers", "drips", "pipes", "valves", "manifolds", "fittings", "equipment", "waterSources", "zones"] as const) {
    (out as unknown as Record<string, unknown[]>)[k] = (p as unknown as Record<string, unknown[]>)[k] ?? [];
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

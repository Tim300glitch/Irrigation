/**
 * DeltaLine data model. Every object placed on the canvas carries real
 * engineering data (flows, sizes, pressures), not just drawing geometry.
 * All lengths are in feet, positions in world feet, pressures in PSI,
 * flows in GPM unless a field name says otherwise.
 */
import type { Vec } from "../geometry/geometry";
import type { UnitSystem } from "../units/units";

export type Id = string;

export type LayerId =
  | "background"
  | "property"
  | "buildings"
  | "hardscape"
  | "landscape"
  | "planting"
  | "sprinklers"
  | "coverage"
  | "laterals"
  | "mainline"
  | "drip"
  | "valves"
  | "electrical"
  | "measurements"
  | "labels";

export interface Layer {
  id: LayerId;
  name: string;
  visible: boolean;
  locked: boolean;
}

export type ProjectStatus = "lead" | "site-survey" | "design" | "quoted" | "approved" | "installation" | "completed";
export type ProjectType = "new-install" | "renovation" | "repair" | "drip-conversion" | "audit";

export interface ProjectMeta {
  name: string;
  client: string;
  customerId?: Id;
  address: string;
  designer: string;
  company: string;
  phone: string;
  email: string;
  date: string; // ISO date
  notes: string;
  status: ProjectStatus;
  projectType: ProjectType;
  planNotes: string[];
}

export type FillPattern = "solid" | "none" | "hatch" | "crosshatch" | "dots" | "grass" | "brick";
export type LineStyle = "solid" | "dashed" | "dotted" | "dashdot";

export interface Style {
  fill: string;
  stroke: string;
  opacity: number; // fill opacity 0..1
  strokeWidth: number; // screen px at 100% print
  pattern: FillPattern;
  lineStyle: LineStyle;
}

export type AreaType =
  | "property"
  | "building"
  | "lawn"
  | "bed"
  | "planting"
  | "driveway"
  | "walkway"
  | "concrete"
  | "patio"
  | "deck"
  | "pool"
  | "utility"
  | "custom";

export type PlantType = "cool-turf" | "warm-turf" | "shrubs" | "groundcover" | "trees" | "low-water" | "annuals";
export type SunExposure = "full" | "partial" | "shade";
export type SoilType = "sand" | "sandy-loam" | "loam" | "clay-loam" | "clay";

export interface Area {
  id: Id;
  type: AreaType;
  name: string;
  points: Vec[];
  style: Style;
  layer: LayerId;
  showLabel: boolean;
  /** hydrozone attributes (for lawn / beds) */
  plantType?: PlantType;
  sun?: SunExposure;
  soil?: SoilType;
  slopePct?: number;
  locked?: boolean;
}

export type LineType = "fence" | "wall" | "hedge" | "custom" | "property-line";

export interface LineObj {
  id: Id;
  type: LineType;
  name: string;
  points: Vec[];
  style: Style;
  layer: LayerId;
  locked?: boolean;
}

export interface Plant {
  id: Id;
  type: "tree" | "shrub";
  name: string;
  position: Vec;
  canopyRadius: number;
  layer: LayerId;
  locked?: boolean;
}

export interface TextLabel {
  id: Id;
  position: Vec;
  text: string;
  size: number; // text height in feet (scales with drawing)
  rotation: number;
  color: string;
  layer: LayerId;
  locked?: boolean;
}

/** A named survey/benchmark point that locations are measured from (e.g. "RP1 — NW house corner"). */
export interface RefPoint {
  id: Id;
  name: string;
  position: Vec;
  /** measurements, rulers and cursor coordinates are shown relative to this point */
  isOrigin?: boolean;
  layer: LayerId;
  locked?: boolean;
}

export type DimensionKind = "aligned" | "horizontal" | "vertical";

export interface Dimension {
  id: Id;
  kind: DimensionKind;
  a: Vec;
  b: Vec;
  offset: number; // feet, perpendicular offset of dimension line
  layer: LayerId;
  locked?: boolean;
}

export type SprinklerCategory = "rotor" | "spray" | "rotary" | "bubbler" | "impact" | "emitter" | "microspray" | "custom";

export interface Sprinkler {
  id: Id;
  position: Vec;
  productId: Id;
  nozzleId: Id;
  /** start direction of the arc sweep, degrees (0 = east, clockwise on screen) */
  arcStart: number;
  arc: number; // degrees of sweep 1..360
  /** Adjusted throw distance (ft). undefined = nozzle catalog radius. */
  radiusOverride?: number;
  zoneId?: Id;
  elevation: number; // ft relative to site datum
  label?: string;
  layer: LayerId;
  locked?: boolean;
  /** custom head data (category "custom") */
  custom?: { radius: number; flowGpm: number; pressure: number; minPressure: number; maxPressure: number };
  /** user allowed spraying onto hardscape (suppresses overspray warnings) */
  oversprayOk?: boolean;
}

export interface DripArea {
  id: Id;
  name: string;
  points: Vec[];
  productId: Id; // dripline product
  rowSpacingIn: number;
  emitterSpacingIn: number;
  emitterGph: number;
  zoneId?: Id;
  layer: LayerId;
  locked?: boolean;
}

export type PipeKind = "mainline" | "lateral" | "drip" | "sleeve" | "wire";
export type PipeMaterial = "pvc-sch40" | "pvc-cl200" | "pvc-cl315" | "poly-100" | "funny-pipe" | "drip-tubing";

export interface Pipe {
  id: Id;
  kind: PipeKind;
  points: Vec[];
  material: PipeMaterial;
  /** nominal size in inches (used when autoSize = false, or as last size) */
  size: number;
  autoSize: boolean;
  /** lateral/drip pipes: zone membership. Pipes of different zones never connect hydraulically. */
  zoneId?: Id;
  layer: LayerId;
  locked?: boolean;
  /** for wire: number of conductors */
  conductors?: number;
}

export type ValveType = "electric" | "master" | "drip" | "prv" | "isolation";

export interface Valve {
  id: Id;
  type: ValveType;
  position: Vec;
  size: number; // nominal inches
  name?: string;
  manifoldId?: Id;
  elevation: number;
  layer: LayerId;
  locked?: boolean;
  /** optional override of friction loss at design flow (psi) */
  lossOverridePsi?: number;
}

export interface Manifold {
  id: Id;
  name: string;
  valveIds: Id[];
}

export type FittingType =
  | "tee"
  | "cross"
  | "elbow90"
  | "elbow45"
  | "coupling"
  | "reducer"
  | "cap"
  | "male-adapter"
  | "female-adapter"
  | "union"
  | "swing-joint";

export interface Fitting {
  id: Id;
  type: FittingType;
  position: Vec;
  size: number;
  rotation: number;
  layer: LayerId;
  locked?: boolean;
}

export type EquipmentType =
  | "backflow"
  | "pressure-regulator"
  | "filter"
  | "check-valve"
  | "quick-coupler"
  | "hose-bib"
  | "pump"
  | "controller"
  | "smart-controller"
  | "rain-sensor"
  | "flow-meter"
  | "valve-box";

export interface Equipment {
  id: Id;
  type: EquipmentType;
  position: Vec;
  size?: number;
  label?: string;
  stations?: number; // controllers
  layer: LayerId;
  locked?: boolean;
}

export type MeterSize = "none" | "5/8" | "3/4" | "1" | "1-1/2" | "2";
export type BackflowType = "none" | "pvb" | "rp" | "dcva" | "avb";

export interface WaterSource {
  id: Id;
  name: string;
  position: Vec;
  staticPsi: number;
  /** measured working (dynamic) pressure at POC at the measured flow. If set it is
   *  used as the POC pressure and service/meter losses are assumed already included. */
  dynamicPsi?: number;
  availableGpm?: number;
  flowTest?: { gallons: number; seconds: number };
  meterSize: MeterSize;
  serviceLineSize: number;
  serviceLineLengthFt: number;
  serviceLineMaterial: PipeMaterial;
  mainlineSize: number;
  elevation: number;
  backflow: BackflowType;
  backflowSize: number;
  pumpBoostPsi?: number;
  prvSettingPsi?: number;
  layer: LayerId;
  locked?: boolean;
}

export interface ZoneSchedule {
  daysPerWeek: number;
  /** manual runtime override in minutes per watering day */
  runtimeOverrideMin?: number;
  efficiencyOverride?: number;
}

export interface Zone {
  id: Id;
  number: number;
  name: string;
  color: string;
  valveId?: Id;
  plantType: PlantType;
  sun: SunExposure;
  soil: SoilType;
  slopePct: number;
  schedule: ZoneSchedule;
  notes?: string;
}

export interface Background {
  dataUrl: string;
  kind: "image" | "pdf" | "aerial";
  x: number;
  y: number;
  pxWidth: number;
  pxHeight: number;
  /** feet per image pixel (from calibration) */
  ftPerPx: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  attribution?: string;
}

export interface CostItem {
  id: Id;
  key?: string; // takeoff key when derived
  category: string;
  item: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface EstimateSettings {
  taxPct: number;
  laborRate: number;
  /** undefined = auto-estimate labor hours from design quantities */
  laborHoursOverride?: number;
  equipmentCost: number;
  markupPct: number;
  pipeWastePct: number;
  manualItems: CostItem[];
  removedKeys: string[];
  qtyOverrides: Record<string, number>;
  priceOverrides: Record<string, number>;
  /** customer-facing view hides markup and internal costs */
  customerMode: boolean;
}

export interface ComparisonSettings {
  /** description of the existing system for water-savings comparison */
  currentSystemType: "spray" | "rotor" | "impact" | "mixed";
  currentController: "timer" | "smart";
  currentRuntimeMinPerWeek?: number;
  currentGpm?: number;
  smartControllerSavingsPct: number;
  climate: ClimateId;
}

export type ClimateId = "ca-coastal" | "ca-inland" | "ca-desert" | "pacific-nw" | "southwest" | "southeast" | "midwest" | "northeast";

export interface DesignSettings {
  unitSystem: UnitSystem;
  gridSize: number; // ft
  gridVisible: boolean;
  rulersVisible: boolean;
  snapGrid: boolean;
  snapVertex: boolean;
  snapEdge: boolean;
  snapSprinkler: boolean;
  angleSnapDeg: number; // 0 = off
  maxVelocityFps: number;
  minorLossPct: number; // fitting/minor loss allowance as % of friction loss
  headLabelStyle: "sequential" | "zone";
  lateralMaterial: PipeMaterial;
  mainlineMaterial: PipeMaterial;
  valveLayout: "grouped" | "distributed";
  maxZoneFlowPct: number; // % of available flow a single zone may use
  showCoverage: boolean;
  drawingScale: number; // plan scale, feet per inch on paper (e.g. 10 => 1" = 10')
}

export interface Project {
  id: Id;
  schemaVersion: number;
  meta: ProjectMeta;
  createdAt: string;
  updatedAt: string;
  settings: DesignSettings;
  layers: Layer[];
  background?: Background;
  areas: Area[];
  lines: LineObj[];
  plants: Plant[];
  labels: TextLabel[];
  dimensions: Dimension[];
  refPoints: RefPoint[];
  sprinklers: Sprinkler[];
  drips: DripArea[];
  pipes: Pipe[];
  valves: Valve[];
  manifolds: Manifold[];
  fittings: Fitting[];
  equipment: Equipment[];
  waterSources: WaterSource[];
  zones: Zone[];
  estimate: EstimateSettings;
  comparison: ComparisonSettings;
}

/** Collections that hold canvas objects, used for generic select/move/delete. */
export const OBJECT_COLLECTIONS = [
  "areas",
  "lines",
  "plants",
  "labels",
  "dimensions",
  "sprinklers",
  "drips",
  "pipes",
  "valves",
  "fittings",
  "equipment",
  "waterSources",
  "refPoints",
] as const;
export type ObjectCollection = (typeof OBJECT_COLLECTIONS)[number];

export type AnyObject =
  | Area
  | LineObj
  | Plant
  | TextLabel
  | Dimension
  | Sprinkler
  | DripArea
  | Pipe
  | Valve
  | Fitting
  | Equipment
  | WaterSource
  | RefPoint;

/** Lightweight summary persisted alongside a project for dashboard use. */
export interface ProjectSummary {
  id: Id;
  name: string;
  client: string;
  address: string;
  status: ProjectStatus;
  projectType: ProjectType;
  createdAt: string;
  updatedAt: string;
  zoneCount: number;
  headCount: number;
  irrigatedArea: number;
  estimateTotal: number;
  errorCount: number;
  warningCount: number;
  lowPressureCount: number;
  hydraulicIssueCount: number;
  missingPriceCount: number;
  thumbnailSvg?: string;
}

export interface Customer {
  id: Id;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: Id;
  projectId?: Id;
  projectName?: string;
  message: string;
  at: string;
}

export interface MaterialProduct {
  id: Id;
  brand: string;
  sku: string;
  category: "pipe" | "sprinklers" | "nozzles" | "valves" | "fittings" | "drip" | "wire" | "controllers" | "backflow" | "boxes" | "misc" | "labor";
  description: string;
  pipeSize?: string;
  unit: string;
  price: number;
  supplier: string;
  notes: string;
  /** takeoff key this product prices (e.g. "pipe:pvc-sch40:1") */
  matchKey?: string;
  updatedAt: string;
}

export interface QuickEstimate {
  id: Id;
  name: string;
  customer: string;
  address: string;
  kind: "repair" | "install" | "other";
  items: CostItem[];
  laborHours: number;
  laborRate: number;
  taxPct: number;
  markupPct: number;
  status: "draft" | "sent" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
}

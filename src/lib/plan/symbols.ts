/** Shared plan symbology (used by the interactive canvas and printed plans). */
import type { AreaType, EquipmentType, FittingType, PipeKind, SprinklerCategory } from "../model/types";

export const PIPE_STYLE: Record<PipeKind, { color: string; width: number; dash?: string; label: string }> = {
  mainline: { color: "#7c3aed", width: 3.2, label: "Mainline (pressurized)" },
  lateral: { color: "#0f172a", width: 1.8, label: "Lateral (non-pressurized)" },
  drip: { color: "#0d9488", width: 1.6, dash: "6 3", label: "Drip supply / tubing" },
  sleeve: { color: "#64748b", width: 7, label: "Sleeve" },
  wire: { color: "#ea580c", width: 1.1, dash: "8 3 2 3", label: "Control wire" },
};

export const HEAD_ABBR: Record<SprinklerCategory, string> = {
  rotor: "R",
  spray: "S",
  rotary: "N",
  bubbler: "B",
  impact: "I",
  emitter: "E",
  microspray: "M",
  custom: "H",
};

export const HEAD_NAMES: Record<SprinklerCategory, string> = {
  rotor: "Gear-driven rotor",
  spray: "Spray head",
  rotary: "Rotary nozzle",
  bubbler: "Bubbler",
  impact: "Impact sprinkler",
  emitter: "Drip emitter",
  microspray: "Micro-spray",
  custom: "Custom sprinkler",
};

export const EQUIPMENT_ABBR: Record<EquipmentType, string> = {
  backflow: "BF",
  "pressure-regulator": "PR",
  filter: "F",
  "check-valve": "CV",
  "quick-coupler": "QC",
  "hose-bib": "HB",
  pump: "P",
  controller: "C",
  "smart-controller": "SC",
  "rain-sensor": "RS",
  "flow-meter": "FM",
  "valve-box": "VB",
};

export const EQUIPMENT_NAMES: Record<EquipmentType, string> = {
  backflow: "Backflow preventer",
  "pressure-regulator": "Pressure regulator",
  filter: "Filter",
  "check-valve": "Check valve",
  "quick-coupler": "Quick coupler",
  "hose-bib": "Hose bib",
  pump: "Pump",
  controller: "Controller",
  "smart-controller": "Smart controller",
  "rain-sensor": "Rain sensor",
  "flow-meter": "Flow meter",
  "valve-box": "Valve box",
};

export interface FittingDef {
  type: FittingType;
  /** short name on the tool palette / properties */
  label: string;
  /** plan symbol text (max ~3 chars) */
  abbr: string;
  /** takeoff / price-list description */
  takeoffName: string;
  group: "slip" | "threaded";
}

/** Every fitting the designer can place. FPT = female thread, MPT = male thread, S = slip (glue). */
export const FITTING_DEFS: FittingDef[] = [
  { type: "tee", label: "Tee", abbr: "T", takeoffName: "Tee (slip)", group: "slip" },
  { type: "elbow90", label: "90° Elbow", abbr: "90", takeoffName: "Ell 90° (slip)", group: "slip" },
  { type: "elbow45", label: "45° Elbow", abbr: "45", takeoffName: "Ell 45° (slip)", group: "slip" },
  { type: "coupling", label: "Coupling", abbr: "C", takeoffName: "Coupling (slip)", group: "slip" },
  { type: "reducer", label: "Reducer", abbr: "RD", takeoffName: "Reducer bushing", group: "slip" },
  { type: "cap", label: "Cap", abbr: "CAP", takeoffName: "Cap (slip)", group: "slip" },
  { type: "cross", label: "Cross", abbr: "X", takeoffName: "Cross", group: "slip" },
  { type: "male-adapter", label: "Male adapter", abbr: "MA", takeoffName: "Male adapter slip×MPT", group: "threaded" },
  { type: "female-adapter", label: "Female adapter", abbr: "FA", takeoffName: "Female adapter slip×FPT", group: "threaded" },
  { type: "tee-fpt", label: "Tee S×S×FPT", abbr: "TF", takeoffName: "Tee slip×slip×FPT", group: "threaded" },
  { type: "tee-thread", label: "Tee all-thread", abbr: "TT", takeoffName: "Tee FPT×FPT×FPT", group: "threaded" },
  { type: "ell-fpt", label: "90° Ell S×FPT", abbr: "9F", takeoffName: "Ell 90° slip×FPT", group: "threaded" },
  { type: "elbow90-thread", label: "90° Ell FPT×FPT", abbr: "9T", takeoffName: "Ell 90° FPT×FPT", group: "threaded" },
  { type: "street-elbow90", label: "90° Street ell", abbr: "S90", takeoffName: "Street ell 90° MPT×FPT", group: "threaded" },
  { type: "elbow45-thread", label: "45° Ell FPT×FPT", abbr: "4T", takeoffName: "Ell 45° FPT×FPT", group: "threaded" },
  { type: "street-elbow45", label: "45° Street ell", abbr: "S45", takeoffName: "Street ell 45° MPT×FPT", group: "threaded" },
  { type: "coupling-thread", label: "Coupling FPT×FPT", abbr: "CT", takeoffName: "Coupling FPT×FPT", group: "threaded" },
  { type: "reducer-bushing-thread", label: "Bushing MPT×FPT", abbr: "RB", takeoffName: "Reducer bushing MPT×FPT", group: "threaded" },
  { type: "cap-thread", label: "Cap FPT", abbr: "CF", takeoffName: "Cap FPT", group: "threaded" },
  { type: "plug", label: "Plug MPT", abbr: "PL", takeoffName: "Plug MPT", group: "threaded" },
  { type: "nipple", label: "Nipple", abbr: "NP", takeoffName: "Nipple MPT×MPT", group: "threaded" },
  { type: "close-nipple", label: "Close nipple", abbr: "CN", takeoffName: "Close nipple MPT×MPT", group: "threaded" },
  { type: "hex-nipple", label: "Hex nipple", abbr: "HN", takeoffName: "Hex nipple MPT×MPT", group: "threaded" },
  { type: "riser-nipple", label: "Riser nipple", abbr: "RN", takeoffName: "Riser / cut-off nipple MPT", group: "threaded" },
  { type: "cross-thread", label: "Cross FPT", abbr: "XT", takeoffName: "Cross FPT×FPT×FPT×FPT", group: "threaded" },
  { type: "union", label: "Union", abbr: "U", takeoffName: "Union", group: "threaded" },
  { type: "union-thread", label: "Union FPT×FPT", abbr: "UT", takeoffName: "Union FPT×FPT", group: "threaded" },
  { type: "barb-ell", label: "Barb ell × MPT", abbr: "BE", takeoffName: "Barbed ell × MPT", group: "threaded" },
  { type: "barb-adapter", label: "Barb × MPT adapter", abbr: "BA", takeoffName: "Barbed × MPT adapter", group: "threaded" },
  { type: "swing-joint", label: "Swing joint", abbr: "SJ", takeoffName: "Swing joint assembly", group: "threaded" },
];

export const FITTING_ABBR = Object.fromEntries(FITTING_DEFS.map((f) => [f.type, f.abbr])) as Record<FittingType, string>;
export const FITTING_LABELS = Object.fromEntries(FITTING_DEFS.map((f) => [f.type, f.label])) as Record<FittingType, string>;

export const AREA_LABELS: Record<AreaType, string> = {
  property: "Property boundary",
  building: "House / building",
  lawn: "Lawn",
  bed: "Flower bed",
  planting: "Planting area",
  driveway: "Driveway",
  walkway: "Paver walkway",
  concrete: "Concrete",
  patio: "Patio",
  deck: "Deck",
  pool: "Pool",
  utility: "Utility area",
  custom: "Custom area",
};

/** Ink-saver fill patterns by area type */
export const INK_PATTERN: Partial<Record<AreaType, string>> = {
  building: "hatch",
  lawn: "grass",
  bed: "dots",
  planting: "dots",
  driveway: "dotsfine",
  concrete: "dotsfine",
  walkway: "brick",
  patio: "brick",
  deck: "hatchh",
  pool: "waves",
  utility: "crosshatch",
};

export function arcPath(cx: number, cy: number, r: number, start: number, arc: number): string {
  if (arc >= 359.9) return `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start + arc) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${arc > 180 ? 1 : 0},1 ${x1},${y1} Z`;
}

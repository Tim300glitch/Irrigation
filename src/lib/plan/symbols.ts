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

export const FITTING_ABBR: Record<FittingType, string> = {
  tee: "T",
  cross: "X",
  elbow90: "90",
  elbow45: "45",
  coupling: "C",
  reducer: "RD",
  cap: "CAP",
  "male-adapter": "MA",
  "female-adapter": "FA",
  union: "U",
  "swing-joint": "SJ",
};

export const FITTING_LABELS: Record<FittingType, string> = {
  tee: "Tee",
  cross: "Cross",
  elbow90: "90° Elbow",
  elbow45: "45° Elbow",
  coupling: "Coupling",
  reducer: "Reducer",
  cap: "Cap",
  "male-adapter": "Male adapter",
  "female-adapter": "Female adapter",
  union: "Union",
  "swing-joint": "Swing joint",
};

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

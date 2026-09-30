/**
 * Sprinkler / nozzle product database.
 *
 * The built-in entries are GENERIC products whose performance values are
 * representative of common residential equipment classes (gear rotors,
 * 4" spray bodies with variable-arc nozzles, multi-stream rotary nozzles, etc.).
 * They are NOT copied manufacturer data. The schema is designed so manufacturer
 * catalogs (Hunter, Rain Bird, Toro, K-Rain...) can be loaded as additional
 * `SprinklerProduct` records via `registerCatalog()` without code changes.
 *
 * Conventions:
 *  - `flowGpm` is at `pressure` (psi).
 *  - For `matchedPrecip` products (spray VAN, rotary nozzles) `flowGpm` is the
 *    FULL-CIRCLE flow and actual flow scales with arc/360.
 *  - For rotors / impacts the nozzle flow is independent of the arc setting;
 *    the designer matches precipitation by choosing nozzles per arc.
 */
import type { SprinklerCategory } from "../model/types";

export interface Nozzle {
  id: string;
  name: string;
  radius: number; // ft at nominal pressure
  flowGpm: number; // gpm at nominal pressure (full circle if matchedPrecip)
  pressure: number; // nominal operating pressure psi
  trajectory: number; // degrees
}

export interface SprinklerProduct {
  id: string;
  manufacturer: string;
  productLine: string;
  model: string;
  category: SprinklerCategory;
  inletSize: number; // inches NPT
  minPressure: number;
  maxPressure: number;
  /** built-in pressure regulation setpoint (psi) if any */
  prsPsi?: number;
  arcAdjustable: boolean;
  arcMin: number;
  arcMax: number;
  matchedPrecip: boolean;
  /** max recommended radius reduction by adjustment screw (fraction) */
  maxRadiusReduction: number;
  popupHeightIn?: number;
  nozzles: Nozzle[];
  notes?: string;
}

const rotorNozzles: Nozzle[] = [
  { id: "0.75", name: "0.75", radius: 28, flowGpm: 0.65, pressure: 40, trajectory: 25 },
  { id: "1.0", name: "1.0", radius: 31, flowGpm: 0.9, pressure: 40, trajectory: 25 },
  { id: "1.5", name: "1.5", radius: 34, flowGpm: 1.35, pressure: 40, trajectory: 25 },
  { id: "2.0", name: "2.0", radius: 36, flowGpm: 1.8, pressure: 40, trajectory: 25 },
  { id: "2.5", name: "2.5", radius: 38, flowGpm: 2.25, pressure: 40, trajectory: 25 },
  { id: "3.0", name: "3.0", radius: 39, flowGpm: 2.7, pressure: 40, trajectory: 25 },
  { id: "4.0", name: "4.0", radius: 41, flowGpm: 3.6, pressure: 40, trajectory: 25 },
  { id: "5.0", name: "5.0", radius: 43, flowGpm: 4.5, pressure: 40, trajectory: 25 },
  { id: "6.0", name: "6.0", radius: 45, flowGpm: 5.4, pressure: 40, trajectory: 25 },
  { id: "8.0", name: "8.0", radius: 48, flowGpm: 7.2, pressure: 40, trajectory: 25 },
];

const lowAngleRotorNozzles: Nozzle[] = [
  { id: "LA-1.0", name: "1.0 LA", radius: 24, flowGpm: 0.8, pressure: 40, trajectory: 13 },
  { id: "LA-1.5", name: "1.5 LA", radius: 27, flowGpm: 1.2, pressure: 40, trajectory: 13 },
  { id: "LA-2.0", name: "2.0 LA", radius: 29, flowGpm: 1.6, pressure: 40, trajectory: 13 },
  { id: "LA-3.0", name: "3.0 LA", radius: 32, flowGpm: 2.4, pressure: 40, trajectory: 13 },
];

const shortRotorNozzles: Nozzle[] = [
  { id: "SR-0.5", name: "0.5 SR", radius: 18, flowGpm: 0.45, pressure: 40, trajectory: 20 },
  { id: "SR-1.0", name: "1.0 SR", radius: 21, flowGpm: 0.8, pressure: 40, trajectory: 20 },
  { id: "SR-1.5", name: "1.5 SR", radius: 23, flowGpm: 1.15, pressure: 40, trajectory: 20 },
  { id: "SR-2.0", name: "2.0 SR", radius: 25, flowGpm: 1.5, pressure: 40, trajectory: 20 },
  { id: "SR-3.0", name: "3.0 SR", radius: 27, flowGpm: 2.2, pressure: 40, trajectory: 20 },
];

// Variable-arc spray nozzles, full-circle flows at 30 psi (representative of the class)
const vanNozzles: Nozzle[] = [
  { id: "VAN-4", name: "4' VAN", radius: 4, flowGpm: 0.42, pressure: 30, trajectory: 15 },
  { id: "VAN-6", name: "6' VAN", radius: 6, flowGpm: 0.9, pressure: 30, trajectory: 15 },
  { id: "VAN-8", name: "8' VAN", radius: 8, flowGpm: 1.05, pressure: 30, trajectory: 15 },
  { id: "VAN-10", name: "10' VAN", radius: 10, flowGpm: 1.6, pressure: 30, trajectory: 23 },
  { id: "VAN-12", name: "12' VAN", radius: 12, flowGpm: 2.6, pressure: 30, trajectory: 23 },
  { id: "VAN-15", name: "15' VAN", radius: 15, flowGpm: 3.7, pressure: 30, trajectory: 23 },
  { id: "VAN-18", name: "18' VAN", radius: 18, flowGpm: 4.6, pressure: 30, trajectory: 28 },
];

const stripNozzles: Nozzle[] = [
  { id: "EST", name: "End strip 4'x15'", radius: 15, flowGpm: 0.5 * 4, pressure: 30, trajectory: 0 },
  { id: "SST", name: "Side strip 4'x30'", radius: 15, flowGpm: 1.2 * 2, pressure: 30, trajectory: 0 },
];

// Multi-stream rotary nozzles, full-circle flow at 40 psi (low precipitation class ~0.4 in/hr)
const rotaryNozzles: Nozzle[] = [
  { id: "RN-800", name: "RN 800 (6-12')", radius: 12, flowGpm: 0.46, pressure: 40, trajectory: 10 },
  { id: "RN-1000", name: "RN 1000 (8-15')", radius: 15, flowGpm: 0.72, pressure: 40, trajectory: 12 },
  { id: "RN-2000", name: "RN 2000 (13-21')", radius: 20, flowGpm: 1.47, pressure: 40, trajectory: 15 },
  { id: "RN-3000", name: "RN 3000 (22-30')", radius: 28, flowGpm: 2.85, pressure: 40, trajectory: 18 },
  { id: "RN-3500", name: "RN 3500 (31-35')", radius: 33, flowGpm: 4.0, pressure: 40, trajectory: 20 },
];

const bubblerNozzles: Nozzle[] = [
  { id: "B-0.25", name: "0.25 GPM flood", radius: 1, flowGpm: 0.25, pressure: 20, trajectory: 0 },
  { id: "B-0.5", name: "0.5 GPM flood", radius: 1.5, flowGpm: 0.5, pressure: 20, trajectory: 0 },
  { id: "B-1.0", name: "1.0 GPM flood", radius: 2, flowGpm: 1.0, pressure: 20, trajectory: 0 },
  { id: "B-2.0", name: "2.0 GPM stream", radius: 3, flowGpm: 2.0, pressure: 20, trajectory: 0 },
];

const impactNozzles: Nozzle[] = [
  { id: "3/32", name: '3/32"', radius: 34, flowGpm: 1.6, pressure: 45, trajectory: 25 },
  { id: "7/64", name: '7/64"', radius: 37, flowGpm: 2.2, pressure: 45, trajectory: 25 },
  { id: "1/8", name: '1/8"', radius: 40, flowGpm: 2.9, pressure: 45, trajectory: 25 },
  { id: "9/64", name: '9/64"', radius: 42, flowGpm: 3.6, pressure: 45, trajectory: 25 },
  { id: "5/32", name: '5/32"', radius: 44, flowGpm: 4.5, pressure: 45, trajectory: 25 },
];

const emitterNozzles: Nozzle[] = [
  { id: "E-0.5", name: "0.5 GPH", radius: 0.5, flowGpm: 0.5 / 60, pressure: 25, trajectory: 0 },
  { id: "E-1", name: "1 GPH", radius: 0.6, flowGpm: 1 / 60, pressure: 25, trajectory: 0 },
  { id: "E-2", name: "2 GPH", radius: 0.8, flowGpm: 2 / 60, pressure: 25, trajectory: 0 },
  { id: "E-4", name: "4 GPH", radius: 1.0, flowGpm: 4 / 60, pressure: 25, trajectory: 0 },
];

const microsprayNozzles: Nozzle[] = [
  { id: "MS-4", name: "Micro-spray 4'", radius: 4, flowGpm: 10 / 60, pressure: 25, trajectory: 10 },
  { id: "MS-7", name: "Micro-spray 7'", radius: 7, flowGpm: 16 / 60, pressure: 25, trajectory: 10 },
];

export const GENERIC_SPRINKLERS: SprinklerProduct[] = [
  {
    id: "gen-rotor-4",
    manufacturer: "Generic",
    productLine: "Gear Rotor",
    model: 'GR-4 4" Gear Rotor',
    category: "rotor",
    inletSize: 0.75,
    minPressure: 25,
    maxPressure: 70,
    arcAdjustable: true,
    arcMin: 40,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0.25,
    popupHeightIn: 4,
    nozzles: rotorNozzles,
  },
  {
    id: "gen-rotor-4-prs",
    manufacturer: "Generic",
    productLine: "Gear Rotor",
    model: 'GR-4P 4" Rotor, PRS 45 psi',
    category: "rotor",
    inletSize: 0.75,
    minPressure: 30,
    maxPressure: 100,
    prsPsi: 45,
    arcAdjustable: true,
    arcMin: 40,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0.25,
    popupHeightIn: 4,
    nozzles: rotorNozzles.map((n) => ({ ...n, pressure: 45, radius: n.radius + 1, flowGpm: +(n.flowGpm * Math.sqrt(45 / 40)).toFixed(2) })),
    notes: "Pressure-regulated body. Nozzle data shown at the 45 psi regulation setpoint.",
  },
  {
    id: "gen-rotor-la",
    manufacturer: "Generic",
    productLine: "Gear Rotor",
    model: "GR-4 Low-Angle",
    category: "rotor",
    inletSize: 0.75,
    minPressure: 25,
    maxPressure: 70,
    arcAdjustable: true,
    arcMin: 40,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0.25,
    nozzles: lowAngleRotorNozzles,
  },
  {
    id: "gen-rotor-sr",
    manufacturer: "Generic",
    productLine: "Gear Rotor",
    model: "GR-SR Short-Radius Rotor",
    category: "rotor",
    inletSize: 0.5,
    minPressure: 25,
    maxPressure: 65,
    arcAdjustable: true,
    arcMin: 40,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0.25,
    nozzles: shortRotorNozzles,
  },
  {
    id: "gen-spray-4",
    manufacturer: "Generic",
    productLine: "Spray Body",
    model: '4" Spray + VAN Nozzle',
    category: "spray",
    inletSize: 0.5,
    minPressure: 15,
    maxPressure: 70,
    arcAdjustable: true,
    arcMin: 0,
    arcMax: 360,
    matchedPrecip: true,
    maxRadiusReduction: 0.25,
    popupHeightIn: 4,
    nozzles: vanNozzles,
  },
  {
    id: "gen-spray-4-prs",
    manufacturer: "Generic",
    productLine: "Spray Body",
    model: '4" Spray PRS30 + VAN Nozzle',
    category: "spray",
    inletSize: 0.5,
    minPressure: 20,
    maxPressure: 100,
    prsPsi: 30,
    arcAdjustable: true,
    arcMin: 0,
    arcMax: 360,
    matchedPrecip: true,
    maxRadiusReduction: 0.25,
    popupHeightIn: 4,
    nozzles: vanNozzles,
    notes: "Pressure-regulating stem maintains ~30 psi at the nozzle.",
  },
  {
    id: "gen-spray-strip",
    manufacturer: "Generic",
    productLine: "Spray Body",
    model: '4" Spray + Strip Nozzle',
    category: "spray",
    inletSize: 0.5,
    minPressure: 15,
    maxPressure: 70,
    arcAdjustable: false,
    arcMin: 180,
    arcMax: 180,
    matchedPrecip: true,
    maxRadiusReduction: 0.1,
    nozzles: stripNozzles,
  },
  {
    id: "gen-rotary-prs",
    manufacturer: "Generic",
    productLine: "Rotary Nozzle",
    model: "PRS40 Spray + Rotary Nozzle",
    category: "rotary",
    inletSize: 0.5,
    minPressure: 30,
    maxPressure: 100,
    prsPsi: 40,
    arcAdjustable: true,
    arcMin: 45,
    arcMax: 360,
    matchedPrecip: true,
    maxRadiusReduction: 0.25,
    popupHeightIn: 4,
    nozzles: rotaryNozzles,
    notes: "High-efficiency multi-stream rotary nozzle on 40 psi regulated body.",
  },
  {
    id: "gen-bubbler",
    manufacturer: "Generic",
    productLine: "Bubbler",
    model: "Adjustable Bubbler",
    category: "bubbler",
    inletSize: 0.5,
    minPressure: 15,
    maxPressure: 70,
    arcAdjustable: false,
    arcMin: 360,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0,
    nozzles: bubblerNozzles,
  },
  {
    id: "gen-impact",
    manufacturer: "Generic",
    productLine: "Impact",
    model: "Brass Impact Sprinkler",
    category: "impact",
    inletSize: 0.75,
    minPressure: 30,
    maxPressure: 70,
    arcAdjustable: true,
    arcMin: 20,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0.25,
    nozzles: impactNozzles,
  },
  {
    id: "gen-emitter",
    manufacturer: "Generic",
    productLine: "Drip",
    model: "Pressure-Compensating Emitter",
    category: "emitter",
    inletSize: 0.25,
    minPressure: 15,
    maxPressure: 50,
    arcAdjustable: false,
    arcMin: 360,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 0,
    nozzles: emitterNozzles,
  },
  {
    id: "gen-microspray",
    manufacturer: "Generic",
    productLine: "Drip",
    model: "Micro-Spray on Stake",
    category: "microspray",
    inletSize: 0.25,
    minPressure: 15,
    maxPressure: 40,
    arcAdjustable: true,
    arcMin: 90,
    arcMax: 360,
    matchedPrecip: true,
    maxRadiusReduction: 0.2,
    nozzles: microsprayNozzles,
  },
  {
    id: "gen-custom",
    manufacturer: "Custom",
    productLine: "Custom",
    model: "Custom Sprinkler",
    category: "custom",
    inletSize: 0.5,
    minPressure: 20,
    maxPressure: 70,
    arcAdjustable: true,
    arcMin: 0,
    arcMax: 360,
    matchedPrecip: false,
    maxRadiusReduction: 1,
    nozzles: [{ id: "custom", name: "Custom", radius: 15, flowGpm: 2, pressure: 30, trajectory: 20 }],
  },
];

export interface DriplineProduct {
  id: string;
  manufacturer: string;
  model: string;
  tubingOdMm: number;
  insideDiameterIn: number;
  emitterGphOptions: number[];
  spacingOptionsIn: number[];
  minPressure: number;
  maxPressure: number;
  /** maximum lateral run length (ft) at typical settings */
  maxRunFt: number;
}

export const GENERIC_DRIPLINE: DriplineProduct[] = [
  {
    id: "gen-dripline-17",
    manufacturer: "Generic",
    model: "17mm PC Dripline",
    tubingOdMm: 17,
    insideDiameterIn: 0.6,
    emitterGphOptions: [0.4, 0.6, 0.9],
    spacingOptionsIn: [12, 18],
    minPressure: 15,
    maxPressure: 50,
    maxRunFt: 300,
  },
];

const catalog = new Map<string, SprinklerProduct>(GENERIC_SPRINKLERS.map((p) => [p.id, p]));

/** Register additional manufacturer catalogs at runtime. */
export function registerCatalog(products: SprinklerProduct[]) {
  for (const p of products) catalog.set(p.id, p);
}

export function allProducts(): SprinklerProduct[] {
  return [...catalog.values()];
}

export function getProduct(id: string): SprinklerProduct {
  return catalog.get(id) ?? GENERIC_SPRINKLERS[0];
}

export function getNozzle(product: SprinklerProduct, nozzleId: string): Nozzle {
  return product.nozzles.find((n) => n.id === nozzleId) ?? product.nozzles[0];
}

export function getDripline(id: string): DriplineProduct {
  return GENERIC_DRIPLINE.find((d) => d.id === id) ?? GENERIC_DRIPLINE[0];
}

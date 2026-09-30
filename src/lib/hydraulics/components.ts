/**
 * Pressure-loss curves for inline components (valves, backflow preventers,
 * water meters).
 *
 * ASSUMPTION: These are GENERIC representative curves compiled to reflect
 * typical published loss charts for each device class and size. Actual losses
 * vary by manufacturer/model — load the manufacturer's curve (or use the
 * per-valve override) for final design. Values: [flow gpm, loss psi].
 */
import type { BackflowType, MeterSize, ValveType } from "../model/types";
import { interpolateCurve } from "./formulas";

const VALVE_CURVES: Record<string, [number, number][]> = {
  "0.75": [
    [2, 1.5],
    [5, 1.8],
    [10, 2.6],
    [15, 4.0],
    [20, 6.2],
  ],
  "1": [
    [2, 1.5],
    [5, 1.6],
    [10, 1.8],
    [15, 2.3],
    [20, 3.0],
    [25, 4.0],
    [30, 5.2],
  ],
  "1.5": [
    [10, 1.2],
    [20, 1.6],
    [40, 2.8],
    [60, 4.8],
    [80, 7.6],
  ],
  "2": [
    [20, 1.2],
    [40, 1.8],
    [80, 3.8],
    [100, 5.4],
    [150, 10.5],
  ],
};

const DRIP_KIT_CURVE: [number, number][] = [
  [1, 3],
  [5, 4.5],
  [10, 6.5],
  [15, 9],
];

export function valveLossPsi(size: number, flowGpm: number, type: ValveType = "electric"): number {
  if (type === "isolation") return interpolateCurve([[10, 0.1], [30, 0.4], [60, 1.2]], flowGpm);
  if (type === "drip") return interpolateCurve(DRIP_KIT_CURVE, flowGpm);
  const key = size <= 0.75 ? "0.75" : size <= 1 ? "1" : size <= 1.5 ? "1.5" : "2";
  return interpolateCurve(VALVE_CURVES[key], flowGpm);
}

const BACKFLOW_CURVES: Record<Exclude<BackflowType, "none">, Record<string, [number, number][]>> = {
  pvb: {
    "0.75": [[5, 2.5], [10, 4], [15, 5.5], [20, 7.5]],
    "1": [[5, 2], [10, 3.2], [15, 4.2], [20, 5.2], [30, 7.5]],
    "1.5": [[10, 2.5], [30, 4], [50, 6], [70, 8.5]],
    "2": [[20, 2.5], [50, 4], [80, 6], [120, 9]],
  },
  avb: {
    "0.75": [[5, 1], [10, 2], [20, 4.5]],
    "1": [[5, 0.8], [10, 1.5], [20, 3], [30, 5]],
    "1.5": [[10, 1], [30, 2.5], [60, 5]],
    "2": [[20, 1], [60, 3], [120, 6]],
  },
  dcva: {
    "0.75": [[5, 4], [10, 5], [15, 6], [20, 7.5]],
    "1": [[5, 3.5], [10, 4.2], [20, 5.5], [30, 7.5]],
    "1.5": [[10, 3.5], [30, 5], [60, 7.5]],
    "2": [[20, 3.5], [60, 5], [120, 8]],
  },
  rp: {
    "0.75": [[5, 10], [10, 11.5], [15, 13], [20, 15]],
    "1": [[5, 9.5], [10, 10.5], [20, 12.5], [30, 15]],
    "1.5": [[10, 10], [30, 11.5], [60, 14.5]],
    "2": [[20, 10], [60, 12], [120, 15.5]],
  },
};

export function backflowLossPsi(type: BackflowType, size: number, flowGpm: number): number {
  if (type === "none") return 0;
  const key = size <= 0.75 ? "0.75" : size <= 1 ? "1" : size <= 1.5 ? "1.5" : "2";
  return interpolateCurve(BACKFLOW_CURVES[type][key], flowGpm);
}

/** Displacement meter loss curves (representative of AWWA C700 maximum-loss behaviour). */
const METER_CURVES: Record<Exclude<MeterSize, "none">, [number, number][]> = {
  "5/8": [[2, 0.2], [5, 1], [10, 3.5], [15, 8], [20, 14]],
  "3/4": [[5, 0.6], [10, 2], [15, 4.3], [20, 7.5], [30, 16]],
  "1": [[5, 0.3], [10, 0.8], [20, 3], [30, 6.5], [40, 11], [50, 17]],
  "1-1/2": [[20, 1.2], [40, 4.2], [60, 9], [80, 15], [100, 22]],
  "2": [[40, 2], [60, 4.2], [80, 7.3], [100, 11], [160, 26]],
};

/** Manufacturer-style maximum continuous (safe) flow per meter size (gpm). */
export const METER_SAFE_FLOW: Record<Exclude<MeterSize, "none">, number> = {
  "5/8": 20,
  "3/4": 30,
  "1": 50,
  "1-1/2": 100,
  "2": 160,
};

export function meterLossPsi(size: MeterSize, flowGpm: number): number {
  if (size === "none") return 0;
  return interpolateCurve(METER_CURVES[size], flowGpm);
}

/**
 * Drip area calculations.
 *   tubing length ≈ area / row spacing + one perimeter header run
 *   emitters = tubing length / emitter spacing
 *   flow (gpm) = emitters × emitter gph / 60
 */
import type { DripArea } from "../model/types";
import { polygonArea, polygonPerimeter } from "../geometry/geometry";

export interface DripCalc {
  area: number;
  tubingFt: number;
  emitters: number;
  flowGpm: number;
  precipInHr: number;
}

export function dripCalc(d: DripArea): DripCalc {
  const area = polygonArea(d.points);
  const row = Math.max(d.rowSpacingIn, 1) / 12;
  const sp = Math.max(d.emitterSpacingIn, 1) / 12;
  const grid = area / row;
  const header = polygonPerimeter(d.points) * 0.5; // supply/flush headers along two sides
  const tubingFt = grid + header;
  const emitters = Math.round(grid / sp);
  const flowGpm = (emitters * d.emitterGph) / 60;
  // PR (in/hr) = 231 × gph / (row spacing in × emitter spacing in)
  const precipInHr = (231 * d.emitterGph) / (d.rowSpacingIn * d.emitterSpacingIn);
  return { area, tubingFt, emitters, flowGpm, precipInHr };
}

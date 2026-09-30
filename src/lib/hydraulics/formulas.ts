/**
 * Core hydraulic formulas (US customary units). Pure functions, unit-tested.
 *
 * Hazen-Williams friction loss (psi per foot of pipe):
 *     hf = 4.52 × Q^1.852 / (C^1.852 × d^4.8704)
 *   Q = flow (gpm), d = pipe INSIDE diameter (inches), C = roughness coefficient.
 *   (This is the standard psi form; the head form is 10.44 L Q^1.852/(C^1.852 d^4.8655) ft.)
 *
 * Velocity (ft/s):
 *     V = 0.4085 × Q / d²      (Q gpm, d inches)
 *
 * Elevation pressure change:
 *     ΔP = 0.433 psi per foot of elevation (water at ~60°F).
 *     Water flowing uphill loses pressure; downhill gains.
 *
 * Minor (fitting) losses are handled as a configurable percentage allowance on
 * pipe friction, a common irrigation-design practice (typically 10%).
 */

export const PSI_PER_FT_ELEVATION = 0.433;
export const HW_EXPONENT = 1.852;

export function hazenWilliamsPsiPerFt(flowGpm: number, insideDiameterIn: number, c: number): number {
  if (flowGpm <= 0 || insideDiameterIn <= 0 || c <= 0) return 0;
  return (4.52 * Math.pow(flowGpm, HW_EXPONENT)) / (Math.pow(c, HW_EXPONENT) * Math.pow(insideDiameterIn, 4.8704));
}

export function frictionLossPsi(flowGpm: number, insideDiameterIn: number, c: number, lengthFt: number): number {
  return hazenWilliamsPsiPerFt(flowGpm, insideDiameterIn, c) * Math.max(0, lengthFt);
}

/** Friction loss per 100 ft (the form found in pipe friction-loss charts). */
export function frictionLossPer100Ft(flowGpm: number, insideDiameterIn: number, c: number): number {
  return hazenWilliamsPsiPerFt(flowGpm, insideDiameterIn, c) * 100;
}

export function velocityFps(flowGpm: number, insideDiameterIn: number): number {
  if (insideDiameterIn <= 0) return 0;
  return (0.4085 * Math.abs(flowGpm)) / (insideDiameterIn * insideDiameterIn);
}

/** Maximum flow for a pipe ID at a velocity limit: Q = V × d² / 0.4085 */
export function flowAtVelocity(velocityLimitFps: number, insideDiameterIn: number): number {
  return (velocityLimitFps * insideDiameterIn * insideDiameterIn) / 0.4085;
}

/** Pressure change due to elevation. Positive rise (ft) gives a pressure LOSS (positive psi). */
export function elevationLossPsi(riseFt: number): number {
  return riseFt * PSI_PER_FT_ELEVATION;
}

/** Bucket flow test: GPM = gallons / seconds × 60 */
export function bucketTestGpm(gallons: number, seconds: number): number {
  if (seconds <= 0 || gallons <= 0) return 0;
  return (gallons / seconds) * 60;
}

/** Linear interpolation on a (flow, loss) curve; extrapolates with a Q² law beyond the table. */
export function interpolateCurve(curve: [number, number][], q: number): number {
  if (q <= 0 || curve.length === 0) return 0;
  // below the first tabulated point, scale toward zero with the square law
  if (q <= curve[0][0]) return curve[0][1] * (q / curve[0][0]) ** 2;
  for (let i = 0; i < curve.length - 1; i++) {
    const [q0, l0] = curve[i];
    const [q1, l1] = curve[i + 1];
    if (q <= q1) return l0 + ((l1 - l0) * (q - q0)) / (q1 - q0);
  }
  const [ql, ll] = curve[curve.length - 1];
  return ll * (q / ql) ** 2;
}

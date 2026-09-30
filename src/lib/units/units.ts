/**
 * Unit handling. All internal geometry is stored in FEET (world units) and all
 * hydraulic quantities in US customary units (gpm, psi, ft/s, inches for pipe ID).
 * Formatting helpers convert to display strings. A `UnitSystem` flag exists so a
 * metric display layer can be added without touching stored data.
 */

export type UnitSystem = "imperial" | "metric";
export type LengthFormat = "ft-in" | "ft" | "in";

export const FT_PER_M = 3.28084;
export const LPM_PER_GPM = 3.78541;
export const KPA_PER_PSI = 6.89476;

function round(v: number, step: number) {
  return Math.round(v / step) * step;
}

/** Formats a length in feet as e.g. 12'-6" (rounded to nearest inch by default). */
export function formatFeetInches(ft: number, inchStep = 1): string {
  const sign = ft < 0 ? "-" : "";
  let totalIn = round(Math.abs(ft) * 12, inchStep);
  let feet = Math.floor(totalIn / 12);
  let inches = totalIn - feet * 12;
  if (inches >= 12 - 1e-9) {
    feet += 1;
    inches = 0;
  }
  const inStr = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
  return `${sign}${feet}'-${inStr}"`;
}

export function formatLength(ft: number, system: UnitSystem = "imperial", format: LengthFormat = "ft-in"): string {
  if (system === "metric") {
    const m = ft / FT_PER_M;
    return m < 10 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`;
  }
  if (format === "ft") return `${ft.toFixed(1)} ft`;
  if (format === "in") return `${(ft * 12).toFixed(1)} in`;
  return formatFeetInches(ft);
}

export function formatArea(sqft: number, system: UnitSystem = "imperial"): string {
  if (system === "metric") return `${(sqft / (FT_PER_M * FT_PER_M)).toFixed(1)} m²`;
  return `${Math.round(sqft).toLocaleString("en-US")} sq ft`;
}

export function formatFlow(gpm: number, system: UnitSystem = "imperial"): string {
  if (system === "metric") return `${(gpm * LPM_PER_GPM).toFixed(1)} L/min`;
  return `${gpm.toFixed(2)} GPM`;
}

export function formatPressure(psi: number, system: UnitSystem = "imperial"): string {
  if (system === "metric") return `${(psi * KPA_PER_PSI).toFixed(0)} kPa`;
  return `${psi.toFixed(1)} PSI`;
}

export function formatCurrency(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function formatCurrency0(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Parses user length input into feet. Accepts:
 *  12  12.5  12'  12' 6"  12'-6"  12ft 6in  150"  6in  3.5m
 * Returns NaN on failure.
 */
export function parseLength(input: string): number {
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return NaN;
  const metric = s.match(/^(-?\d+(?:\.\d+)?)\s*m$/);
  if (metric) return parseFloat(metric[1]) * FT_PER_M;
  const ftIn = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*-?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (ftIn) {
    const f = parseFloat(ftIn[1]);
    const i = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    return f < 0 ? f - i / 12 : f + i / 12;
  }
  const inch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/);
  if (inch) return parseFloat(inch[1]) / 12;
  const plain = s.match(/^-?\d+(?:\.\d+)?$/);
  if (plain) return parseFloat(s);
  return NaN;
}

/** Pipe nominal size label, e.g. 1.25 -> 1-1/4" */
export function pipeSizeLabel(nominalIn: number): string {
  const whole = Math.floor(nominalIn + 1e-9);
  const frac = nominalIn - whole;
  const fracs: [number, string][] = [
    [0.25, "1/4"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.75, "3/4"],
  ];
  const f = fracs.find(([v]) => Math.abs(v - frac) < 0.01);
  if (frac < 0.01) return `${whole}"`;
  if (!f) return `${nominalIn}"`;
  return whole === 0 ? `${f[1]}"` : `${whole}-${f[1]}"`;
}

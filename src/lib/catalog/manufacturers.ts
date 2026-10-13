/**
 * Brand-name sprinkler catalog: the popular residential / light-commercial
 * MP-style rotary nozzles, gear-driven rotors and variable-arc (VAN) spray
 * nozzles from Hunter, Rain Bird, Toro and K-Rain.
 *
 * Values are NOMINAL figures in line with the manufacturers' published
 * performance charts (radius in ft, flow in GPM at the listed pressure),
 * rounded for planning. Charts are revised from time to time, so confirm
 * against the current manufacturer chart for final design / submittals.
 *
 * Conventions follow `sprinklers.ts`:
 *  - matched-precip products (VAN, rotary nozzles, strips) list FULL-CIRCLE
 *    flow; the hydraulics scale it by arc/360.
 *  - rotor nozzle flow does not depend on the arc setting.
 *  - matched-precip `model` strings are "<body> + <nozzle family>" so the
 *    takeoff can split body and nozzle onto separate lines.
 */
import type { Nozzle, SprinklerProduct } from "./sprinklers";

const nz = (id: string, name: string, radius: number, flowGpm: number, pressure: number, trajectory: number): Nozzle => ({ id, name, radius, flowGpm, pressure, trajectory });

type Base = Pick<SprinklerProduct, "id" | "manufacturer" | "productLine" | "model" | "nozzles"> & Partial<SprinklerProduct>;

const rotor = (p: Base): SprinklerProduct => ({
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
  ...p,
});

const spray = (p: Base): SprinklerProduct => ({
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
  ...p,
});

const rotary = (p: Base): SprinklerProduct => ({
  category: "rotary",
  inletSize: 0.5,
  minPressure: 30,
  maxPressure: 100,
  arcAdjustable: true,
  arcMin: 45,
  arcMax: 360,
  matchedPrecip: true,
  maxRadiusReduction: 0.25,
  popupHeightIn: 4,
  ...p,
});

/** Strip patterns are fixed; flow is listed as 2x the actual strip flow so the 180° arc gives the real figure. */
const strip = (p: Base): SprinklerProduct => rotary({ arcAdjustable: false, arcMin: 180, arcMax: 180, maxRadiusReduction: 0.1, ...p });

// ---------------------------------------------------------------------------
// Gear-driven rotor nozzle racks (flow at 45 psi unless noted)
// ---------------------------------------------------------------------------

/** Hunter I-20 / PGP Ultra share the same nozzle rack. */
const hunterI20Nozzles: Nozzle[] = [
  nz("1.5", "1.5 blue", 34, 1.4, 45, 25),
  nz("2.0", "2.0 blue", 36, 1.9, 45, 25),
  nz("2.5", "2.5 blue", 38, 2.4, 45, 25),
  nz("3.0", "3.0 blue", 40, 2.9, 45, 25),
  nz("4.0", "4.0 blue", 42, 3.8, 45, 25),
  nz("5.0", "5.0 blue", 44, 4.7, 45, 25),
  nz("6.0", "6.0 blue", 46, 5.6, 45, 25),
  nz("8.0", "8.0 blue", 49, 7.5, 45, 25),
  nz("0.50LA", "0.50 LA gray", 20, 0.5, 45, 13),
  nz("1.0LA", "1.0 LA gray", 25, 1.0, 45, 13),
  nz("2.0LA", "2.0 LA gray", 30, 1.9, 45, 13),
  nz("3.0LA", "3.0 LA gray", 33, 2.8, 45, 13),
  nz("0.5SR", "0.5 SR red", 17, 0.5, 45, 15),
  nz("1.0SR", "1.0 SR red", 21, 1.0, 45, 15),
  nz("1.5SR", "1.5 SR red", 23, 1.5, 45, 15),
  nz("2.0SR", "2.0 SR red", 25, 2.0, 45, 15),
];

const hunterPgjNozzles: Nozzle[] = [
  nz("0.75", "0.75", 22, 0.75, 45, 25),
  nz("1.0", "1.0", 25, 1.0, 45, 25),
  nz("1.5", "1.5", 28, 1.5, 45, 25),
  nz("2.0", "2.0", 31, 2.0, 45, 25),
  nz("2.5", "2.5", 33, 2.5, 45, 25),
  nz("3.0", "3.0", 35, 3.0, 45, 25),
  nz("4.0", "4.0", 37, 3.9, 45, 25),
];

const rb5000Nozzles: Nozzle[] = [
  nz("1.5", "1.5", 34, 1.5, 45, 25),
  nz("2.0", "2.0", 37, 2.0, 45, 25),
  nz("2.5", "2.5", 39, 2.5, 45, 25),
  nz("3.0", "3.0", 41, 2.9, 45, 25),
  nz("4.0", "4.0", 43, 3.8, 45, 25),
  nz("5.0", "5.0", 45, 4.7, 45, 25),
  nz("6.0", "6.0", 47, 5.6, 45, 25),
  nz("8.0", "8.0", 50, 7.4, 45, 25),
  nz("1.0LA", "1.0 LA", 26, 1.0, 45, 10),
  nz("1.5LA", "1.5 LA", 29, 1.5, 45, 10),
  nz("2.0LA", "2.0 LA", 31, 2.0, 45, 10),
  nz("3.0LA", "3.0 LA", 34, 2.9, 45, 10),
  // MPR pre-balanced sets: Q = 90°, T = 120°, H = 180° nozzle for matched precipitation
  nz("MPR25Q", "MPR 25' Q (90°)", 25, 0.7, 45, 25),
  nz("MPR25T", "MPR 25' T (120°)", 25, 0.95, 45, 25),
  nz("MPR25H", "MPR 25' H (180°)", 25, 1.4, 45, 25),
  nz("MPR30Q", "MPR 30' Q (90°)", 30, 1.0, 45, 25),
  nz("MPR30T", "MPR 30' T (120°)", 30, 1.35, 45, 25),
  nz("MPR30H", "MPR 30' H (180°)", 30, 2.0, 45, 25),
  nz("MPR35Q", "MPR 35' Q (90°)", 35, 1.4, 45, 25),
  nz("MPR35T", "MPR 35' T (120°)", 35, 1.85, 45, 25),
  nz("MPR35H", "MPR 35' H (180°)", 35, 2.8, 45, 25),
];

const rb3500Nozzles: Nozzle[] = [
  nz("0.75", "0.75", 22, 0.75, 45, 25),
  nz("1.0", "1.0", 26, 1.0, 45, 25),
  nz("1.5", "1.5", 29, 1.5, 45, 25),
  nz("2.0", "2.0", 31, 2.0, 45, 25),
  nz("3.0", "3.0", 33, 2.9, 45, 25),
  nz("4.0", "4.0", 35, 3.8, 45, 25),
];

const rbFalconNozzles: Nozzle[] = [
  nz("4", "#4", 45, 3.9, 50, 25),
  nz("6", "#6", 50, 5.9, 50, 25),
  nz("8", "#8", 55, 7.9, 50, 25),
  nz("10", "#10", 58, 9.8, 50, 25),
  nz("12", "#12", 61, 11.6, 50, 25),
  nz("16", "#16", 65, 15.4, 50, 25),
];

const toroT5Nozzles: Nozzle[] = [
  nz("1.0", "1.0", 30, 1.0, 45, 25),
  nz("1.5", "1.5", 33, 1.5, 45, 25),
  nz("2.0", "2.0", 36, 2.0, 45, 25),
  nz("2.5", "2.5", 38, 2.5, 45, 25),
  nz("3.0", "3.0", 40, 3.0, 45, 25),
  nz("4.0", "4.0", 43, 3.9, 45, 25),
  nz("5.0", "5.0", 45, 4.8, 45, 25),
  nz("6.0", "6.0", 47, 5.7, 45, 25),
  nz("8.0", "8.0", 50, 7.6, 45, 25),
  nz("1.0LA", "1.0 LA", 25, 1.0, 45, 12),
  nz("2.0LA", "2.0 LA", 30, 2.0, 45, 12),
  nz("3.0LA", "3.0 LA", 33, 2.9, 45, 12),
];

const toroMini8Nozzles: Nozzle[] = [
  nz("0.5", "0.5", 20, 0.5, 45, 25),
  nz("1.0", "1.0", 25, 1.0, 45, 25),
  nz("1.5", "1.5", 28, 1.5, 45, 25),
  nz("2.0", "2.0", 31, 2.0, 45, 25),
  nz("3.0", "3.0", 34, 2.9, 45, 25),
];

const kRainProPlusNozzles: Nozzle[] = [
  nz("1.0", "1.0", 30, 1.0, 45, 25),
  nz("1.5", "1.5", 33, 1.5, 45, 25),
  nz("2.0", "2.0", 36, 2.0, 45, 25),
  nz("2.5", "2.5", 38, 2.5, 45, 25),
  nz("3.0", "3.0", 40, 3.0, 45, 25),
  nz("4.0", "4.0", 42, 3.9, 45, 25),
  nz("5.0", "5.0", 44, 4.8, 45, 25),
  nz("6.0", "6.0", 46, 5.7, 45, 25),
  nz("8.0", "8.0", 49, 7.6, 45, 25),
  nz("1.0LA", "1.0 LA", 25, 1.0, 45, 12),
  nz("2.0LA", "2.0 LA", 29, 2.0, 45, 12),
];

const kRainMiniProNozzles: Nozzle[] = [
  nz("0.75", "0.75", 22, 0.75, 45, 25),
  nz("1.0", "1.0", 25, 1.0, 45, 25),
  nz("1.5", "1.5", 28, 1.5, 45, 25),
  nz("2.0", "2.0", 31, 2.0, 45, 25),
  nz("3.0", "3.0", 34, 2.9, 45, 25),
];

// ---------------------------------------------------------------------------
// Variable-arc spray nozzles (full-circle flow at 30 psi)
// ---------------------------------------------------------------------------

const rbVanNozzles: Nozzle[] = [
  nz("4VAN", "4-VAN", 4, 0.42, 30, 5),
  nz("6VAN", "6-VAN", 6, 0.9, 30, 10),
  nz("8VAN", "8-VAN", 8, 1.05, 30, 10),
  nz("10VAN", "10-VAN", 10, 1.6, 30, 23),
  nz("12VAN", "12-VAN", 12, 2.6, 30, 23),
  nz("15VAN", "15-VAN", 15, 3.7, 30, 23),
  nz("18VAN", "18-VAN", 17, 4.6, 30, 28),
];

const rbHeVanNozzles: Nozzle[] = [
  nz("HE-VAN-08", "HE-VAN 8", 8, 1.2, 30, 10),
  nz("HE-VAN-10", "HE-VAN 10", 10, 1.75, 30, 15),
  nz("HE-VAN-12", "HE-VAN 12", 12, 2.3, 30, 23),
  nz("HE-VAN-15", "HE-VAN 15", 15, 3.3, 30, 23),
];

const hunterProAdjNozzles: Nozzle[] = [
  nz("4A", "4A", 4, 0.4, 30, 5),
  nz("6A", "6A", 6, 0.8, 30, 10),
  nz("8A", "8A", 8, 1.12, 30, 10),
  nz("10A", "10A", 10, 1.58, 30, 23),
  nz("12A", "12A", 12, 2.6, 30, 23),
  nz("15A", "15A", 15, 3.7, 30, 23),
  nz("17A", "17A", 17, 4.56, 30, 28),
];

const toroVanNozzles: Nozzle[] = [
  nz("4", "4' Adj. Arc", 4, 0.42, 30, 5),
  nz("6", "6' Adj. Arc", 6, 0.86, 30, 10),
  nz("8", "8' Adj. Arc", 8, 1.1, 30, 10),
  nz("10", "10' Adj. Arc", 10, 1.6, 30, 23),
  nz("12", "12' Adj. Arc", 12, 2.55, 30, 23),
  nz("15", "15' Adj. Arc", 15, 3.6, 30, 23),
  nz("17", "17' Adj. Arc", 17, 4.5, 30, 28),
];

const kRainVanNozzles: Nozzle[] = [
  nz("4", "4' VAN", 4, 0.42, 30, 5),
  nz("6", "6' VAN", 6, 0.88, 30, 10),
  nz("8", "8' VAN", 8, 1.08, 30, 10),
  nz("10", "10' VAN", 10, 1.6, 30, 23),
  nz("12", "12' VAN", 12, 2.6, 30, 23),
  nz("15", "15' VAN", 15, 3.7, 30, 23),
  nz("17", "17' VAN", 17, 4.5, 30, 28),
];

// ---------------------------------------------------------------------------
// Multi-stream rotary nozzles (full-circle flow at the optimum pressure)
// ---------------------------------------------------------------------------

const hunterMpNozzles: Nozzle[] = [
  nz("MP800SR", "MP800SR (6-12')", 12, 1.12, 40, 10),
  nz("MP815", "MP815 (8-15')", 15, 1.6, 40, 12),
  nz("MP1000", "MP1000 (8-15')", 15, 0.88, 40, 10),
  nz("MP2000", "MP2000 (13-21')", 21, 1.76, 40, 13),
  nz("MP3000", "MP3000 (22-30')", 30, 3.44, 40, 18),
  nz("MP3500", "MP3500 (31-35')", 35, 4.4, 40, 20),
];

const hunterMpStripNozzles: Nozzle[] = [
  nz("MPLCS515", "MP LCS-515 left corner 5'x15'", 15, 0.4, 40, 10),
  nz("MPRCS515", "MP RCS-515 right corner 5'x15'", 15, 0.4, 40, 10),
  nz("MPSS530", "MP SS-530 side strip 5'x30'", 15, 0.8, 40, 10),
];

const rbRvanNozzles: Nozzle[] = [
  nz("RVAN14", "R-VAN14 (8-14')", 14, 1.22, 45, 12),
  nz("RVAN18", "R-VAN18 (13-18')", 18, 2.02, 45, 15),
  nz("RVAN24", "R-VAN24 (17-24')", 24, 3.6, 45, 18),
];

const rbRvanStripNozzles: Nozzle[] = [
  nz("RVAN-LCS", "R-VAN-LCS left corner 5'x15'", 15, 0.5, 45, 10),
  nz("RVAN-RCS", "R-VAN-RCS right corner 5'x15'", 15, 0.5, 45, 10),
  nz("RVAN-SST", "R-VAN-SST side strip 5'x30'", 15, 1.0, 45, 10),
];

const toroRotatingNozzles: Nozzle[] = [
  nz("PRN13", "Precision Rotating 13' (8-13')", 13, 1.0, 40, 10),
  nz("PRN17", "Precision Rotating 17' (13-17')", 17, 1.7, 40, 13),
  nz("PRN22", "Precision Rotating 22' (18-22')", 22, 2.8, 40, 16),
];

const kRainRnNozzles: Nozzle[] = [
  nz("RN100", "RN100 (8-15')", 15, 0.9, 40, 10),
  nz("RN200", "RN200 (13-21')", 21, 1.8, 40, 13),
  nz("RN300", "RN300 (22-30')", 30, 3.4, 40, 18),
];

export const MANUFACTURER_SPRINKLERS: SprinklerProduct[] = [
  // ---------------- Gear-driven rotors ----------------
  rotor({ id: "hun-pgp-ultra", manufacturer: "Hunter", productLine: "Gear Rotor", model: 'PGP Ultra 4" Rotor', nozzles: hunterI20Nozzles, maxPressure: 70 }),
  rotor({ id: "hun-i20", manufacturer: "Hunter", productLine: "Gear Rotor", model: 'I-20 4" Rotor', nozzles: hunterI20Nozzles, maxPressure: 100 }),
  rotor({ id: "hun-i20-6", manufacturer: "Hunter", productLine: "Gear Rotor", model: 'I-20 6" Rotor', nozzles: hunterI20Nozzles, maxPressure: 100, popupHeightIn: 6 }),
  rotor({ id: "hun-i20-12", manufacturer: "Hunter", productLine: "Gear Rotor", model: 'I-20 12" Shrub Rotor', nozzles: hunterI20Nozzles, maxPressure: 100, popupHeightIn: 12 }),
  rotor({ id: "hun-pgj", manufacturer: "Hunter", productLine: "Gear Rotor", model: 'PGJ 4" Rotor', inletSize: 0.5, nozzles: hunterPgjNozzles, maxPressure: 70 }),
  rotor({ id: "rb-5004-plus", manufacturer: "Rain Bird", productLine: "Gear Rotor", model: '5004 Plus 4" Rotor', nozzles: rb5000Nozzles, maxPressure: 70 }),
  rotor({ id: "rb-5004-plus-prs", manufacturer: "Rain Bird", productLine: "Gear Rotor", model: '5004 Plus PRS 4" Rotor', nozzles: rb5000Nozzles, minPressure: 25, maxPressure: 100, prsPsi: 45, notes: "Built-in pressure regulation holds ~45 psi at the nozzle." }),
  rotor({ id: "rb-5006-plus", manufacturer: "Rain Bird", productLine: "Gear Rotor", model: '5006 Plus 6" Rotor', nozzles: rb5000Nozzles, maxPressure: 70, popupHeightIn: 6 }),
  rotor({ id: "rb-3504", manufacturer: "Rain Bird", productLine: "Gear Rotor", model: '3504 4" Rotor', inletSize: 0.5, nozzles: rb3500Nozzles, maxPressure: 55 }),
  rotor({ id: "rb-falcon-6504", manufacturer: "Rain Bird", productLine: "Gear Rotor", model: 'Falcon 6504 Rotor', inletSize: 1, minPressure: 35, maxPressure: 100, nozzles: rbFalconNozzles, notes: "Large-turf rotor, 1\" inlet." }),
  rotor({ id: "toro-t5", manufacturer: "Toro", productLine: "Gear Rotor", model: 'T5 RapidSet 4" Rotor', nozzles: toroT5Nozzles, maxPressure: 70 }),
  rotor({ id: "toro-super-800", manufacturer: "Toro", productLine: "Gear Rotor", model: 'Super 800 4" Rotor', nozzles: toroT5Nozzles, maxPressure: 70 }),
  rotor({ id: "toro-mini-8", manufacturer: "Toro", productLine: "Gear Rotor", model: 'Mini 8 Rotor', inletSize: 0.5, nozzles: toroMini8Nozzles, maxPressure: 60 }),
  rotor({ id: "krain-proplus", manufacturer: "K-Rain", productLine: "Gear Rotor", model: 'ProPlus 4" Rotor', nozzles: kRainProPlusNozzles, maxPressure: 70 }),
  rotor({ id: "krain-minipro", manufacturer: "K-Rain", productLine: "Gear Rotor", model: 'MiniPro Rotor', inletSize: 0.5, nozzles: kRainMiniProNozzles, maxPressure: 60 }),

  // ---------------- VAN spray nozzles on regulated spray bodies ----------------
  spray({ id: "rb-1804prs-van", manufacturer: "Rain Bird", productLine: "VAN Nozzle", model: "1804 PRS + VAN Nozzle", nozzles: rbVanNozzles }),
  spray({ id: "rb-1804prs-hevan", manufacturer: "Rain Bird", productLine: "HE-VAN Nozzle", model: "1804 PRS + HE-VAN Nozzle", nozzles: rbHeVanNozzles, notes: "High-efficiency variable arc nozzle." }),
  spray({ id: "hun-prs30-proadj", manufacturer: "Hunter", productLine: "Pro Adjustable Nozzle", model: "Pro-Spray PRS30 + Pro Adjustable Nozzle", nozzles: hunterProAdjNozzles }),
  spray({ id: "toro-570z-prx-van", manufacturer: "Toro", productLine: "Adjustable Arc Nozzle", model: "570Z PRX + Adjustable Arc Nozzle", nozzles: toroVanNozzles }),
  spray({ id: "krain-pros-prs-van", manufacturer: "K-Rain", productLine: "VAN Nozzle", model: "Pro-S PRS + VAN Nozzle", nozzles: kRainVanNozzles }),

  // ---------------- Multi-stream rotary nozzles (MP-style) ----------------
  rotary({ id: "hun-prs40-mp", manufacturer: "Hunter", productLine: "MP Rotator", model: "Pro-Spray PRS40 + MP Rotator", prsPsi: 40, nozzles: hunterMpNozzles, notes: "MP Rotator performs best at 40 psi; PRS40 body holds that pressure." }),
  strip({ id: "hun-prs40-mp-strip", manufacturer: "Hunter", productLine: "MP Rotator Strip", model: "Pro-Spray PRS40 + MP Strip", prsPsi: 40, nozzles: hunterMpStripNozzles }),
  rotary({ id: "rb-1804-rvan", manufacturer: "Rain Bird", productLine: "R-VAN Nozzle", model: "RD1804 P45 + R-VAN Nozzle", prsPsi: 45, nozzles: rbRvanNozzles, notes: "R-VAN performs best at 45 psi; the P45 body holds that pressure." }),
  strip({ id: "rb-1804-rvan-strip", manufacturer: "Rain Bird", productLine: "R-VAN Strip", model: "RD1804 P45 + R-VAN Strip", prsPsi: 45, nozzles: rbRvanStripNozzles }),
  rotary({ id: "toro-570z-prn", manufacturer: "Toro", productLine: "Precision Rotating Nozzle", model: "570Z + Precision Rotating Nozzle", maxPressure: 70, nozzles: toroRotatingNozzles, notes: "Rotating nozzles perform best near 40 psi; regulate the zone if static pressure is high." }),
  rotary({ id: "krain-pros-rn", manufacturer: "K-Rain", productLine: "RN Rotary Nozzle", model: "Pro-S + RN Rotary Nozzle", maxPressure: 70, nozzles: kRainRnNozzles, notes: "RN nozzles perform best near 40 psi; regulate the zone if static pressure is high." }),
];

/** Typical contractor cost (USD) used to seed the material price list. */
export const MANUFACTURER_HEAD_PRICE: Record<string, number> = {
  "hun-pgp-ultra": 16,
  "hun-i20": 24,
  "hun-i20-6": 34,
  "hun-i20-12": 42,
  "hun-pgj": 14,
  "rb-5004-plus": 15.5,
  "rb-5004-plus-prs": 22,
  "rb-5006-plus": 30,
  "rb-3504": 12.5,
  "rb-falcon-6504": 68,
  "toro-t5": 17,
  "toro-super-800": 22,
  "toro-mini-8": 12,
  "krain-proplus": 15,
  "krain-minipro": 11,
  // spray bodies (nozzle priced separately)
  "rb-1804prs-van": 6.5,
  "rb-1804prs-hevan": 6.5,
  "hun-prs30-proadj": 6.25,
  "toro-570z-prx-van": 6,
  "krain-pros-prs-van": 5.75,
  "hun-prs40-mp": 6.5,
  "hun-prs40-mp-strip": 6.5,
  "rb-1804-rvan": 6.75,
  "rb-1804-rvan-strip": 6.75,
  "toro-570z-prn": 6,
  "krain-pros-rn": 5.75,
};

export const MANUFACTURER_NOZZLE_PRICE: Record<string, number> = {
  "rb-1804prs-van": 2.4,
  "rb-1804prs-hevan": 3.1,
  "hun-prs30-proadj": 2.3,
  "toro-570z-prx-van": 2.2,
  "krain-pros-prs-van": 2.1,
  "hun-prs40-mp": 6.9,
  "hun-prs40-mp-strip": 6.9,
  "rb-1804-rvan": 6.2,
  "rb-1804-rvan-strip": 6.2,
  "toro-570z-prn": 5.9,
  "krain-pros-rn": 5.6,
};

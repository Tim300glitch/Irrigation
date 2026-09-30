/**
 * ZONE SCHEDULING & WATER USE — PLANNING RECOMMENDATIONS ONLY.
 * Actual irrigation needs depend on local weather, season, soil, plant health
 * and water-agency regulations.
 *
 * Method (landscape-coefficient approach):
 *   plant need (in/week) = ETo_week × Kc × sun factor
 *   gross application    = need / application efficiency
 *   runtime (min/week)   = gross / PR × 60
 *   max cycle (min)      = soil allowable depth per cycle × slope factor / PR × 60
 *   gallons per cycle    = zone GPM × runtime per watering day
 * ETo tables are approximate monthly reference evapotranspiration normals for
 * broad climate regions (inches/month). The `ClimateProvider` interface allows
 * a future weather/ET feed (e.g. CIMIS) to replace these static values.
 */
import type { ClimateId, PlantType, SoilType, SunExposure, Zone } from "../model/types";
import type { ZoneResult } from "../hydraulics/analysis";
import { APPLICATION_EFFICIENCY, type PrecipClass } from "./sprinkler";

export const CLIMATES: Record<ClimateId, { name: string; etoMonthly: number[] }> = {
  "ca-coastal": { name: "California coastal", etoMonthly: [1.9, 2.2, 3.3, 4.2, 4.8, 5.2, 5.5, 5.3, 4.4, 3.4, 2.3, 1.8] },
  "ca-inland": { name: "California inland valley", etoMonthly: [1.6, 2.4, 3.9, 5.3, 6.8, 7.8, 8.4, 7.4, 5.7, 4.0, 2.2, 1.4] },
  "ca-desert": { name: "California low desert", etoMonthly: [2.6, 3.7, 5.9, 8.0, 10.1, 10.9, 11.0, 10.1, 8.2, 6.0, 3.5, 2.4] },
  "pacific-nw": { name: "Pacific Northwest", etoMonthly: [0.6, 1.0, 1.8, 2.8, 3.9, 4.6, 5.5, 4.8, 3.1, 1.7, 0.8, 0.5] },
  southwest: { name: "Southwest desert (AZ/NV)", etoMonthly: [2.8, 3.8, 5.8, 7.6, 9.5, 10.4, 10.2, 9.2, 7.8, 5.9, 3.7, 2.6] },
  southeast: { name: "Southeast humid", etoMonthly: [1.8, 2.3, 3.6, 4.7, 5.5, 5.7, 5.8, 5.3, 4.4, 3.4, 2.3, 1.7] },
  midwest: { name: "Midwest", etoMonthly: [0.6, 1.0, 2.1, 3.4, 4.6, 5.5, 6.0, 5.2, 3.8, 2.4, 1.1, 0.6] },
  northeast: { name: "Northeast", etoMonthly: [0.6, 0.9, 1.9, 3.1, 4.3, 5.0, 5.4, 4.6, 3.3, 2.0, 1.0, 0.6] },
};

export interface ClimateProvider {
  etoInchesPerWeek(climate: ClimateId, month: number): number;
}

export const staticClimate: ClimateProvider = {
  etoInchesPerWeek(climate, month) {
    const m = CLIMATES[climate].etoMonthly[month];
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    return (m / days) * 7;
  },
};

export const PLANT_KC: Record<PlantType, { kc: number; label: string }> = {
  "cool-turf": { kc: 0.8, label: "Cool-season turf (fescue, rye, bluegrass)" },
  "warm-turf": { kc: 0.6, label: "Warm-season turf (bermuda, zoysia, St. Augustine)" },
  shrubs: { kc: 0.5, label: "Shrubs (moderate water)" },
  groundcover: { kc: 0.5, label: "Groundcover" },
  trees: { kc: 0.5, label: "Trees" },
  "low-water": { kc: 0.3, label: "Low-water / native plants" },
  annuals: { kc: 0.8, label: "Annual flowers / vegetables" },
};

export const SUN_FACTOR: Record<SunExposure, number> = { full: 1, partial: 0.8, shade: 0.6 };

/** infiltration-based allowable depth per cycle (in) and soak time (min) */
export const SOIL: Record<SoilType, { label: string; depthPerCycle: number; soakMin: number; intakeInHr: number }> = {
  sand: { label: "Sand", depthPerCycle: 0.5, soakMin: 30, intakeInHr: 0.8 },
  "sandy-loam": { label: "Sandy loam", depthPerCycle: 0.35, soakMin: 40, intakeInHr: 0.5 },
  loam: { label: "Loam", depthPerCycle: 0.25, soakMin: 45, intakeInHr: 0.35 },
  "clay-loam": { label: "Clay loam", depthPerCycle: 0.18, soakMin: 60, intakeInHr: 0.25 },
  clay: { label: "Clay", depthPerCycle: 0.12, soakMin: 60, intakeInHr: 0.15 },
};

export function slopeFactor(slopePct: number): number {
  if (slopePct <= 5) return 1;
  if (slopePct <= 8) return 0.8;
  if (slopePct <= 12) return 0.6;
  if (slopePct <= 20) return 0.4;
  return 0.25;
}

export interface ZoneScheduleResult {
  zoneId: string;
  precipInHr: number;
  efficiency: number;
  needInWeek: number;
  grossInWeek: number;
  runtimeMinWeek: number;
  runtimeMinDay: number;
  cycles: number;
  cycleMin: number;
  soakMin: number;
  gallonsPerDay: number;
  gallonsPerWeek: number;
  gallonsPerMonth: number;
}

export function scheduleZone(zone: Zone, zr: ZoneResult, cls: PrecipClass, climate: ClimateId, month: number, provider: ClimateProvider = staticClimate): ZoneScheduleResult {
  const pr = cls === "drip" ? Math.max(zr.avgPrecip, 0.3) : zr.avgPrecip || 0.4;
  const eff = zone.schedule.efficiencyOverride ?? APPLICATION_EFFICIENCY[cls];
  const eto = provider.etoInchesPerWeek(climate, month);
  const need = eto * PLANT_KC[zone.plantType].kc * SUN_FACTOR[zone.sun];
  const gross = need / eff;
  const runtimeWeek = pr > 0 ? (gross / pr) * 60 : 0;
  const days = Math.max(1, Math.min(7, zone.schedule.daysPerWeek));
  const perDay = zone.schedule.runtimeOverrideMin ?? runtimeWeek / days;
  const soil = SOIL[zone.soil];
  const maxCycle = pr > 0 ? ((soil.depthPerCycle * slopeFactor(zone.slopePct)) / pr) * 60 : perDay;
  const cycles = Math.max(1, Math.ceil(perDay / Math.max(maxCycle, 1)));
  const gpd = zr.gpm * perDay;
  return {
    zoneId: zone.id,
    precipInHr: pr,
    efficiency: eff,
    needInWeek: need,
    grossInWeek: gross,
    runtimeMinWeek: perDay * days,
    runtimeMinDay: perDay,
    cycles,
    cycleMin: perDay / cycles,
    soakMin: cycles > 1 ? soil.soakMin : 0,
    gallonsPerDay: gpd,
    gallonsPerWeek: gpd * days,
    gallonsPerMonth: gpd * days * 4.345,
  };
}

/**
 * Water-use comparison (estimate only — not guaranteed savings).
 * Water required = area × need / efficiency (0.623 gal per sq ft per inch).
 */
export function waterForArea(areaSqFt: number, needInWeek: number, efficiency: number): number {
  return (areaSqFt * needInWeek * 0.623) / Math.max(efficiency, 0.05);
}

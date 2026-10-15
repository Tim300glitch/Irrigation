/**
 * Whole-project water use from the zone schedules (planning estimate only).
 * Shared by the scheduling dialog and the PDF export so both show the same totals.
 */
import type { ClimateId, Project, Zone } from "../model/types";
import type { HydraulicResult, ZoneResult } from "../hydraulics/analysis";
import { scheduleZone, type ZoneScheduleResult } from "./schedule";
import { headPerformance, precipClass, type PrecipClass } from "./sprinkler";
import { dripCalc } from "./drip";

export interface ZoneWaterUse {
  z: Zone;
  zr: ZoneResult;
  cls: PrecipClass;
  s: ZoneScheduleResult;
}

export function zoneWaterUse(project: Project, hyd: HydraulicResult, climate: ClimateId, month: number): ZoneWaterUse[] {
  return [...project.zones]
    .sort((a, b) => a.number - b.number)
    .flatMap((z) => {
      const zr0 = hyd.zones.find((r) => r.zoneId === z.id);
      if (!zr0) return [];
      const h = project.sprinklers.find((s) => s.zoneId === z.id);
      const drip = project.drips.find((d) => d.zoneId === z.id);
      const cls: PrecipClass = h ? precipClass(headPerformance(h).product.category) : drip ? "drip" : "spray";
      const zr = cls === "drip" && drip ? { ...zr0, avgPrecip: dripCalc(drip).precipInHr } : zr0;
      return [{ z, zr, cls, s: scheduleZone(z, zr, cls, climate, month) }];
    });
}

export interface WaterUseTotals {
  month: number;
  /** all zones, before smart-controller savings */
  gallonsPerWeek: number;
  gallonsPerMonth: number;
  gallonsPerYear: number;
  /** 1 − smart-controller savings when the design has a smart controller, else 1 */
  smartFactor: number;
}

export function projectWaterUse(project: Project, hyd: HydraulicResult, month: number, climate: ClimateId = project.comparison.climate): WaterUseTotals {
  const rows = zoneWaterUse(project, hyd, climate, month);
  let year = 0;
  for (let mi = 0; mi < 12; mi++) for (const r of rows) year += scheduleZone(r.z, r.zr, r.cls, climate, mi).gallonsPerMonth;
  const smart = project.equipment.some((e) => e.type === "smart-controller");
  return {
    month,
    gallonsPerWeek: rows.reduce((a, r) => a + r.s.gallonsPerWeek, 0),
    gallonsPerMonth: rows.reduce((a, r) => a + r.s.gallonsPerMonth, 0),
    gallonsPerYear: year,
    smartFactor: smart ? 1 - project.comparison.smartControllerSavingsPct / 100 : 1,
  };
}

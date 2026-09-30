"use client";
import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { Field, Modal, NumberInput, Select, Stat } from "../../ui";
import { CLIMATES, PLANT_KC, SOIL, scheduleZone, staticClimate, waterForArea, SUN_FACTOR } from "@/lib/irrigation/schedule";
import { headPerformance, precipClass, type PrecipClass } from "@/lib/irrigation/sprinkler";
import type { ClimateId, PlantType, SoilType, SunExposure } from "@/lib/model/types";
import { dripCalc } from "@/lib/irrigation/drip";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_EFF: Record<string, number> = { spray: 0.55, rotor: 0.65, impact: 0.6, mixed: 0.58 };

export function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const [month, setMonth] = useState(6);
  const cmp = project.comparison;
  const zoneCls = (zid: string): PrecipClass => {
    const h = project.sprinklers.find((s) => s.zoneId === zid);
    if (h) return precipClass(headPerformance(h).product.category);
    return project.drips.some((d) => d.zoneId === zid) ? "drip" : "spray";
  };
  const rows = useMemo(() => {
    if (!analysis) return [];
    return [...project.zones]
      .sort((a, b) => a.number - b.number)
      .map((z) => {
        const zr = analysis.hyd.zones.find((r) => r.zoneId === z.id)!;
        const cls = zoneCls(z.id);
        const zrAdj = cls === "drip" && project.drips.some((d) => d.zoneId === z.id) ? { ...zr, avgPrecip: dripCalc(project.drips.find((d) => d.zoneId === z.id)!).precipInHr } : zr;
        return { z, zr, cls, s: scheduleZone(z, zrAdj, cls, cmp.climate, month) };
      });
  }, [project, analysis, month, cmp.climate]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!analysis) return null;
  const perCycle = rows.reduce((a, r) => a + r.zr.gpm * r.s.runtimeMinDay, 0);
  const monthly = rows.reduce((a, r) => a + r.s.gallonsPerMonth, 0);
  const annual = MONTHS.reduce((acc, _m, mi) => acc + rows.reduce((a, r) => a + scheduleZone(r.z, r.zr, r.cls, cmp.climate, mi).gallonsPerMonth, 0), 0);
  const smart = project.equipment.some((e) => e.type === "smart-controller");
  const proposedMonthly = monthly * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1);
  // current system estimate
  const irrigatedArea = analysis.totals.irrigatedArea;
  const eto = staticClimate.etoInchesPerWeek(cmp.climate, month);
  const avgKc = project.zones.length ? project.zones.reduce((a, z) => a + PLANT_KC[z.plantType].kc * SUN_FACTOR[z.sun], 0) / project.zones.length : 0.7;
  const currentMonthly = cmp.currentGpm && cmp.currentRuntimeMinPerWeek ? cmp.currentGpm * cmp.currentRuntimeMinPerWeek * 4.345 : waterForArea(irrigatedArea, eto * avgKc, CURRENT_EFF[cmp.currentSystemType]) * 4.345 * (cmp.currentController === "timer" ? 1.15 : 1);
  const savings = currentMonthly - proposedMonthly;
  const upZone = (id: string, fn: (z: (typeof project.zones)[number]) => void) => apply((d) => fn(d.zones.find((x) => x.id === id)!));
  return (
    <Modal open onClose={onClose} title="Zone scheduling & water use" subtitle="PLANNING RECOMMENDATIONS ONLY — actual schedules depend on local weather, season, soil, plant needs and water-agency rules." width={1100}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Climate (reference ETo)" className="w-60">
          <Select value={cmp.climate} onChange={(v: ClimateId) => apply((d) => void (d.comparison.climate = v))} options={(Object.keys(CLIMATES) as ClimateId[]).map((c) => ({ value: c, label: CLIMATES[c].name }))} />
        </Field>
        <Field label="Month" className="w-28">
          <Select value={month} onChange={setMonth} options={MONTHS.map((m, i) => ({ value: i, label: m }))} />
        </Field>
        <div className="pb-1 text-[12px] text-slate-500">ETo {CLIMATES[cmp.climate].etoMonthly[month]} in/month ({eto.toFixed(2)} in/week). Landscape coefficient method; weather-based (ET) scheduling can replace these static values.</div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Zone", "Plant type", "Sun", "Soil", "Slope", "Days/wk", "PR in/h", "Need in/wk", "Min/day", "Cycles × min", "Soak", "Gal/day", "Gal/month"].map((c) => (
                <th key={c} className="px-2 py-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(({ z, s }) => (
              <tr key={z.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-semibold">
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                  {z.number}
                </td>
                <td className="px-1">
                  <Select className="h-7 w-40 text-[12px]" value={z.plantType} onChange={(v: PlantType) => upZone(z.id, (x) => void (x.plantType = v))} options={(Object.keys(PLANT_KC) as PlantType[]).map((k) => ({ value: k, label: PLANT_KC[k].label.split(" (")[0] }))} />
                </td>
                <td className="px-1">
                  <Select className="h-7 w-24 text-[12px]" value={z.sun} onChange={(v: SunExposure) => upZone(z.id, (x) => void (x.sun = v))} options={[{ value: "full", label: "Full" }, { value: "partial", label: "Partial" }, { value: "shade", label: "Shade" }]} />
                </td>
                <td className="px-1">
                  <Select className="h-7 w-28 text-[12px]" value={z.soil} onChange={(v: SoilType) => upZone(z.id, (x) => void (x.soil = v))} options={(Object.keys(SOIL) as SoilType[]).map((k) => ({ value: k, label: SOIL[k].label }))} />
                </td>
                <td className="px-1">
                  <NumberInput className="w-16" value={z.slopePct} step={1} min={0} suffix="%" onChange={(v) => upZone(z.id, (x) => void (x.slopePct = v))} />
                </td>
                <td className="px-1">
                  <NumberInput className="w-14" value={z.schedule.daysPerWeek} step={1} min={1} max={7} onChange={(v) => upZone(z.id, (x) => void (x.schedule.daysPerWeek = v))} />
                </td>
                <td className="px-2">{s.precipInHr.toFixed(2)}</td>
                <td className="px-2">{s.needInWeek.toFixed(2)}</td>
                <td className="px-2 font-semibold">{s.runtimeMinDay.toFixed(0)}</td>
                <td className="whitespace-nowrap px-2">
                  {s.cycles} × {s.cycleMin.toFixed(0)}
                </td>
                <td className="whitespace-nowrap px-2">{s.soakMin ? `${s.soakMin} min` : "—"}</td>
                <td className="px-2">{s.gallonsPerDay.toFixed(0)}</td>
                <td className="px-2">{s.gallonsPerMonth.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_1.3fr] gap-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Estimated water use — proposed design</div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Per irrigation cycle" value={`${perCycle.toFixed(0)} gal`} sub="all zones, one day" />
            <Stat label={`${MONTHS[month]} (est.)`} value={`${proposedMonthly.toFixed(0)} gal`} sub={smart ? `incl. ${cmp.smartControllerSavingsPct}% smart controller` : "timer schedule"} />
            <Stat label="Annual (est.)" value={`${Math.round(annual * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1)).toLocaleString()} gal`} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Runtime = weekly plant need ÷ application efficiency ÷ precipitation rate. Cycle length limited by soil intake and slope to prevent runoff.</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Current system vs proposed system ({MONTHS[month]})</div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Current heads">
              <Select value={cmp.currentSystemType} onChange={(v) => apply((d) => void (d.comparison.currentSystemType = v))} options={[{ value: "spray", label: "Sprays" }, { value: "rotor", label: "Rotors" }, { value: "impact", label: "Impacts" }, { value: "mixed", label: "Mixed" }]} />
            </Field>
            <Field label="Current controller">
              <Select value={cmp.currentController} onChange={(v) => apply((d) => void (d.comparison.currentController = v))} options={[{ value: "timer", label: "Timer" }, { value: "smart", label: "Smart" }]} />
            </Field>
            <Field label="Measured GPM">
              <NumberInput allowEmpty value={cmp.currentGpm} step={0.5} min={0} onChange={(v) => apply((d) => void (d.comparison.currentGpm = v || undefined))} />
            </Field>
            <Field label="Min / week">
              <NumberInput allowEmpty value={cmp.currentRuntimeMinPerWeek} step={5} min={0} onChange={(v) => apply((d) => void (d.comparison.currentRuntimeMinPerWeek = v || undefined))} />
            </Field>
            <Field label="Smart savings" className="col-span-2">
              <NumberInput value={cmp.smartControllerSavingsPct} suffix="%" step={1} min={0} max={50} onChange={(v) => apply((d) => void (d.comparison.smartControllerSavingsPct = v))} />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-2.5">
            <Stat label="Current (est.)" value={`${currentMonthly.toFixed(0)} gal/mo`} sub={cmp.currentGpm ? "from measured flow & runtime" : `${Math.round(CURRENT_EFF[cmp.currentSystemType] * 100)}% efficiency assumed`} />
            <Stat label="Proposed (est.)" value={`${proposedMonthly.toFixed(0)} gal/mo`} />
            <Stat label="Estimated savings" value={<span className={savings > 0 ? "text-emerald-700" : "text-slate-700"}>{savings > 0 ? `${savings.toFixed(0)} gal/mo` : "—"}</span>} sub={currentMonthly > 0 && savings > 0 ? `${((savings / currentMonthly) * 100).toFixed(0)}% (estimate)` : undefined} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Savings are estimates for planning and customer discussion, not guaranteed results. Actual use depends on weather, maintenance, schedule management and local restrictions.</p>
        </div>
      </div>
    </Modal>
  );
}

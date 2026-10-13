"use client";
import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button, Field, Modal, NumberInput, Select, Stat, cn } from "../../ui";
import { CLIMATES, PLANT_KC, SOIL, scheduleZone, staticClimate, waterForArea, SUN_FACTOR, suggestSchedule, wateringDaysPerWeek, DAY_PATTERNS } from "@/lib/irrigation/schedule";
import { headPerformance, precipClass, type PrecipClass } from "@/lib/irrigation/sprinkler";
import type { ClimateId, PlantType, SoilType, SunExposure } from "@/lib/model/types";
import { dripCalc } from "@/lib/irrigation/drip";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
        return { z, zr: zrAdj, cls, s: scheduleZone(z, zrAdj, cls, cmp.climate, month) };
      });
  }, [project, analysis, month, cmp.climate]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!analysis) return null;
  const weekly = rows.reduce((a, r) => a + r.s.gallonsPerWeek, 0);
  const minutesWeek = rows.reduce((a, r) => a + r.s.runtimeMinWeek, 0);
  const daysOf = (z: (typeof project.zones)[number]) => z.schedule.days ?? DAY_PATTERNS[wateringDaysPerWeek(z)];
  const byWeekday = WEEKDAYS.map((_d, wd) => rows.reduce((a, r) => a + (daysOf(r.z).includes(wd) ? r.s.gallonsPerDay : 0), 0));
  const maxDay = Math.max(1, ...byWeekday);
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
  const toggleDay = (z: (typeof project.zones)[number], wd: number) =>
    upZone(z.id, (x) => {
      const cur = new Set(x.schedule.days ?? DAY_PATTERNS[wateringDaysPerWeek(x)]);
      if (cur.has(wd)) {
        if (cur.size === 1) return; // at least one watering day
        cur.delete(wd);
      } else cur.add(wd);
      x.schedule.days = [...cur].sort((a, b) => a - b);
      x.schedule.daysPerWeek = x.schedule.days.length;
    });
  const autoSuggest = () => {
    const runMinutes = (z: (typeof project.zones)[number], daysPerWeek: number) => {
      const r = rows.find((x) => x.z.id === z.id)!;
      return scheduleZone({ ...z, schedule: { ...z.schedule, daysPerWeek, days: undefined, runtimeOverrideMin: undefined, cyclesOverride: undefined } }, r.zr, r.cls, cmp.climate, month).runtimeMinDay;
    };
    const plan = suggestSchedule(project.zones, cmp.climate, month, runMinutes);
    apply((d) => {
      for (const p of plan) {
        const z = d.zones.find((x) => x.id === p.zoneId);
        if (!z) continue;
        z.schedule.daysPerWeek = p.daysPerWeek;
        z.schedule.days = [...p.days];
        z.schedule.startTime = p.startTime;
        delete z.schedule.runtimeOverrideMin;
        delete z.schedule.cyclesOverride;
      }
    });
  };
  return (
    <Modal open onClose={onClose} title="Zone scheduling & water use" subtitle="PLANNING RECOMMENDATIONS ONLY — actual schedules depend on local weather, season, soil, plant needs and water-agency rules." width={1280}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Climate (reference ETo)" className="w-60">
          <Select value={cmp.climate} onChange={(v: ClimateId) => apply((d) => void (d.comparison.climate = v))} options={(Object.keys(CLIMATES) as ClimateId[]).map((c) => ({ value: c, label: CLIMATES[c].name }))} />
        </Field>
        <Field label="Month" className="w-28">
          <Select value={month} onChange={setMonth} options={MONTHS.map((m, i) => ({ value: i, label: m }))} />
        </Field>
        <Button variant="primary" onClick={autoSuggest} title="Fill in watering days, start times and run times for every zone based on soil, plants and the selected month. Replaces your manual edits.">
          <Sparkles size={14} /> Auto-suggest schedule
        </Button>
        <div className="basis-full pb-1 text-[12px] text-slate-500">ETo {CLIMATES[cmp.climate].etoMonthly[month]} in/month ({eto.toFixed(2)} in/week). Click days to turn watering on or off, type a start time, or type your own minutes and cycles; the reset arrow goes back to the recommended run time.</div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Zone", "Plant type", "Sun", "Soil", "Slope", "Watering days", "Start", "PR in/h", "Need in/wk", "Min/day", "Cycles × min", "Soak", "Gal/day", "Gal/week", "Gal/month"].map((c) => (
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
                  <Select className="h-7 w-32 text-[12px]" value={z.plantType} onChange={(v: PlantType) => upZone(z.id, (x) => void (x.plantType = v))} options={(Object.keys(PLANT_KC) as PlantType[]).map((k) => ({ value: k, label: PLANT_KC[k].label.split(" (")[0] }))} />
                </td>
                <td className="px-1">
                  <Select className="h-7 w-[76px] text-[12px]" value={z.sun} onChange={(v: SunExposure) => upZone(z.id, (x) => void (x.sun = v))} options={[{ value: "full", label: "Full" }, { value: "partial", label: "Partial" }, { value: "shade", label: "Shade" }]} />
                </td>
                <td className="px-1">
                  <Select className="h-7 w-24 text-[12px]" value={z.soil} onChange={(v: SoilType) => upZone(z.id, (x) => void (x.soil = v))} options={(Object.keys(SOIL) as SoilType[]).map((k) => ({ value: k, label: SOIL[k].label }))} />
                </td>
                <td className="px-1">
                  <NumberInput className="w-16" value={z.slopePct} step={1} min={0} suffix="%" onChange={(v) => upZone(z.id, (x) => void (x.slopePct = v))} />
                </td>
                <td className="px-1">
                  <div className="flex gap-0.5">
                    {WEEKDAYS.map((d, wd) => {
                      const on = daysOf(z).includes(wd);
                      return (
                        <button key={wd} type="button" title={WEEKDAY_NAMES[wd]} onClick={() => toggleDay(z, wd)} className={cn("h-6 w-5 rounded text-[10.5px] font-semibold", on ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="px-1">
                  <input type="time" className="h-7 w-[104px] rounded-md border border-slate-300 px-1 text-[12px]" value={z.schedule.startTime ?? ""} onChange={(e) => upZone(z.id, (x) => void (e.target.value ? (x.schedule.startTime = e.target.value) : delete x.schedule.startTime))} />
                </td>
                <td className="px-2">{s.precipInHr.toFixed(2)}</td>
                <td className="px-2">{s.needInWeek.toFixed(2)}</td>
                <td className="px-1">
                  <div className="flex items-center gap-0.5">
                    <NumberInput className="w-14" inputClassName={z.schedule.runtimeOverrideMin !== undefined ? "font-semibold text-amber-700" : "font-semibold"} value={Math.round(s.runtimeMinDay)} step={1} min={1} max={240} onChange={(v) => upZone(z.id, (x) => void (x.schedule.runtimeOverrideMin = v))} />
                    {z.schedule.runtimeOverrideMin !== undefined && (
                      <button type="button" title="Back to recommended run time" className="text-slate-400 hover:text-slate-700" onClick={() => upZone(z.id, (x) => void delete x.schedule.runtimeOverrideMin)}>
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-1">
                  <div className="flex items-center gap-1">
                    <NumberInput className="w-11" inputClassName={z.schedule.cyclesOverride !== undefined ? "text-amber-700" : undefined} value={s.cycles} step={1} min={1} max={6} onChange={(v) => upZone(z.id, (x) => void (x.schedule.cyclesOverride = Math.round(v)))} />
                    <span>× {s.cycleMin.toFixed(0)}</span>
                    {z.schedule.cyclesOverride !== undefined && (
                      <button type="button" title="Back to recommended cycles" className="text-slate-400 hover:text-slate-700" onClick={() => upZone(z.id, (x) => void delete x.schedule.cyclesOverride)}>
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2">{s.soakMin ? `${s.soakMin} min` : "—"}</td>
                <td className="px-2">{s.gallonsPerDay.toFixed(0)}</td>
                <td className="px-2">{s.gallonsPerWeek.toFixed(0)}</td>
                <td className="px-2">{s.gallonsPerMonth.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tabular border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td className="px-2 py-1.5" colSpan={9}>
                Total — all {rows.length} zones
              </td>
              <td className="px-2" colSpan={4}>
                {Math.round(minutesWeek)} min/week
              </td>
              <td className="px-2">{Math.round(weekly).toLocaleString()}</td>
              <td className="px-2">{Math.round(monthly).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_1.3fr] gap-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Estimated water use — proposed design</div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Per week (est.)" value={`${Math.round(weekly * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1)).toLocaleString()} gal`} sub={smart ? "all zones, after smart savings" : "all zones"} />
            <Stat label={`${MONTHS[month]} (est.)`} value={`${Math.round(proposedMonthly).toLocaleString()} gal`} sub={smart ? `incl. ${cmp.smartControllerSavingsPct}% smart controller` : "timer schedule"} />
            <Stat label="Annual (est.)" value={`${Math.round(annual * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1)).toLocaleString()} gal`} />
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10.5px]">
            {byWeekday.map((g, wd) => (
              <div key={wd} title={`${WEEKDAY_NAMES[wd]}: ${Math.round(g)} gal`}>
                <div className="flex h-10 items-end justify-center">
                  <div className="w-4 rounded-t bg-sky-500" style={{ height: `${Math.max(g > 0 ? 6 : 0, (g / maxDay) * 100)}%` }} />
                </div>
                <div className="text-slate-500">{WEEKDAY_NAMES[wd]}</div>
                <div className="tabular font-medium">{Math.round(g)}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Gallons by day of the week, all zones. Runtime = weekly plant need ÷ application efficiency ÷ precipitation rate. Cycle length limited by soil intake and slope to prevent runoff.</p>
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

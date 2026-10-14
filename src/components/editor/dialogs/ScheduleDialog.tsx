"use client";
import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAnalysis } from "@/store/analysisStore";
import { Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button, Field, Modal, NumberInput, Select, Stat, Toggle, cn } from "../../ui";
import { CLIMATES, PLANT_KC, SOIL, scheduleZone, staticClimate, waterForArea, SUN_FACTOR, suggestSchedule, wateringDaysPerWeek, DAY_PATTERNS } from "@/lib/irrigation/schedule";
import { projectWaterUse, zoneWaterUse } from "@/lib/irrigation/waterUse";
import type { ClimateId, WaterPriceUnit, HeadBodyId, HeadGroup, NozzleTypeId, PlantType, SoilType, SunExposure } from "@/lib/model/types";
import { PRICE_UNITS, STATE_WATER_RATES, stateFromAddress, waterPrice } from "@/lib/irrigation/waterRates";
import { HEAD_BODIES, KIND_LABEL, NOZZLE_TYPES, currentHeadGroups, groupEfficiency, mixEfficiency, nozzleForBody, nozzlesFor } from "@/lib/irrigation/headTypes";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BODY_OPTIONS = (Object.keys(HEAD_BODIES) as HeadBodyId[]).map((b) => ({ value: b, label: HEAD_BODIES[b].label, group: KIND_LABEL[HEAD_BODIES[b].kind] }));

/** Rows of head body + nozzle type + share of the area, for the savings comparison. */
function HeadMixEditor({ groups, onChange }: { groups: HeadGroup[]; onChange: (g: HeadGroup[]) => void }) {
  const set = (i: number, g: HeadGroup) => onChange(groups.map((x, j) => (j === i ? g : x)));
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_76px_36px_16px] gap-1.5 text-[10.5px] uppercase tracking-wide text-slate-500">
        <span>Head body</span>
        <span>Nozzle</span>
        <span>% of area</span>
        <span>Eff.</span>
        <span />
      </div>
      {groups.map((g, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_76px_36px_16px] items-center gap-1.5">
          <Select className="h-7 text-[12px]" value={g.body} onChange={(b: HeadBodyId) => set(i, { ...g, body: b, nozzle: nozzleForBody(b, g.nozzle) })} options={BODY_OPTIONS} />
          <Select className="h-7 text-[12px]" value={g.nozzle} onChange={(n: NozzleTypeId) => set(i, { ...g, nozzle: n })} options={nozzlesFor(g.body).map((n) => ({ value: n, label: NOZZLE_TYPES[n].label }))} />
          <NumberInput value={g.sharePct} step={5} min={0} max={100} suffix="%" onChange={(v) => set(i, { ...g, sharePct: v })} />
          <span className="tabular text-[11.5px] text-slate-600">{Math.round(groupEfficiency(g) * 100)}%</span>
          <button type="button" title="Remove" disabled={groups.length === 1} className="text-slate-400 hover:text-red-600 disabled:opacity-30" onClick={() => onChange(groups.filter((_x, j) => j !== i))}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" className="flex items-center gap-1 text-[12px] font-medium text-sky-700 hover:text-sky-900" onClick={() => onChange([...groups, { body: "spray-4-prs", nozzle: "mp-rotator", sharePct: 0 }])}>
        <Plus size={13} /> Add head type
      </button>
    </div>
  );
}


export function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const analysis = useAnalysis();
  const [month, setMonth] = useState(6);
  const cmp = project.comparison;
  const rows = useMemo(() => (analysis ? zoneWaterUse(project, analysis.hyd, cmp.climate, month) : []), [project, analysis, month, cmp.climate]);
  if (!analysis) return null;
  const weekly = rows.reduce((a, r) => a + r.s.gallonsPerWeek, 0);
  const minutesWeek = rows.reduce((a, r) => a + r.s.runtimeMinWeek, 0);
  const daysOf = (z: (typeof project.zones)[number]) => z.schedule.days ?? DAY_PATTERNS[wateringDaysPerWeek(z)];
  const byWeekday = WEEKDAYS.map((_d, wd) => rows.reduce((a, r) => a + (daysOf(r.z).includes(wd) ? r.s.gallonsPerDay : 0), 0));
  const maxDay = Math.max(1, ...byWeekday);
  const use = projectWaterUse(project, analysis.hyd, month);
  const monthly = use.gallonsPerMonth;
  const annual = use.gallonsPerYear;
  const smart = use.smartFactor < 1;
  const proposedMonthly = monthly * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1);
  // current system estimate
  const irrigatedArea = analysis.totals.irrigatedArea;
  const eto = staticClimate.etoInchesPerWeek(cmp.climate, month);
  const avgKc = project.zones.length ? project.zones.reduce((a, z) => a + PLANT_KC[z.plantType].kc * SUN_FACTOR[z.sun], 0) / project.zones.length : 0.7;
  const curHeads = currentHeadGroups(cmp);
  const curEff = mixEfficiency(curHeads);
  const currentMonthly = cmp.currentGpm && cmp.currentRuntimeMinPerWeek ? cmp.currentGpm * cmp.currentRuntimeMinPerWeek * 4.345 : waterForArea(irrigatedArea, eto * avgKc, curEff) * 4.345 * (cmp.currentController === "timer" ? 1.15 : 1);
  const propHeads = cmp.proposedHeads;
  const propEff = propHeads?.length ? mixEfficiency(propHeads) : undefined;
  const compareProposed = propEff ? waterForArea(irrigatedArea, eto * avgKc, propEff) * 4.345 * use.smartFactor : proposedMonthly;
  const savings = currentMonthly - compareProposed;
  const price = waterPrice(cmp, project.meta.address);
  const detectedState = stateFromAddress(project.meta.address);
  const wp = cmp.waterPrice ?? { mode: "auto" as const, amount: 0, unit: "kgal" as WaterPriceUnit };
  const setWp = (patch: Partial<typeof wp>) => apply((d) => void (d.comparison.waterPrice = { ...wp, ...patch }));
  const usd = (gal: number) => `$${(gal * price.perGallon).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="grid grid-cols-[1fr_1fr] gap-x-6 rounded-lg border border-slate-200 p-3">
          <div className="col-span-2 mb-2 text-[12.5px] font-semibold">Estimated water use — proposed design</div>
          <div className="grid grid-cols-3 content-start gap-3">
            <Stat label="Per week (est.)" value={`${Math.round(weekly * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1)).toLocaleString()} gal`} sub={smart ? "all zones, after smart savings" : "all zones"} />
            <Stat label={`${MONTHS[month]} (est.)`} value={`${Math.round(proposedMonthly).toLocaleString()} gal`} sub={smart ? `incl. ${cmp.smartControllerSavingsPct}% smart controller` : "timer schedule"} />
            <Stat label="Annual (est.)" value={`${Math.round(annual * (smart ? 1 - cmp.smartControllerSavingsPct / 100 : 1)).toLocaleString()} gal`} />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px]">
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
          <p className="col-span-2 mt-2 text-[11px] text-slate-500">Gallons by day of the week, all zones. Runtime = weekly plant need ÷ application efficiency ÷ precipitation rate. Cycle length limited by soil intake and slope to prevent runoff.</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Water cost estimate</div>
          <div className="grid grid-cols-[1fr_1fr] gap-x-6">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Water price" className="w-40">
                <Select value={wp.mode} onChange={(v: "auto" | "manual") => setWp({ mode: v, amount: v === "manual" && !wp.amount ? +(price.perGallon * PRICE_UNITS[wp.unit].gallons).toFixed(4) : wp.amount })} options={[{ value: "auto", label: "Auto (by state)" }, { value: "manual", label: "My price" }]} />
              </Field>
              {wp.mode === "auto" ? (
                <Field label="State" className="w-52">
                  <Select
                    value={wp.state ?? ""}
                    onChange={(v: string) => setWp({ state: v || undefined })}
                    options={[{ value: "", label: detectedState ? `From address (${STATE_WATER_RATES[detectedState].name})` : "From address (not found, US average)" }, ...Object.entries(STATE_WATER_RATES).map(([code, r]) => ({ value: code, label: r.name }))]}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Price" className="w-28">
                    <NumberInput value={wp.amount} step={wp.unit === "gal" ? 0.001 : 0.25} min={0} onChange={(v) => setWp({ amount: v })} />
                  </Field>
                  <Field label="Unit" className="w-48">
                    <Select value={wp.unit} onChange={(u: WaterPriceUnit) => setWp({ unit: u })} options={(Object.keys(PRICE_UNITS) as WaterPriceUnit[]).map((u) => ({ value: u, label: PRICE_UNITS[u].label }))} />
                  </Field>
                </>
              )}
              <p className="basis-full text-[11px] text-slate-500">
                Using ${(price.perGallon * 1000).toFixed(2)} per 1,000 gal (${price.perGallon.toFixed(4)}/gal), {price.source}.{price.auto ? " Auto rates are rough state averages; for an exact number, choose My price and enter the rate from a local water bill." : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 content-start gap-3">
              <Stat label="Per week (est.)" value={usd(weekly * use.smartFactor)} sub="proposed design" />
              <Stat label={`${MONTHS[month]} (est.)`} value={usd(proposedMonthly)} />
              <Stat label="Per year (est.)" value={usd(annual * use.smartFactor)} />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Current system vs proposed system ({MONTHS[month]})</div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-slate-700">Current heads</div>
              <HeadMixEditor groups={curHeads} onChange={(g) => apply((d) => void (d.comparison.currentHeads = g))} />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Field label="Current controller">
                  <Select value={cmp.currentController} onChange={(v) => apply((d) => void (d.comparison.currentController = v))} options={[{ value: "timer", label: "Timer" }, { value: "smart", label: "Smart" }]} />
                </Field>
                <Field label="Measured GPM">
                  <NumberInput allowEmpty value={cmp.currentGpm} step={0.5} min={0} onChange={(v) => apply((d) => void (d.comparison.currentGpm = v || undefined))} />
                </Field>
                <Field label="Min / week">
                  <NumberInput allowEmpty value={cmp.currentRuntimeMinPerWeek} step={5} min={0} onChange={(v) => apply((d) => void (d.comparison.currentRuntimeMinPerWeek = v || undefined))} />
                </Field>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-slate-700">Proposed heads</div>
              <Toggle
                checked={!propHeads?.length}
                onChange={(v) => apply((d) => void (v ? delete d.comparison.proposedHeads : (d.comparison.proposedHeads = [{ body: "spray-4-prs-cv", nozzle: "mp-rotator", sharePct: 100 }])))}
                label="Use the heads in this design and its schedule"
              />
              {propHeads?.length ? (
                <div className="mt-2">
                  <HeadMixEditor groups={propHeads} onChange={(g) => apply((d) => void (d.comparison.proposedHeads = g))} />
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">Turn this off to try other heads and nozzles and see how much water they would save.</p>
              )}
              <Field label="Smart controller savings" className="mt-3 w-44">
                <NumberInput value={cmp.smartControllerSavingsPct} suffix="%" step={1} min={0} max={50} onChange={(v) => apply((d) => void (d.comparison.smartControllerSavingsPct = v))} />
              </Field>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-2.5">
            <Stat label="Current (est.)" value={`${Math.round(currentMonthly).toLocaleString()} gal/mo · ${usd(currentMonthly)}`} sub={cmp.currentGpm && cmp.currentRuntimeMinPerWeek ? "from measured flow & runtime" : `${Math.round(curEff * 100)}% efficiency${cmp.currentController === "timer" ? ", timer" : ""}`} />
            <Stat label="Proposed (est.)" value={`${Math.round(compareProposed).toLocaleString()} gal/mo · ${usd(compareProposed)}`} sub={propEff ? `chosen heads, ${Math.round(propEff * 100)}% efficiency` : "from this design's schedule"} />
            <Stat label="Estimated savings" value={<span className={savings > 0 ? "text-emerald-700" : "text-slate-700"}>{savings > 0 ? `${Math.round(savings).toLocaleString()} gal/mo · ${usd(savings)}` : "—"}</span>} sub={currentMonthly > 0 && savings > 0 ? `${((savings / currentMonthly) * 100).toFixed(0)}% (estimate)` : undefined} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Savings are estimates for planning and customer discussion, not guaranteed results. Actual use depends on weather, maintenance, schedule management and local restrictions.</p>
        </div>
      </div>
    </Modal>
  );
}

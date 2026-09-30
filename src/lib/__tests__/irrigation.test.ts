import { describe, expect, test } from "vitest";
import { precipitationRate, areaPrecipitationRate, headFlow, flowAtPressure, headPerformance } from "../irrigation/sprinkler";
import { getProduct, getNozzle } from "../catalog/sprinklers";
import { headRateAt, computeCoverage } from "../irrigation/coverage";
import { createProject, makeArea, makeWaterSource, rect } from "../model/factory";
import { computeTakeoff } from "../materials/takeoff";
import { computeEstimate } from "../materials/estimate";
import { defaultMaterialProducts, findPrice } from "../materials/pricing";
import { analyzeHydraulics } from "../hydraulics/analysis";
import { autoLayoutArea } from "../irrigation/autoLayout";
import { autoZone } from "../irrigation/autoZone";
import { dripCalc } from "../irrigation/drip";
import type { Sprinkler } from "../model/types";
import { scheduleZone } from "../irrigation/schedule";
import { createDemoProject } from "../model/demo";
import { analyzeProject } from "../analysis";

describe("precipitation rate", () => {
  test("96.25 × GPM(full circle) / spacing²", () => {
    // 180° head with 2 gpm at 30 ft square spacing -> full-circle equiv 4 gpm
    expect(precipitationRate(2, 180, 30)).toBeCloseTo((96.25 * 4) / 900, 9);
  });
  test("area method", () => {
    expect(areaPrecipitationRate(10, 1000)).toBeCloseTo(0.9625, 9);
  });
  test("matched-precip nozzles scale flow with arc", () => {
    const spray = getProduct("gen-spray-4");
    const n = getNozzle(spray, "VAN-15");
    expect(headFlow(spray, n, 90)).toBeCloseTo(n.flowGpm / 4, 9);
    expect(headFlow(spray, n, 180)).toBeCloseTo(n.flowGpm / 2, 9);
    const rotor = getProduct("gen-rotor-4");
    const rn = getNozzle(rotor, "3.0");
    expect(headFlow(rotor, rn, 90)).toBe(rn.flowGpm);
  });
  test("orifice pressure/flow relation", () => {
    expect(flowAtPressure(2, 40, 160)).toBeCloseTo(4, 9);
  });
  test("radius override changes throw but not flow", () => {
    const s: Sprinkler = { id: "a", position: { x: 0, y: 0 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 180, elevation: 0, layer: "sprinklers" };
    const base = headPerformance(s);
    const cut = headPerformance({ ...s, radiusOverride: 30 });
    expect(cut.radius).toBe(30);
    expect(cut.flowGpm).toBe(base.flowGpm);
    expect(cut.radiusReduction).toBeCloseTo(1 - 30 / 39, 9);
  });
});

describe("coverage model", () => {
  test("triangular profile integrates to the head's flow", () => {
    const s: Sprinkler = { id: "a", position: { x: 0, y: 0 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 90, elevation: 0, layer: "sprinklers" };
    const perf = headPerformance(s);
    const step = 0.25;
    let sum = 0;
    for (let x = -45; x < 45; x += step) for (let y = -45; y < 45; y += step) sum += headRateAt(perf, s, { x: x + step / 2, y: y + step / 2 }) * step * step;
    // sum is in (in/hr)·ft²; divide by 96.25 to get gpm
    expect(sum / 96.25).toBeCloseTo(perf.flowGpm, 1);
  });
  test("a single head in a lawn leaves insufficient coverage", () => {
    const p = createProject();
    p.areas.push(makeArea("lawn", rect(0, 0, 40, 40)));
    p.sprinklers.push({ id: "a", position: { x: 0, y: 0 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 90, elevation: 0, layer: "sprinklers" });
    const c = computeCoverage(p)!;
    expect(c.stats.insufficientPct).toBeGreaterThan(90);
  });
});

describe("auto layout & auto zone", () => {
  test("rectangular lawn gets head-to-head layout with corner quarter circles", () => {
    const p = createProject();
    const lawn = makeArea("lawn", rect(0, 0, 60, 40));
    p.areas.push(lawn);
    const r = autoLayoutArea(p, lawn, { headClass: "rotor" });
    expect(r.heads.length).toBeGreaterThanOrEqual(6);
    const corners = r.heads.filter((h) => h.arc === 90);
    expect(corners.length).toBe(4);
    // every head inside or on the lawn
    for (const h of r.heads) {
      expect(h.position.x).toBeGreaterThanOrEqual(0);
      expect(h.position.x).toBeLessThanOrEqual(60);
    }
    const test = { ...p, sprinklers: r.heads.map((h, i) => ({ ...h, id: `h${i}` })) };
    const cov = computeCoverage(test)!;
    expect(cov.stats.insufficientPct).toBeLessThan(10);
  });
  test("narrow strip gets spray heads", () => {
    const p = createProject();
    const strip = makeArea("lawn", rect(0, 0, 60, 8));
    p.areas.push(strip);
    const r = autoLayoutArea(p, strip, { headClass: "auto" });
    expect(r.headClass).toBe("spray");
  });
  test("auto zone never exceeds the zone flow limit and never mixes rotors with sprays", () => {
    const p = createProject();
    p.waterSources.push(makeWaterSource({ x: -5, y: -5 }, { availableGpm: 12 }));
    const a = makeArea("lawn", rect(0, 0, 80, 60));
    const b = makeArea("lawn", rect(0, 70, 60, 8));
    p.areas.push(a, b);
    const ra = autoLayoutArea(p, a, { headClass: "rotor" });
    const rb = autoLayoutArea(p, b, { headClass: "spray" });
    p.sprinklers = [...ra.heads, ...rb.heads].map((h, i) => ({ ...h, id: `h${i}` }));
    let n = 0;
    const res = autoZone(p, {}, () => `id${n++}`);
    const limit = 12 * 0.9;
    for (const z of res.zones) {
      const members = p.sprinklers.filter((s) => res.assignments.get(s.id) === z.id);
      const q = members.reduce((acc, s) => acc + headPerformance(s).flowGpm, 0);
      expect(q).toBeLessThanOrEqual(limit + 1e-9);
      const cats = new Set(members.map((s) => getProduct(s.productId).category));
      expect(cats.size).toBe(1);
    }
  });
});

describe("drip", () => {
  test("tubing, emitters and flow", () => {
    const c = dripCalc({ id: "d", name: "d", points: rect(0, 0, 10, 12), productId: "gen-dripline-17", rowSpacingIn: 18, emitterSpacingIn: 12, emitterGph: 0.9, layer: "drip" });
    expect(c.area).toBe(120);
    expect(c.emitters).toBe(80); // 80 ft of dripline / 1 ft spacing
    expect(c.flowGpm).toBeCloseTo((80 * 0.9) / 60, 9);
    expect(c.precipInHr).toBeCloseTo((231 * 0.9) / (18 * 12), 9);
  });
});

describe("materials & estimate", () => {
  test("pipe takeoff lengths equal drawn lengths plus waste", () => {
    const p = createProject();
    p.estimate.pipeWastePct = 10;
    p.pipes.push({ id: "l1", kind: "lateral", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], material: "pvc-sch40", size: 1, autoSize: false, layer: "laterals" });
    p.pipes.push({ id: "l2", kind: "lateral", points: [{ x: 100, y: 0 }, { x: 100, y: 50 }], material: "pvc-sch40", size: 1, autoSize: false, layer: "laterals" });
    const t = computeTakeoff(p, analyzeHydraulics(p));
    const pipe = t.find((i) => i.key === "pipe:pvc-sch40:1")!;
    expect(pipe.quantity).toBeCloseTo(150, 6);
    expect(pipe.orderQty).toBe(165);
    // the 90° corner is an elbow; the two ends are caps
    expect(t.find((i) => i.key === "fitting:elbow90:1")?.quantity).toBe(1);
    expect(t.find((i) => i.key === "fitting:cap:1")?.quantity).toBe(2);
    // 100 ft run = 5 sticks -> 5 couplings along it
    expect(t.find((i) => i.key === "fitting:coupling:1")?.quantity).toBe(5 + 2);
  });
  test("manual fittings are counted and override inference", () => {
    const p = createProject();
    p.pipes.push({ id: "l1", kind: "lateral", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], material: "pvc-sch40", size: 1, autoSize: false, layer: "laterals" });
    p.fittings.push({ id: "f1", type: "elbow45", position: { x: 10, y: 0 }, size: 1, rotation: 0, layer: "laterals" });
    const t = computeTakeoff(p, analyzeHydraulics(p));
    expect(t.find((i) => i.key === "fitting:elbow45:1")?.quantity).toBe(1);
    expect(t.find((i) => i.key === "fitting:elbow90:1")).toBeUndefined();
  });
  test("estimate totals", () => {
    const p = createProject();
    p.pipes.push({ id: "l1", kind: "lateral", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], material: "pvc-sch40", size: 1, autoSize: false, layer: "laterals" });
    const products = defaultMaterialProducts();
    const t = computeTakeoff(p, analyzeHydraulics(p));
    const e = computeEstimate(p, t, products, { ...p.estimate, laborHoursOverride: 10, laborRate: 50, equipmentCost: 100, markupPct: 20, taxPct: 10 });
    const price = findPrice("pipe:pvc-sch40:1", products)!.price;
    const pipeLine = e.lines.find((l) => l.key === "pipe:pvc-sch40:1")!;
    expect(pipeLine.total).toBeCloseTo(100 * price, 6);
    expect(pipeLine.wasteCost).toBeCloseTo(10 * price, 6);
    const base = e.materialSubtotal + e.waste + 500 + 100;
    expect(e.markup).toBeCloseTo(base * 0.2, 6);
    expect(e.tax).toBeCloseTo((e.materialSubtotal + e.waste) * 0.1, 6);
    expect(e.total).toBeCloseTo(base * 1.2 + e.tax, 6);
  });
  test("price lookup: exact then wildcard", () => {
    const products = defaultMaterialProducts();
    expect(findPrice("head:gen-rotor-4:3.0", products)?.matchKey).toBe("head:gen-rotor-4:*");
    expect(findPrice("pipe:pvc-sch40:1", products)?.matchKey).toBe("pipe:pvc-sch40:1");
  });
});

describe("scheduling", () => {
  test("runtime = gross need / PR, split into cycles by soil intake", () => {
    const zone = { id: "z", number: 1, name: "z", color: "", plantType: "cool-turf" as const, sun: "full" as const, soil: "clay" as const, slopePct: 0, schedule: { daysPerWeek: 3 } };
    const zr = { avgPrecip: 0.5, gpm: 10 } as unknown as Parameters<typeof scheduleZone>[1];
    const r = scheduleZone(zone, zr, "rotor", "ca-inland", 6);
    const etoWeek = (8.4 / 31) * 7;
    expect(r.needInWeek).toBeCloseTo(etoWeek * 0.8, 6);
    expect(r.runtimeMinWeek).toBeCloseTo((r.needInWeek / 0.7 / 0.5) * 60, 6);
    expect(r.cycles).toBeGreaterThan(1); // clay needs cycle & soak
    expect(r.gallonsPerDay).toBeCloseTo(10 * r.runtimeMinDay, 6);
  });
});

describe("demo project", () => {
  test("generates a working three-zone rotor system", () => {
    const p = createDemoProject();
    expect(p.zones.length).toBe(3);
    expect(p.sprinklers.length).toBeGreaterThanOrEqual(15);
    expect(p.sprinklers.length).toBeLessThanOrEqual(25);
    const a = analyzeProject(p, defaultMaterialProducts());
    expect(a.warnings.filter((w) => w.severity === "error")).toHaveLength(0);
    for (const z of a.hyd.zones) expect(z.status).not.toBe("error");
    expect(a.estimate.total).toBeGreaterThan(1000);
  });
});

describe("deleting valves", () => {
  test("removes the valve's zone, renumbers zones and drops it from materials", async () => {
    const { deleteObjects } = await import("../editor/ops");
    const p = createProject();
    for (let i = 1; i <= 3; i++) {
      p.valves.push({ id: `v${i}`, type: "electric", position: { x: i * 2, y: 0 }, size: 1, name: `V${i}`, elevation: 0, layer: "valves" });
      p.zones.push({ id: `z${i}`, number: i, name: `Zone ${i}`, color: "#000", valveId: `v${i}`, plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0, schedule: { daysPerWeek: 3 } });
    }
    p.sprinklers.push({ id: "h", position: { x: 0, y: 5 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 90, zoneId: "z2", elevation: 0, layer: "sprinklers" });
    deleteObjects(p, ["v2"]);
    expect(p.zones.map((z) => [z.number, z.name, z.valveId])).toEqual([[1, "Zone 1", "v1"], [2, "Zone 2", "v3"]]);
    expect(p.valves.map((v) => v.name)).toEqual(["V1", "V2"]);
    expect(p.sprinklers[0].zoneId).toBeUndefined();
    deleteObjects(p, ["v1", "v3"]);
    expect(p.zones).toHaveLength(0);
    const t = computeTakeoff(p, analyzeHydraulics(p));
    expect(t.some((i) => i.key.startsWith("valve:") || i.key.includes("controller"))).toBe(false);
  });
});

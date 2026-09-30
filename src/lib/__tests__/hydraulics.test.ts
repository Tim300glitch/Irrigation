import { describe, expect, test } from "vitest";
import { bucketTestGpm, elevationLossPsi, flowAtVelocity, frictionLossPer100Ft, frictionLossPsi, hazenWilliamsPsiPerFt, interpolateCurve, velocityFps } from "../hydraulics/formulas";
import { insideDiameter } from "../hydraulics/pipes";
import { analyzeHydraulics, availableFlow, sourcePressure } from "../hydraulics/analysis";
import { valveLossPsi } from "../hydraulics/components";
import { createProject, makeWaterSource } from "../model/factory";
import type { Project } from "../model/types";

describe("Hazen-Williams friction loss", () => {
  test("matches published Sch 40 PVC chart (1\" @ 10 GPM ≈ 2.47 psi/100 ft, C=150)", () => {
    // Charts use ID 1.049"
    const loss = frictionLossPer100Ft(10, 1.049, 150);
    expect(loss).toBeGreaterThan(2.47 * 0.95);
    expect(loss).toBeLessThan(2.47 * 1.05);
  });
  test("2\" Sch 40 @ 50 GPM ≈ 1.8 psi/100 ft", () => {
    const loss = frictionLossPer100Ft(50, 2.067, 150);
    expect(loss).toBeGreaterThan(1.6);
    expect(loss).toBeLessThan(2.0);
  });
  test("loss scales with Q^1.852 and linearly with length", () => {
    const a = hazenWilliamsPsiPerFt(10, 1, 150);
    const b = hazenWilliamsPsiPerFt(20, 1, 150);
    expect(b / a).toBeCloseTo(2 ** 1.852, 6);
    expect(frictionLossPsi(10, 1, 150, 200)).toBeCloseTo(a * 200, 9);
  });
  test("zero or invalid inputs give zero", () => {
    expect(hazenWilliamsPsiPerFt(0, 1, 150)).toBe(0);
    expect(frictionLossPsi(10, 0, 150, 100)).toBe(0);
  });
  test("rougher pipe (lower C) loses more", () => {
    expect(hazenWilliamsPsiPerFt(10, 1, 140)).toBeGreaterThan(hazenWilliamsPsiPerFt(10, 1, 150));
  });
});

describe("velocity", () => {
  test("1\" Sch 40 (ID 1.049) @ 10 GPM ≈ 3.71 ft/s", () => {
    expect(velocityFps(10, 1.049)).toBeCloseTo(3.71, 2);
  });
  test("flowAtVelocity is the inverse of velocityFps", () => {
    const q = flowAtVelocity(5, 1.029);
    expect(velocityFps(q, 1.029)).toBeCloseTo(5, 9);
  });
  test("3/4\" Sch 40 carries ~8 GPM at 5 ft/s", () => {
    expect(flowAtVelocity(5, insideDiameter("pvc-sch40", 0.75))).toBeGreaterThan(7.5);
    expect(flowAtVelocity(5, insideDiameter("pvc-sch40", 0.75))).toBeLessThan(8.5);
  });
});

describe("elevation & flow test", () => {
  test("0.433 psi per foot", () => {
    expect(elevationLossPsi(10)).toBeCloseTo(4.33, 6);
    expect(elevationLossPsi(-5)).toBeCloseTo(-2.165, 6);
  });
  test("bucket test GPM = gallons / seconds × 60", () => {
    expect(bucketTestGpm(5, 15)).toBeCloseTo(20, 9);
    expect(bucketTestGpm(5, 0)).toBe(0);
  });
});

describe("component loss curves", () => {
  test("interpolates linearly inside the table", () => {
    const c: [number, number][] = [
      [10, 2],
      [20, 4],
    ];
    expect(interpolateCurve(c, 15)).toBeCloseTo(3, 9);
    expect(interpolateCurve(c, 40)).toBeCloseTo(16, 9); // Q² extrapolation
  });
  test("valve loss increases with flow", () => {
    expect(valveLossPsi(1, 25)).toBeGreaterThan(valveLossPsi(1, 10));
  });
});

/** Build a minimal zone: POC -> 20 ft mainline -> valve -> 100 ft lateral with 2 heads */
function simpleZone(lateralSize = 1, loop = false): Project {
  const p = createProject();
  p.settings.minorLossPct = 0;
  p.waterSources.push(makeWaterSource({ x: 0, y: 0 }, { staticPsi: 60, dynamicPsi: 60, backflow: "none", meterSize: "none", availableGpm: 20 }));
  p.valves.push({ id: "v1", type: "electric", position: { x: 20, y: 0 }, size: 1, elevation: 0, layer: "valves", lossOverridePsi: 2 });
  p.zones.push({ id: "z1", number: 1, name: "Z1", color: "#00f", valveId: "v1", plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0, schedule: { daysPerWeek: 3 } });
  p.pipes.push({ id: "m1", kind: "mainline", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], material: "pvc-sch40", size: 1, autoSize: false, layer: "mainline" });
  p.pipes.push({ id: "l1", kind: "lateral", points: [{ x: 20, y: 0 }, { x: 70, y: 0 }], material: "pvc-sch40", size: lateralSize, autoSize: false, layer: "laterals" });
  p.pipes.push({ id: "l2", kind: "lateral", points: [{ x: 70, y: 0 }, { x: 120, y: 0 }], material: "pvc-sch40", size: lateralSize, autoSize: false, layer: "laterals" });
  const head = (id: string, x: number) => ({ id, position: { x, y: 0 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 180, zoneId: "z1", elevation: 0, layer: "sprinklers" as const });
  p.sprinklers.push(head("h1", 70), head("h2", 120));
  if (loop) {
    // a parallel path to h2 forming a loop
    p.pipes.push({ id: "l3", kind: "lateral", points: [{ x: 20, y: 0 }, { x: 20, y: 30 }, { x: 120, y: 30 }, { x: 120, y: 0 }], material: "pvc-sch40", size: lateralSize, autoSize: false, layer: "laterals" });
  }
  return p;
}

describe("zone hydraulic analysis", () => {
  test("zone GPM equals the sum of head flows", () => {
    const h = analyzeHydraulics(simpleZone());
    expect(h.zones[0].gpm).toBeCloseTo(2.7 * 2, 9);
    expect(h.zones[0].headCount).toBe(2);
  });
  test("pressure at the last head = POC − mainline − valve − lateral friction", () => {
    const p = simpleZone();
    const h = analyzeHydraulics(p);
    const id = insideDiameter("pvc-sch40", 1);
    const main = frictionLossPsi(5.4, id, 150, 20);
    const lat = frictionLossPsi(5.4, id, 150, 50) + frictionLossPsi(2.7, id, 150, 50);
    const expected = 60 - main - 2 - lat;
    expect(h.heads.get("h2")!.pressure!).toBeCloseTo(expected, 6);
    expect(h.zones[0].criticalHeadId).toBe("h2");
    expect(h.zones[0].longestPathFt).toBeCloseTo(100, 6);
  });
  test("elevation reduces pressure at a raised head by 0.433 psi/ft", () => {
    const p = simpleZone();
    const flat = analyzeHydraulics(p).heads.get("h2")!.pressure!;
    p.sprinklers[1].elevation = 10;
    const raised = analyzeHydraulics(p).heads.get("h2")!.pressure!;
    expect(flat - raised).toBeCloseTo(4.33, 6);
  });
  test("edge flows accumulate downstream demand", () => {
    const h = analyzeHydraulics(simpleZone());
    expect(h.pipes.get("l1")!.maxFlow).toBeCloseTo(5.4, 9);
    expect(h.pipes.get("l2")!.maxFlow).toBeCloseTo(2.7, 9);
    expect(h.pipes.get("m1")!.maxFlow).toBeCloseTo(5.4, 9);
  });
  test("looped lateral balances flow (Hardy Cross) and conserves mass", () => {
    const h = analyzeHydraulics(simpleZone(1, true));
    const l1 = h.pipes.get("l1")!.maxFlow;
    const l3 = h.pipes.get("l3")!.maxFlow;
    // flows leaving the valve sum to zone demand
    expect(l1 + l3).toBeCloseTo(5.4, 3);
    expect(l3).toBeGreaterThan(0.1);
    // looped zone has lower loss than the branched one
    const branched = analyzeHydraulics(simpleZone()).heads.get("h2")!.pressure!;
    expect(h.heads.get("h2")!.pressure!).toBeGreaterThan(branched);
  });
  test("auto-sizing keeps velocity at or below the limit", () => {
    const p = simpleZone();
    p.pipes.forEach((x) => (x.autoSize = true));
    p.sprinklers.forEach((s) => (s.nozzleId = "8.0"));
    const h = analyzeHydraulics(p);
    for (const pr of h.pipes.values()) expect(pr.maxVelocity).toBeLessThanOrEqual(5 + 1e-9);
  });
  test("undersized manual pipe raises velocity above 5 ft/s and is reported", () => {
    const p = simpleZone(0.5);
    p.sprinklers.forEach((s) => (s.nozzleId = "6.0"));
    const h = analyzeHydraulics(p);
    expect(h.pipes.get("l1")!.maxVelocity).toBeGreaterThan(5);
    expect(h.zones[0].status).not.toBe("good");
  });
  test("disconnected head is flagged", () => {
    const p = simpleZone();
    p.sprinklers.push({ id: "h3", position: { x: 60, y: 40 }, productId: "gen-rotor-4", nozzleId: "3.0", arcStart: 0, arc: 360, zoneId: "z1", elevation: 0, layer: "sprinklers" });
    const h = analyzeHydraulics(p);
    expect(h.heads.get("h3")!.status).toBe("disconnected");
  });
});

describe("water source", () => {
  test("static pressure minus meter, service line and backflow losses", () => {
    const src = makeWaterSource({ x: 0, y: 0 }, { staticPsi: 70, meterSize: "3/4", serviceLineSize: 1, serviceLineLengthFt: 50, backflow: "pvb", backflowSize: 1 });
    const r = sourcePressure(src, 15);
    expect(r.pressure).toBeCloseTo(70 - r.meterLoss - r.serviceLoss - r.backflowLoss, 9);
    expect(r.meterLoss).toBeGreaterThan(0);
    expect(r.serviceLoss).toBeGreaterThan(0);
  });
  test("measured flow test wins over meter estimate", () => {
    const src = makeWaterSource({ x: 0, y: 0 }, { flowTest: { gallons: 5, seconds: 20 } });
    expect(availableFlow(src).gpm).toBeCloseTo(15, 9);
    expect(availableFlow(src).basis).toBe("bucket test");
  });
  test("meter estimate uses 75% of meter safe flow capped by service velocity", () => {
    const src = makeWaterSource({ x: 0, y: 0 }, { meterSize: "5/8", serviceLineSize: 1 });
    expect(availableFlow(src).gpm).toBeCloseTo(15, 6);
  });
  test("PRV caps downstream pressure", () => {
    const src = makeWaterSource({ x: 0, y: 0 }, { staticPsi: 110, prvSettingPsi: 60, meterSize: "none", backflow: "none", serviceLineLengthFt: 0 });
    expect(sourcePressure(src, 10).pressure).toBe(60);
  });
});

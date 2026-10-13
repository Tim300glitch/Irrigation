import { describe, expect, test } from "vitest";
import { produce } from "immer";
import { createProject } from "../model/factory";
import type { Pipe, Project, Sprinkler } from "../model/types";
import { applyZonesFromPiping, zonesFromPiping } from "../irrigation/zoneFromPiping";
import { analyzeHydraulics } from "../hydraulics/analysis";
import { applyPipeMoveLinks, constrainPipeMove, pipeMoveLinks } from "../editor/pipeLinks";
import { FITTING_ABBR, FITTING_DEFS, FITTING_LABELS } from "../plan/symbols";
import { FITTING_NAMES } from "../materials/takeoff";
import { defaultMaterialProducts, findPrice } from "../materials/pricing";

const lat = (id: string, points: [number, number][], zoneId?: string): Pipe => ({ id, kind: "lateral", points: points.map(([x, y]) => ({ x, y })), material: "pvc-cl200", size: 1, autoSize: true, zoneId, layer: "laterals" });
const head = (id: string, x: number, y: number, zoneId?: string): Sprinkler => ({ id, position: { x, y }, productId: "gen-spray-4", nozzleId: "VAN-15", arcStart: 0, arc: 360, elevation: 0, layer: "sprinklers", zoneId });

function zonedProject(pipeZone?: string): Project {
  const p = createProject();
  p.valves.push({ id: "v1", type: "electric", position: { x: 0, y: 0 }, size: 1, elevation: 0, layer: "valves" });
  p.zones.push({ id: "z1", number: 1, name: "Zone 1", color: "#f00", valveId: "v1", plantType: "cool-turf", sun: "full", soil: "loam", slopePct: 0, schedule: { daysPerWeek: 3 } });
  p.pipes.push(lat("a", [[0, 0], [20, 0]], pipeZone), lat("b", [[20, 0], [20, 15]]));
  // heads along the run (one mid-pipe, one at the far end)
  p.sprinklers.push(head("h1", 10, 0.4), head("h2", 20, 15));
  return p;
}

describe("zones follow the piping", () => {
  test("unassigned heads on a zoned lateral join the zone and connect", () => {
    const p = zonedProject("z1");
    // before: the heads have no zone, so the hydraulics can't see them
    expect(analyzeHydraulics(p).heads.get("h1")?.status ?? "none").not.toBe("ok");
    const next = produce(p, (d) => void applyZonesFromPiping(d));
    expect(next.sprinklers.map((s) => s.zoneId)).toEqual(["z1", "z1"]);
    expect(next.pipes.map((x) => x.zoneId)).toEqual(["z1", "z1"]);
    const hyd = analyzeHydraulics(next);
    expect(hyd.heads.get("h1")?.connected).toBe(true);
    expect(hyd.heads.get("h2")?.connected).toBe(true);
    expect(hyd.zones.find((z) => z.zoneId === "z1")?.headCount).toBe(2);
  });

  test("unzoned laterals started at the valve take its zone", () => {
    const a = zonesFromPiping(zonedProject());
    expect(a.pipes.get("a")).toBe("z1");
    expect(a.pipes.get("b")).toBe("z1");
    expect(a.sprinklers.get("h2")).toBe("z1");
  });

  test("explicit zones are kept and ambiguous pipes are left alone", () => {
    const p = zonedProject();
    p.sprinklers[0].zoneId = "z2";
    p.valves.push({ id: "v2", type: "electric", position: { x: 20, y: 15 }, size: 1, elevation: 0, layer: "valves" });
    p.zones.push({ ...p.zones[0], id: "z2", number: 2, valveId: "v2" });
    const a = zonesFromPiping(p);
    expect(a.sprinklers.has("h1")).toBe(false);
    // the run joins both valves: can't tell which zone it is
    expect(a.pipes.size).toBe(0);
  });

  test("converges (second pass changes nothing)", () => {
    const once = produce(zonedProject(), (d) => void applyZonesFromPiping(d));
    const a = zonesFromPiping(once);
    expect(a.pipes.size + a.sprinklers.size).toBe(0);
  });
});

describe("dragging a pipe keeps its joints", () => {
  // U shape: leg L1 up to an elbow, run R across, leg L2 down from the other elbow
  function uProject(): Project {
    const p = createProject();
    p.pipes.push(lat("L1", [[0, 0], [0, 10]]), lat("R", [[0, 10], [20, 10]]), lat("L2", [[20, 10], [20, 0]]));
    p.fittings.push({ id: "e1", type: "elbow90", position: { x: 0, y: 10 }, size: 1, rotation: 0, layer: "laterals" }, { id: "e2", type: "elbow90", position: { x: 20, y: 10 }, size: 1, rotation: 0, layer: "laterals" });
    return p;
  }
  const move = (p: Project, ids: string[], dx: number, dy: number, free = false) => {
    const links = pipeMoveLinks(p, ids);
    const delta = constrainPipeMove(links, { x: dx, y: dy }, free);
    return produce(p, (d) => {
      for (const pipe of d.pipes) if (ids.includes(pipe.id)) pipe.points = pipe.points.map((q) => ({ x: q.x + delta.x, y: q.y + delta.y }));
      applyPipeMoveLinks(d, links, delta);
    });
  };

  test("legs shorten, elbows follow, angles stay square", () => {
    const next = move(uProject(), ["R"], 1.5, -4);
    const pt = (id: string) => next.pipes.find((x) => x.id === id)!.points;
    expect(pt("R")).toEqual([{ x: 0, y: 6 }, { x: 20, y: 6 }]); // sideways part dropped
    expect(pt("L1")[1]).toEqual({ x: 0, y: 6 });
    expect(pt("L2")[0]).toEqual({ x: 20, y: 6 });
    expect(next.fittings.map((f) => f.position)).toEqual([{ x: 0, y: 6 }, { x: 20, y: 6 }]);
  });

  test("a leg is never shortened past its other end", () => {
    const next = move(uProject(), ["R"], 0, -50);
    expect(next.pipes.find((x) => x.id === "L1")!.points[1].y).toBeCloseTo(0.25, 6);
  });

  test("Alt moves freely and the joints still follow", () => {
    const next = move(uProject(), ["R"], 2, -4, true);
    expect(next.pipes.find((x) => x.id === "L1")!.points[1]).toEqual({ x: 2, y: 6 });
  });

  test("a branch tee'd into a run slides along it", () => {
    const p = createProject();
    p.pipes.push(lat("main", [[0, 0], [30, 0]]), lat("br", [[10, 0], [10, 8]]));
    const next = move(p, ["br"], 3, 5);
    expect(next.pipes.find((x) => x.id === "br")!.points).toEqual([{ x: 13, y: 0 }, { x: 13, y: 8 }]);
  });
});

describe("fittings catalog", () => {
  test("every fitting has a label, symbol, takeoff name and price", () => {
    const products = defaultMaterialProducts();
    expect(FITTING_DEFS.filter((f) => f.group === "threaded").length).toBeGreaterThanOrEqual(20);
    for (const f of FITTING_DEFS) {
      expect(FITTING_LABELS[f.type]).toBeTruthy();
      expect(FITTING_ABBR[f.type].length).toBeLessThanOrEqual(3);
      expect(FITTING_NAMES[f.type]).toBeTruthy();
      expect(findPrice(`fitting:${f.type}:1`, products), f.type).toBeTruthy();
    }
    expect(new Set(FITTING_DEFS.map((f) => f.type)).size).toBe(FITTING_DEFS.length);
  });
});

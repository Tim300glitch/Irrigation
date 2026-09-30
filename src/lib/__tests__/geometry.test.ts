import { describe, expect, test } from "vitest";
import { centroid, closestOnSegment, interiorAngle, pointInPolygon, pointInSector, polygonArea, polygonPerimeter, segmentsCross, sectorArea, constrainAngle, deflectionAngle, inscribedRadius } from "../geometry/geometry";
import { formatFeetInches, parseLength, pipeSizeLabel } from "../units/units";

const sq = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
  { x: 0, y: 20 },
];

describe("polygon geometry", () => {
  test("area & perimeter of a rectangle", () => {
    expect(polygonArea(sq)).toBe(200);
    expect(polygonPerimeter(sq)).toBe(60);
  });
  test("area is orientation independent", () => {
    expect(polygonArea([...sq].reverse())).toBe(200);
  });
  test("L-shape area", () => {
    const L = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ];
    expect(polygonArea(L)).toBe(300);
    expect(interiorAngle(L, 3)).toBeCloseTo(270, 6);
    expect(interiorAngle(L, 0)).toBeCloseTo(90, 6);
  });
  test("triangle area", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }])).toBe(6);
  });
  test("centroid & point-in-polygon", () => {
    expect(centroid(sq)).toEqual({ x: 5, y: 10 });
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });
  test("closest point on segment", () => {
    const c = closestOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(c.point).toEqual({ x: 5, y: 0 });
    expect(c.d).toBe(5);
  });
  test("segment crossing", () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBe(false);
  });
  test("inscribed radius of a 20 ft wide strip ≈ 10 ft", () => {
    const r = inscribedRadius([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }, { x: 0, y: 20 }]).r;
    expect(r).toBeGreaterThan(9);
    expect(r).toBeLessThanOrEqual(10);
  });
  test("angle constraint and deflection", () => {
    const p = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 9 }, 45);
    expect(p.x).toBeCloseTo(p.y, 6);
    expect(deflectionAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 })).toBeCloseTo(45, 6);
  });
});

describe("sprinkler coverage geometry", () => {
  test("quarter circle sector membership", () => {
    const c = { x: 0, y: 0 };
    expect(pointInSector({ x: 5, y: 5 }, c, 10, 0, 90)).toBe(true);
    expect(pointInSector({ x: -5, y: 5 }, c, 10, 0, 90)).toBe(false);
    expect(pointInSector({ x: 9, y: 9 }, c, 10, 0, 90)).toBe(false); // outside radius
  });
  test("sector wraps through 0°", () => {
    expect(pointInSector({ x: 5, y: -1 }, { x: 0, y: 0 }, 10, 300, 90)).toBe(true);
  });
  test("sector area: 90° = quarter, 180° = half, 360° = full circle", () => {
    expect(sectorArea(10, 90)).toBeCloseTo(Math.PI * 25, 9);
    expect(sectorArea(10, 180)).toBeCloseTo(Math.PI * 50, 9);
    expect(sectorArea(10, 360)).toBeCloseTo(Math.PI * 100, 9);
  });
});

describe("units", () => {
  test("feet-inches formatting", () => {
    expect(formatFeetInches(12.5)).toBe(`12'-6"`);
    expect(formatFeetInches(18.25)).toBe(`18'-3"`);
    expect(formatFeetInches(0.999)).toBe(`1'-0"`);
  });
  test("length parsing", () => {
    expect(parseLength(`12'6"`)).toBeCloseTo(12.5, 9);
    expect(parseLength(`12' 6"`)).toBeCloseTo(12.5, 9);
    expect(parseLength("12.5")).toBe(12.5);
    expect(parseLength('18"')).toBe(1.5);
    expect(parseLength("3m")).toBeCloseTo(9.84252, 4);
    expect(parseLength("abc")).toBeNaN();
  });
  test("pipe size labels", () => {
    expect(pipeSizeLabel(0.75)).toBe('3/4"');
    expect(pipeSizeLabel(1.25)).toBe('1-1/4"');
    expect(pipeSizeLabel(2)).toBe('2"');
  });
});

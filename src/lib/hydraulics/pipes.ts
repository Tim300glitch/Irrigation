/**
 * Pipe data: inside diameters and Hazen-Williams C factors.
 * IDs are nominal published dimensions for each pipe class (ASTM D1785 for
 * Schedule 40, ASTM D2241 SDR-21 for Class 200, SDR-13.5 for Class 315,
 * SIDR-15 for 100 psi polyethylene which is ID-controlled).
 */
import type { PipeMaterial } from "../model/types";

export interface PipeSpec {
  material: PipeMaterial;
  label: string;
  c: number;
  /** nominal size (in) -> inside diameter (in) */
  ids: Record<string, number>;
  unit: string;
}

export const PIPE_SPECS: Record<PipeMaterial, PipeSpec> = {
  "pvc-sch40": {
    material: "pvc-sch40",
    label: "Sch 40 PVC",
    c: 150,
    unit: "ft",
    ids: { "0.5": 0.602, "0.75": 0.804, "1": 1.029, "1.25": 1.36, "1.5": 1.59, "2": 2.047, "2.5": 2.445, "3": 3.042, "4": 3.998 },
  },
  "pvc-cl200": {
    material: "pvc-cl200",
    label: "Class 200 PVC",
    c: 150,
    unit: "ft",
    ids: { "0.75": 0.93, "1": 1.189, "1.25": 1.502, "1.5": 1.72, "2": 2.149, "2.5": 2.601, "3": 3.166, "4": 4.072 },
  },
  "pvc-cl315": {
    material: "pvc-cl315",
    label: "Class 315 PVC",
    c: 150,
    unit: "ft",
    ids: { "0.5": 0.716, "0.75": 0.894, "1": 1.121, "1.25": 1.414, "1.5": 1.618, "2": 2.023, "2.5": 2.449, "3": 2.982 },
  },
  "poly-100": {
    material: "poly-100",
    label: "Poly SIDR-15 100 psi",
    c: 140,
    unit: "ft",
    ids: { "0.5": 0.622, "0.75": 0.824, "1": 1.049, "1.25": 1.38, "1.5": 1.61, "2": 2.067 },
  },
  "funny-pipe": {
    material: "funny-pipe",
    label: "Swing pipe (funny pipe)",
    c: 140,
    unit: "ft",
    ids: { "0.5": 0.49 },
  },
  "drip-tubing": {
    material: "drip-tubing",
    label: "Drip tubing 17mm",
    c: 140,
    unit: "ft",
    ids: { "0.5": 0.6, "0.75": 0.82 },
  },
};

export const STANDARD_SIZES = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

export function sizesFor(material: PipeMaterial): number[] {
  return Object.keys(PIPE_SPECS[material].ids)
    .map(Number)
    .sort((a, b) => a - b);
}

export function insideDiameter(material: PipeMaterial, nominal: number): number {
  const spec = PIPE_SPECS[material];
  const id = spec.ids[String(nominal)];
  if (id) return id;
  // custom size not in table: approximate ID as nominal (flagged to user in UI)
  return nominal;
}

export function hwC(material: PipeMaterial): number {
  return PIPE_SPECS[material].c;
}

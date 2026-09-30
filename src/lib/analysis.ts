/** Aggregates every engineering module into one derived analysis of a project. */
import type { MaterialProduct, Project, ProjectSummary } from "./model/types";
import { analyzeHydraulics, type HydraulicResult } from "./hydraulics/analysis";
import { computeCoverage, type CoverageGrid } from "./irrigation/coverage";
import { runDesignCheck, type DesignWarning } from "./irrigation/designCheck";
import { computeTakeoff, type TakeoffItem } from "./materials/takeoff";
import { computeEstimate, type EstimateResult } from "./materials/estimate";
import { headLabels } from "./irrigation/labels";
import { polygonArea, polylineLength } from "./geometry/geometry";
import { isIrrigated } from "./irrigation/site";
import { dripCalc } from "./irrigation/drip";

export interface ProjectTotals {
  lawnArea: number;
  irrigatedArea: number;
  heads: number;
  zones: number;
  totalPipe: number;
  mainline: number;
  lateral: number;
  valves: number;
  maxZoneGpm: number;
  totalGpm: number;
  materialCost: number;
  projectCost: number;
}

export interface ProjectAnalysis {
  hyd: HydraulicResult;
  coverage: CoverageGrid | null;
  warnings: DesignWarning[];
  takeoff: TakeoffItem[];
  estimate: EstimateResult;
  totals: ProjectTotals;
  labels: Map<string, string>;
}

export function analyzeProject(project: Project, products: MaterialProduct[]): ProjectAnalysis {
  const hyd = analyzeHydraulics(project);
  const coverage = computeCoverage(project);
  const warnings = runDesignCheck(project, hyd, coverage);
  const takeoff = computeTakeoff(project, hyd);
  const estimate = computeEstimate(project, takeoff, products);
  const labels = headLabels(project);
  const lawnArea = project.areas.filter((a) => a.type === "lawn").reduce((s, a) => s + polygonArea(a.points), 0);
  const irrigatedArea = project.areas.filter(isIrrigated).reduce((s, a) => s + polygonArea(a.points), 0);
  const len = (k: string) => project.pipes.filter((p) => p.kind === k).reduce((s, p) => s + polylineLength(p.points), 0);
  const mainline = len("mainline");
  const lateral = len("lateral") + len("drip");
  void dripCalc;
  return {
    hyd,
    coverage,
    warnings,
    takeoff,
    estimate,
    labels,
    totals: {
      lawnArea,
      irrigatedArea,
      heads: project.sprinklers.length,
      zones: project.zones.length,
      totalPipe: mainline + lateral,
      mainline,
      lateral,
      valves: project.valves.length,
      maxZoneGpm: hyd.maxZoneGpm,
      totalGpm: hyd.totalGpm,
      materialCost: estimate.materialSubtotal + estimate.waste,
      projectCost: estimate.total,
    },
  };
}

export function summarize(project: Project, a: ProjectAnalysis, thumbnailSvg?: string): ProjectSummary {
  return {
    id: project.id,
    name: project.meta.name,
    client: project.meta.client,
    address: project.meta.address,
    status: project.meta.status,
    projectType: project.meta.projectType,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    zoneCount: project.zones.length,
    headCount: project.sprinklers.length,
    irrigatedArea: a.totals.irrigatedArea,
    estimateTotal: a.estimate.total,
    errorCount: a.warnings.filter((w) => w.severity === "error").length,
    warningCount: a.warnings.filter((w) => w.severity === "warning").length,
    lowPressureCount: a.warnings.filter((w) => w.code === "below-min-pressure" || w.code === "low-pressure").length,
    hydraulicIssueCount: a.warnings.filter((w) => ["excess-gpm", "high-gpm", "velocity", "pressure-variation", "undersized", "below-min-pressure", "low-pressure"].includes(w.code)).length,
    missingPriceCount: a.estimate.missingPrices,
    thumbnailSvg,
  };
}

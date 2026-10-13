"use client";
import { create } from "zustand";
import { useEffect } from "react";
import type { ProjectAnalysis } from "@/lib/analysis";
import { analyzeProject } from "@/lib/analysis";
import { applyZonesFromPiping, zonesFromPiping } from "@/lib/irrigation/zoneFromPiping";
import { useProjectStore } from "./projectStore";
import { useAppStore } from "./appStore";
import { useEditorStore } from "./editorStore";

interface AnalysisState {
  analysis: ProjectAnalysis | null;
  forRevision: number;
  ms: number;
}

export const useAnalysisStore = create<AnalysisState>(() => ({ analysis: null, forRevision: -1, ms: 0 }));

/** Recomputes the engineering analysis shortly after the design changes (not during drags).
 *  First fills in zones implied by the piping (see zoneFromPiping). */
export function useAnalysisRunner() {
  const project = useProjectStore((s) => s.project);
  const revision = useProjectStore((s) => s.revision);
  const products = useAppStore((s) => s.products);
  const dragging = useEditorStore((s) => s.dragging);
  useEffect(() => {
    if (!project || dragging) return;
    const first = useAnalysisStore.getState().analysis === null;
    const t = setTimeout(
      () => {
        // heads and laterals piped from a zone's valve join that zone (re-runs once with the update)
        const zf = zonesFromPiping(project);
        if (zf.pipes.size || zf.sprinklers.size) {
          useProjectStore.getState().apply((d) => void applyZonesFromPiping(d, zf), { history: false });
          return;
        }
        const t0 = performance.now();
        const analysis = analyzeProject(project, products);
        useAnalysisStore.setState({ analysis, forRevision: revision, ms: performance.now() - t0 });
      },
      first ? 0 : 140,
    );
    return () => clearTimeout(t);
  }, [project, products, revision, dragging]);
}

export const useAnalysis = () => useAnalysisStore((s) => s.analysis);

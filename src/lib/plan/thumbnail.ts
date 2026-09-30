import type { Project } from "../model/types";
import { renderPlanSvg } from "./planSvg";

/** Small plan thumbnail for dashboard cards (no analysis needed). */
export function renderThumbnail(project: Project, width = 240, height = 160): string {
  return renderPlanSvg(project, null, { width, height, mode: "color", installer: false, showCoverage: true, showLabels: false, showPipeSizes: false });
}

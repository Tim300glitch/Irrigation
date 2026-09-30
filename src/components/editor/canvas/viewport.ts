import type { Viewport } from "@/store/editorStore";
import type { Bounds, Vec } from "@/lib/geometry/geometry";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 120;

export const toScreen = (v: Viewport, p: Vec): Vec => ({ x: (p.x - v.x) * v.zoom, y: (p.y - v.y) * v.zoom });
export const toWorld = (v: Viewport, p: Vec): Vec => ({ x: p.x / v.zoom + v.x, y: p.y / v.zoom + v.y });

export function zoomAt(v: Viewport, screen: Vec, factor: number): Viewport {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
  const w = toWorld(v, screen);
  return { zoom, x: w.x - screen.x / zoom, y: w.y - screen.y / zoom };
}

export function fitBounds(b: Bounds, size: { w: number; h: number }, pad = 40): Viewport {
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min((size.w - pad * 2) / bw, (size.h - pad * 2) / bh)));
  return { zoom, x: b.minX - (size.w / zoom - bw) / 2, y: b.minY - (size.h / zoom - bh) / 2 };
}

/** "nice" ruler/grid step in ft so that step*zoom ≥ minPx */
export function niceStep(zoom: number, minPx: number): number {
  const steps = [1 / 12, 3 / 12, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const s of steps) if (s * zoom >= minPx) return s;
  return 1000;
}

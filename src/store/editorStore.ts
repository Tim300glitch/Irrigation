"use client";
import { create } from "zustand";
import type { AreaType, EquipmentType, FittingType, LineType, PipeKind, PipeMaterial, ValveType, DimensionKind } from "@/lib/model/types";
import type { Vec } from "@/lib/geometry/geometry";
import type { AnyObject, ObjectCollection } from "@/lib/model/types";

export type Tool =
  | "select"
  | "pan"
  | "area"
  | "line"
  | "plant"
  | "text"
  | "sprinkler"
  | "drip"
  | "pipe"
  | "fitting"
  | "valve"
  | "equipment"
  | "source"
  | "measure"
  | "dimension"
  | "calibrate";

export type MeasureMode = "distance" | "area" | "angle" | "radius";
export type AreaShape = "polygon" | "rectangle" | "circle";

export interface ToolOptions {
  areaType: AreaType;
  areaShape: AreaShape;
  lineType: LineType;
  plantType: "tree" | "shrub";
  sprinklerProduct: string;
  sprinklerNozzle: string;
  sprinklerArc: number;
  sprinklerAutoArc: boolean;
  pipeKind: PipeKind;
  pipeMaterial: PipeMaterial;
  pipeSize: number;
  pipeAutoSize: boolean;
  fittingType: FittingType;
  valveType: ValveType;
  valveCreatesZone: boolean;
  equipmentType: EquipmentType;
  measureMode: MeasureMode;
  dimensionKind: DimensionKind | "auto";
}

export interface Viewport {
  x: number; // world coordinate at the left edge
  y: number; // world coordinate at the top edge
  zoom: number; // screen px per ft
}

export type RightTab = "properties" | "zones" | "checks" | "assistant";
export type DialogId =
  | null
  | "project"
  | "hydraulics"
  | "materials"
  | "estimate"
  | "schedule"
  | "export"
  | "background"
  | "shortcuts"
  | "autodesign"
  | "versions"
  | "water"
  | "layers";

export interface SnapResult {
  point: Vec;
  kind: "grid" | "vertex" | "edge" | "sprinkler" | "device" | "none" | "angle";
}

interface EditorState {
  tool: Tool;
  opts: ToolOptions;
  viewport: Viewport;
  canvasSize: { w: number; h: number };
  selection: string[];
  highlight: string[];
  hover: string | null;
  draft: Vec[];
  cursor: Vec | null;
  snap: SnapResult | null;
  spacePan: boolean;
  dragging: boolean;
  showCoverage: boolean;
  showHeatmap: boolean;
  installerMode: boolean;
  showLabels: boolean;
  showPipeLabels: boolean;
  rightTab: RightTab;
  dialog: DialogId;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  clipboard: { collection: ObjectCollection; obj: AnyObject }[];
  activeZoneId: string | null;
  measurePoints: Vec[];
  toast: { msg: string; kind: "info" | "success" | "warn" } | null;
  vertexSel: { id: string; index: number } | null;
  setTool: (t: Tool) => void;
  setOpts: (o: Partial<ToolOptions>) => void;
  setViewport: (v: Partial<Viewport>) => void;
  setCanvasSize: (s: { w: number; h: number }) => void;
  select: (ids: string[]) => void;
  setHighlight: (ids: string[]) => void;
  setHover: (id: string | null) => void;
  setDraft: (d: Vec[]) => void;
  setCursor: (p: Vec | null, s?: SnapResult | null) => void;
  set: (p: Partial<EditorState>) => void;
  showToast: (msg: string, kind?: "info" | "success" | "warn") => void;
}

export const DEFAULT_OPTS: ToolOptions = {
  areaType: "lawn",
  areaShape: "polygon",
  lineType: "fence",
  plantType: "tree",
  sprinklerProduct: "gen-rotor-4",
  sprinklerNozzle: "3.0",
  sprinklerArc: 180,
  sprinklerAutoArc: true,
  pipeKind: "lateral",
  pipeMaterial: "pvc-sch40",
  pipeSize: 1,
  pipeAutoSize: true,
  fittingType: "tee",
  valveType: "electric",
  valveCreatesZone: true,
  equipmentType: "controller",
  measureMode: "distance",
  dimensionKind: "auto",
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  opts: DEFAULT_OPTS,
  viewport: { x: -10, y: -10, zoom: 5 },
  canvasSize: { w: 800, h: 600 },
  selection: [],
  highlight: [],
  hover: null,
  draft: [],
  cursor: null,
  snap: null,
  spacePan: false,
  dragging: false,
  showCoverage: true,
  showHeatmap: false,
  installerMode: false,
  showLabels: true,
  showPipeLabels: true,
  rightTab: "properties",
  dialog: null,
  leftCollapsed: false,
  rightCollapsed: false,
  clipboard: [],
  activeZoneId: null,
  measurePoints: [],
  toast: null,
  vertexSel: null,
  setTool: (t) =>
    set((s) => {
      // switching to pan keeps an in-progress drawing so the user can resume it
      const keepDraft = t === "pan" || t === s.tool;
      return { tool: t, draft: keepDraft ? s.draft : [], measurePoints: t === "measure" ? s.measurePoints : [], vertexSel: null };
    }),
  setOpts: (o) => set((s) => ({ opts: { ...s.opts, ...o } })),
  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
  setCanvasSize: (c) => set({ canvasSize: c }),
  select: (ids) => set({ selection: ids, vertexSel: null }),
  setHighlight: (ids) => set({ highlight: ids }),
  setHover: (id) => set({ hover: id }),
  setDraft: (d) => set({ draft: d }),
  setCursor: (p, s) => set({ cursor: p, snap: s ?? null }),
  set: (p) => set(p),
  showToast: (msg, kind = "info") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { msg, kind } });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },
}));

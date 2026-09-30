"use client";
import { useEffect } from "react";
import { useEditorStore, type Tool } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { actions } from "./actions";

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "V", action: "Select / edit tool" },
  { keys: "H", action: "Pan tool" },
  { keys: "Space (hold) + drag", action: "Pan temporarily — works while drawing pipe" },
  { keys: "Middle / right mouse drag", action: "Pan at any time" },
  { keys: "Mouse wheel / pinch", action: "Zoom at cursor" },
  { keys: "P", action: "Draw pipe" },
  { keys: "S", action: "Place sprinkler" },
  { keys: "F", action: "Place fitting (tee, 45°, 90°…)" },
  { keys: "A", action: "Place valve" },
  { keys: "L", action: "Draw lawn area" },
  { keys: "B", action: "Draw building" },
  { keys: "M", action: "Measure" },
  { keys: "D", action: "Dimension" },
  { keys: "T", action: "Text label" },
  { keys: "R", action: "Reference point (measure from it)" },
  { keys: "G", action: "Toggle grid" },
  { keys: "C", action: "Toggle coverage arcs" },
  { keys: "0", action: "Zoom to fit" },
  { keys: "+ / −", action: "Zoom in / out" },
  { keys: "Arrows", action: "Nudge selection 0.5 ft (Shift = 5 ft) or pan" },
  { keys: "Enter", action: "Finish polygon / line" },
  { keys: "Esc", action: "Cancel current operation / clear selection" },
  { keys: "Delete / Backspace", action: "Delete selection" },
  { keys: "Ctrl/⌘ + Z", action: "Undo" },
  { keys: "Ctrl/⌘ + Shift + Z  or  Ctrl + Y", action: "Redo" },
  { keys: "Ctrl/⌘ + C / V", action: "Copy / paste" },
  { keys: "Ctrl/⌘ + D", action: "Duplicate" },
  { keys: "Ctrl/⌘ + A", action: "Select all" },
  { keys: "Ctrl/⌘ + S", action: "Save" },
  { keys: "Ctrl/⌘ + P", action: "Export PDF plan set" },
  { keys: "Shift (drawing)", action: "Constrain to 45° angles" },
  { keys: "Alt (drawing)", action: "Disable snapping" },
  { keys: "?", action: "Show this help" },
];

const TOOL_KEYS: Record<string, Tool> = { r: "refpoint", v: "select", h: "pan", p: "pipe", s: "sprinkler", f: "fitting", a: "valve", m: "measure", d: "dimension", t: "text" };

export function useShortcuts(finishDraft: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const ed = useEditorStore.getState();
      if (ed.dialog) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space") {
        if (!ed.spacePan) ed.set({ spacePan: true });
        e.preventDefault();
        return;
      }
      if (mod) {
        if (k === "z" && e.shiftKey) actions.redo();
        else if (k === "z") actions.undo();
        else if (k === "y") actions.redo();
        else if (k === "c") actions.copy();
        else if (k === "v") actions.paste();
        else if (k === "d") actions.duplicate();
        else if (k === "a") actions.selectAll();
        else if (k === "s") actions.save();
        else if (k === "p") ed.set({ dialog: "export" });
        else return;
        e.preventDefault();
        return;
      }
      if (k === "escape") {
        if (ed.draft.length || ed.measurePoints.length) ed.set({ draft: [], measurePoints: [] });
        else if (ed.tool !== "select") ed.setTool("select");
        else ed.set({ selection: [], highlight: [] });
        return;
      }
      if (k === "enter") {
        finishDraft();
        return;
      }
      if (k === "delete" || k === "backspace") {
        actions.deleteSelection();
        e.preventDefault();
        return;
      }
      if (k.startsWith("arrow")) {
        const step = e.shiftKey ? 5 : 0.5;
        const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
        const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
        actions.nudge(dx, dy);
        e.preventDefault();
        return;
      }
      if (k === "?" || (e.shiftKey && k === "/")) return ed.set({ dialog: "shortcuts" });
      if (k === "0") return actions.fit();
      if (k === "=" || k === "+") return actions.zoom(1.25);
      if (k === "-") return actions.zoom(0.8);
      if (k === "g") return useProjectStore.getState().apply((d) => void (d.settings.gridVisible = !d.settings.gridVisible), { history: false });
      if (k === "c") return ed.set({ showCoverage: !ed.showCoverage });
      if (k === "l") {
        ed.setOpts({ areaType: "lawn" });
        return ed.setTool("area");
      }
      if (k === "b") {
        ed.setOpts({ areaType: "building" });
        return ed.setTool("area");
      }
      if (TOOL_KEYS[k]) ed.setTool(TOOL_KEYS[k]);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useEditorStore.getState().set({ spacePan: false });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [finishDraft]);
}

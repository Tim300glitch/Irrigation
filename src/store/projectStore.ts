"use client";
/**
 * Project document store with undo/redo. Every mutation goes through `apply`
 * (immer recipe). History stores immutable snapshots (structural sharing keeps
 * this cheap). Drag operations call `checkpoint()` once, then `apply(..., {history:false})`.
 */
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { Project } from "@/lib/model/types";

const MAX_HISTORY = 200;

interface ProjectState {
  project: Project | null;
  past: Project[];
  future: Project[];
  dirty: boolean;
  revision: number;
  lastSavedAt?: string;
  setProject: (p: Project | null) => void;
  apply: (recipe: (d: Draft<Project>) => void, opts?: { history?: boolean }) => void;
  replace: (p: Project, opts?: { history?: boolean }) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: (at: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  dirty: false,
  revision: 0,
  setProject: (p) => set({ project: p, past: [], future: [], dirty: false, revision: 0 }),
  apply: (recipe, opts) => {
    const cur = get().project;
    if (!cur) return;
    const next = produce(cur, (d) => {
      recipe(d);
      d.updatedAt = new Date().toISOString();
    });
    if (next === cur) return;
    const history = opts?.history !== false;
    set((s) => ({
      project: next,
      past: history ? [...s.past, cur].slice(-MAX_HISTORY) : s.past,
      future: history ? [] : s.future,
      dirty: true,
      revision: s.revision + 1,
    }));
  },
  replace: (p, opts) => {
    const cur = get().project;
    const history = opts?.history !== false && cur;
    set((s) => ({
      project: { ...p, updatedAt: new Date().toISOString() },
      past: history ? [...s.past, cur!].slice(-MAX_HISTORY) : s.past,
      future: history ? [] : s.future,
      dirty: true,
      revision: s.revision + 1,
    }));
  },
  checkpoint: () => {
    const cur = get().project;
    if (!cur) return;
    set((s) => ({ past: [...s.past, cur].slice(-MAX_HISTORY), future: [] }));
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set((s) => ({ project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: true, revision: s.revision + 1 }));
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set((s) => ({ project: next, past: [...past, project], future: future.slice(1), dirty: true, revision: s.revision + 1 }));
  },
  markSaved: (at) => set({ dirty: false, lastSavedAt: at }),
}));

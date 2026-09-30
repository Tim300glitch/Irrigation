"use client";
import { searchParams } from "@/lib/nav";
import { AskHost } from "@/components/AskHost";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { useAppStore } from "@/store/appStore";
import { useAnalysisRunner, useAnalysisStore } from "@/store/analysisStore";
import { repo } from "@/lib/storage/repository";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import { CanvasView } from "./canvas/CanvasView";
import { useShortcuts } from "./useShortcuts";
import { finishDraftAction } from "./canvas/useCanvasController";
import { actions } from "./actions";
import { Dialogs } from "./dialogs/Dialogs";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

const AUTOSAVE_MS = 2500;
const VERSION_EVERY_MS = 10 * 60 * 1000;

export function Workspace({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const revision = useProjectStore((s) => s.revision);
  const init = useAppStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);
  const leftCollapsed = useEditorStore((s) => s.leftCollapsed);
  const rightCollapsed = useEditorStore((s) => s.rightCollapsed);
  const set = useEditorStore((s) => s.set);
  const lastVersion = useRef(Date.now());
  useAnalysisRunner();
  useShortcuts(finishDraftAction);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await init();
      const p = await repo.getProject(projectId);
      if (cancelled) return;
      if (!p) {
        setError("Project not found");
        return;
      }
      useAnalysisStore.setState({ analysis: null, forRevision: -1 });
      useProjectStore.getState().setProject(p);
      useEditorStore.setState({ selection: [], highlight: [], draft: [], measurePoints: [], tool: "select", activeZoneId: null, dialog: null });
      // responsive: collapse side panels on narrow screens
      if (typeof window !== "undefined" && window.innerWidth < 1100) useEditorStore.setState({ leftCollapsed: true, rightCollapsed: window.innerWidth < 800 });
      requestAnimationFrame(() => setTimeout(() => actions.fit(), 30));
      if (searchParams().get("start") === "upload") useEditorStore.setState({ dialog: "background" });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, init]);

  // autosave shortly after edits; periodic version snapshots
  useEffect(() => {
    if (!dirty || !project) return;
    const t = setTimeout(async () => {
      const dragging = useEditorStore.getState().dragging;
      if (dragging) return;
      const versionDue = Date.now() - lastVersion.current > VERSION_EVERY_MS;
      await actions.save({ silent: true, version: versionDue ? "Autosave" : undefined });
      if (versionDue) lastVersion.current = Date.now();
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, revision, project]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) {
        actions.save({ silent: true });
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  if (error)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-600">{error}</p>
        <Link href="/projects" className="text-brand-700 underline">
          Back to projects
        </Link>
      </div>
    );
  if (!project) return <div className="flex h-screen items-center justify-center text-slate-500">Loading design workspace…</div>;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        {!leftCollapsed && <LeftPanel />}
        <div className="relative min-w-0 flex-1">
          <CanvasView />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button onClick={() => set({ leftCollapsed: !leftCollapsed })} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50" title={leftCollapsed ? "Show tools" : "Hide tools"}>
              {leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            <button onClick={() => set({ rightCollapsed: !rightCollapsed })} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50" title={rightCollapsed ? "Show properties" : "Hide properties"}>
              {rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
            </button>
          </div>
        </div>
        {!rightCollapsed && <RightPanel />}
      </div>
      <StatusBar />
      <Dialogs />
      <AskHost />
    </div>
  );
}

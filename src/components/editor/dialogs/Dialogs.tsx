"use client";
import { useEditorStore } from "@/store/editorStore";
import { ProjectDialog, ShortcutsDialog, VersionsDialog, AutoDesignDialog } from "./BasicDialogs";
import { HydraulicsDialog } from "./HydraulicsDialog";
import { MaterialsDialog, EstimateDialog } from "./MaterialsDialogs";
import { ScheduleDialog } from "./ScheduleDialog";
import { ExportDialog } from "./ExportDialog";
import { BackgroundDialog } from "./BackgroundDialog";

export function Dialogs() {
  const dialog = useEditorStore((s) => s.dialog);
  const close = () => useEditorStore.getState().set({ dialog: null });
  switch (dialog) {
    case "project":
      return <ProjectDialog onClose={close} />;
    case "shortcuts":
      return <ShortcutsDialog onClose={close} />;
    case "versions":
      return <VersionsDialog onClose={close} />;
    case "autodesign":
      return <AutoDesignDialog onClose={close} />;
    case "hydraulics":
      return <HydraulicsDialog onClose={close} />;
    case "materials":
      return <MaterialsDialog onClose={close} />;
    case "estimate":
      return <EstimateDialog onClose={close} />;
    case "schedule":
      return <ScheduleDialog onClose={close} />;
    case "export":
      return <ExportDialog onClose={close} />;
    case "background":
      return <BackgroundDialog onClose={close} />;
    default:
      return null;
  }
}

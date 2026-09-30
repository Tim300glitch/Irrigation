"use client";
import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("@/components/editor/Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center text-slate-500">Loading design workspace…</div>,
});

export function DesignPage({ id }: { id: string }) {
  return <Workspace projectId={id} />;
}

"use client";
/** Photo management: categorized galleries, camera/upload, vector annotations (circle, arrow, text, freehand). */
import { useRef, useState } from "react";
import { Camera, Circle, ArrowUpRight, Type, PenLine, Trash2, Undo2, X } from "lucide-react";
import type { Annotation, EntityType, Photo, PhotoCategory } from "@/lib/crm/types";
import { PHOTO_CATEGORIES } from "@/lib/crm/constants";
import { useCrm } from "@/store/crmStore";
import { crmRepo } from "@/lib/crm/repository";
import { uid } from "@/lib/crm/workflows";
import { dateTime } from "@/lib/crm/format";
import { ask } from "@/components/AskHost";
import { Button, Badge, cn, Empty, Modal, Select } from "./ui";

export function AnnotationLayer({ annotations, className }: { annotations: Annotation[]; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        {annotations
          .filter((a) => a.type === "arrow")
          .map((a) => (
            <marker key={a.id} id={`ah-${a.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={a.color} />
            </marker>
          ))}
      </defs>
      {annotations.map((a) =>
        a.type === "circle" ? (
          <ellipse key={a.id} cx={a.x * 100} cy={a.y * 100} rx={(a.r ?? 0.1) * 100} ry={(a.r ?? 0.1) * 100 * 1.33} fill="none" stroke={a.color} strokeWidth={0.9} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        ) : a.type === "arrow" ? (
          <line key={a.id} x1={a.x * 100} y1={a.y * 100} x2={(a.x2 ?? a.x) * 100} y2={(a.y2 ?? a.y) * 100} stroke={a.color} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} markerEnd={`url(#ah-${a.id})`} />
        ) : a.type === "freehand" ? (
          <polyline key={a.id} points={(a.path ?? []).map((p) => `${p.x * 100},${p.y * 100}`).join(" ")} fill="none" stroke={a.color} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} strokeLinecap="round" strokeLinejoin="round" />
        ) : null,
      )}
      {annotations
        .filter((a) => a.type === "text")
        .map((a) => (
          <foreignObject key={a.id} x={a.x * 100} y={a.y * 100 - 4} width={100 - a.x * 100} height={12}>
            <span style={{ background: a.color, color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>{a.text}</span>
          </foreignObject>
        ))}
    </svg>
  );
}

export function PhotoUploadButton({ entityType, entityId, customerId, propertyId, jobId, category = "before", size = "sm", label = "Add photos" }: { entityType: EntityType; entityId: string; customerId?: string; propertyId?: string; jobId?: string; category?: PhotoCategory; size?: "sm" | "md" | "lg"; label?: string }) {
  const { insert, log, session } = useCrm();
  const ref = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<PhotoCategory>(category);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select value={cat} onChange={(e) => setCat(e.target.value as PhotoCategory)} options={PHOTO_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} className={cn("w-[110px]", size === "lg" ? "h-10" : "h-8")} />
      <Button size={size} variant="primary" onClick={() => ref.current?.click()}>
        <Camera size={14} /> {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          for (const f of files) {
            const url = await crmRepo.uploadFile(await downscale(f), `${entityType}/${entityId}/${Date.now()}-${f.name}`);
            const p: Photo = { id: uid("pho"), url, caption: f.name.replace(/\.[^.]+$/, ""), category: cat, entityType, entityId, customerId, propertyId, jobId, takenAt: new Date(f.lastModified || Date.now()).toISOString(), takenBy: session?.employeeId, annotations: [] };
            insert("photos", p);
          }
          if (files.length) log({ type: "photo", message: `${files.length} ${cat.replace("_", " ")} photo${files.length > 1 ? "s" : ""} added`, entityType, entityId, customerId, jobId });
          e.target.value = "";
        }}
      />
    </span>
  );
}

/** Resize photos to ≤1600px JPEG before storing (field uploads on cellular). */
async function downscale(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.type === "image/svg+xml") return f;
  try {
    const bmp = await createImageBitmap(f);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? f), "image/jpeg", 0.82));
  } catch {
    return f;
  }
}

export function PhotoGallery({ photos, upload, columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" }: { photos: Photo[]; upload?: React.ReactNode; columns?: string }) {
  const [cat, setCat] = useState<PhotoCategory | "all">("all");
  const [open, setOpen] = useState<Photo | null>(null);
  const shown = photos.filter((p) => cat === "all" || p.category === cat).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["all", ...PHOTO_CATEGORIES.map((c) => c.id)] as const).map((c) => {
          const n = c === "all" ? photos.length : photos.filter((p) => p.category === c).length;
          return (
            <button key={c} onClick={() => setCat(c)} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", cat === c ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-50" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              {c === "all" ? "All" : PHOTO_CATEGORIES.find((x) => x.id === c)!.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        <span className="ml-auto">{upload}</span>
      </div>
      {shown.length ? (
        <div className={cn("grid gap-2", columns)}>
          {shown.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
              <AnnotationLayer annotations={p.annotations} />
              <span className="absolute left-1.5 top-1.5">
                <Badge tone={PHOTO_CATEGORIES.find((c) => c.id === p.category)?.tone}>{PHOTO_CATEGORIES.find((c) => c.id === p.category)?.label}</Badge>
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-[11px] text-white">
                <span className="block truncate font-medium">{p.caption}</span>
                <span className="opacity-80">{dateTime(p.takenAt)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<Camera size={18} />} title="No photos">
          Before / during / after photos are timestamped and linked to the job, property and customer automatically.
        </Empty>
      )}
      {open && <PhotoEditor photo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

type Tool = "circle" | "arrow" | "text" | "freehand";
const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff"];

function PhotoEditor({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { update, remove } = useCrm();
  const [ann, setAnn] = useState<Annotation[]>(photo.annotations);
  const [tool, setTool] = useState<Tool>("circle");
  const [color, setColor] = useState(COLORS[0]);
  const [caption, setCaption] = useState(photo.caption);
  const [category, setCategory] = useState<PhotoCategory>(photo.category);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Photo"
      subtitle={`${dateTime(photo.takenAt)} · draw to annotate`}
      width={900}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => {
              remove("photos", photo.id);
              onClose();
            }}
          >
            <Trash2 size={13} /> Delete
          </Button>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              update("photos", photo.id, { annotations: ann, caption, category });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["circle", Circle, "Circle"],
            ["arrow", ArrowUpRight, "Arrow"],
            ["text", Type, "Note"],
            ["freehand", PenLine, "Draw"],
          ] as const
        ).map(([t, I, l]) => (
          <button key={t} onClick={() => setTool(t)} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium", tool === t ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-100")}>
            <I size={13} /> {l}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={cn("h-5 w-5 rounded-full border border-slate-300", color === c && "ring-2 ring-brand-500 ring-offset-1")} style={{ background: c }} aria-label={`Color ${c}`} />
        ))}
        <button onClick={() => setAnn(ann.slice(0, -1))} className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100" disabled={!ann.length}>
          <Undo2 size={13} /> Undo
        </button>
        <button onClick={() => setAnn([])} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100">
          <X size={13} /> Clear
        </button>
      </div>
      <div
        ref={box}
        className="relative w-full touch-none select-none overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: "4 / 3" }}
        onPointerDown={async (e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const p = pt(e);
          if (tool === "text") {
            const text = await ask.prompt("Annotation text", "Cracked 1-inch tee");
            if (text) setAnn([...ann, { id: uid("an"), type: "text", color, x: p.x, y: p.y, text }]);
            return;
          }
          setDraft({ id: uid("an"), type: tool, color, x: p.x, y: p.y, x2: p.x, y2: p.y, r: 0.01, path: [p] });
        }}
        onPointerMove={(e) => {
          if (!draft) return;
          const p = pt(e);
          setDraft({ ...draft, x2: p.x, y2: p.y, r: Math.hypot(p.x - draft.x, (p.y - draft.y) * 0.75), path: [...(draft.path ?? []), p] });
        }}
        onPointerUp={() => {
          if (draft) setAnn([...ann, draft.type === "freehand" ? draft : { ...draft, path: undefined }]);
          setDraft(null);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption} className="h-full w-full object-contain" draggable={false} />
        <AnnotationLayer annotations={draft ? [...ann, draft] : ann} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px]">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[13px]" placeholder="Caption" />
        <Select value={category} onChange={(e) => setCategory(e.target.value as PhotoCategory)} options={PHOTO_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
    </Modal>
  );
}

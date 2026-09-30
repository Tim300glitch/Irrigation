"use client";
import { useRef, useState } from "react";
import { Upload, Search, Trash2, Ruler, Loader2, Square } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { Button, Field, Modal, NumberInput, TextInput, Toggle } from "../../ui";
import { esriProvider, type GeocodeResult } from "@/lib/maps/provider";
import { makeArea, rect } from "@/lib/model/factory";
import { actions } from "../actions";

async function pdfToImage(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as never).promise;
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), w: vp.width, h: vp.height };
}

function fileToImage(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale very large scans to keep projects light
        const max = 3000;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve({ dataUrl: c.toDataURL("image/jpeg", 0.88), w: c.width, h: c.height });
      };
      img.onerror = reject;
      img.src = r.result as string;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function BackgroundDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assumeWidth, setAssumeWidth] = useState(120);
  const [query, setQuery] = useState(project.meta.address);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [areaW, setAreaW] = useState(160);
  const [areaH, setAreaH] = useState(160);
  const [lotW, setLotW] = useState(80);
  const [lotD, setLotD] = useState(120);
  const bg = project.background;

  const onFile = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      const img = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") ? await pdfToImage(f) : await fileToImage(f);
      apply((d) => {
        d.background = { dataUrl: img.dataUrl, kind: f.type.includes("pdf") ? "pdf" : "image", x: 0, y: 0, pxWidth: img.w, pxHeight: img.h, ftPerPx: assumeWidth / img.w, opacity: 0.6, locked: true, visible: true };
      });
      onClose();
      setTimeout(() => {
        actions.fit();
        useEditorStore.getState().setTool("calibrate");
        useEditorStore.getState().showToast("Background imported — click two points of a known distance to calibrate the scale", "info");
      }, 50);
    } catch (e) {
      setErr(`Could not import file: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setErr(null);
    try {
      setResults(await esriProvider.geocode(query));
    } catch (e) {
      setErr(`Address search failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const useAerial = async (r: GeocodeResult) => {
    setBusy(true);
    setErr(null);
    try {
      const img = await esriProvider.aerial(r.lat, r.lon, areaW, areaH);
      apply((d) => {
        d.background = { dataUrl: img.dataUrl, kind: "aerial", x: -areaW / 2 + 50, y: -areaH / 2 + 50, pxWidth: img.pxWidth, pxHeight: img.pxHeight, ftPerPx: img.ftPerPx, opacity: 0.8, locked: true, visible: true, attribution: img.attribution };
      });
      onClose();
      setTimeout(() => actions.fit(), 50);
    } catch (e) {
      setErr(`Aerial imagery failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Site background & starting point" subtitle="Start from dimensions, an uploaded plan/survey/sketch, or an aerial image." width={760}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <Square size={15} /> Property dimensions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lot width">
                <NumberInput value={lotW} suffix="ft" step={1} min={10} onChange={setLotW} />
              </Field>
              <Field label="Lot depth">
                <NumberInput value={lotD} suffix="ft" step={1} min={10} onChange={setLotD} />
              </Field>
            </div>
            <Button
              className="mt-2 w-full"
              onClick={() => {
                apply((d) => {
                  d.areas = d.areas.filter((a) => a.type !== "property");
                  d.areas.unshift(makeArea("property", rect(0, 0, lotW, lotD)));
                });
                onClose();
                setTimeout(() => actions.fit(), 30);
              }}
            >
              Create property boundary
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <Upload size={15} /> Upload site plan / survey / sketch
            </div>
            <p className="mb-2 text-[11.5px] text-slate-500">PNG, JPG or PDF (first page). After import, click two points of a known distance to calibrate the scale.</p>
            <Field label="Approximate image width (before calibration)">
              <NumberInput value={assumeWidth} suffix="ft" step={10} min={10} onChange={setAssumeWidth} />
            </Field>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button variant="primary" className="mt-2 w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Choose file…
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <Search size={15} /> Aerial image from address
            </div>
            <div className="flex gap-2">
              <TextInput value={query} onChange={setQuery} placeholder="Street address" />
              <Button onClick={search} disabled={busy || !query}>
                Search
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Capture width">
                <NumberInput value={areaW} suffix="ft" step={10} min={40} max={600} onChange={setAreaW} />
              </Field>
              <Field label="Capture height">
                <NumberInput value={areaH} suffix="ft" step={10} min={40} max={600} onChange={setAreaH} />
              </Field>
            </div>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <button key={`${r.lat},${r.lon}`} onClick={() => useAerial(r)} className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-[12px] hover:bg-slate-50">
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-slate-500">Imagery is auto-scaled from Web-Mercator resolution — verify with a known measurement. Provider terms and attribution apply; additional providers can be configured in Settings.</p>
          </div>
          {bg && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-[13px] font-semibold">Current background</div>
              <div className="text-[11.5px] text-slate-500">
                {bg.kind} · {(bg.pxWidth * bg.ftPerPx).toFixed(0)} × {(bg.pxHeight * bg.ftPerPx).toFixed(0)} ft · {bg.ftPerPx.toFixed(4)} ft/px
              </div>
              {bg.attribution && <div className="text-[10.5px] text-slate-400">{bg.attribution}</div>}
              <Field label={`Opacity ${Math.round(bg.opacity * 100)}%`} className="mt-2">
                <input type="range" min={0.1} max={1} step={0.05} value={bg.opacity} onChange={(e) => apply((d) => void (d.background!.opacity = +e.target.value), { history: false })} className="w-full" />
              </Field>
              <Toggle checked={bg.visible} onChange={(v) => apply((d) => void (d.background!.visible = v))} label="Visible" />
              <div className="mt-2 flex gap-2">
                <Button
                  onClick={() => {
                    onClose();
                    useEditorStore.getState().setTool("calibrate");
                  }}
                >
                  <Ruler size={14} /> Calibrate
                </Button>
                <Button variant="danger" onClick={() => apply((d) => void (d.background = undefined))}>
                  <Trash2 size={14} /> Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {err && <p className="mt-3 rounded bg-red-50 p-2 text-[12px] text-red-700">{err}</p>}
    </Modal>
  );
}

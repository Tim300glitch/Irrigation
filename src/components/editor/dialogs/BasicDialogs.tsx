"use client";
import { ask } from "@/components/AskHost";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useEditorStore } from "@/store/editorStore";
import { Button, Field, Modal, NumberInput, Select, TextInput, Badge, LengthInput } from "../../ui";
import type { ProjectStatus, ProjectType } from "@/lib/model/types";
import { SHORTCUTS } from "../useShortcuts";
import { repo, type ProjectVersion } from "@/lib/storage/repository";
import { actions } from "../actions";
import { allProducts, getProduct } from "@/lib/catalog/sprinklers";
import type { LayoutHeadClass } from "@/lib/irrigation/autoLayout";
import { autoLayoutArea } from "@/lib/irrigation/autoLayout";
import { formatArea, formatFeetInches } from "@/lib/units/units";
import { polygonArea } from "@/lib/geometry/geometry";
import { isIrrigated } from "@/lib/irrigation/site";

export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "site-survey", label: "Site survey" },
  { value: "design", label: "Design" },
  { value: "quoted", label: "Quoted" },
  { value: "approved", label: "Approved" },
  { value: "installation", label: "Installation" },
  { value: "completed", label: "Completed" },
];
export const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "new-install", label: "New irrigation installation" },
  { value: "renovation", label: "Irrigation renovation" },
  { value: "repair", label: "Repair" },
  { value: "drip-conversion", label: "Drip conversion" },
  { value: "audit", label: "System audit" },
];

export function ProjectDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const apply = useProjectStore((s) => s.apply);
  const m = project.meta;
  const up = (k: keyof typeof m, v: string) => apply((d) => void ((d.meta as unknown as Record<string, unknown>)[k] = v));
  return (
    <Modal open onClose={onClose} title="Project information" subtitle="Shown in the plan title block and proposals" width={680} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name">
          <TextInput value={m.name} onChange={(v) => up("name", v)} />
        </Field>
        <Field label="Client">
          <TextInput value={m.client} onChange={(v) => up("client", v)} />
        </Field>
        <Field label="Address" className="col-span-2">
          <TextInput value={m.address} onChange={(v) => up("address", v)} />
        </Field>
        <Field label="Designer">
          <TextInput value={m.designer} onChange={(v) => up("designer", v)} />
        </Field>
        <Field label="Company">
          <TextInput value={m.company} onChange={(v) => up("company", v)} />
        </Field>
        <Field label="Phone">
          <TextInput value={m.phone} onChange={(v) => up("phone", v)} />
        </Field>
        <Field label="Email">
          <TextInput value={m.email} onChange={(v) => up("email", v)} />
        </Field>
        <Field label="Date">
          <input type="date" className="h-8 w-full rounded-md border border-slate-300 px-2" value={m.date} onChange={(e) => up("date", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={m.status} onChange={(v) => up("status", v)} options={STATUS_OPTIONS} />
        </Field>
        <Field label="Project type" className="col-span-2">
          <Select value={m.projectType} onChange={(v) => up("projectType", v)} options={TYPE_OPTIONS} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea className="h-20 w-full rounded-md border border-slate-300 p-2 text-[13px]" value={m.notes} onChange={(e) => up("notes", e.target.value)} />
        </Field>
        <Field label="Plan notes (one per line — printed on the plan)" className="col-span-2">
          <textarea className="h-28 w-full rounded-md border border-slate-300 p-2 text-[13px]" value={m.planNotes.join("\n")} onChange={(e) => apply((d) => void (d.meta.planNotes = e.target.value.split("\n")))} />
        </Field>
      </div>
    </Modal>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Keyboard shortcuts" width={640}>
      <div className="grid grid-cols-2 gap-x-6">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-[12.5px]">
            <span className="text-slate-700">{s.action}</span>
            <kbd className="whitespace-nowrap rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function VersionsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [label, setLabel] = useState("");
  const load = () => repo.listVersions(project.id).then(setVersions);
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open onClose={onClose} title="Version history" subtitle="Snapshots are saved automatically every 10 minutes and whenever you save a named version." width={560}>
      <div className="mb-3 flex gap-2">
        <TextInput value={label} onChange={setLabel} placeholder="Version name, e.g. 'Sent to customer'" />
        <Button
          variant="primary"
          onClick={async () => {
            await actions.save({ version: label || "Manual save" });
            setLabel("");
            load();
          }}
        >
          Save version
        </Button>
      </div>
      {versions.length === 0 && <p className="text-slate-500">No versions yet.</p>}
      <div className="divide-y divide-slate-100">
        {versions.map((v) => (
          <div key={v.at} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium text-slate-800">{v.label}</div>
              <div className="text-[11.5px] text-slate-500">{new Date(v.at).toLocaleString()}</div>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const p = await repo.getVersion(project.id, v.at);
                if (!p || !(await ask.confirm(`Restore "${v.label}"? The current design stays in undo history.`))) return;
                useProjectStore.getState().replace(p);
                onClose();
              }}
            >
              Restore
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function AutoDesignDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const selection = useEditorStore((s) => s.selection);
  const areas = project.areas.filter(isIrrigated);
  const initial = areas.find((a) => selection.includes(a.id))?.id ?? areas[0]?.id ?? "";
  const [areaId, setAreaId] = useState(initial);
  const [headClass, setHeadClass] = useState<LayoutHeadClass>("auto");
  const [productId, setProductId] = useState<string>("");
  const [radius, setRadius] = useState<number | undefined>(undefined);
  const area = areas.find((a) => a.id === areaId);
  const preview = area ? autoLayoutArea(project, area, { headClass, productId: productId || undefined, radius }) : null;
  const products = allProducts().filter((p) => ["rotor", "spray", "rotary", "impact"].includes(p.category));
  const q = preview ? preview.heads.reduce((acc, h) => acc + (getProduct(h.productId).matchedPrecip ? getProduct(h.productId).nozzles.find((n) => n.id === h.nozzleId)!.flowGpm * (h.arc / 360) : getProduct(h.productId).nozzles.find((n) => n.id === h.nozzleId)!.flowGpm), 0) : 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Auto design area"
      subtitle="Head-to-head layout: corners first, then perimeter, interior fill, gap fill — arcs aimed away from hardscape."
      width={600}
      footer={
        <>
          <Button
            onClick={() => {
              actions.autoLayoutAll({ headClass, productId: productId || undefined, radius });
              onClose();
            }}
          >
            Layout all {areas.length} areas
          </Button>
          <Button
            variant="primary"
            disabled={!area}
            onClick={() => {
              actions.autoLayoutArea(areaId, { headClass, productId: productId || undefined, radius });
              onClose();
            }}
          >
            Auto design area
          </Button>
        </>
      }
    >
      {!areas.length ? (
        <p className="text-slate-600">Draw a lawn, bed or planting area first (left panel → Site drawing).</p>
      ) : (
        <div className="space-y-3">
          <Field label="Area">
            <Select value={areaId} onChange={setAreaId} options={areas.map((a) => ({ value: a.id, label: `${a.name} — ${formatArea(polygonArea(a.points))}` }))} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Head type">
              <Select
                value={headClass}
                onChange={(v) => {
                  setHeadClass(v);
                  setProductId("");
                }}
                options={[
                  { value: "auto", label: "Auto (by width)" },
                  { value: "rotor", label: "Gear rotors" },
                  { value: "rotary", label: "Rotary nozzles" },
                  { value: "spray", label: "Spray heads" },
                ]}
              />
            </Field>
            <Field label="Product">
              <Select value={productId} onChange={setProductId} options={[{ value: "", label: "Default for type" }, ...products.map((p) => ({ value: p.id, label: p.model }))]} />
            </Field>
            <Field label="Spacing / radius">
              <LengthInput allowEmpty value={radius} min={4} onChange={(v) => setRadius(v || undefined)} />
            </Field>
          </div>
          {preview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12.5px]">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{preview.headClass}</Badge>
                <span>
                  <b>{preview.heads.length}</b> heads · {preview.product.model}
                </span>
              </div>
              <div className="text-slate-600">
                Narrowest width {formatFeetInches(preview.widthFt)} · head-to-head spacing {formatFeetInches(preview.radius)} · total flow {q.toFixed(1)} GPM
              </div>
              {preview.notes.map((n, i) => (
                <div key={i} className="mt-1 text-amber-800">
                  {n}
                </div>
              ))}
              <p className="mt-2 text-[11.5px] text-slate-500">Existing heads inside the area are replaced. Everything stays editable afterwards (drag heads, arcs and throw handles).</p>
            </div>
          )}
          <p className="text-[12px] text-slate-500">Tip: after layout run Auto-Design → Auto zone → Auto route.</p>
        </div>
      )}
    </Modal>
  );
}

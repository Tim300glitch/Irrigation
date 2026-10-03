"use client";
import { saveFile } from "@/lib/saveFile";
import { ask } from "@/components/AskHost";
import { useEffect, useState } from "react";
import { Save, Download, Upload, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useAppStore } from "@/store/appStore";
import { Button, Field, NumberInput, Select, TextInput } from "@/components/ui";
import { repo, type CompanyProfile } from "@/lib/storage/repository";
import { SHORTCUTS } from "@/components/editor/useShortcuts";
import { persistProject } from "@/lib/storage/seed";
import type { Project } from "@/lib/model/types";
import { migrateProject } from "@/lib/model/factory";

export default function SettingsPage() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [p, setP] = useState<CompanyProfile>(profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setP(profile), [profile]);
  const exportAll = async () => {
    const summaries = await repo.listSummaries();
    const projects = (await Promise.all(summaries.map((s) => repo.getProject(s.id)))).filter(Boolean);
    const data = { version: 1, exportedAt: new Date().toISOString(), profile: await repo.getProfile(), projects, customers: await repo.getList("customers"), products: await repo.getList("products"), quickEstimates: await repo.getList("quickEstimates") };
    saveFile(new Blob([JSON.stringify(data)], { type: "application/json" }), `deltaline-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importAll = async (f: File) => {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.projects)) return ask.alert("This file is not a DeltaLine backup.");
    for (const pr of data.projects as Project[]) await persistProject(migrateProject(pr));
    if (data.customers) await repo.setList("customers", data.customers);
    if (data.products) await repo.setList("products", data.products);
    if (data.quickEstimates) await repo.setList("quickEstimates", data.quickEstimates);
    if (data.profile) await repo.setProfile(data.profile);
    await useAppStore.getState().refresh();
    ask.alert(`Restored ${data.projects.length} projects.`);
  };
  return (
    <AppShell title="Design Studio Settings">
      <div className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 md:px-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Company profile</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Company">
              <TextInput value={p.company} onChange={(v) => setP({ ...p, company: v })} />
            </Field>
            <Field label="Designer (default)">
              <TextInput value={p.designer} onChange={(v) => setP({ ...p, designer: v })} />
            </Field>
            <Field label="Phone">
              <TextInput value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
            </Field>
            <Field label="Email">
              <TextInput value={p.email} onChange={(v) => setP({ ...p, email: v })} />
            </Field>
            <Field label="Address">
              <TextInput value={p.address} onChange={(v) => setP({ ...p, address: v })} />
            </Field>
            <Field label="Contractor license">
              <TextInput value={p.license} onChange={(v) => setP({ ...p, license: v })} />
            </Field>
          </div>
          <h3 className="mb-2 mt-5 text-[13px] font-semibold">Estimate defaults for new projects</h3>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sales tax">
              <NumberInput value={p.defaultTaxPct} suffix="%" step={0.25} onChange={(v) => setP({ ...p, defaultTaxPct: v })} />
            </Field>
            <Field label="Labor rate">
              <NumberInput value={p.defaultLaborRate} suffix="$/h" step={5} onChange={(v) => setP({ ...p, defaultLaborRate: v })} />
            </Field>
            <Field label="Markup">
              <NumberInput value={p.defaultMarkupPct} suffix="%" step={1} onChange={(v) => setP({ ...p, defaultMarkupPct: v })} />
            </Field>
          </div>
          <h3 className="mb-2 mt-5 text-[13px] font-semibold">Aerial imagery provider</h3>
          <Select className="max-w-md" value={p.mapProvider} onChange={(v) => setP({ ...p, mapProvider: v })} options={[{ value: "esri", label: "Esri World Imagery + OpenStreetMap geocoding (no key)" }, { value: "none", label: "Disabled" }]} />
          <p className="mt-1 text-[11.5px] text-slate-500">Additional providers (Google, Mapbox, Nearmap) plug into the MapProvider interface with your own API key — no credentials are bundled.</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={async () => {
              await setProfile(p);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            <Save size={14} /> {saved ? "Saved" : "Save settings"}
          </Button>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-[15px] font-semibold">Data &amp; storage</h2>
          <p className="mb-3 text-[12.5px] text-slate-600">Projects are stored locally in this browser (IndexedDB) and autosaved as you work, with version snapshots. The storage layer is abstracted so a PostgreSQL/Supabase sync backend can be connected for multi-device access.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportAll}>
              <Download size={14} /> Export full backup
            </Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium hover:bg-slate-50">
              <Upload size={14} /> Restore backup
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
            </label>
            <Button
              variant="danger"
              onClick={async () => {
                if (!(await ask.confirm("Reset all local data and reload the demo projects?", true))) return;
                const summaries = await repo.listSummaries();
                for (const s of summaries) await repo.deleteProject(s.id);
                await repo.setFlag("seeded-v1", false);
                location.reload();
              }}
            >
              <RotateCcw size={14} /> Reset demo data
            </Button>
          </div>
        </section>
        <section id="help" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-[15px] font-semibold">Help — designing a system in 8 steps</h2>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-slate-700">
            <li>Create a project (enter lot dimensions or upload a site plan and calibrate it with two clicks).</li>
            <li>Draw the house, hardscape and lawn/planting areas with the Site drawing tools (polygon, rectangle or circle).</li>
            <li>Place the water source (POC) and enter static pressure and a bucket-test flow.</li>
            <li>Select a lawn and use Auto-Design → Auto design area, or place heads manually (arcs auto-fit the area).</li>
            <li>Auto zone groups heads by flow limit, head type and hydrozone. Adjust zones in the Zones tab.</li>
            <li>Auto route draws laterals, mainline, wire and sleeves; or draw pipe yourself (P). Pan with Space/middle/right-drag at any time.</li>
            <li>Fix anything listed in Checks — click a warning to jump to it. The Assistant tab shows the next step.</li>
            <li>Review Materials and Estimate, then Export PDF (plan, installer sheet, schedules, proposal).</li>
          </ol>
          <h3 className="mb-2 mt-4 text-[13px] font-semibold">Keyboard shortcuts</h3>
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex justify-between border-b border-slate-100 py-1 text-[12.5px]">
                <span>{s.action}</span>
                <kbd className="font-mono text-[11px] text-slate-600">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

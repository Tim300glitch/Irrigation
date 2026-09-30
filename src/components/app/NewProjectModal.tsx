"use client";
import { ask } from "@/components/AskHost";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Square, Ruler, Upload, FileJson, Check } from "lucide-react";
import { Button, Field, Modal, NumberInput, Select, TextInput, cn, LengthInput } from "../ui";
import { createProject, makeArea, rect, uid, migrateProject } from "@/lib/model/factory";
import type { Project, ProjectType } from "@/lib/model/types";
import { TYPE_OPTIONS } from "../editor/dialogs/BasicDialogs";
import { persistProject, logActivity } from "@/lib/storage/seed";
import { useAppStore } from "@/store/appStore";

type Start = "blank" | "dimensions" | "upload" | "import";

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const customers = useAppStore((s) => s.customers);
  const profile = useAppStore((s) => s.profile);
  const products = useAppStore((s) => s.products);
  const setCustomers = useAppStore((s) => s.setCustomers);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<ProjectType>("new-install");
  const [start, setStart] = useState<Start>("dimensions");
  const [w, setW] = useState(80);
  const [d, setD] = useState(120);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<Project | null>(null);

  const create = async () => {
    setBusy(true);
    let p: Project;
    if (start === "import" && imported) {
      p = migrateProject({ ...imported, id: uid("prj") });
      if (name) p.meta.name = name;
    } else {
      p = createProject({ name: name || `${customer || "New"} Irrigation Design`, client: customer, address, projectType: type, designer: profile.designer, company: profile.company, phone: profile.phone, email: profile.email, status: type === "audit" ? "site-survey" : "design" });
      p.estimate.taxPct = profile.defaultTaxPct;
      p.estimate.laborRate = profile.defaultLaborRate;
      p.estimate.markupPct = profile.defaultMarkupPct;
      if (start === "dimensions") p.areas.push(makeArea("property", rect(0, 0, w, d)));
    }
    // link/create customer record
    if (customer) {
      let c = customers.find((x) => x.name.toLowerCase() === customer.toLowerCase());
      if (!c) {
        c = { id: uid("cus"), name: customer, email: "", phone: "", address, notes: "", createdAt: new Date().toISOString() };
        await setCustomers([...customers, c]);
      }
      p.meta.customerId = c.id;
    }
    await persistProject(p, products);
    await logActivity("Project created", p.id, p.meta.name);
    await useAppStore.getState().refresh();
    setBusy(false);
    onClose();
    router.push(`/design/${p.id}${start === "upload" ? "?start=upload" : ""}`);
  };

  const starts: { id: Start; icon: React.ReactNode; title: string; desc: string }[] = [
    { id: "blank", icon: <Square size={18} />, title: "Blank canvas", desc: "Draw everything from scratch" },
    { id: "dimensions", icon: <Ruler size={18} />, title: "Enter property dimensions", desc: "Start with the lot boundary" },
    { id: "upload", icon: <Upload size={18} />, title: "Upload site plan", desc: "PNG, JPG, PDF, survey or sketch" },
    { id: "import", icon: <FileJson size={18} />, title: "Import existing design", desc: "DeltaLine project file (.json)" },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New irrigation project"
      subtitle="Takes about 10 seconds — everything can be changed later."
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={busy || (start === "import" && !imported)}>
            {busy ? "Creating…" : "Create & open designer"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name" className="col-span-2">
          <TextInput value={name} onChange={setName} placeholder="e.g. Johnson Residence — front & back yard" />
        </Field>
        <Field label="Customer">
          <input list="dl-customers" className="h-8 w-full rounded-md border border-slate-300 px-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={customer} onChange={(e) => {
            setCustomer(e.target.value);
            const c = customers.find((x) => x.name === e.target.value);
            if (c && !address) setAddress(c.address);
          }} placeholder="Name (new or existing)" />
          <datalist id="dl-customers">
            {customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Project type">
          <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
        </Field>
        <Field label="Project address" className="col-span-2">
          <TextInput value={address} onChange={setAddress} placeholder="Street, city, state" />
        </Field>
      </div>
      <div className="mt-4 mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">How do you want to start?</div>
      <div className="grid grid-cols-2 gap-2">
        {starts.map((s) => (
          <button key={s.id} onClick={() => setStart(s.id)} className={cn("relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors", start === s.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300" : "border-slate-200 hover:bg-slate-50")}>
            <span className={cn("mt-0.5", start === s.id ? "text-brand-600" : "text-slate-500")}>{s.icon}</span>
            <span>
              <span className="block text-[13px] font-semibold text-slate-900">{s.title}</span>
              <span className="block text-[11.5px] text-slate-500">{s.desc}</span>
            </span>
            {start === s.id && <Check size={15} className="absolute right-2 top-2 text-brand-600" />}
          </button>
        ))}
      </div>
      {start === "dimensions" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Lot width (street frontage)">
            <LengthInput value={w} onChange={setW} min={10} />
          </Field>
          <Field label="Lot depth">
            <LengthInput value={d} onChange={setD} min={10} />
          </Field>
        </div>
      )}
      {start === "import" && (
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const p = JSON.parse(await f.text()) as Project;
                if (!p.meta || !Array.isArray(p.areas)) throw new Error("not a DeltaLine project");
                setImported(p);
                if (!name) setName(p.meta.name);
              } catch (err) {
                ask.alert(`Could not import this file: ${String(err)}`);
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <FileJson size={14} /> {imported ? `Loaded: ${imported.meta.name}` : "Choose project file…"}
          </Button>
        </div>
      )}
      {start === "upload" && <p className="mt-3 text-[12px] text-slate-500">The designer opens with the import dialog. After uploading, click two points of a known distance to set the scale.</p>}
    </Modal>
  );
}

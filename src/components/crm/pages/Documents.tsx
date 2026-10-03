"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Image as ImageIcon, ExternalLink, Trash2, Paperclip } from "lucide-react";
import { useCrm, byId } from "@/store/crmStore";
import type { CrmDocument, DocumentType, EntityType } from "@/lib/crm/types";
import { DOCUMENT_TYPES } from "@/lib/crm/constants";
import { crmRepo } from "@/lib/crm/repository";
import { uid } from "@/lib/crm/workflows";
import { customerName, date } from "@/lib/crm/format";
import { Page, PageHeader, Card, Tabs, Button, Select, SearchBox, Badge, Empty, Modal, Field, Input } from "../ui";
import { DataTable } from "../DataTable";
import { PhotoGallery } from "../Photos";

const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b ? `${Math.round(b / 1e3)} KB` : "link");

export function entityHref(t: EntityType, id: string) {
  const m: Partial<Record<EntityType, string>> = { customer: "customers", property: "properties", job: "jobs", estimate: "estimates", invoice: "invoices", audit: "audits", install: "installs" };
  return m[t] ? `/${m[t]}/${id}` : "#";
}

export function DocumentsList({ docs }: { docs: CrmDocument[] }) {
  const { data, remove } = useCrm();
  const cust = byId(data.customers);
  return (
    <DataTable
      rows={docs}
      initialSort={{ key: "d", dir: "desc" }}
      empty={<Empty icon={<Paperclip size={18} />} title="No documents">Contracts, permits, backflow certificates, manuals and warranties live here.</Empty>}
      columns={[
        { key: "n", header: "Name", mobile: true, cell: (d) => <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-700">{d.mime.startsWith("image/") ? <ImageIcon size={14} className="text-slate-400" /> : <FileText size={14} className="text-slate-400" />}{d.name}</a> },
        { key: "t", header: "Type", mobile: true, cell: (d) => <Badge>{DOCUMENT_TYPES.find((t) => t.id === d.type)?.label}</Badge> },
        { key: "a", header: "Attached to", hideBelow: "md", cell: (d) => <Link href={entityHref(d.entityType, d.entityId)} className="text-slate-600 hover:text-brand-700">{d.entityType}{d.customerId ? ` · ${customerName(cust.get(d.customerId))}` : ""}</Link> },
        { key: "s", header: "Size", align: "right", hideBelow: "lg", cell: (d) => <span className="text-slate-500">{size(d.size)}</span> },
        { key: "d", header: "Uploaded", sort: (d) => d.uploadedAt, cell: (d) => <span className="text-slate-500">{date(d.uploadedAt)}</span> },
        { key: "x", header: "", cell: (d) => <span className="flex justify-end gap-1"><a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Open"><ExternalLink size={13} /></a><button onClick={() => remove("documents", d.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={13} /></button></span> },
      ]}
    />
  );
}

export function DocumentUpload({ entityType, entityId, customerId, defaultType = "other" }: { entityType: EntityType; entityId: string; customerId?: string; defaultType?: DocumentType }) {
  const { insert, log, session } = useCrm();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>(defaultType);
  const [name, setName] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => ref.current?.click()}>
        <Upload size={13} /> Upload
      </Button>
      <input
        ref={ref}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPending(f);
            setName(f.name);
            setType(f.type.startsWith("image/") ? "photo" : /permit/i.test(f.name) ? "permit" : /backflow/i.test(f.name) ? "backflow" : /warrant/i.test(f.name) ? "warranty" : /manual/i.test(f.name) ? "manual" : /contract/i.test(f.name) ? "contract" : defaultType);
          }
          e.target.value = "";
        }}
      />
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Upload document"
          width={480}
          footer={
            <>
              <Button onClick={() => setPending(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const url = await crmRepo.uploadFile(pending, `${entityType}/${entityId}/${Date.now()}-${pending.name}`);
                  insert("documents", { id: uid("doc"), name, type, url, mime: pending.type || "application/octet-stream", size: pending.size, entityType, entityId, customerId, uploadedAt: new Date().toISOString(), uploadedBy: session?.employeeId, notes: "" });
                  log({ type: "document", message: `Document uploaded — ${name}`, entityType, entityId, customerId });
                  setPending(null);
                }}
              >
                Upload
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} options={DOCUMENT_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export function DocumentsPage() {
  const data = useCrm((s) => s.data);
  const [tab, setTab] = useState<"documents" | "photos">("documents");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const docs = useMemo(() => data.documents.filter((d) => (!type || d.type === type) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))), [data.documents, type, q]);
  return (
    <Page>
      <PageHeader title="Documents & photos" subtitle={`${data.documents.length} documents · ${data.photos.length} photos — attach to customers, properties, jobs, estimates and equipment`} />
      <Tabs
        tabs={[
          { id: "documents", label: "Documents", count: data.documents.length },
          { id: "photos", label: "Photos", count: data.photos.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-3"
      />
      {tab === "documents" ? (
        <Card pad={false}>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
            <SearchBox value={q} onChange={setQ} className="w-64" placeholder="Search documents…" />
            <Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "", label: "All types" }, ...DOCUMENT_TYPES.map((t) => ({ value: t.id, label: t.label }))]} className="w-48" />
          </div>
          <DocumentsList docs={docs} />
        </Card>
      ) : (
        <Card>
          <PhotoGallery photos={data.photos} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
        </Card>
      )}
    </Page>
  );
}

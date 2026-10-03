"use client";
import { CrmShell } from "@/components/crm/Shell";
import { DocumentsPage } from "@/components/crm/pages/Documents";

export default function Page() {
  return (
    <CrmShell title="Documents">
      <DocumentsPage />
    </CrmShell>
  );
}

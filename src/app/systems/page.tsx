"use client";
import { CrmShell } from "@/components/crm/Shell";
import { SystemsPage } from "@/components/crm/pages/Audits";

export default function Page() {
  return (
    <CrmShell title="Irrigation Systems">
      <SystemsPage />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { AuditsPage } from "@/components/crm/pages/Audits";

export default function Page() {
  return (
    <CrmShell title="Audits">
      <AuditsPage />
    </CrmShell>
  );
}

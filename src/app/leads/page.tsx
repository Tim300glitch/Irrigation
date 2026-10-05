"use client";
import { CrmShell } from "@/components/crm/Shell";
import { LeadsPage } from "@/components/crm/pages/Leads";

export default function Page() {
  return (
    <CrmShell title="Leads">
      <LeadsPage />
    </CrmShell>
  );
}

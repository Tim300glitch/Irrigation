"use client";
import { CrmShell } from "@/components/crm/Shell";
import { ReportsPage } from "@/components/crm/pages/Reports";

export default function Page() {
  return (
    <CrmShell title="Reports">
      <ReportsPage />
    </CrmShell>
  );
}

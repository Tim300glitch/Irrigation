"use client";
import { CrmShell } from "@/components/crm/Shell";
import { EstimatesPage } from "@/components/crm/pages/Estimates";

export default function Page() {
  return (
    <CrmShell title="Estimates">
      <EstimatesPage />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { DispatchPage } from "@/components/crm/pages/Schedule";

export default function Page() {
  return (
    <CrmShell title="Dispatch">
      <DispatchPage />
    </CrmShell>
  );
}

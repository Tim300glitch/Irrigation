"use client";
import { CrmShell } from "@/components/crm/Shell";
import { ServicePlansPage } from "@/components/crm/pages/Resources";

export default function Page() {
  return (
    <CrmShell title="Service Plans">
      <ServicePlansPage />
    </CrmShell>
  );
}

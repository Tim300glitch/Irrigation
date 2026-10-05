"use client";
import { CrmShell } from "@/components/crm/Shell";
import { VendorsPage } from "@/components/crm/pages/Resources";

export default function Page() {
  return (
    <CrmShell title="Vendors">
      <VendorsPage />
    </CrmShell>
  );
}

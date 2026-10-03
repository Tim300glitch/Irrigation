"use client";
import { CrmShell } from "@/components/crm/Shell";
import { CustomersPage } from "@/components/crm/pages/Customers";

export default function Page() {
  return (
    <CrmShell title="Customers">
      <CustomersPage />
    </CrmShell>
  );
}

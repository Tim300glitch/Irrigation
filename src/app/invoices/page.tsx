"use client";
import { CrmShell } from "@/components/crm/Shell";
import { InvoicesPage } from "@/components/crm/pages/Invoices";

export default function Page() {
  return (
    <CrmShell title="Invoices">
      <InvoicesPage />
    </CrmShell>
  );
}

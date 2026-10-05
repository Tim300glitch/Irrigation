"use client";
import { CrmShell } from "@/components/crm/Shell";
import { PaymentsPage } from "@/components/crm/pages/Invoices";

export default function Page() {
  return (
    <CrmShell title="Payments">
      <PaymentsPage />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { InvoiceDetail } from "@/components/crm/pages/Invoices";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Invoice">
      <InvoiceDetail id={id} />
    </CrmShell>
  );
}

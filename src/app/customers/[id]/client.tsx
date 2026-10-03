"use client";
import { CrmShell } from "@/components/crm/Shell";
import { CustomerDetail } from "@/components/crm/pages/Customers";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Customer">
      <CustomerDetail id={id} />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { PropertyDetail } from "@/components/crm/pages/Properties";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Property">
      <PropertyDetail id={id} />
    </CrmShell>
  );
}

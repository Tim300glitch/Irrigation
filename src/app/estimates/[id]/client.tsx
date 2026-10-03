"use client";
import { CrmShell } from "@/components/crm/Shell";
import { EstimateBuilder } from "@/components/crm/pages/Estimates";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Estimate">
      <EstimateBuilder id={id} />
    </CrmShell>
  );
}

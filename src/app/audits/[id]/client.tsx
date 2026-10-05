"use client";
import { CrmShell } from "@/components/crm/Shell";
import { AuditDetail } from "@/components/crm/pages/Audits";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Audit">
      <AuditDetail id={id} />
    </CrmShell>
  );
}

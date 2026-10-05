"use client";
import { CrmShell } from "@/components/crm/Shell";
import { JobDetail } from "@/components/crm/pages/Jobs";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Job">
      <JobDetail id={id} />
    </CrmShell>
  );
}

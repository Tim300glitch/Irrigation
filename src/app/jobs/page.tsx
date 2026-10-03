"use client";
import { CrmShell } from "@/components/crm/Shell";
import { JobsPage } from "@/components/crm/pages/Jobs";

export default function Page() {
  return (
    <CrmShell title="Jobs">
      <JobsPage />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { SchedulePage } from "@/components/crm/pages/Schedule";

export default function Page() {
  return (
    <CrmShell title="Schedule">
      <SchedulePage />
    </CrmShell>
  );
}

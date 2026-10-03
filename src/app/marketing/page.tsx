"use client";
import { CrmShell } from "@/components/crm/Shell";
import { MarketingPage } from "@/components/crm/pages/Reports";

export default function Page() {
  return (
    <CrmShell title="Marketing">
      <MarketingPage />
    </CrmShell>
  );
}

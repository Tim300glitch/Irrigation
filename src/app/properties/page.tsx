"use client";
import { CrmShell } from "@/components/crm/Shell";
import { PropertiesPage } from "@/components/crm/pages/Properties";

export default function Page() {
  return (
    <CrmShell title="Properties">
      <PropertiesPage />
    </CrmShell>
  );
}

"use client";
import { CrmShell } from "@/components/crm/Shell";
import { SettingsPage } from "@/components/crm/pages/Settings";

export default function Page() {
  return (
    <CrmShell title="Settings">
      <SettingsPage />
    </CrmShell>
  );
}

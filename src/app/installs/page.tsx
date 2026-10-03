"use client";
import { CrmShell } from "@/components/crm/Shell";
import { InstallsPage } from "@/components/crm/pages/Installs";

export default function Page() {
  return (
    <CrmShell title="Install Projects">
      <InstallsPage />
    </CrmShell>
  );
}

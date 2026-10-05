"use client";
import { CrmShell } from "@/components/crm/Shell";
import { InstallDetail } from "@/components/crm/pages/Installs";

export function DetailRoute({ id }: { id: string }) {
  return (
    <CrmShell title="Install Project">
      <InstallDetail id={id} />
    </CrmShell>
  );
}

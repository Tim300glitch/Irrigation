"use client";
import { CrmShell } from "@/components/crm/Shell";
import { InventoryPage } from "@/components/crm/pages/Resources";

export default function Page() {
  return (
    <CrmShell title="Inventory">
      <InventoryPage />
    </CrmShell>
  );
}

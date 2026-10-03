"use client";
import { CrmShell } from "@/components/crm/Shell";
import { Dashboard } from "@/components/crm/pages/Dashboard";

export default function Home() {
  return (
    <CrmShell title="Dashboard">
      <Dashboard />
    </CrmShell>
  );
}

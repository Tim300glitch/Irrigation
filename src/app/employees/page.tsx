"use client";
import { CrmShell } from "@/components/crm/Shell";
import { EmployeesPage } from "@/components/crm/pages/Resources";

export default function Page() {
  return (
    <CrmShell title="Employees">
      <EmployeesPage />
    </CrmShell>
  );
}

"use client";
import { AppShell } from "@/components/app/AppShell";
import { Dashboard } from "@/components/app/Dashboard";

export default function Home() {
  return (
    <AppShell title="Home">
      <Dashboard />
    </AppShell>
  );
}

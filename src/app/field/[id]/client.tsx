"use client";
import { FieldJob } from "@/components/crm/pages/Field";

export function DetailRoute({ id }: { id: string }) {
  return <FieldJob id={id} />;
}

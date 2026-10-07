/** Deleting employees: clean removal, archive when history exists, guards. */
import { beforeAll, describe, expect, it } from "vitest";
import { useCrm } from "@/store/crmStore";
import type { Employee } from "../crm/types";

const s = () => useCrm.getState();
const base: Omit<Employee, "id" | "firstName" | "role"> = { lastName: "Test", phone: "", email: "", color: "#0891b2", payType: "hourly", payRate: 25, commissionPct: 0, certifications: [], hireDate: "2026-01-01", active: true, workDays: [1, 2, 3, 4, 5], shiftStart: "07:00", shiftEnd: "15:30" };

describe("delete employee", () => {
  beforeAll(async () => {
    await s().init();
  }, 60000);

  it("removes an employee with no history entirely", () => {
    s().insert("employees", { ...base, id: "emp_new", firstName: "Newbie", role: "helper" });
    expect(s().deleteEmployee("emp_new").ok).toBe(true);
    expect(s().data.employees.some((e) => e.id === "emp_new")).toBe(false);
  });

  it("archives an employee with history and takes them off open work", () => {
    const tech = s().data.employees.find((e) => e.id !== s().session?.employeeId && e.role === "technician" && s().data.timeEntries.some((t) => t.employeeId === e.id))!;
    const openBefore = s().data.jobs.filter((j) => j.assignedTo === tech.id && j.status !== "completed" && j.status !== "cancelled");
    const hoursBefore = s().data.timeEntries.filter((t) => t.employeeId === tech.id).length;
    const r = s().deleteEmployee(tech.id);
    expect(r.ok).toBe(true);
    const after = s().data.employees.find((e) => e.id === tech.id)!;
    expect(after.archived).toBe(true);
    expect(after.active).toBe(false);
    for (const j of openBefore) expect(s().data.jobs.find((x) => x.id === j.id)!.assignedTo).toBeUndefined();
    expect(s().data.timeEntries.filter((t) => t.employeeId === tech.id).length).toBe(hoursBefore);
    const now = new Date().toISOString();
    expect(s().data.appointments.some((a) => a.end > now && a.employeeIds.includes(tech.id))).toBe(false);
  });

  it("refuses to delete the signed-in user or the only owner", () => {
    const me = s().session!.employeeId!;
    expect(s().deleteEmployee(me).ok).toBe(false);
    const owners = s().data.employees.filter((e) => e.role === "owner" && !e.archived);
    if (owners.length === 1) {
      // sign in as someone else so the "self" guard isn't what blocks it
      const other = s().data.employees.find((e) => e.id !== owners[0].id && !e.archived)!;
      useCrm.setState({ session: { ...s().session!, employeeId: other.id } });
      expect(s().deleteEmployee(owners[0].id).message).toMatch(/only owner/);
    }
  });
});

describe("start over", () => {
  it("Start empty keeps the price book; Erase everything clears it and resets business info", async () => {
    await s().resetDemo();
    const items = s().data.items.length;
    await s().startFresh();
    expect(s().data.customers.length).toBe(0);
    expect(s().data.employees.length).toBe(1);
    expect(s().data.items.length).toBe(items);
    await s().startFresh({ everything: true });
    expect(s().data.items.length).toBe(0);
    expect(s().data.estimateTemplates.length).toBe(0);
    expect(s().data.employees).toHaveLength(1);
    expect(s().data.employees[0].firstName).toBe("Owner");
    expect(s().settings.businessName).toBe("My Irrigation Company");
    expect(s().session?.employeeId).toBe(s().data.employees[0].id);
  });
});

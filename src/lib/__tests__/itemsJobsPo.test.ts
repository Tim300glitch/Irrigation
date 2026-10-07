/** Purchase orders, item options/defaults, job delete/archive. */
import { beforeAll, describe, expect, it } from "vitest";
import { useCrm } from "@/store/crmStore";
import { defaultLines } from "../crm/workflows";
import { lineCostFor } from "../crm/itemOptions";

const s = () => useCrm.getState();

describe("items, purchase orders, jobs", () => {
  beforeAll(async () => {
    await s().init();
    await s().resetDemo();
  }, 60000);

  it("receiving a PO adds stock to the warehouse and logs it", () => {
    const item = s().data.items.find((i) => i.stocked && i.preferredVendorId)!;
    const before = item.warehouseQty;
    const po = s().createPurchaseOrder({ vendorId: item.preferredVendorId, items: [{ id: "pol1", itemId: item.id, name: item.name, sku: item.sku, qty: 7, unit: item.unit, unitCost: item.cost }] });
    expect(po.number).toBeGreaterThan(0);
    s().receivePurchaseOrder(po.id);
    expect(s().data.items.find((i) => i.id === item.id)!.warehouseQty).toBe(before + 7);
    expect(s().data.purchaseOrders.find((p) => p.id === po.id)!.status).toBe("received");
    expect(s().data.inventoryTxns.some((t) => t.itemId === item.id && t.note.includes(`PO-${po.number}`))).toBe(true);
    // receiving twice does nothing
    s().receivePurchaseOrder(po.id);
    expect(s().data.items.find((i) => i.id === item.id)!.warehouseQty).toBe(before + 7);
  });

  it("a PO can deliver straight to a truck", () => {
    const truck = s().data.trucks[0];
    const item = s().data.items.find((i) => i.stocked)!;
    const qty = () => s().data.truckStock.find((x) => x.truckId === truck.id && x.itemId === item.id)?.qty ?? 0;
    const before = qty();
    const po = s().createPurchaseOrder({ deliverTo: truck.id, items: [{ id: "pol2", itemId: item.id, name: item.name, sku: "", qty: 3, unit: item.unit, unitCost: item.cost }] });
    s().receivePurchaseOrder(po.id);
    expect(qty()).toBe(before + 3);
  });

  it("option costs drive the line price; default kits follow job type", () => {
    const ctl = s().data.items.find((i) => i.id === "itm_prohc")!;
    expect(lineCostFor(ctl, { Zones: "24" }).unitCost).toBe(389);
    expect(lineCostFor(ctl, {}).unitCost).toBe(ctl.cost);
    const kit = defaultLines(s().data.items, "smart_controller");
    expect(kit.map((l) => l.itemId)).toContain("itm_prohc");
    expect(defaultLines(s().data.items, "winterization")).toHaveLength(0);
  });

  it("deleting an item removes its truck stock", () => {
    const ts = s().data.truckStock[0];
    s().deleteItem(ts.itemId);
    expect(s().data.items.some((i) => i.id === ts.itemId)).toBe(false);
    expect(s().data.truckStock.some((x) => x.itemId === ts.itemId)).toBe(false);
  });

  it("jobs: invoiced jobs can't be deleted; others can, with change orders", () => {
    const invoiced = s().data.jobs.find((j) => s().data.invoices.some((i) => i.jobId === j.id))!;
    expect(s().deleteJob(invoiced.id).ok).toBe(false);
    const c = s().data.customers[0];
    const p = s().data.properties.find((x) => x.customerId === c.id)!;
    const j = s().createJob({ customerId: c.id, propertyId: p.id, title: "Temp", crew: s().data.employees.slice(0, 2).map((e) => e.id) });
    s().createChangeOrder(j.id, { title: "x", description: "", items: [] });
    expect(s().deleteJob(j.id).ok).toBe(true);
    expect(s().data.jobs.some((x) => x.id === j.id)).toBe(false);
    expect(s().data.changeOrders.some((x) => x.jobId === j.id)).toBe(false);
  });
});

import type { InventoryItem, LineItem } from "./types";
import { priceFromRule } from "./calc";

/** Cost/price for an item given chosen options (last option with its own cost wins). */
export function lineCostFor(item: InventoryItem, chosen: Record<string, string>): Pick<LineItem, "unitCost" | "unitPrice"> {
  let cost = item.cost;
  for (const o of item.options ?? []) {
    const v = o.values.find((x) => x.label === chosen[o.name]);
    if (v?.cost != null) cost = v.cost;
  }
  return { unitCost: cost, unitPrice: priceFromRule(cost, item.pricing) };
}

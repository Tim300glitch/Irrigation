/**
 * Water price for the cost estimate. PLANNING ESTIMATES ONLY.
 *
 * "Auto" uses a rough typical residential water rate for the project's state
 * (taken from the address). Real rates vary a lot by city and water district
 * and are often tiered, so users can enter the price from their own bill.
 */
import type { ComparisonSettings, WaterPriceUnit } from "../model/types";

/** Approximate typical residential water-only rates, US$ per 1,000 gallons. */
export const STATE_WATER_RATES: Record<string, { name: string; per1000: number }> = {
  AL: { name: "Alabama", per1000: 5.5 },
  AK: { name: "Alaska", per1000: 9 },
  AZ: { name: "Arizona", per1000: 5 },
  AR: { name: "Arkansas", per1000: 5 },
  CA: { name: "California", per1000: 9 },
  CO: { name: "Colorado", per1000: 6 },
  CT: { name: "Connecticut", per1000: 8 },
  DE: { name: "Delaware", per1000: 6.5 },
  DC: { name: "District of Columbia", per1000: 9 },
  FL: { name: "Florida", per1000: 5 },
  GA: { name: "Georgia", per1000: 6.5 },
  HI: { name: "Hawaii", per1000: 7 },
  ID: { name: "Idaho", per1000: 3.5 },
  IL: { name: "Illinois", per1000: 6 },
  IN: { name: "Indiana", per1000: 5.5 },
  IA: { name: "Iowa", per1000: 6.5 },
  KS: { name: "Kansas", per1000: 6.5 },
  KY: { name: "Kentucky", per1000: 6 },
  LA: { name: "Louisiana", per1000: 5 },
  ME: { name: "Maine", per1000: 6.5 },
  MD: { name: "Maryland", per1000: 7.5 },
  MA: { name: "Massachusetts", per1000: 8.5 },
  MI: { name: "Michigan", per1000: 6 },
  MN: { name: "Minnesota", per1000: 5.5 },
  MS: { name: "Mississippi", per1000: 4.5 },
  MO: { name: "Missouri", per1000: 6 },
  MT: { name: "Montana", per1000: 5 },
  NE: { name: "Nebraska", per1000: 4.5 },
  NV: { name: "Nevada", per1000: 4.5 },
  NH: { name: "New Hampshire", per1000: 7 },
  NJ: { name: "New Jersey", per1000: 7.5 },
  NM: { name: "New Mexico", per1000: 5 },
  NY: { name: "New York", per1000: 7 },
  NC: { name: "North Carolina", per1000: 6.5 },
  ND: { name: "North Dakota", per1000: 5 },
  OH: { name: "Ohio", per1000: 7 },
  OK: { name: "Oklahoma", per1000: 5.5 },
  OR: { name: "Oregon", per1000: 6.5 },
  PA: { name: "Pennsylvania", per1000: 8 },
  RI: { name: "Rhode Island", per1000: 7 },
  SC: { name: "South Carolina", per1000: 6 },
  SD: { name: "South Dakota", per1000: 5 },
  TN: { name: "Tennessee", per1000: 5.5 },
  TX: { name: "Texas", per1000: 6.5 },
  UT: { name: "Utah", per1000: 4 },
  VT: { name: "Vermont", per1000: 7 },
  VA: { name: "Virginia", per1000: 7 },
  WA: { name: "Washington", per1000: 8 },
  WV: { name: "West Virginia", per1000: 8.5 },
  WI: { name: "Wisconsin", per1000: 6 },
  WY: { name: "Wyoming", per1000: 4.5 },
};

export const US_AVERAGE_PER_1000 = 6.5;

/** Gallons in one billing unit. CCF / HCF = 100 cubic feet. */
export const PRICE_UNITS: Record<WaterPriceUnit, { label: string; gallons: number }> = {
  gal: { label: "per gallon", gallons: 1 },
  kgal: { label: "per 1,000 gal", gallons: 1000 },
  ccf: { label: "per CCF / HCF (748 gal)", gallons: 748.052 },
};

/** Two-letter state from an address like "… Riverside, CA 92506" or "… Austin, Texas". */
export function stateFromAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const m = /(?:,|\s)\s*([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?\s*(?:,?\s*(?:USA|US|United States))?\s*$/.exec(address.trim());
  if (m && STATE_WATER_RATES[m[1]]) return m[1];
  const lower = address.toLowerCase();
  let best: string | undefined;
  for (const [code, s] of Object.entries(STATE_WATER_RATES)) {
    if (lower.includes(s.name.toLowerCase()) && (!best || s.name.length > STATE_WATER_RATES[best].name.length)) best = code;
  }
  return best;
}

export interface WaterPrice {
  /** US$ per gallon */
  perGallon: number;
  auto: boolean;
  /** where the price came from, for display */
  source: string;
  state?: string;
}

export function waterPrice(cmp: ComparisonSettings, address: string | undefined): WaterPrice {
  if (cmp.waterPrice?.mode === "manual" && cmp.waterPrice.amount > 0) {
    const unit = PRICE_UNITS[cmp.waterPrice.unit];
    return { perGallon: cmp.waterPrice.amount / unit.gallons, auto: false, source: "your price" };
  }
  const state = cmp.waterPrice?.state ?? stateFromAddress(address);
  const rate = state ? STATE_WATER_RATES[state] : undefined;
  return rate
    ? { perGallon: rate.per1000 / 1000, auto: true, source: `typical ${rate.name} rate`, state }
    : { perGallon: US_AVERAGE_PER_1000 / 1000, auto: true, source: "US average rate" };
}

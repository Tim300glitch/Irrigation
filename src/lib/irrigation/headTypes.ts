/**
 * Generic head bodies and nozzle types for the water-savings comparison
 * (existing system vs. upgrade). PLANNING ESTIMATES ONLY.
 *
 * Nozzle type sets the application efficiency (how much of the water lands
 * usefully). Body features adjust it: pressure regulation stops misting and
 * over-pressure losses, check valves stop low-head drainage after each cycle.
 */
import type { ComparisonSettings, HeadBodyId, HeadGroup, NozzleTypeId } from "../model/types";

export type HeadKind = "spray" | "rotor" | "impact" | "bubbler" | "drip";

export const KIND_LABEL: Record<HeadKind, string> = {
  spray: "Spray bodies",
  rotor: "Gear-driven rotors",
  impact: "Impact heads",
  bubbler: "Bubblers",
  drip: "Drip",
};

export interface HeadBody {
  label: string;
  kind: HeadKind;
  regulated?: boolean;
  checkValve?: boolean;
  /** multiplier on water applied for losses specific to this body (1 = none) */
  lossFactor?: number;
}

export const HEAD_BODIES: Record<HeadBodyId, HeadBody> = {
  "spray-2": { label: '2" pop-up spray body', kind: "spray" },
  "spray-4": { label: '4" pop-up spray body', kind: "spray" },
  "spray-6": { label: '6" pop-up spray body', kind: "spray" },
  "spray-12": { label: '12" pop-up spray body', kind: "spray" },
  "spray-4-prs": { label: '4" spray body, pressure-regulated', kind: "spray", regulated: true },
  "spray-6-prs": { label: '6" spray body, pressure-regulated', kind: "spray", regulated: true },
  "spray-12-prs": { label: '12" spray body, pressure-regulated', kind: "spray", regulated: true },
  "spray-4-prs-cv": { label: '4" spray, pressure-reg. + check valve', kind: "spray", regulated: true, checkValve: true },
  "spray-6-prs-cv": { label: '6" spray, pressure-reg. + check valve', kind: "spray", regulated: true, checkValve: true },
  "spray-12-prs-cv": { label: '12" spray, pressure-reg. + check valve', kind: "spray", regulated: true, checkValve: true },
  "shrub-riser": { label: "Shrub adapter on fixed riser", kind: "spray", lossFactor: 1.05 },
  "rotor-4": { label: '4" gear-driven rotor', kind: "rotor" },
  "rotor-6": { label: '6" gear-driven rotor', kind: "rotor" },
  "rotor-12": { label: '12" gear-driven rotor', kind: "rotor" },
  "rotor-4-prs": { label: '4" gear-driven rotor, pressure-regulated', kind: "rotor", regulated: true },
  "rotor-4-prs-cv": { label: '4" gear rotor, pressure-reg. + check valve', kind: "rotor", regulated: true, checkValve: true },
  "rotor-6-prs-cv": { label: '6" gear rotor, pressure-reg. + check valve', kind: "rotor", regulated: true, checkValve: true },
  "impact-riser": { label: "Impact head on riser", kind: "impact" },
  "impact-popup": { label: "Pop-up impact head", kind: "impact" },
  bubbler: { label: "Bubbler / tree riser", kind: "bubbler" },
  drip: { label: "Drip (dripline or emitters)", kind: "drip" },
};

export interface NozzleType {
  label: string;
  /** body kinds this nozzle fits */
  fits: HeadKind[];
  /** application efficiency (fraction of applied water used by plants) */
  efficiency: number;
}

export const NOZZLE_TYPES: Record<NozzleTypeId, NozzleType> = {
  "fixed-spray": { label: "Fixed-arc spray nozzle", fits: ["spray"], efficiency: 0.55 },
  van: { label: "VAN (variable-arc) spray nozzle", fits: ["spray"], efficiency: 0.55 },
  strip: { label: "Strip nozzle (side / end / center)", fits: ["spray"], efficiency: 0.5 },
  "he-spray": { label: "High-efficiency spray (HE-VAN style)", fits: ["spray"], efficiency: 0.65 },
  "mp-rotator": { label: "MP Rotator (multi-stream rotary)", fits: ["spray"], efficiency: 0.7 },
  "rotor-std": { label: "Standard rotor nozzle", fits: ["rotor"], efficiency: 0.65 },
  "rotor-low-angle": { label: "Low-angle rotor nozzle", fits: ["rotor"], efficiency: 0.65 },
  "rotor-mpr": { label: "Matched-precipitation rotor nozzle set", fits: ["rotor"], efficiency: 0.7 },
  "impact-std": { label: "Impact nozzle (brass or plastic)", fits: ["impact"], efficiency: 0.6 },
  "bubbler-std": { label: "Bubbler nozzle", fits: ["bubbler", "spray"], efficiency: 0.8 },
  "drip-std": { label: "Drip emitter / dripline", fits: ["drip"], efficiency: 0.85 },
};

const DEFAULT_NOZZLE: Record<HeadKind, NozzleTypeId> = { spray: "fixed-spray", rotor: "rotor-std", impact: "impact-std", bubbler: "bubbler-std", drip: "drip-std" };

export function nozzlesFor(body: HeadBodyId): NozzleTypeId[] {
  const kind = HEAD_BODIES[body].kind;
  return (Object.keys(NOZZLE_TYPES) as NozzleTypeId[]).filter((n) => NOZZLE_TYPES[n].fits.includes(kind));
}

/** Keeps the nozzle when it fits the new body, else picks that body's usual nozzle. */
export function nozzleForBody(body: HeadBodyId, nozzle: NozzleTypeId): NozzleTypeId {
  return NOZZLE_TYPES[nozzle].fits.includes(HEAD_BODIES[body].kind) ? nozzle : DEFAULT_NOZZLE[HEAD_BODIES[body].kind];
}

/** Multiplier on water applied from body features (pressure regulation, check valve). */
export function bodyFactor(b: HeadBody): number {
  let f = b.lossFactor ?? 1;
  if (b.regulated) f *= b.kind === "spray" ? 0.92 : 0.96;
  if (b.checkValve) f *= 0.97;
  return f;
}

/** Effective efficiency of one head type: nozzle efficiency, with body losses taken out. */
export function groupEfficiency(g: Pick<HeadGroup, "body" | "nozzle">): number {
  return NOZZLE_TYPES[g.nozzle].efficiency / bodyFactor(HEAD_BODIES[g.body]);
}

/** Area-weighted efficiency of a mix of head types (shares need not sum to 100). */
export function mixEfficiency(groups: HeadGroup[]): number {
  const total = groups.reduce((a, g) => a + Math.max(0, g.sharePct), 0);
  if (!groups.length || total <= 0) return 0.55;
  // weight water use (1/eff), not efficiency, so the mix uses the right amount of water
  const waterPerNeed = groups.reduce((a, g) => a + (Math.max(0, g.sharePct) / total) / groupEfficiency(g), 0);
  return 1 / waterPerNeed;
}

/** Existing-system head mix; older projects only stored a system type. */
export function currentHeadGroups(cmp: ComparisonSettings): HeadGroup[] {
  if (cmp.currentHeads?.length) return cmp.currentHeads;
  switch (cmp.currentSystemType) {
    case "rotor":
      return [{ body: "rotor-4", nozzle: "rotor-std", sharePct: 100 }];
    case "impact":
      return [{ body: "impact-riser", nozzle: "impact-std", sharePct: 100 }];
    case "mixed":
      return [
        { body: "spray-4", nozzle: "fixed-spray", sharePct: 50 },
        { body: "rotor-4", nozzle: "rotor-std", sharePct: 50 },
      ];
    default:
      return [{ body: "spray-4", nozzle: "fixed-spray", sharePct: 100 }];
  }
}

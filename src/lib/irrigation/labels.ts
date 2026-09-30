import type { Project } from "../model/types";
import { getProduct } from "../catalog/sprinklers";

const PREFIX: Record<string, string> = { rotor: "R", spray: "S", rotary: "N", bubbler: "B", impact: "I", emitter: "E", microspray: "M", custom: "H" };

/** Head labels: "R1, S2…" (sequential per type) or "Z1-H1…" (per zone). User labels win. */
export function headLabels(project: Project): Map<string, string> {
  const out = new Map<string, string>();
  const zoneNum = new Map(project.zones.map((z) => [z.id, z.number]));
  const sorted = [...project.sprinklers].sort((a, b) => {
    const za = a.zoneId ? zoneNum.get(a.zoneId) ?? 999 : 999;
    const zb = b.zoneId ? zoneNum.get(b.zoneId) ?? 999 : 999;
    if (za !== zb) return za - zb;
    if (Math.abs(a.position.y - b.position.y) > 3) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });
  if (project.settings.headLabelStyle === "zone") {
    const counters = new Map<string, number>();
    for (const s of sorted) {
      const zn = s.zoneId ? zoneNum.get(s.zoneId) : undefined;
      const key = zn ? `Z${zn}` : "Z?";
      const c = (counters.get(key) ?? 0) + 1;
      counters.set(key, c);
      out.set(s.id, s.label || `${key}-H${c}`);
    }
  } else {
    const counters = new Map<string, number>();
    for (const s of sorted) {
      const p = PREFIX[getProduct(s.productId).category] ?? "H";
      const c = (counters.get(p) ?? 0) + 1;
      counters.set(p, c);
      out.set(s.id, s.label || `${p}${c}`);
    }
  }
  return out;
}

/** compass words for a direction (north = -y) */
export function compass(dx: number, dy: number): string {
  const ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = east, 90 = north
  const dirs = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];
  const idx = Math.round(((ang + 360) % 360) / 45) % 8;
  return dirs[idx];
}

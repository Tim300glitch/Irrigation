import { test } from "vitest";
import { createDemoProject, createSampleProjects } from "@/lib/model/demo";
import { analyzeProject } from "@/lib/analysis";
import { defaultMaterialProducts } from "@/lib/materials/pricing";

test("demo", () => {
  const t0 = Date.now();
  const p = createDemoProject();
  const t1 = Date.now();
  const a = analyzeProject(p, defaultMaterialProducts());
  const t2 = Date.now();
  console.log("gen ms", t1 - t0, "analyze ms", t2 - t1);
  console.log("heads", p.sprinklers.length, "zones", p.zones.length, "pipes", p.pipes.length);
  for (const z of a.hyd.zones) console.log(z.number, z.name, z.headCount, z.gpm.toFixed(1), "crit", z.criticalPressure?.toFixed(1), "var", z.pressureVariationPct.toFixed(0), "vel", z.maxVelocity.toFixed(1), z.status, z.issues);
  for (const w of a.warnings) console.log(w.severity, w.code, w.message);
  console.log("cov", a.coverage?.stats);
  console.log("total", a.estimate.total.toFixed(0), "mat", a.estimate.materialSubtotal.toFixed(0), "missing", a.estimate.missingPrices);
  for (const s of createSampleProjects()) {
    const b = analyzeProject(s, defaultMaterialProducts());
    console.log(s.meta.name, s.sprinklers.length, s.zones.length, b.estimate.total.toFixed(0), b.warnings.filter(w=>w.severity!=="recommendation").map(w=>w.code).join(","));
  }
});

import { writeFileSync } from "node:fs";
import type { Project } from "@/lib/model/types";
import { headPerformance } from "@/lib/irrigation/sprinkler";
function svgOf(p: Project, labels: Map<string,string>) {
  const S = 6;
  const parts: string[] = [];
  for (const a of p.areas) parts.push(`<polygon points="${a.points.map(q=>`${q.x*S},${q.y*S}`).join(" ")}" fill="${a.style.fill}" fill-opacity="${a.style.opacity||0.05}" stroke="${a.style.stroke}"/>`);
  for (const h of p.sprinklers) {
    const pf = headPerformance(h); const r = pf.radius*S;
    const x=h.position.x*S,y=h.position.y*S;
    if (h.arc>=359.9) parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="blue" fill-opacity="0.07" stroke="blue" stroke-opacity="0.3"/>`);
    else { const a0=h.arcStart*Math.PI/180,a1=(h.arcStart+h.arc)*Math.PI/180; parts.push(`<path d="M${x},${y} L${x+r*Math.cos(a0)},${y+r*Math.sin(a0)} A${r},${r} 0 ${h.arc>180?1:0} 1 ${x+r*Math.cos(a1)},${y+r*Math.sin(a1)} Z" fill="blue" fill-opacity="0.07" stroke="blue" stroke-opacity="0.3"/>`);}
    parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="red"/><text x="${x+5}" y="${y-5}" font-size="11">${labels.get(h.id)}</text>`);
  }
  for (const pp of p.pipes) parts.push(`<polyline points="${pp.points.map(q=>`${q.x*S},${q.y*S}`).join(" ")}" fill="none" stroke="${pp.kind==="mainline"?"#111":pp.kind==="wire"?"orange":pp.kind==="sleeve"?"gray":"purple"}" stroke-width="${pp.kind==="sleeve"?6:2}"/>`);
  for (const v of p.valves) parts.push(`<rect x="${v.position.x*S-4}" y="${v.position.y*S-4}" width="8" height="8" fill="green"/>`);
  const w = Math.max(...p.areas.flatMap(a=>a.points.map(q=>q.x)))*S+20, hgt = Math.max(...p.areas.flatMap(a=>a.points.map(q=>q.y)))*S+20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}"><rect width="100%" height="100%" fill="white"/>${parts.join("")}</svg>`;
}
test("svg", () => {
  const out = "/tmp/claude-0/-home-user-Irrigation/98f1274b-808b-5a7f-bf25-b726367ff544/scratchpad/";
  const p = createDemoProject();
  const a = analyzeProject(p, defaultMaterialProducts());
  writeFileSync(out+"demo.svg", svgOf(p, a.labels));
  const s = createSampleProjects();
  s.forEach((q,i)=>{ const b = analyzeProject(q, defaultMaterialProducts()); writeFileSync(out+`s${i}.svg`, svgOf(q, b.labels)); });
});

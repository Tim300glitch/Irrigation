/**
 * Printable plan renderer (pure SVG strings). Used for PDF export, print preview
 * and dashboard thumbnails. Produces construction-plan styling in two modes:
 *  - color: zone-colored heads/laterals, tinted areas
 *  - ink:   white background, thin black/gray linework, hatch patterns,
 *           zone identification by number tags and line patterns
 */
import type { Project } from "../model/types";
import type { ProjectAnalysis } from "../analysis";
import { boundsOf, dist, polylineLength, type Bounds, type Vec } from "../geometry/geometry";
import { headPerformance } from "../irrigation/sprinkler";
import { arcPath, EQUIPMENT_ABBR, INK_PATTERN, PIPE_STYLE } from "./symbols";
import { formatFeetInches, pipeSizeLabel } from "../units/units";
import { locate, referenceLines } from "./references";

export interface PlanOptions {
  width: number; // output units (pt)
  height: number;
  mode: "color" | "ink";
  installer: boolean;
  showCoverage: boolean;
  showLabels: boolean;
  showPipeSizes: boolean;
  /** world bounds to fit; defaults to project extents */
  bounds?: Bounds;
  /** fixed scale in output units per ft (overrides fit) */
  scale?: number;
  showReferenceDims?: boolean;
  /** text size multiplier (1 = 11×17 sheet) */
  textScale?: number;
}

export function projectBounds(project: Project, pad = 6): Bounds {
  const pts: Vec[] = [
    ...project.areas.flatMap((a) => a.points),
    ...project.lines.flatMap((l) => l.points),
    ...project.pipes.flatMap((p) => p.points),
    ...project.sprinklers.map((s) => s.position),
    ...project.waterSources.map((s) => s.position),
  ];
  if (!pts.length) return { minX: 0, minY: 0, maxX: 100, maxY: 80 };
  const b = boundsOf(pts);
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function fitTransform(b: Bounds, width: number, height: number, fixedScale?: number) {
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const s = fixedScale ?? Math.min(width / bw, height / bh);
  const ox = (width - bw * s) / 2 - b.minX * s;
  const oy = (height - bh * s) / 2 - b.minY * s;
  return { s, ox, oy, tx: (x: number) => x * s + ox, ty: (y: number) => y * s + oy };
}

function patternDefs(s: number) {
  const u = Math.max(3, s * 1.2);
  return `<defs>
<pattern id="p-hatch" patternUnits="userSpaceOnUse" width="${u}" height="${u}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${u}" stroke="#555" stroke-width="0.4"/></pattern>
<pattern id="p-hatchh" patternUnits="userSpaceOnUse" width="${u}" height="${u}"><line x1="0" y1="0" x2="${u}" y2="0" stroke="#777" stroke-width="0.35"/></pattern>
<pattern id="p-crosshatch" patternUnits="userSpaceOnUse" width="${u}" height="${u}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${u}" stroke="#777" stroke-width="0.35"/><line x1="0" y1="0" x2="${u}" y2="0" stroke="#777" stroke-width="0.35"/></pattern>
<pattern id="p-dots" patternUnits="userSpaceOnUse" width="${u}" height="${u}"><circle cx="${u / 2}" cy="${u / 2}" r="0.45" fill="#666"/></pattern>
<pattern id="p-dotsfine" patternUnits="userSpaceOnUse" width="${u * 0.8}" height="${u * 0.8}"><circle cx="${u * 0.2}" cy="${u * 0.2}" r="0.3" fill="#888"/><circle cx="${u * 0.6}" cy="${u * 0.55}" r="0.25" fill="#999"/></pattern>
<pattern id="p-grass" patternUnits="userSpaceOnUse" width="${u * 2}" height="${u * 2}"><path d="M${u * 0.4},${u * 0.9} l${u * 0.12},${-u * 0.35} M${u * 0.6},${u * 0.9} l${-u * 0.08},${-u * 0.3} M${u * 1.4},${u * 1.9} l${u * 0.12},${-u * 0.35} M${u * 1.6},${u * 1.9} l${-u * 0.08},${-u * 0.3}" stroke="#8a8a8a" stroke-width="0.35" fill="none"/></pattern>
<pattern id="p-brick" patternUnits="userSpaceOnUse" width="${u * 2}" height="${u}"><path d="M0,0 H${u * 2} M0,${u / 2} H${u * 2} M${u / 2},0 V${u / 2} M${u * 1.5},${u / 2} V${u}" stroke="#888" stroke-width="0.3" fill="none"/></pattern>
<pattern id="p-waves" patternUnits="userSpaceOnUse" width="${u * 2}" height="${u}"><path d="M0,${u / 2} q${u / 2},${-u / 3} ${u},0 t${u},0" stroke="#999" stroke-width="0.35" fill="none"/></pattern>
</defs>`;
}

export function renderPlanSvg(project: Project, analysis: ProjectAnalysis | null, o: PlanOptions): string {
  const b = o.bounds ?? projectBounds(project);
  const T = fitTransform(b, o.width, o.height, o.scale);
  const { s, tx, ty } = T;
  const ink = o.mode === "ink";
  const out: string[] = [];
  const pts = (ps: Vec[]) => ps.map((p) => `${f(tx(p.x))},${f(ty(p.y))}`).join(" ");
  const visible = new Set(project.layers.filter((l) => l.visible).map((l) => l.id));
  const zoneColor = new Map(project.zones.map((z) => [z.id, z.color]));
  const zoneNum = new Map(project.zones.map((z) => [z.id, z.number]));
  const fontSmall = 5.6 * (o.textScale ?? 1);
  out.push(patternDefs(s));
  out.push(`<rect x="0" y="0" width="${f(o.width)}" height="${f(o.height)}" fill="#ffffff"/>`);

  if (project.background && project.background.visible && !ink && !o.installer && visible.has("background")) {
    const bg = project.background;
    out.push(`<image href="${bg.dataUrl}" x="${f(tx(bg.x))}" y="${f(ty(bg.y))}" width="${f(bg.pxWidth * bg.ftPerPx * s)}" height="${f(bg.pxHeight * bg.ftPerPx * s)}" opacity="${Math.min(bg.opacity, 0.6)}" preserveAspectRatio="none"/>`);
  }

  // areas: property first, then larger areas under smaller ones
  const areas = [...project.areas].filter((a) => visible.has(a.layer)).sort((a, c) => (a.type === "property" ? -1 : c.type === "property" ? 1 : 0) || areaSize(c.points) - areaSize(a.points));
  for (const a of areas) {
    const dash = a.style.lineStyle === "dashed" ? ' stroke-dasharray="4 2"' : a.style.lineStyle === "dashdot" ? ' stroke-dasharray="8 2 2 2"' : a.style.lineStyle === "dotted" ? ' stroke-dasharray="1 2"' : "";
    if (a.type === "property") {
      out.push(`<polygon points="${pts(a.points)}" fill="none" stroke="${ink ? "#222" : "#334155"}" stroke-width="0.9"${' stroke-dasharray="10 3 2 3"'}/>`);
      continue;
    }
    if (ink || o.installer) {
      const pat = INK_PATTERN[a.type];
      const fill = o.installer && a.type !== "building" ? "none" : pat ? `url(#p-${pat})` : "none";
      out.push(`<polygon points="${pts(a.points)}" fill="${fill}" stroke="#333" stroke-width="${a.type === "building" ? 0.9 : 0.45}"${dash}/>`);
    } else {
      out.push(`<polygon points="${pts(a.points)}" fill="${a.style.fill}" fill-opacity="${Math.max(0.12, a.style.opacity * 0.75)}" stroke="${a.style.stroke}" stroke-width="${a.type === "building" ? 0.9 : 0.5}"${dash}/>`);
      if (a.style.pattern !== "solid" && a.style.pattern !== "none" && INK_PATTERN[a.type]) out.push(`<polygon points="${pts(a.points)}" fill="url(#p-${INK_PATTERN[a.type]})" opacity="0.35"/>`);
    }
    if (o.showLabels && a.showLabel && !o.installer) {
      const c = labelPoint(a.points);
      out.push(`<text x="${f(tx(c.x))}" y="${f(ty(c.y))}" font-size="${f(fontSmall * 1.2)}" font-family="Helvetica" fill="#475569" text-anchor="middle" letter-spacing="0.3">${esc(a.name.toUpperCase())}</text>`);
    }
  }
  for (const l of project.lines) {
    if (!visible.has(l.layer)) continue;
    const dash = l.style.lineStyle === "dashed" ? "5 2" : l.style.lineStyle === "dotted" ? "1 2" : l.style.lineStyle === "dashdot" ? "8 2 2 2" : "";
    out.push(`<polyline points="${pts(l.points)}" fill="none" stroke="${ink ? "#444" : l.style.stroke}" stroke-width="${Math.min(2, l.style.strokeWidth * 0.5)}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
    if (l.type === "fence" && !o.installer) {
      // fence tick marks
      for (let i = 0; i < l.points.length - 1; i++) {
        const a = l.points[i];
        const c = l.points[i + 1];
        const L = dist(a, c);
        for (let d = 4; d < L; d += 8) {
          const t = d / L;
          const px = a.x + (c.x - a.x) * t;
          const py = a.y + (c.y - a.y) * t;
          out.push(`<circle cx="${f(tx(px))}" cy="${f(ty(py))}" r="0.7" fill="${ink ? "#444" : l.style.stroke}"/>`);
        }
      }
    }
  }
  if (!o.installer) {
    for (const pl of project.plants) {
      if (!visible.has(pl.layer)) continue;
      const r = pl.canopyRadius * s;
      if (pl.type === "tree") {
        out.push(`<circle cx="${f(tx(pl.position.x))}" cy="${f(ty(pl.position.y))}" r="${f(r)}" fill="${ink ? "none" : "#16a34a"}" fill-opacity="0.12" stroke="${ink ? "#555" : "#15803d"}" stroke-width="0.5" stroke-dasharray="2 1.5"/>`);
        out.push(`<circle cx="${f(tx(pl.position.x))}" cy="${f(ty(pl.position.y))}" r="0.9" fill="${ink ? "#555" : "#15803d"}"/>`);
      } else out.push(`<circle cx="${f(tx(pl.position.x))}" cy="${f(ty(pl.position.y))}" r="${f(r)}" fill="${ink ? "none" : "#22c55e"}" fill-opacity="0.25" stroke="${ink ? "#666" : "#15803d"}" stroke-width="0.4"/>`);
    }
  }
  for (const d of project.drips) {
    if (!visible.has(d.layer)) continue;
    const c = d.zoneId ? zoneColor.get(d.zoneId) ?? "#0d9488" : "#0d9488";
    out.push(`<polygon points="${pts(d.points)}" fill="${ink ? "url(#p-hatchh)" : c}" fill-opacity="${ink ? 1 : 0.12}" stroke="${ink ? "#333" : c}" stroke-width="0.6" stroke-dasharray="4 2"/>`);
    const cc = labelPoint(d.points);
    out.push(`<text x="${f(tx(cc.x))}" y="${f(ty(cc.y))}" font-size="${f(fontSmall)}" font-family="Helvetica" text-anchor="middle" fill="#0f172a">DRIP ${d.zoneId ? `Z${zoneNum.get(d.zoneId)}` : ""} ${d.emitterGph}GPH@${d.emitterSpacingIn}"</text>`);
  }

  // coverage arcs
  if (o.showCoverage && !o.installer && visible.has("coverage")) {
    for (const h of project.sprinklers) {
      const perf = headPerformance(h);
      if (perf.product.category === "emitter") continue;
      const c = h.zoneId ? zoneColor.get(h.zoneId) ?? "#2563eb" : "#2563eb";
      const d = arcPath(tx(h.position.x), ty(h.position.y), perf.radius * s, h.arcStart, h.arc);
      out.push(ink ? `<path d="${d}" fill="none" stroke="#9ca3af" stroke-width="0.25" stroke-dasharray="1.5 1.5"/>` : `<path d="${d}" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-opacity="0.35" stroke-width="0.3"/>`);
    }
  }

  // pipes
  const order = ["sleeve", "lateral", "drip", "mainline", "wire"];
  const pipes = [...project.pipes].sort((a, c) => order.indexOf(a.kind) - order.indexOf(c.kind));
  for (const p of pipes) {
    const layer = p.kind === "mainline" ? "mainline" : p.kind === "wire" ? "electrical" : p.kind === "drip" ? "drip" : "laterals";
    if (!visible.has(layer)) continue;
    const st = PIPE_STYLE[p.kind];
    let color = st.color;
    if (!ink && (p.kind === "lateral" || p.kind === "drip") && p.zoneId) color = zoneColor.get(p.zoneId) ?? color;
    if (ink) color = p.kind === "sleeve" ? "#bbb" : p.kind === "wire" ? "#777" : "#111";
    const w = p.kind === "sleeve" ? Math.max(3, s * 0.9) : st.width * (o.installer ? 0.55 : 0.42);
    let dash = st.dash;
    if (ink && p.kind === "lateral" && p.zoneId) {
      const n = zoneNum.get(p.zoneId) ?? 1;
      dash = n % 3 === 2 ? "6 1.5" : n % 3 === 0 ? "6 1.5 1.5 1.5" : undefined;
    }
    if (p.kind === "sleeve") {
      out.push(`<polyline points="${pts(p.points)}" fill="none" stroke="${ink ? "#666" : "#475569"}" stroke-width="${f(w)}" stroke-linecap="butt"/>`);
      out.push(`<polyline points="${pts(p.points)}" fill="none" stroke="#fff" stroke-width="${f(w - 1)}" stroke-linecap="butt"/>`);
    } else out.push(`<polyline points="${pts(p.points)}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
    if (o.showPipeSizes && analysis && (p.kind === "lateral" || p.kind === "mainline" || p.kind === "drip")) {
      const L = polylineLength(p.points);
      if (L * s > 34) {
        const pr = analysis.hyd.pipes.get(p.id);
        const size = pr?.sizes[0] ?? p.size;
        const a = p.points[0];
        const c = p.points[p.points.length - 1];
        let ang = (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        const mx = tx((a.x + c.x) / 2);
        const my = ty((a.y + c.y) / 2);
        out.push(`<text x="${f(mx)}" y="${f(my - 1.4)}" font-size="${f(fontSmall * 0.85)}" font-family="Helvetica" text-anchor="middle" fill="${ink ? "#111" : color}" transform="rotate(${f(ang)} ${f(mx)} ${f(my)})">${esc(pipeSizeLabel(size))}${p.kind === "mainline" ? " ML" : ""}</text>`);
      }
    }
  }
  if (o.showPipeSizes) {
    for (const ft of project.fittings) {
      out.push(`<rect x="${f(tx(ft.position.x) - 1.6)}" y="${f(ty(ft.position.y) - 1.6)}" width="3.2" height="3.2" fill="#fff" stroke="#111" stroke-width="0.4"/>`);
    }
  }

  // equipment, sources
  for (const e of project.equipment) {
    if (!visible.has(e.layer)) continue;
    const x = tx(e.position.x);
    const y = ty(e.position.y);
    out.push(`<rect x="${f(x - 3.4)}" y="${f(y - 2.6)}" width="6.8" height="5.2" fill="#fff" stroke="#111" stroke-width="0.5"/><text x="${f(x)}" y="${f(y + 1.6)}" font-size="3.6" font-family="Helvetica" font-weight="bold" text-anchor="middle">${EQUIPMENT_ABBR[e.type]}</text>`);
  }
  for (const w of project.waterSources) {
    const x = tx(w.position.x);
    const y = ty(w.position.y);
    const hex = [0, 60, 120, 180, 240, 300].map((a) => `${f(x + 4.2 * Math.cos((a * Math.PI) / 180))},${f(y + 4.2 * Math.sin((a * Math.PI) / 180))}`).join(" ");
    out.push(`<polygon points="${hex}" fill="${ink ? "#fff" : "#dbeafe"}" stroke="#111" stroke-width="0.6"/><text x="${f(x)}" y="${f(y + 1.3)}" font-size="3.2" font-family="Helvetica" font-weight="bold" text-anchor="middle">POC</text>`);
    if (w.backflow !== "none") out.push(`<text x="${f(x + 5.5)}" y="${f(y + 1.3)}" font-size="3.4" font-family="Helvetica">BF (${w.backflow.toUpperCase()})</text>`);
  }
  // valves
  for (const v of project.valves) {
    if (!visible.has(v.layer)) continue;
    const z = project.zones.find((zz) => zz.valveId === v.id);
    const x = tx(v.position.x);
    const y = ty(v.position.y);
    const c = z && !ink ? z.color : "#fff";
    out.push(`<rect x="${f(x - 2.6)}" y="${f(y - 2.6)}" width="5.2" height="5.2" fill="${c}" stroke="#111" stroke-width="0.6"/>`);
    out.push(`<text x="${f(x)}" y="${f(y + 1.5)}" font-size="4" font-family="Helvetica" font-weight="bold" text-anchor="middle" fill="${z && !ink ? "#fff" : "#111"}">${z ? z.number : v.type === "master" ? "M" : "V"}</text>`);
  }
  // manifolds
  for (const m of project.manifolds) {
    const vs = project.valves.filter((v) => m.valveIds.includes(v.id));
    if (!vs.length) continue;
    const mb = boundsOf(vs.map((v) => v.position));
    out.push(`<rect x="${f(tx(mb.minX) - 5)}" y="${f(ty(mb.minY) - 5)}" width="${f((mb.maxX - mb.minX) * s + 10)}" height="${f((mb.maxY - mb.minY) * s + 10)}" fill="none" stroke="#111" stroke-width="0.4" stroke-dasharray="2 1"/>`);
    out.push(`<text x="${f(tx(mb.minX) - 5)}" y="${f(ty(mb.minY) - 6.5)}" font-size="${f(fontSmall * 0.9)}" font-family="Helvetica">${esc(m.name.toUpperCase())}</text>`);
  }

  // heads
  const labels = analysis?.labels;
  for (const h of project.sprinklers) {
    if (!visible.has("sprinklers")) continue;
    const perf = headPerformance(h);
    const x = tx(h.position.x);
    const y = ty(h.position.y);
    const zc = h.zoneId ? zoneColor.get(h.zoneId) ?? "#111" : "#111";
    const color = ink ? "#111" : zc;
    const R = o.installer ? 2.4 : 2.0;
    const cat = perf.product.category;
    if (cat === "emitter") {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="0.9" fill="${color}"/>`);
      continue;
    }
    if (cat === "bubbler") out.push(`<polygon points="${f(x)},${f(y - R)} ${f(x + R)},${f(y + R * 0.8)} ${f(x - R)},${f(y + R * 0.8)}" fill="#fff" stroke="${color}" stroke-width="0.5"/>`);
    else {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="#fff" stroke="${color}" stroke-width="0.55"/>`);
      // filled wedge shows the arc
      out.push(`<path d="${arcPath(x, y, R, h.arcStart, h.arc)}" fill="${color}"/>`);
      if (cat === "spray" || cat === "rotary" || cat === "microspray") out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R * 0.45}" fill="#fff" stroke="${color}" stroke-width="0.3"/>`);
    }
    if (o.showLabels && labels) out.push(`<text x="${f(x + R + 0.8)}" y="${f(y - R + 0.2)}" font-size="${f(fontSmall * 0.85)}" font-family="Helvetica" fill="#111">${esc(labels.get(h.id) ?? "")}</text>`);
  }

  // dimensions
  if (visible.has("measurements")) {
    for (const d of project.dimensions) out.push(dimensionSvg(d.a, d.b, d.kind, d.offset, tx, ty, fontSmall, ink));
  }
  // installer reference dims from walls
  if (o.installer && o.showReferenceDims && labels) {
    const refs = referenceLines(project);
    for (const h of project.sprinklers) {
      const loc = locate(h.position, refs);
      for (const r of [loc.d1, loc.d2]) {
        if (!r || r.dist > 60 || r.dist < 1) continue;
        out.push(`<line x1="${f(tx(h.position.x))}" y1="${f(ty(h.position.y))}" x2="${f(tx(r.foot.x))}" y2="${f(ty(r.foot.y))}" stroke="#2563eb" stroke-width="0.25" stroke-dasharray="1 1"/>`);
        const mx = tx((h.position.x + r.foot.x) / 2);
        const my = ty((h.position.y + r.foot.y) / 2);
        out.push(`<text x="${f(mx)}" y="${f(my)}" font-size="${f(fontSmall * 0.7)}" font-family="Helvetica" fill="#1d4ed8" text-anchor="middle">${esc(formatFeetInches(r.dist))}</text>`);
      }
    }
  }
  for (const t of project.labels) {
    if (!visible.has(t.layer)) continue;
    out.push(`<text x="${f(tx(t.position.x))}" y="${f(ty(t.position.y))}" font-size="${f(Math.max(3.5, t.size * s))}" font-family="Helvetica" fill="${ink ? "#111" : t.color}" transform="rotate(${t.rotation} ${f(tx(t.position.x))} ${f(ty(t.position.y))})">${esc(t.text)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(o.width)}" height="${f(o.height)}" viewBox="0 0 ${f(o.width)} ${f(o.height)}">${out.join("")}</svg>`;
}

function areaSize(pts: Vec[]) {
  const b = boundsOf(pts);
  return (b.maxX - b.minX) * (b.maxY - b.minY);
}

export function labelPoint(pts: Vec[]): Vec {
  const b = boundsOf(pts);
  // polygon centroid, fallback to bbox center
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  if (Math.abs(a) < 1e-6) return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function dimensionGeometry(a: Vec, b: Vec, kind: "aligned" | "horizontal" | "vertical", offset: number) {
  let p1 = a;
  let p2 = b;
  if (kind === "horizontal") {
    const y = Math.max(a.y, b.y) + offset;
    p1 = { x: a.x, y };
    p2 = { x: b.x, y };
    return { d1: p1, d2: p2, length: Math.abs(b.x - a.x), ext: [a, p1, b, p2] };
  }
  if (kind === "vertical") {
    const x = Math.max(a.x, b.x) + offset;
    p1 = { x, y: a.y };
    p2 = { x, y: b.y };
    return { d1: p1, d2: p2, length: Math.abs(b.y - a.y), ext: [a, p1, b, p2] };
  }
  const L = dist(a, b) || 1;
  const nx = -(b.y - a.y) / L;
  const ny = (b.x - a.x) / L;
  p1 = { x: a.x + nx * offset, y: a.y + ny * offset };
  p2 = { x: b.x + nx * offset, y: b.y + ny * offset };
  return { d1: p1, d2: p2, length: dist(a, b), ext: [a, p1, b, p2] };
}

function dimensionSvg(a: Vec, b: Vec, kind: "aligned" | "horizontal" | "vertical", offset: number, tx: (x: number) => number, ty: (y: number) => number, fs: number, ink: boolean) {
  const g = dimensionGeometry(a, b, kind, offset);
  const c = ink ? "#111" : "#1e3a8a";
  const [e1a, e1b, e2a, e2b] = g.ext;
  const x1 = tx(g.d1.x),
    y1 = ty(g.d1.y),
    x2 = tx(g.d2.x),
    y2 = ty(g.d2.y);
  let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tick = (x: number, y: number) => `<line x1="${f(x - 1.4)}" y1="${f(y + 1.4)}" x2="${f(x + 1.4)}" y2="${f(y - 1.4)}" stroke="${c}" stroke-width="0.5"/>`;
  return `<g><line x1="${f(tx(e1a.x))}" y1="${f(ty(e1a.y))}" x2="${f(tx(e1b.x))}" y2="${f(ty(e1b.y))}" stroke="${c}" stroke-width="0.25"/><line x1="${f(tx(e2a.x))}" y1="${f(ty(e2a.y))}" x2="${f(tx(e2b.x))}" y2="${f(ty(e2b.y))}" stroke="${c}" stroke-width="0.25"/><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${c}" stroke-width="0.35"/>${tick(x1, y1)}${tick(x2, y2)}<text x="${f(mx)}" y="${f(my - 1.2)}" font-size="${f(fs)}" font-family="Helvetica" text-anchor="middle" fill="${c}" transform="rotate(${f(ang)} ${f(mx)} ${f(my)})">${esc(formatFeetInches(g.length))}</text></g>`;
}

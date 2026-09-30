/**
 * PDF export: construction-style plan sheets.
 *   Sheet 1  Irrigation plan  — drawing at a standard engineering scale, title block,
 *            legend, zone schedule, north arrow, scale bar, notes
 *   Sheet 2  Installer plan   — simplified linework + head location schedule
 *            (distances from building walls / property lines)
 *   Sheet 3  Hydraulic & watering schedule
 *   Sheet 4  Materials / proposal (customer mode hides markup & internal costs)
 * The drawing is vector (SVG → PDF via svg2pdf.js); tables use jsPDF text.
 */
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import type { Project } from "../model/types";
import type { ProjectAnalysis } from "../analysis";
import { projectBounds, renderPlanSvg } from "../plan/planSvg";
import { locate, referenceLines } from "../plan/references";
import { formatCurrency, formatFeetInches, pipeSizeLabel, formatArea } from "../units/units";
import { HEAD_NAMES, PIPE_STYLE } from "../plan/symbols";
import { headPerformance, precipClass } from "../irrigation/sprinkler";
import { scheduleZone } from "../irrigation/schedule";
import { getProduct } from "../catalog/sprinklers";

export type PaperSize = "letter" | "a4" | "tabloid" | "a3" | "arch-d";
export const PAPER: Record<PaperSize, { label: string; w: number; h: number }> = {
  letter: { label: 'Letter 8.5×11"', w: 612, h: 792 },
  a4: { label: "A4", w: 595.28, h: 841.89 },
  tabloid: { label: '11×17" (Tabloid)', w: 792, h: 1224 },
  a3: { label: "A3", w: 841.89, h: 1190.55 },
  "arch-d": { label: '24×36" (Arch D)', w: 1728, h: 2592 },
};

export interface ExportOptions {
  paper: PaperSize;
  orientation: "landscape" | "portrait";
  mode: "color" | "ink";
  sheets: { plan: boolean; installer: boolean; schedule: boolean; materials: boolean };
  showCoverage: boolean;
  customerMode: boolean;
  company: { name: string; phone: string; email: string; license?: string };
}

const STD_SCALES = [4, 5, 8, 10, 16, 20, 30, 40, 50, 60, 80, 100, 120, 200];

function chooseScale(boundsW: number, boundsH: number, areaW: number, areaH: number, preferred: number): { ftPerIn: number; fits: boolean } {
  const fits = (n: number) => (boundsW / n) * 72 <= areaW && (boundsH / n) * 72 <= areaH;
  if (fits(preferred)) {
    // use a larger scale (smaller N) if it still fits and paper is big
    let best = preferred;
    for (const n of STD_SCALES) if (n < best && fits(n)) best = n;
    return { ftPerIn: best, fits: true };
  }
  for (const n of STD_SCALES) if (fits(n)) return { ftPerIn: n, fits: true };
  return { ftPerIn: Math.ceil(Math.max((boundsW * 72) / areaW, (boundsH * 72) / areaH)), fits: false };
}

async function drawSvg(doc: jsPDF, svg: string, x: number, y: number, w: number, h: number) {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden";
  holder.innerHTML = svg;
  document.body.appendChild(holder);
  const el = holder.querySelector("svg") as SVGSVGElement;
  try {
    await (doc as unknown as { svg: (el: Element, o: object) => Promise<void> }).svg(el, { x, y, width: w, height: h });
  } finally {
    holder.remove();
  }
}

interface Ctx {
  doc: jsPDF;
  W: number;
  H: number;
  m: number;
  ink: boolean;
  project: Project;
  analysis: ProjectAnalysis;
  opts: ExportOptions;
  sheet: number;
  sheets: number;
}

const BRAND: [number, number, number] = [15, 100, 144];

function frame(c: Ctx, title: string): { x: number; y: number; w: number; h: number; tbBottom: number } {
  const { doc, W, H, m } = c;
  doc.setDrawColor(20);
  doc.setLineWidth(1.2);
  doc.rect(m, m, W - 2 * m, H - 2 * m);
  const landscape = W > H;
  const tbW = landscape ? Math.min(210, W * 0.26) : W - 2 * m;
  const tbH = landscape ? H - 2 * m : Math.min(150, H * 0.22);
  const tbX = landscape ? W - m - tbW : m;
  const tbY = landscape ? m : H - m - tbH;
  doc.setLineWidth(0.8);
  if (landscape) doc.line(tbX, m, tbX, H - m);
  else doc.line(m, tbY, W - m, tbY);
  const tbBottom = titleBlock(c, title, tbX, tbY, tbW, tbH, landscape);
  return landscape ? { x: m + 8, y: m + 8, w: W - 2 * m - tbW - 16, h: H - 2 * m - 16, tbBottom } : { x: m + 8, y: m + 8, w: W - 2 * m - 16, h: H - 2 * m - tbH - 16, tbBottom };
}

function titleBlock(c: Ctx, title: string, x: number, y: number, w: number, h: number, vertical: boolean): number {
  const { doc, project, opts, ink } = c;
  const meta = project.meta;
  const pad = 8;
  if (vertical) {
    let cy = y + pad;
    // company
    doc.setFillColor(...(ink ? ([255, 255, 255] as [number, number, number]) : BRAND));
    doc.rect(x, y, w, 46, ink ? "S" : "F");
    doc.setTextColor(ink ? 20 : 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(opts.company.name || meta.company, x + pad, cy + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text([opts.company.phone, opts.company.email, opts.company.license ?? ""].filter(Boolean).join("  ·  "), x + pad, cy + 26, { maxWidth: w - 2 * pad });
    cy = y + 46;
    doc.setTextColor(20);
    const rows: [string, string][] = [
      ["PROJECT", meta.name],
      ["CLIENT", meta.client],
      ["ADDRESS", meta.address],
      ["DESIGNER", meta.designer],
      ["DATE", meta.date],
    ];
    for (const [k, v] of rows) {
      doc.setDrawColor(180);
      doc.setLineWidth(0.4);
      doc.line(x, cy, x + w, cy);
      doc.setFontSize(6);
      doc.setTextColor(110);
      doc.text(k, x + pad, cy + 8);
      doc.setFontSize(8.5);
      doc.setTextColor(20);
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(v || "—", w - 2 * pad);
      doc.text(lines.slice(0, 2), x + pad, cy + 18);
      doc.setFont("helvetica", "normal");
      cy += 18 + Math.min(lines.length, 2) * 9;
    }
    doc.setDrawColor(180);
    doc.line(x, cy, x + w, cy);
    const rowsBottom = cy;
    // sheet title at bottom
    const by = y + h - 64;
    doc.setDrawColor(20);
    doc.setLineWidth(0.8);
    doc.line(x, by, x + w, by);
    doc.setFontSize(6);
    doc.setTextColor(110);
    doc.text("SHEET TITLE", x + pad, by + 9);
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(title.toUpperCase(), w - 70), x + pad, by + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(110);
    doc.text("SHEET", x + w - 52, by + 9);
    doc.setFontSize(18);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(`L-${c.sheet}`, x + w - 52, by + 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`${c.sheet} of ${c.sheets}`, x + w - 52, by + 40);
    doc.setFontSize(6);
    doc.setTextColor(120);
    doc.text("Generated with DeltaLine Irrigation. Hydraulic values are design calculations; verify in field.", x + pad, y + h - 8, { maxWidth: w - 2 * pad });
    doc.setTextColor(20);
    return rowsBottom;
  } else {
    // horizontal title block (portrait)
    const colW = w / 4;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(ink ? ([20, 20, 20] as [number, number, number]) : BRAND));
    doc.text(opts.company.name || meta.company, x + pad, y + 18);
    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text([opts.company.phone, opts.company.email].filter(Boolean), x + pad, y + 30);
    const cells: [string, string][] = [
      ["PROJECT", meta.name],
      ["CLIENT", meta.client],
      ["ADDRESS", meta.address],
      ["DESIGNER / DATE", `${meta.designer} · ${meta.date}`],
    ];
    cells.forEach(([k, v], i) => {
      const cx = x + colW + (i % 2) * colW;
      const cy = y + 8 + Math.floor(i / 2) * 34;
      doc.setFontSize(6);
      doc.setTextColor(110);
      doc.text(k, cx, cy + 6);
      doc.setFontSize(8.5);
      doc.setTextColor(20);
      doc.setFont("helvetica", "bold");
      doc.text(doc.splitTextToSize(v || "—", colW - 10).slice(0, 2), cx, cy + 16);
      doc.setFont("helvetica", "normal");
    });
    const sx = x + 3 * colW;
    doc.setLineWidth(0.8);
    doc.line(sx, y, sx, y + h);
    doc.setFontSize(6);
    doc.setTextColor(110);
    doc.text("SHEET TITLE", sx + pad, y + 12);
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(title.toUpperCase(), colW - 16), sx + pad, y + 26);
    doc.setFontSize(18);
    doc.text(`L-${c.sheet}`, sx + pad, y + 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`${c.sheet} of ${c.sheets}`, sx + pad, y + 82);
    return y;
  }
}

function northArrow(doc: jsPDF, x: number, y: number, s = 16) {
  doc.setDrawColor(20);
  doc.setFillColor(20, 20, 20);
  doc.setLineWidth(0.8);
  doc.circle(x, y, s, "S");
  doc.triangle(x, y - s + 2, x - s * 0.35, y + s * 0.4, x, y + s * 0.15, "F");
  doc.triangle(x, y - s + 2, x + s * 0.35, y + s * 0.4, x, y + s * 0.15, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("N", x - 3, y - s - 3);
  doc.setFont("helvetica", "normal");
}

function scaleBar(doc: jsPDF, x: number, y: number, ftPerIn: number) {
  const ptPerFt = 72 / ftPerIn;
  const steps = [5, 10, 20, 25, 50, 100, 200];
  const seg = steps.find((s) => s * ptPerFt >= 36) ?? 200;
  doc.setLineWidth(0.6);
  doc.setDrawColor(20);
  for (let i = 0; i < 4; i++) {
    const sx = x + i * seg * ptPerFt;
    if (i % 2 === 0) doc.setFillColor(20, 20, 20);
    else doc.setFillColor(255, 255, 255);
    doc.rect(sx, y, seg * ptPerFt, 4, "FD");
    doc.setFontSize(6);
    doc.text(`${i * seg}'`, sx - 2, y + 11);
  }
  doc.text(`${4 * seg}'`, x + 4 * seg * ptPerFt - 4, y + 11);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(`SCALE: 1" = ${ftPerIn}'-0"`, x, y - 4);
  doc.setFont("helvetica", "normal");
}

function table(doc: jsPDF, x: number, y: number, cols: { label: string; w: number; align?: "left" | "right" }[], rows: string[][], opts: { fontSize?: number; rowH?: number; maxY?: number; header?: boolean; zebra?: boolean } = {}) {
  const fs = opts.fontSize ?? 7;
  const rh = opts.rowH ?? fs + 5;
  let cy = y;
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  if (opts.header !== false) {
    doc.setFillColor(235, 238, 242);
    doc.rect(x, cy, totalW, rh + 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs - 0.5);
    let cx = x;
    for (const c of cols) {
      doc.text(c.label, c.align === "right" ? cx + c.w - 3 : cx + 3, cy + rh - 3, { align: c.align === "right" ? "right" : "left" });
      cx += c.w;
    }
    cy += rh + 1;
    doc.setFont("helvetica", "normal");
  }
  doc.setFontSize(fs);
  let i = 0;
  for (const r of rows) {
    if (opts.maxY && cy + rh > opts.maxY) return { y: cy, rest: rows.slice(i) };
    if (opts.zebra !== false && i % 2 === 1) {
      doc.setFillColor(248, 249, 251);
      doc.rect(x, cy, totalW, rh, "F");
    }
    let cx = x;
    r.forEach((cell, k) => {
      const c = cols[k];
      const txt = doc.splitTextToSize(cell ?? "", c.w - 5)[0] ?? "";
      doc.text(txt, c.align === "right" ? cx + c.w - 3 : cx + 3, cy + rh - 3.5, { align: c.align === "right" ? "right" : "left" });
      cx += c.w;
    });
    doc.setDrawColor(225);
    doc.setLineWidth(0.3);
    doc.line(x, cy + rh, x + totalW, cy + rh);
    cy += rh;
    i++;
  }
  return { y: cy, rest: [] as string[][] };
}

async function planSheet(c: Ctx, installer: boolean) {
  const { doc, project, analysis, opts } = c;
  const area = frame(c, installer ? "Installer plan & head locations" : "Irrigation plan");
  const landscape = c.W > c.H;
  const b = projectBounds(project, 4);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  // reserve room for legend under drawing (portrait) or in title strip (landscape)
  const legendH = landscape ? 0 : 118;
  const drawW = area.w;
  const drawH = area.h - legendH - 24;
  const sc = chooseScale(bw, bh, drawW, drawH, project.settings.drawingScale);
  const s = 72 / sc.ftPerIn;
  const svg = renderPlanSvg(project, analysis, {
    width: drawW,
    height: drawH,
    mode: opts.mode,
    installer,
    showCoverage: opts.showCoverage && !installer,
    showLabels: true,
    showPipeSizes: true,
    scale: s,
    bounds: b,
    showReferenceDims: installer,
    textScale: Math.max(0.8, Math.min(1.8, Math.min(c.W, c.H) / 792)),
  });
  await drawSvg(doc, svg, area.x, area.y, drawW, drawH);
  const barY = area.y + drawH + 18;
  scaleBar(doc, area.x + 6, barY, sc.ftPerIn);
  if (!sc.fits) {
    doc.setFontSize(6.5);
    doc.text("(scale adjusted to fit sheet)", area.x + 6, barY + 20);
  }
  northArrow(doc, area.x + drawW - 24, area.y + 26);

  // legend + zone schedule + notes
  const lx = landscape ? c.W - c.m - Math.min(210, c.W * 0.26) + 8 : area.x;
  let ly = landscape ? area.tbBottom + 16 : area.y + drawH + 50;
  const lw = landscape ? Math.min(210, c.W * 0.26) - 16 : area.w;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LEGEND", lx, ly);
  doc.setFont("helvetica", "normal");
  ly += 6;
  const cats = [...new Set(project.sprinklers.map((h) => getProduct(h.productId).category))];
  const legendItems: { draw: (x: number, y: number) => void; label: string }[] = [];
  for (const cat of cats) {
    const prod = project.sprinklers.find((h) => getProduct(h.productId).category === cat);
    legendItems.push({
      label: `${HEAD_NAMES[cat]} — ${prod ? getProduct(prod.productId).model : ""}`,
      draw: (x, y) => {
        doc.setDrawColor(20);
        doc.setFillColor(255, 255, 255);
        doc.circle(x + 4, y - 2.5, 2.6, "FD");
        doc.setFillColor(20, 20, 20);
        doc.triangle(x + 4, y - 2.5, x + 6.6, y - 2.5, x + 4, y - 5.1, "F");
      },
    });
  }
  const pipeKinds = [...new Set(project.pipes.map((p) => p.kind))];
  for (const k of pipeKinds) {
    const st = PIPE_STYLE[k];
    legendItems.push({
      label: st.label,
      draw: (x, y) => {
        const hex = opts.mode === "ink" ? "#111111" : st.color;
        const r = parseInt(hex.slice(1, 3), 16),
          g = parseInt(hex.slice(3, 5), 16),
          bb = parseInt(hex.slice(5, 7), 16);
        doc.setDrawColor(r, g, bb);
        doc.setLineWidth(k === "sleeve" ? 3 : k === "mainline" ? 1.4 : 0.8);
        if (st.dash) doc.setLineDashPattern(st.dash.split(" ").map((n) => +n * 0.5), 0);
        doc.line(x, y - 2.5, x + 9, y - 2.5);
        doc.setLineDashPattern([], 0);
        doc.setLineWidth(0.5);
        doc.setDrawColor(20);
      },
    });
  }
  legendItems.push({
    label: "Zone control valve (zone no.)",
    draw: (x, y) => {
      doc.setDrawColor(20);
      doc.rect(x + 1.5, y - 5, 5, 5);
    },
  });
  legendItems.push({
    label: "Point of connection / backflow",
    draw: (x, y) => {
      doc.setDrawColor(20);
      doc.circle(x + 4, y - 2.5, 3, "S");
    },
  });
  const cols = landscape ? 1 : 3;
  const colW = lw / cols;
  legendItems.forEach((it, i) => {
    const cx = lx + (i % cols) * colW;
    const cy = ly + 10 + Math.floor(i / cols) * 10;
    it.draw(cx, cy);
    doc.setFontSize(6.5);
    doc.setTextColor(20);
    doc.text(doc.splitTextToSize(it.label, colW - 16)[0], cx + 13, cy - 0.5);
  });
  ly += 12 + Math.ceil(legendItems.length / cols) * 10;

  if (landscape) {
    // zone schedule
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ZONE SCHEDULE", lx, ly + 6);
    doc.setFont("helvetica", "normal");
    const rows = analysis.hyd.zones.map((z) => [String(z.number), `${z.headCount}`, z.gpm.toFixed(1), pipeSizeLabel(z.recommendedLateralSize), z.criticalPressure !== undefined ? z.criticalPressure.toFixed(0) : "—", z.status.toUpperCase()]);
    const t = table(doc, lx, ly + 10, [
      { label: "ZONE", w: lw * 0.14 },
      { label: "HEADS", w: lw * 0.15, align: "right" },
      { label: "GPM", w: lw * 0.16, align: "right" },
      { label: "PIPE", w: lw * 0.17, align: "right" },
      { label: "PSI", w: lw * 0.14, align: "right" },
      { label: "STATUS", w: lw * 0.24 },
    ], rows, { fontSize: 6.5 });
    ly = t.y + 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTES", lx, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    let ny = ly + 9;
    const maxY = c.H - c.m - 72;
    project.meta.planNotes.filter(Boolean).forEach((n, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${n}`, lw);
      if (ny + lines.length * 8 > maxY) return;
      doc.text(lines, lx, ny);
      ny += lines.length * 8 + 1;
    });
  }
}

async function installerTableSheet(c: Ctx) {
  const { doc, project, analysis } = c;
  const area = frame(c, "Head location schedule");
  const refs = referenceLines(project);
  const labels = analysis.labels;
  const heads = [...project.sprinklers].sort((a, b) => (labels.get(a.id) ?? "").localeCompare(labels.get(b.id) ?? "", undefined, { numeric: true }));
  const rows = heads.map((h) => {
    const perf = headPerformance(h);
    const loc = locate(h.position, refs);
    const z = project.zones.find((zz) => zz.id === h.zoneId);
    return [labels.get(h.id) ?? "", z ? String(z.number) : "—", perf.product.model, perf.nozzle.name, `${Math.round(h.arc)}°`, formatFeetInches(perf.radius), loc.d1 ? `${formatFeetInches(loc.d1.dist)} from ${loc.d1.name}` : "", loc.d2 ? `${formatFeetInches(loc.d2.dist)} from ${loc.d2.name}` : ""];
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("HEAD LOCATION SCHEDULE — measured perpendicular from permanent reference lines", area.x, area.y + 8);
  doc.setFont("helvetica", "normal");
  const w = area.w;
  const cols = [
    { label: "HEAD", w: w * 0.07 },
    { label: "ZONE", w: w * 0.05 },
    { label: "MODEL", w: w * 0.2 },
    { label: "NOZZLE", w: w * 0.1 },
    { label: "ARC", w: w * 0.05, align: "right" as const },
    { label: "THROW", w: w * 0.06, align: "right" as const },
    { label: "REFERENCE 1", w: w * 0.235 },
    { label: "REFERENCE 2", w: w * 0.235 },
  ];
  let rest = rows;
  let y = area.y + 16;
  while (rest.length) {
    const t = table(doc, area.x, y, cols, rest, { fontSize: 7, maxY: area.y + area.h });
    rest = t.rest;
    if (rest.length) {
      doc.addPage();
      c.sheet++;
      const a2 = frame(c, "Head location schedule (cont.)");
      y = a2.y + 8;
    }
  }
}

function scheduleSheet(c: Ctx) {
  const { doc, project, analysis } = c;
  const area = frame(c, "Hydraulic & watering schedule");
  let y = area.y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ZONE HYDRAULIC SUMMARY", area.x, y);
  doc.setFont("helvetica", "normal");
  const w = area.w;
  const hrows = analysis.hyd.zones.map((z) => [
    String(z.number),
    Object.entries(z.counts)
      .map(([k, n]) => `${n} ${HEAD_NAMES[k as keyof typeof HEAD_NAMES]}`)
      .join(", ") + (z.dripGpm ? " + drip" : ""),
    z.gpm.toFixed(1),
    z.source ? z.source.pressure.toFixed(1) : "—",
    z.mainlineLoss.toFixed(1),
    z.valveLoss.toFixed(1),
    z.maxLateralLoss.toFixed(1),
    z.criticalPressure?.toFixed(1) ?? "—",
    `${z.pressureVariationPct.toFixed(0)}%`,
    z.maxVelocity.toFixed(1),
    pipeSizeLabel(z.recommendedLateralSize),
    z.status.toUpperCase(),
  ]);
  const t = table(doc, area.x, y + 6, [
    { label: "ZONE", w: w * 0.05 },
    { label: "HEADS", w: w * 0.25 },
    { label: "GPM", w: w * 0.06, align: "right" },
    { label: "POC PSI", w: w * 0.07, align: "right" },
    { label: "MAIN LOSS", w: w * 0.08, align: "right" },
    { label: "VALVE LOSS", w: w * 0.08, align: "right" },
    { label: "LAT. LOSS", w: w * 0.07, align: "right" },
    { label: "MIN HEAD PSI", w: w * 0.09, align: "right" },
    { label: "VAR.", w: w * 0.05, align: "right" },
    { label: "MAX FT/S", w: w * 0.07, align: "right" },
    { label: "PIPE", w: w * 0.05, align: "right" },
    { label: "STATUS", w: w * 0.08 },
  ], hrows);
  y = t.y + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RECOMMENDED WATERING SCHEDULE (JULY, PLANNING ONLY)", area.x, y);
  doc.setFont("helvetica", "normal");
  const srows = [...project.zones]
    .sort((a, b) => a.number - b.number)
    .map((z) => {
      const zr = analysis.hyd.zones.find((r) => r.zoneId === z.id)!;
      const h = project.sprinklers.find((s) => s.zoneId === z.id);
      const cls = h ? precipClass(headPerformance(h).product.category) : "drip";
      const s = scheduleZone(z, zr, cls, project.comparison.climate, 6);
      return [String(z.number), z.plantType, `${z.schedule.daysPerWeek}`, s.precipInHr.toFixed(2), `${s.runtimeMinDay.toFixed(0)} min`, `${s.cycles} × ${s.cycleMin.toFixed(0)} min`, s.soakMin ? `${s.soakMin} min` : "—", s.gallonsPerDay.toFixed(0), s.gallonsPerMonth.toFixed(0)];
    });
  const t2 = table(doc, area.x, y + 6, [
    { label: "ZONE", w: w * 0.06 },
    { label: "PLANT TYPE", w: w * 0.14 },
    { label: "DAYS/WK", w: w * 0.08, align: "right" },
    { label: "PR IN/HR", w: w * 0.09, align: "right" },
    { label: "RUN/DAY", w: w * 0.11, align: "right" },
    { label: "CYCLES", w: w * 0.14, align: "right" },
    { label: "SOAK", w: w * 0.1, align: "right" },
    { label: "GAL/DAY", w: w * 0.12, align: "right" },
    { label: "GAL/MONTH", w: w * 0.12, align: "right" },
  ], srows);
  y = t2.y + 14;
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize("Schedules are planning recommendations based on regional reference ET, landscape coefficients, estimated application efficiency and soil intake. Actual irrigation requirements depend on local weather, season, soil, plant health and water-agency regulations. Adjust seasonally or use a weather-based (smart) controller.", w), area.x, y);
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESIGN CRITERIA", area.x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const src = project.waterSources[0];
  const lines = [
    `Water source: ${src ? `${src.name}, static ${src.staticPsi} PSI, meter ${src.meterSize}", backflow ${src.backflow.toUpperCase()}, available ${analysis.hyd.sources.get(src.id)?.availableGpm.toFixed(1)} GPM (${analysis.hyd.sources.get(src.id)?.availableGpmBasis})` : "not defined"}`,
    `Max zone flow ${project.settings.maxZoneFlowPct}% of available · max velocity ${project.settings.maxVelocityFps} ft/s · fitting allowance ${project.settings.minorLossPct}% · Hazen-Williams C=150 (PVC), 140 (PE)`,
    `Irrigated area ${formatArea(analysis.totals.irrigatedArea)} · ${project.sprinklers.length} heads · ${project.zones.length} zones · ${Math.round(analysis.totals.totalPipe)} ft pipe (${Math.round(analysis.totals.mainline)} ft mainline)`,
  ];
  doc.text(lines.flatMap((l) => doc.splitTextToSize(l, w)), area.x, y + 10);
}

function materialsSheet(c: Ctx) {
  const { doc, project, analysis, opts } = c;
  const customer = opts.customerMode;
  const area = frame(c, customer ? "Proposal & materials" : "Materials & estimate");
  const e = analysis.estimate;
  const mk = 1 + project.estimate.markupPct / 100;
  const w = area.w;
  let y = area.y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(customer ? `PROPOSAL — ${project.meta.name}` : "MATERIAL TAKEOFF & COST ESTIMATE (CONTRACTOR)", area.x, y);
  doc.setFont("helvetica", "normal");
  const rows = e.lines.map((l) => [l.category, l.item, String(l.orderQty), l.unit, formatCurrency(l.unitCost * (customer ? mk : 1)), formatCurrency((l.total + l.wasteCost) * (customer ? mk : 1))]);
  const cols = [
    { label: "CATEGORY", w: w * 0.14 },
    { label: "ITEM", w: w * 0.46 },
    { label: "QTY", w: w * 0.08, align: "right" as const },
    { label: "UNIT", w: w * 0.07 },
    { label: "UNIT PRICE", w: w * 0.12, align: "right" as const },
    { label: "TOTAL", w: w * 0.13, align: "right" as const },
  ];
  let rest = rows;
  let area2 = area;
  y += 6;
  while (rest.length) {
    const t = table(doc, area2.x, y, cols, rest, { fontSize: 6.8, maxY: area2.y + area2.h - 90 });
    rest = t.rest;
    y = t.y;
    if (rest.length) {
      doc.addPage();
      c.sheet++;
      area2 = frame(c, "Materials (cont.)");
      y = area2.y + 8;
    }
  }
  y += 10;
  const sx = area2.x + w * 0.6;
  const totals: [string, number][] = customer
    ? [
        ["Materials", (e.materialSubtotal + e.waste) * mk],
        ["Installation labor & equipment", (e.labor + e.equipment) * mk],
        ["Sales tax", e.tax],
        ["TOTAL", e.total],
      ]
    : [
        ["Material subtotal", e.materialSubtotal],
        [`Waste (${project.estimate.pipeWastePct}% pipe)`, e.waste],
        [`Labor (${e.laborHours.toFixed(1)} h)`, e.labor],
        ["Equipment", e.equipment],
        [`Markup (${project.estimate.markupPct}%)`, e.markup],
        [`Tax (${project.estimate.taxPct}%)`, e.tax],
        ["TOTAL PROJECT COST", e.total],
      ];
  doc.setFontSize(8);
  for (const [l, v] of totals) {
    const bold = l.startsWith("TOTAL");
    if (bold) {
      y += 6;
      doc.setLineWidth(0.8);
      doc.line(sx, y - 10, sx + w * 0.4, y - 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
    }
    doc.text(l, sx, y);
    doc.text(formatCurrency(v), sx + w * 0.4, y, { align: "right" });
    y += bold ? 14 : 11;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(customer ? "Proposal valid for 30 days. Price includes materials, installation and cleanup as shown on the irrigation plan." : "Internal estimate — contains markup and cost data. Do not send to customer; export in customer mode for proposals.", area2.x, Math.min(y + 8, area2.y + area2.h - 4), { maxWidth: w * 0.55 });
}

export async function exportPdf(project: Project, analysis: ProjectAnalysis, opts: ExportOptions): Promise<Blob> {
  const paper = PAPER[opts.paper];
  const landscape = opts.orientation === "landscape";
  const W = landscape ? paper.h : paper.w;
  const H = landscape ? paper.w : paper.h;
  const doc = new jsPDF({ unit: "pt", format: [paper.w, paper.h], orientation: opts.orientation, compress: true });
  const sheets = (opts.sheets.plan ? 1 : 0) + (opts.sheets.installer ? 2 : 0) + (opts.sheets.schedule ? 1 : 0) + (opts.sheets.materials ? 1 : 0);
  const c: Ctx = { doc, W, H, m: Math.max(18, Math.min(W, H) * 0.035), ink: opts.mode === "ink", project, analysis, opts, sheet: 1, sheets: Math.max(sheets, 1) };
  let first = true;
  const next = () => {
    if (!first) {
      doc.addPage([paper.w, paper.h], opts.orientation);
      c.sheet++;
    }
    first = false;
  };
  if (opts.sheets.plan) {
    next();
    await planSheet(c, false);
  }
  if (opts.sheets.installer) {
    next();
    await planSheet(c, true);
    next();
    await installerTableSheet(c);
  }
  if (opts.sheets.schedule) {
    next();
    scheduleSheet(c);
  }
  if (opts.sheets.materials) {
    next();
    materialsSheet(c);
  }
  doc.setProperties({ title: `${project.meta.name} — Irrigation Plan`, author: opts.company.name, creator: "DeltaLine Irrigation" });
  return doc.output("blob");
}

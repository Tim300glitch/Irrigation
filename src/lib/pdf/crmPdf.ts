/**
 * Customer-facing PDFs for the CRM, generated in the browser (jsPDF, vector):
 * estimates (all options + signature), invoices, audit reports and system maps.
 * Returned as Blobs and handed to saveFile(), which works both in a normal
 * browser and inside a hosted artifact (downloads capability).
 */
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import type { AuditReport, Customer, CrmSettings, Estimate, Invoice, LineItem, Payment, Property, PurchaseOrder, Vendor, Zone } from "../crm/types";
import { invoiceTotals, optionTotals, type AuditResult } from "../crm/calc";
import { addressFull, customerName, date, money, num } from "../crm/format";

const W = 612;
const H = 792;
const M = 44;
const BRAND: [number, number, number] = [15, 100, 144];

/** "Zones: 8 · Type: Direct burial" */
export function optionText(o?: Record<string, string>) {
  return o ? Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
}

class Pdf {
  doc = new jsPDF({ unit: "pt", format: "letter" });
  y = M;
  constructor(private s: CrmSettings) {}

  header(kind: string, rightLines: string[]) {
    const d = this.doc;
    d.setFillColor(...BRAND);
    d.rect(0, 0, W, 78, "F");
    d.setTextColor(255);
    d.setFont("helvetica", "bold");
    d.setFontSize(16);
    d.text(this.s.businessName, M, 34);
    d.setFont("helvetica", "normal");
    d.setFontSize(8.5);
    d.text([addressFull(this.s.address), [this.s.phone, this.s.email].filter(Boolean).join("  ·  "), this.s.license].filter(Boolean), M, 50);
    d.setFont("helvetica", "bold");
    d.setFontSize(18);
    d.text(kind, W - M, 34, { align: "right" });
    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.text(rightLines, W - M, 50, { align: "right" });
    d.setTextColor(20);
    this.y = 104;
  }

  ensure(h: number) {
    if (this.y + h > H - M) {
      this.doc.addPage();
      this.y = M;
    }
  }

  parties(blocks: { label: string; lines: string[] }[]) {
    const d = this.doc;
    const colW = (W - 2 * M) / blocks.length;
    let maxH = 0;
    blocks.forEach((b, i) => {
      const x = M + i * colW;
      d.setFontSize(7.5);
      d.setTextColor(110);
      d.setFont("helvetica", "bold");
      d.text(b.label.toUpperCase(), x, this.y);
      d.setFont("helvetica", "normal");
      d.setTextColor(20);
      d.setFontSize(10);
      const lines = b.lines.filter(Boolean).flatMap((l) => d.splitTextToSize(l, colW - 12) as string[]);
      d.text(lines, x, this.y + 14);
      maxH = Math.max(maxH, 14 + lines.length * 12);
    });
    this.y += maxH + 12;
  }

  heading(text: string, size = 13) {
    this.ensure(28);
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(size);
    d.setTextColor(20);
    const lines = d.splitTextToSize(text, W - 2 * M) as string[];
    d.text(lines, M, this.y);
    this.y += lines.length * (size + 3) + 4;
    d.setFont("helvetica", "normal");
  }

  paragraph(text: string, size = 9.5, color = 70) {
    if (!text) return;
    const d = this.doc;
    d.setFontSize(size);
    d.setTextColor(color);
    const lines = d.splitTextToSize(text, W - 2 * M) as string[];
    for (const l of lines) {
      this.ensure(size + 4);
      d.text(l, M, this.y);
      this.y += size + 3;
    }
    this.y += 4;
    d.setTextColor(20);
  }

  /** Line-item table with page breaks and a repeated header. */
  items(items: LineItem[], qtyOf: (i: LineItem) => number = (i) => i.qty) {
    const d = this.doc;
    const cols = [
      { l: "Description", x: M, a: "left" as const },
      { l: "Qty", x: 382, a: "right" as const },
      { l: "Unit price", x: 470, a: "right" as const },
      { l: "Amount", x: W - M, a: "right" as const },
    ];
    const head = () => {
      d.setFillColor(236, 240, 244);
      d.rect(M - 6, this.y - 11, W - 2 * M + 12, 16, "F");
      d.setFont("helvetica", "bold");
      d.setFontSize(8.5);
      d.setTextColor(60);
      cols.forEach((c) => d.text(c.l, c.x, this.y, { align: c.a }));
      d.setFont("helvetica", "normal");
      d.setTextColor(20);
      this.y += 16;
    };
    this.ensure(40);
    head();
    for (const i of items) {
      d.setFontSize(9.5);
      const name = d.splitTextToSize(i.name, 300) as string[];
      d.setFontSize(8);
      const text = [optionText(i.options), i.description].filter(Boolean).join(" — ");
      const desc = text ? (d.splitTextToSize(text, 300) as string[]) : [];
      const h = name.length * 12 + desc.length * 10 + 4;
      if (this.y + h > H - M) {
        d.addPage();
        this.y = M + 12;
        head();
      }
      const q = qtyOf(i);
      d.setFontSize(9.5);
      d.text(name, M, this.y);
      d.text(`${num(q, 2)} ${i.unit}`, cols[1].x, this.y, { align: "right" });
      d.text(money(i.unitPrice), cols[2].x, this.y, { align: "right" });
      d.text(money(q * i.unitPrice), cols[3].x, this.y, { align: "right" });
      if (desc.length) {
        d.setFontSize(8);
        d.setTextColor(110);
        d.text(desc, M, this.y + name.length * 12 - 2);
        d.setTextColor(20);
      }
      this.y += h;
      d.setDrawColor(230);
      d.line(M - 6, this.y - 9, W - M + 6, this.y - 9);
    }
    this.y += 4;
  }

  totals(rows: [string, number, ("bold" | "green")?][]) {
    const d = this.doc;
    this.ensure(rows.length * 14 + 10);
    for (const [k, v, style] of rows) {
      d.setFont("helvetica", style === "bold" ? "bold" : "normal");
      d.setFontSize(style === "bold" ? 11 : 9.5);
      d.setTextColor(style === "green" ? 22 : 20, style === "green" ? 120 : 20, style === "green" ? 60 : 20);
      if (style === "bold") {
        d.setDrawColor(20);
        d.line(380, this.y - 10, W - M, this.y - 10);
      }
      d.text(k, 390, this.y);
      d.text(money(v), W - M, this.y, { align: "right" });
      this.y += style === "bold" ? 16 : 13;
    }
    d.setFont("helvetica", "normal");
    d.setTextColor(20);
    this.y += 6;
  }

  signature(name?: string, dataUrl?: string, when?: string) {
    this.ensure(70);
    const d = this.doc;
    const y = this.y + 36;
    if (dataUrl) {
      try {
        d.addImage(dataUrl, "PNG", M, y - 40, 150, 38);
      } catch {
        /* unsupported image — keep the printed name */
      }
    }
    d.setDrawColor(20);
    d.line(M, y, M + 260, y);
    d.line(W - M - 150, y, W - M, y);
    d.setFontSize(8.5);
    d.setTextColor(90);
    d.text(name ? `Customer signature — ${name}` : "Customer signature", M, y + 11);
    d.text(when ? `Date — ${date(when)}` : "Date", W - M - 150, y + 11);
    d.setTextColor(20);
    this.y = y + 26;
  }

  footer() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      d.setPage(p);
      d.setFontSize(7.5);
      d.setTextColor(140);
      d.text(`${this.s.businessName} · ${this.s.phone}`, M, H - 22);
      d.text(`Page ${p} of ${n}`, W - M, H - 22, { align: "right" });
    }
  }

  blob() {
    this.footer();
    return this.doc.output("blob");
  }
}

export function estimatePdf(e: Estimate, c: Customer | undefined, p: Property | undefined, s: CrmSettings): Blob {
  const pdf = new Pdf(s);
  pdf.header("ESTIMATE", [`#${e.number}`, `Date ${date(e.createdAt)}`, e.validUntil ? `Valid until ${date(e.validUntil)}` : ""].filter(Boolean));
  pdf.parties([
    { label: "Prepared for", lines: [customerName(c), c?.phone ?? "", c?.email ?? ""] },
    { label: "Service address", lines: [addressFull(p?.address)] },
  ]);
  pdf.heading(e.title, 14);
  e.options.forEach((o, i) => {
    const t = optionTotals(e, o);
    const chosen = e.status === "approved" && e.selectedOptionId === o.id;
    pdf.heading(`${e.options.length > 1 ? `Option ${i + 1}: ` : ""}${o.name}${chosen ? "  (approved)" : ""}  —  ${money(t.total)}`, 11.5);
    pdf.paragraph(o.description);
    pdf.items(o.items);
    pdf.totals([
      ["Subtotal", t.subtotal],
      ...(t.discount ? ([["Discount", -t.discount, "green"]] as [string, number, "green"][]) : []),
      ...(e.tripCharge ? ([["Trip charge", e.tripCharge]] as [string, number][]) : []),
      ...(e.diagnosticFee ? ([["Diagnostic fee", e.diagnosticFee]] as [string, number][]) : []),
      [`Tax (${e.taxPct}%)`, t.tax],
      ["Total", t.total, "bold"],
      ...(t.deposit ? ([[`Deposit due (${e.depositPct}%)`, t.deposit]] as [string, number][]) : []),
    ]);
  });
  if (e.customerNotes) {
    pdf.heading("Notes", 10.5);
    pdf.paragraph(e.customerNotes);
  }
  pdf.heading("Terms", 10.5);
  pdf.paragraph(e.terms, 8.5);
  pdf.signature(e.signature?.name, e.signature?.dataUrl, e.signature?.signedAt);
  return pdf.blob();
}

export function purchaseOrderPdf(po: PurchaseOrder, v: Vendor | undefined, deliverTo: string, s: CrmSettings): Blob {
  const pdf = new Pdf(s);
  pdf.header("PURCHASE ORDER", [`PO-${po.number}`, `Date ${date(po.orderedAt ?? po.createdAt)}`, ...(po.neededBy ? [`Needed by ${date(po.neededBy)}`] : [])]);
  pdf.parties([
    { label: "Supplier", lines: v ? [v.name, v.contactName, v.address, [v.phone, v.email].filter(Boolean).join("  ·  "), v.accountNumber ? `Our account # ${v.accountNumber}` : ""].filter(Boolean) : ["Supplier not set"] },
    { label: "Ship to", lines: [s.businessName, addressFull(s.address), deliverTo !== "Warehouse" ? `Attn: ${deliverTo}` : ""].filter(Boolean) },
    { label: "Terms", lines: [v?.paymentTerms || "Per account terms"] },
  ]);
  const lines: LineItem[] = po.items.map((l) => ({ id: l.id, itemId: l.itemId, kind: "material", name: l.name, description: l.sku ? `SKU ${l.sku}` : "", qty: l.qty, unit: l.unit, unitCost: l.unitCost, unitPrice: l.unitCost, taxable: false }));
  pdf.items(lines);
  pdf.totals([["Order total", po.items.reduce((t, l) => t + l.qty * l.unitCost, 0), "bold"]]);
  if (po.notes) pdf.paragraph(po.notes);
  pdf.paragraph(`Please reference PO-${po.number} on the packing slip and invoice. Questions: ${[s.phone, s.email].filter(Boolean).join(" · ")}`, 8.5);
  return pdf.blob();
}

export function invoicePdf(inv: Invoice, payments: Payment[], c: Customer | undefined, p: Property | undefined, s: CrmSettings): Blob {
  const t = invoiceTotals(inv, payments);
  const pdf = new Pdf(s);
  pdf.header(inv.kind === "deposit" ? "DEPOSIT INVOICE" : "INVOICE", [`INV-${inv.number}`, `Issued ${date(inv.issueDate)}`, `Due ${date(inv.dueDate)}`]);
  pdf.parties([
    { label: "Bill to", lines: [customerName(c), addressFull(c?.billingAddress), c?.email ?? ""] },
    ...(p ? [{ label: "Service address", lines: [addressFull(p.address)] }] : []),
    { label: "Balance due", lines: [money(t.balance), t.balance > 0 ? `by ${date(inv.dueDate)}` : "Paid in full — thank you"] },
  ]);
  pdf.items(inv.items);
  pdf.totals([
    ["Subtotal", t.subtotal],
    ...(t.discount ? ([["Discount", -t.discount, "green"]] as [string, number, "green"][]) : []),
    [`Tax (${inv.taxPct}%)`, t.tax],
    ["Total", t.total, "bold"],
    ...(t.depositCredit ? ([["Deposit received", -t.depositCredit, "green"]] as [string, number, "green"][]) : []),
    ...(t.paid ? ([["Payments", -t.paid, "green"]] as [string, number, "green"][]) : []),
    ["Balance due", t.balance, "bold"],
  ]);
  if (inv.notes) pdf.paragraph(inv.notes);
  pdf.paragraph(inv.terms, 8.5);
  pdf.paragraph(`Checks payable to ${(s.legalName || s.businessName).replace(/\.$/, "")}. Card and bank payments: use the payment link sent with this invoice or your customer portal.`, 8.5);
  return pdf.blob();
}

export function auditPdf(a: AuditReport, r: AuditResult, p: Property | undefined, c: Customer | undefined, zones: Zone[], s: CrmSettings): Blob {
  const pdf = new Pdf(s);
  pdf.header("IRRIGATION AUDIT", [`Audit date ${date(a.date)}`, a.status === "complete" ? "Final report" : "Draft"]);
  pdf.parties([
    { label: "Property", lines: [addressFull(p?.address)] },
    { label: "Customer", lines: [customerName(c)] },
  ]);
  const d = pdf.doc;
  const tiles: [string, string][] = [
    ["Overall score", `${r.overall} (${r.grade})`],
    ["Water efficiency", String(r.efficiency)],
    ["Est. water savings", `${r.savingsPct}%`],
    ["Distribution uniformity", a.distributionUniformity !== undefined ? `${Math.round(a.distributionUniformity * 100)}%` : "—"],
  ];
  const tw = (W - 2 * M - 18) / 4;
  tiles.forEach(([k, v], i) => {
    const x = M + i * (tw + 6);
    d.setDrawColor(203, 213, 225);
    d.roundedRect(x, pdf.y - 12, tw, 44, 4, 4, "S");
    d.setFontSize(7.5);
    d.setTextColor(110);
    d.text(k, x + 8, pdf.y + 1);
    d.setFont("helvetica", "bold");
    d.setFontSize(15);
    d.setTextColor(20);
    d.text(v, x + 8, pdf.y + 22);
    d.setFont("helvetica", "normal");
  });
  pdf.y += 50;
  if (r.savingsGallonsYr) pdf.paragraph(`Estimated savings ≈ ${num(r.savingsGallonsYr)} gallons per year after recommended work.`);
  pdf.heading("Measurements", 11);
  pdf.paragraph(`Static ${a.staticPsi ?? "—"} psi · Dynamic ${a.dynamicPsi ?? "—"} psi · Flow ${a.flowGpm ?? "—"} GPM · Precipitation ${a.precipRate ?? "—"} in/hr · Runtime ${a.minutesPerWeek ?? "—"} min/week`);
  pdf.paragraph(`Broken heads ${a.brokenHeads} · Leaks ${a.leaks} · Overspray ${a.overspray} · Runoff ${a.runoff} · Low heads ${a.lowHeads} · Tilted heads ${a.tiltedHeads} · Spacing ${a.headSpacingOk ? "OK" : "needs correction"} · Nozzles ${a.nozzleMatch ? "matched" : "mismatched"}`);
  pdf.paragraph(`Controller: ${a.controllerSettings || "—"} · Schedule: ${a.wateringSchedule || "—"} · Soil ${a.soilType.replace("_", " ")} · Sun ${a.sunExposure} · Slope ${a.slopePct}% · ${a.plantType}`);
  if (a.pressureProblems || a.valveIssues) pdf.paragraph([a.pressureProblems, a.valveIssues].filter(Boolean).join(" · "));
  pdf.heading("Repair recommendations", 11);
  r.repairs.forEach((x) => pdf.paragraph(`P${x.priority}  ${x.text}${x.estCost ? `  (≈ ${money(x.estCost)})` : ""}`, 9.5, 20));
  if (!r.repairs.length) pdf.paragraph("No repairs needed.");
  pdf.heading("Upgrade recommendations", 11);
  r.upgrades.forEach((x) => pdf.paragraph(`P${x.priority}  ${x.text}  (≈ ${x.savingsPct}% water savings)`, 9.5, 20));
  if (!r.upgrades.length) pdf.paragraph("No upgrades recommended.");
  pdf.heading("Zone findings", 11);
  for (const z of zones) {
    const f = a.zoneFindings.find((x) => x.zoneId === z.id);
    pdf.paragraph(`Zone ${z.number} ${z.name} — ${z.sprinklerType}, ${z.manufacturer} ${z.model}${f?.precipRate ? ` · ${f.precipRate} in/hr` : ""}${f?.du ? ` · DU ${Math.round(f.du * 100)}%` : ""} · ${f?.issues.map((i) => i.replace(/_/g, " ")).join(", ") || "OK"}${f?.note ? ` · ${f.note}` : ""}`, 9, 40);
  }
  if (a.notes) {
    pdf.heading("Auditor notes", 11);
    pdf.paragraph(a.notes);
  }
  return pdf.blob();
}

/** System map: the given SVG element (map units) drawn to fit, plus a zone schedule. */
/** svg2pdf can't resolve CSS custom properties; paper is always the light theme. */
const PAPER_VARS: Record<string, string> = {
  "--map-ink": "#1e293b",
  "--color-surface": "#ffffff",
  "--color-slate-200": "#e2e8f0",
  "--color-slate-500": "#64748b",
  "--color-slate-700": "#334155",
};

function resolveCssVars(root: Element) {
  const fix = (v: string) =>
    v.replace(/var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name: string, fb?: string) => PAPER_VARS[name] ?? fb?.trim() ?? (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#334155"));
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const a of ["fill", "stroke", "stop-color", "color", "style"]) {
      const v = el.getAttribute(a);
      if (v?.includes("var(")) el.setAttribute(a, fix(v));
    }
  }
}

export async function mapPdf(svg: SVGSVGElement, title: string, zones: Zone[], s: CrmSettings): Promise<Blob> {
  const pdf = new Pdf(s);
  pdf.doc.deletePage(1);
  pdf.doc.addPage("letter", "landscape");
  const LW = 792;
  const d = pdf.doc;
  d.setFont("helvetica", "bold");
  d.setFontSize(15);
  d.text("Irrigation System Map", M, 40);
  d.setFont("helvetica", "normal");
  d.setFontSize(9.5);
  d.text(title, M, 56);
  d.text([s.businessName, s.phone, `Printed ${date(Date.now())}`].join("  ·  "), LW - M, 40, { align: "right" });
  const vb = svg.viewBox.baseVal;
  const boxW = zones.length ? 480 : LW - 2 * M;
  const boxH = 612 - 70 - M;
  const k = Math.min(boxW / vb.width, boxH / vb.height);
  const w = vb.width * k;
  const h = vb.height * k;
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden";
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  resolveCssVars(clone);
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    await (d as unknown as { svg: (el: Element, o: object) => Promise<void> }).svg(clone, { x: M, y: 70, width: w, height: h });
  } finally {
    holder.remove();
  }
  d.setDrawColor(203, 213, 225);
  d.rect(M, 70, w, h);
  if (zones.length) {
    let y = 82;
    const x = M + boxW + 18;
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    d.text("Zone schedule", x, y);
    d.setFont("helvetica", "normal");
    y += 14;
    d.setFontSize(7.5);
    for (const z of zones) {
      const lines = d.splitTextToSize(`${z.number}. ${z.name} — ${z.sprinklerType}, ${z.manufacturer} ${z.model}; ${z.headCount || "—"} heads; ${z.flowGpm ?? "—"} GPM; valve ${z.valveType} ${z.valveSize}`, LW - M - x) as string[];
      if (y + lines.length * 9 > 612 - M) break;
      d.text(lines, x, y);
      y += lines.length * 9 + 3;
    }
  }
  return pdf.blob();
}

export const pdfName = (s: string) => s.replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim() + ".pdf";

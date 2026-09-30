/** Customer-facing PDF for a quick (repair / small job) estimate. Markup is folded into prices. */
import { jsPDF } from "jspdf";
import type { QuickEstimate } from "../model/types";
import type { CompanyProfile } from "../storage/repository";
import { simpleEstimate } from "../materials/estimate";
import { formatCurrency } from "../units/units";

export function quickEstimatePdf(q: QuickEstimate, profile: CompanyProfile): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const m = 48;
  const mk = 1 + q.markupPct / 100;
  const t = simpleEstimate(q.items, q.laborHours, q.laborRate, q.taxPct, q.markupPct);
  doc.setFillColor(15, 100, 144);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(profile.company, m, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text([profile.phone, profile.email, profile.license].filter(Boolean).join("   ·   "), m, 54);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(q.kind === "repair" ? "Repair Quote" : "Estimate", m, 108);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const info: [string, string][] = [
    ["Prepared for", q.customer || "—"],
    ["Address", q.address || "—"],
    ["Estimate", q.name],
    ["Date", new Date(q.updatedAt).toLocaleDateString()],
  ];
  let y = 132;
  for (const [k, v] of info) {
    doc.setTextColor(110);
    doc.text(k, m, y);
    doc.setTextColor(20);
    doc.text(doc.splitTextToSize(v, 360)[0], m + 90, y);
    y += 16;
  }
  y += 14;
  const cols = [
    { l: "Item", x: m, a: "left" as const },
    { l: "Qty", x: 360, a: "right" as const },
    { l: "Unit", x: 372, a: "left" as const },
    { l: "Unit price", x: 480, a: "right" as const },
    { l: "Total", x: W - m, a: "right" as const },
  ];
  doc.setFillColor(236, 240, 244);
  doc.rect(m - 6, y - 12, W - 2 * m + 12, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  cols.forEach((c) => doc.text(c.l, c.x, y, { align: c.a }));
  doc.setFont("helvetica", "normal");
  y += 18;
  const row = (cells: string[]) => {
    if (y > 700) {
      doc.addPage();
      y = m;
    }
    cells.forEach((c, i) => doc.text(i === 0 ? doc.splitTextToSize(c, 290)[0] : c, cols[i].x, y, { align: cols[i].a }));
    doc.setDrawColor(225);
    doc.line(m - 6, y + 6, W - m + 6, y + 6);
    y += 18;
  };
  for (const i of q.items) row([i.item, String(i.quantity), i.unit, formatCurrency(i.unitCost * mk), formatCurrency(i.quantity * i.unitCost * mk)]);
  if (q.laborHours > 0) row(["Labor", String(q.laborHours), "h", formatCurrency(q.laborRate * mk), formatCurrency(t.labor * mk)]);
  y += 10;
  const tot: [string, number][] = [
    ["Materials", t.materials * mk],
    ["Labor", t.labor * mk],
    ["Sales tax", t.tax],
  ];
  doc.setFontSize(10);
  for (const [l, v] of tot) {
    doc.text(l, 400, y);
    doc.text(formatCurrency(v), W - m, y, { align: "right" });
    y += 16;
  }
  doc.setDrawColor(20);
  doc.line(400, y - 8, W - m, y - 8);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", 400, y);
  doc.text(formatCurrency(t.total), W - m, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("This estimate is valid for 30 days. Prices include parts and labor as listed.", m, 740);
  return doc.output("blob");
}

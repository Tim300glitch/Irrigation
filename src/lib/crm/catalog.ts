/**
 * Starter catalog: price book, estimate & checklist templates, service plans,
 * message templates and automation rules. Representative contractor costs
 * (2026, Southern California supply house pricing) — edit in Settings / Inventory.
 */
import type { Automation, ChecklistTemplate, EstimateTemplate, InventoryItem, ItemCategory, MessageTemplate, PricingRule, ServicePlan, Vendor } from "./types";

type ItemSeed = [id: string, name: string, sku: string, cat: ItemCategory, mfr: string, unit: string, cost: number, rule: PricingRule, stock: number, min: number, vendor: string, laborHrs?: number];

const X = (v: number): PricingRule => ({ type: "multiplier", value: v });
const M = (v: number): PricingRule => ({ type: "margin", value: v });
const U = (v: number): PricingRule => ({ type: "markup", value: v });
const F = (v: number): PricingRule => ({ type: "flat", value: v });

export const VENDORS: Vendor[] = [
  { id: "ven_ewing", name: "Ewing Irrigation & Landscape Supply", contactName: "Chris Valdez", phone: "(951) 555-0180", email: "riverside@ewing.example", website: "ewingirrigation.com", accountNumber: "EW-448812", address: "1420 Columbia Ave, Riverside, CA 92507", categories: ["rotors", "sprinklers", "nozzles", "valves", "pvc", "fittings", "drip", "controllers", "wire", "backflow"], paymentTerms: "Net 30", notes: "Primary supplier. Contractor pricing tier 3. Will-call opens 6:00 AM." },
  { id: "ven_siteone", name: "SiteOne Landscape Supply", contactName: "Megan Holt", phone: "(951) 555-0191", email: "temecula@siteone.example", website: "siteone.com", accountNumber: "S1-20391", address: "41890 Enterprise Cir, Temecula, CA 92590", categories: ["rotors", "sprinklers", "nozzles", "valves", "pvc", "fittings", "drip", "controllers", "wire"], paymentTerms: "Net 30", notes: "Use for Temecula / Murrieta jobs. Partners Program points." },
  { id: "ven_horizon", name: "Horizon Distribution", contactName: "Andre Lewis", phone: "(951) 555-0177", email: "corona@horizon.example", website: "horizononline.com", accountNumber: "HZ-77120", address: "250 Radio Rd, Corona, CA 92879", categories: ["pvc", "fittings", "backflow", "valves"], paymentTerms: "Net 15", notes: "Best pricing on PVC and backflow assemblies." },
  { id: "ven_hdpro", name: "Home Depot Pro", contactName: "Desk", phone: "(951) 555-0150", email: "pro@homedepot.example", website: "homedepot.com/pro", accountNumber: "HDP-55190", address: "Riverside, CA", categories: ["misc", "fittings"], paymentTerms: "Card", notes: "Emergency / after-hours only." },
  { id: "ven_sunbelt", name: "Sunbelt Rentals", contactName: "Rick Barnes", phone: "(951) 555-0133", email: "riverside@sunbelt.example", website: "sunbeltrentals.com", accountNumber: "SB-9020", address: "Riverside, CA", categories: ["equipment"], paymentTerms: "Net 30", notes: "Trenchers, mini-ex, vibratory plow." },
];

const ITEMS: ItemSeed[] = [
  // rotors
  ["itm_pgpu", "Hunter PGP Ultra 4\" Rotor", "PGPU-00", "rotors", "Hunter", "ea", 13.1, X(2.45), 46, 24, "ven_ewing", 0.35],
  ["itm_i20", "Hunter I-20 4\" Rotor (SS)", "I20-04-SS", "rotors", "Hunter", "ea", 19.8, X(2.3), 18, 12, "ven_ewing", 0.35],
  ["itm_rb5004", "Rain Bird 5004 Plus PC Rotor", "5004PC", "rotors", "Rain Bird", "ea", 12.4, X(2.45), 38, 24, "ven_siteone", 0.35],
  ["itm_rb3504", "Rain Bird 3504 Rotor", "3504PC", "rotors", "Rain Bird", "ea", 9.8, X(2.5), 14, 10, "ven_siteone", 0.3],
  // sprays
  ["itm_rb1804", "Rain Bird 1804 4\" Spray Body", "1804", "sprinklers", "Rain Bird", "ea", 2.85, X(3), 120, 60, "ven_ewing", 0.25],
  ["itm_rb1806", "Rain Bird 1806 6\" Spray Body", "1806", "sprinklers", "Rain Bird", "ea", 4.6, X(2.8), 40, 24, "ven_ewing", 0.25],
  ["itm_rb1812", "Rain Bird 1812 12\" Spray Body", "1812", "sprinklers", "Rain Bird", "ea", 7.9, X(2.6), 22, 12, "ven_ewing", 0.3],
  ["itm_prs40", "Hunter Pro-Spray PRS40 4\" Body", "PROS-04-PRS40", "sprinklers", "Hunter", "ea", 5.2, X(2.7), 36, 24, "ven_siteone", 0.25],
  // nozzles
  ["itm_mp1000", "Hunter MP Rotator MP1000", "MP1000-90", "nozzles", "Hunter", "ea", 6.1, X(2.6), 34, 24, "ven_ewing", 0.05],
  ["itm_mp2000", "Hunter MP Rotator MP2000", "MP2000-90", "nozzles", "Hunter", "ea", 6.1, X(2.6), 52, 24, "ven_ewing", 0.05],
  ["itm_mp3000", "Hunter MP Rotator MP3000", "MP3000-90", "nozzles", "Hunter", "ea", 6.4, X(2.6), 30, 18, "ven_ewing", 0.05],
  ["itm_mpstrip", "Hunter MP Strip LCS515", "MPLCS515", "nozzles", "Hunter", "ea", 6.1, X(2.6), 9, 12, "ven_ewing", 0.05],
  ["itm_rvan", "Rain Bird R-VAN18 Rotary Nozzle", "RVAN18", "nozzles", "Rain Bird", "ea", 5.4, X(2.6), 28, 18, "ven_siteone", 0.05],
  ["itm_hevan", "Rain Bird HE-VAN 15 Nozzle", "HE-VAN-15", "nozzles", "Rain Bird", "ea", 2.95, X(3), 64, 40, "ven_ewing", 0.05],
  ["itm_rb15", "Rain Bird 15-Series MPR Nozzle", "15Q", "nozzles", "Rain Bird", "ea", 1.25, X(3.5), 80, 40, "ven_ewing", 0.05],
  // valves
  ["itm_pgv", "Hunter PGV-101G 1\" Valve", "PGV-101G", "valves", "Hunter", "ea", 22.5, M(55), 16, 10, "ven_ewing", 1.25],
  ["itm_pgvjt", "Hunter PGV-100JT-G 1\" Jar-Top Valve", "PGV-100JT-G", "valves", "Hunter", "ea", 26.4, M(55), 8, 6, "ven_ewing", 1.25],
  ["itm_icv", "Hunter ICV-101G 1\" Commercial Valve", "ICV-101G", "valves", "Hunter", "ea", 46, M(50), 4, 4, "ven_ewing", 1.4],
  ["itm_dv", "Rain Bird 100-DV 1\" Valve", "100-DV", "valves", "Rain Bird", "ea", 19.8, M(55), 14, 10, "ven_siteone", 1.25],
  ["itm_dvf", "Rain Bird 100-DVF 1\" Valve w/ Flow Control", "100-DVF", "valves", "Rain Bird", "ea", 22.1, M(55), 6, 6, "ven_siteone", 1.25],
  ["itm_pesb", "Rain Bird 100-PESB 1\" Valve", "100-PESB", "valves", "Rain Bird", "ea", 48.5, M(50), 3, 4, "ven_siteone", 1.4],
  ["itm_xcz", "Rain Bird XCZ-100-PRB-COM Drip Control Kit", "XCZ-100-PRB-COM", "drip", "Rain Bird", "ea", 62, M(50), 5, 4, "ven_ewing", 1.5],
  ["itm_sol", "Hunter 24VAC Solenoid", "458200", "valves", "Hunter", "ea", 14.2, X(2.8), 12, 8, "ven_ewing", 0.25],
  ["itm_dvdia", "Rain Bird DV Diaphragm Assembly", "DV-DIAPH", "valves", "Rain Bird", "ea", 6.85, X(3.5), 4, 8, "ven_siteone", 0.4],
  ["itm_asv", "Orbit 3/4\" Anti-Siphon Valve", "57461", "valves", "Orbit", "ea", 14, M(50), 6, 4, "ven_hdpro", 1.25],
  // pvc
  ["itm_pvc1", "1\" PVC SCH 40 Pipe", "PVC40-100", "pvc", "JM Eagle", "ft", 0.92, X(2.2), 840, 400, "ven_horizon"],
  ["itm_pvc34", "3/4\" PVC SCH 40 Pipe", "PVC40-075", "pvc", "JM Eagle", "ft", 0.66, X(2.2), 620, 400, "ven_horizon"],
  ["itm_pvc114", "1-1/4\" PVC SCH 40 Pipe", "PVC40-125", "pvc", "JM Eagle", "ft", 1.32, X(2.1), 220, 200, "ven_horizon"],
  ["itm_pvc1c200", "1\" PVC Class 200 Pipe", "PVC200-100", "pvc", "JM Eagle", "ft", 0.55, X(2.2), 400, 200, "ven_horizon"],
  ["itm_funny", "1/2\" Funny Pipe (Flex Swing Pipe)", "SP-100", "pvc", "Rain Bird", "ft", 0.24, X(3), 900, 300, "ven_ewing"],
  // fittings
  ["itm_tee1", "1\" SCH 40 Tee (S×S×S)", "401-010", "fittings", "Lasco", "ea", 1.05, X(3), 64, 30, "ven_horizon"],
  ["itm_ell1", "1\" SCH 40 90° Elbow", "406-010", "fittings", "Lasco", "ea", 0.88, X(3), 82, 40, "ven_horizon"],
  ["itm_tee34", "3/4\" SCH 40 Tee", "401-007", "fittings", "Lasco", "ea", 0.62, X(3), 70, 30, "ven_horizon"],
  ["itm_ell34", "3/4\" SCH 40 90° Elbow", "406-007", "fittings", "Lasco", "ea", 0.48, X(3), 90, 40, "ven_horizon"],
  ["itm_cpl1", "1\" SCH 40 Coupling", "429-010", "fittings", "Lasco", "ea", 0.55, X(3), 60, 30, "ven_horizon"],
  ["itm_slipfix", "1\" Slip-Fix Repair Coupling", "SF-100", "fittings", "King Brothers", "ea", 9.8, X(2.5), 7, 10, "ven_ewing", 0.5],
  ["itm_ma1", "1\" PVC Male Adapter", "436-010", "fittings", "Lasco", "ea", 0.62, X(3), 70, 30, "ven_horizon"],
  ["itm_sj12", "1/2\" × 12\" Swing Joint", "SJ-512", "fittings", "Rain Bird", "ea", 3.4, X(2.8), 40, 24, "ven_ewing"],
  ["itm_sj34", "3/4\" × 12\" Rotor Swing Joint", "SJ-7512", "fittings", "Rain Bird", "ea", 6.9, X(2.6), 30, 18, "ven_ewing"],
  ["itm_barb", "Funny Pipe Barbed Elbow", "SBE-050", "fittings", "Rain Bird", "ea", 0.22, X(4), 300, 100, "ven_ewing"],
  ["itm_glue", "PVC Primer & Cement Kit", "WELDON-KIT", "fittings", "Weld-On", "kit", 14.8, X(1.8), 9, 6, "ven_horizon"],
  // drip
  ["itm_xfs", "Rain Bird XFS Dripline 0.6 GPH @ 12\"", "XFS-06-12-500", "drip", "Rain Bird", "ft", 0.31, X(2.6), 1200, 500, "ven_ewing"],
  ["itm_techline", "Netafim Techline CV 0.6 GPH @ 12\"", "TLCV6-12", "drip", "Netafim", "ft", 0.34, X(2.6), 600, 500, "ven_siteone"],
  ["itm_poly", "1/2\" Drip Poly Tubing", "POLY-700", "drip", "Rain Bird", "ft", 0.14, X(3), 1000, 500, "ven_ewing"],
  ["itm_emit", "1 GPH Pressure-Compensating Emitter", "XB-10PC", "drip", "Rain Bird", "ea", 0.28, X(4), 400, 200, "ven_ewing", 0.03],
  ["itm_manifold", "Xeri-Bird 8-Outlet Manifold", "XBCV-8", "drip", "Rain Bird", "ea", 18, X(2.5), 6, 4, "ven_ewing", 0.4],
  ["itm_dripkit", "Drip Filter / Pressure Regulator Kit", "PRF-075", "drip", "Rain Bird", "ea", 29, X(2.4), 7, 5, "ven_ewing", 0.5],
  ["itm_flush", "Drip Flush Cap", "MDFC", "drip", "Rain Bird", "ea", 1.7, X(3.5), 40, 20, "ven_ewing"],
  ["itm_staple", "Drip Tubing Staple 6\"", "TDS-050", "drip", "Rain Bird", "ea", 0.12, X(4), 600, 200, "ven_ewing"],
  // controllers
  ["itm_prohc", "Hunter Pro-HC 12-Station Hydrawise Controller", "PHC-1200", "controllers", "Hunter", "ea", 238, U(65), 4, 3, "ven_ewing", 1.5],
  ["itm_hpc", "Hunter Hydrawise HPC-400 Controller", "HPC-400", "controllers", "Hunter", "ea", 214, U(65), 2, 2, "ven_ewing", 1.5],
  ["itm_esptm2", "Rain Bird ESP-TM2 12-Station Controller", "ESP-TM2-12", "controllers", "Rain Bird", "ea", 142, U(70), 3, 3, "ven_siteone", 1.25],
  ["itm_lnk2", "Rain Bird LNK2 WiFi Module", "LNK2WIFI", "controllers", "Rain Bird", "ea", 72, U(70), 4, 3, "ven_siteone", 0.25],
  ["itm_rachio", "Rachio 3 8-Zone Smart Controller", "8ZULW-C", "controllers", "Rachio", "ea", 172, U(60), 2, 2, "ven_ewing", 1.25],
  ["itm_solarsync", "Hunter Solar Sync ET Sensor", "SOLAR-SYNC", "controllers", "Hunter", "ea", 96, U(65), 3, 2, "ven_ewing", 0.75],
  ["itm_rainclik", "Hunter Rain-Clik Sensor", "RAIN-CLIK", "controllers", "Hunter", "ea", 32, U(80), 5, 3, "ven_ewing", 0.5],
  // wire
  ["itm_w185", "18/5 Irrigation Control Wire", "18-5-500", "wire", "Paige", "ft", 0.32, X(2.4), 1500, 500, "ven_ewing"],
  ["itm_w187", "18/7 Irrigation Control Wire", "18-7-500", "wire", "Paige", "ft", 0.44, X(2.4), 800, 500, "ven_ewing"],
  ["itm_w1813", "18/13 Irrigation Control Wire", "18-13-500", "wire", "Paige", "ft", 0.82, X(2.3), 300, 250, "ven_ewing"],
  ["itm_dby", "3M DBY Waterproof Wire Connector", "DBY-6", "wire", "3M", "ea", 0.85, X(3.5), 150, 60, "ven_ewing", 0.05],
  // backflow
  ["itm_pvb", "Febco 765 1\" Pressure Vacuum Breaker", "765-1", "backflow", "Febco", "ea", 148, U(60), 2, 2, "ven_horizon", 2],
  ["itm_rp", "Wilkins 975XL 1\" Reduced Pressure Assembly", "975XL-1", "backflow", "Wilkins", "ea", 325, U(55), 1, 1, "ven_horizon", 3],
  ["itm_pvbkit", "PVB Bonnet & Poppet Repair Kit", "905-111", "backflow", "Febco", "ea", 38, X(2.4), 5, 3, "ven_horizon", 0.75],
  // misc
  ["itm_vb10", "10\" Round Valve Box", "910-B", "misc", "Carson", "ea", 11.5, X(2.5), 14, 8, "ven_ewing", 0.35],
  ["itm_vbstd", "Standard Rectangular Valve Box", "1419-B", "misc", "Carson", "ea", 24, X(2.4), 9, 6, "ven_ewing", 0.5],
  ["itm_gravel", "Pea Gravel (bag)", "GRV-50", "misc", "—", "bag", 4.8, X(2.5), 20, 10, "ven_hdpro"],
  // labor (non-stock)
  ["lab_tech", "Irrigation Technician Labor", "LAB-TECH", "labor", "", "hr", 38, F(95), 0, 0, ""],
  ["lab_install", "Installation Crew Labor", "LAB-INSTALL", "labor", "", "hr", 34, F(85), 0, 0, ""],
  ["lab_diag", "Diagnostic Labor", "LAB-DIAG", "labor", "", "hr", 38, F(110), 0, 0, ""],
  ["lab_trench", "Trenching & Backfill (per ft)", "LAB-TRENCH", "labor", "", "ft", 1.1, F(3.25), 0, 0, ""],
  ["lab_program", "Controller Programming & Setup", "LAB-PROG", "labor", "", "ea", 25, F(85), 0, 0, ""],
  // equipment (non-stock)
  ["eqp_trencher", "Walk-Behind Trencher (day)", "EQ-TRENCH", "equipment", "", "day", 185, U(35), 0, 0, "ven_sunbelt"],
  ["eqp_miniex", "Mini Excavator (day)", "EQ-MINIEX", "equipment", "", "day", 340, U(30), 0, 0, "ven_sunbelt"],
  ["eqp_puller", "Vibratory Pipe Puller (day)", "EQ-PULL", "equipment", "", "day", 210, U(35), 0, 0, "ven_sunbelt"],
];

export function priceBook(): InventoryItem[] {
  return ITEMS.map(([id, name, sku, category, manufacturer, unit, cost, pricing, stock, min, vendor, laborHrs]) => {
    const nonStock = category === "labor" || category === "equipment";
    return {
      id,
      name,
      sku,
      category,
      manufacturer,
      description: "",
      unit,
      cost,
      pricing,
      taxable: !nonStock,
      stocked: !nonStock,
      warehouseQty: stock,
      minQty: min,
      reorderQty: Math.max(min * 2, unit === "ft" ? 500 : 10),
      preferredVendorId: vendor || undefined,
      laborHrsPerUnit: laborHrs,
      active: true,
      ...EXTRAS[id],
    };
  });
}

/** Options, links and default kits on a few sample items. */
const EXTRAS: Record<string, Partial<InventoryItem>> = {
  itm_prohc: {
    options: [{ name: "Zones", values: [{ label: "6", cost: 198 }, { label: "12", cost: 238 }, { label: "24", cost: 389 }] }, { name: "Mount", values: [{ label: "Indoor" }, { label: "Outdoor" }] }],
    links: [{ label: "Hunter product page", url: "https://www.hunterindustries.com/irrigation-product/controllers/pro-hc" }],
    defaultFor: [{ serviceType: "smart_controller", qty: 1 }],
  },
  itm_w185: {
    options: [{ name: "Wire type", values: [{ label: "Multi-strand direct burial" }, { label: "Single-strand UF" }] }, { name: "Gauge", values: [{ label: "18 AWG" }, { label: "14 AWG", cost: 0.58 }] }],
    links: [{ label: "Paige spec sheet", url: "https://www.paigeelectric.com" }],
  },
  itm_rainclik: { defaultFor: [{ serviceType: "smart_controller", qty: 1 }] },
};

/* ───────────────────────── Estimate templates ───────────────────────── */

type T = Omit<EstimateTemplate["options"][number]["items"][number], "unitCost" | "unitPrice" | "taxable" | "description"> & { description?: string };
const it = (itemId: string, qty: number, name = "", kind: T["kind"] = "material", unit = "ea"): T => ({ itemId, qty, name, kind, unit });
const lab = (qty: number, id = "lab_tech") => it(id, qty, "", "labor", "hr");

/** Templates reference price-book ids; names/costs/prices are resolved when applied. */
export const ESTIMATE_TEMPLATES_RAW: { id: string; name: string; serviceType: EstimateTemplate["serviceType"]; description: string; options: { name: string; description: string; tier?: "good" | "better" | "best"; items: T[] }[] }[] = [
  {
    id: "tpl_heads",
    name: "Sprinkler head replacement",
    serviceType: "head_replacement",
    description: "Replace broken spray heads / rotors, adjust coverage.",
    options: [
      { name: "Replace broken heads", description: "Like-for-like replacement of damaged heads.", tier: "good", items: [it("itm_rb1804", 4), it("itm_hevan", 4), it("itm_sj12", 2), lab(1.5)] },
      { name: "Replace + MP Rotator upgrade", description: "Replace broken heads and retrofit the zone with Hunter MP Rotators for matched precipitation.", tier: "better", items: [it("itm_prs40", 8), it("itm_mp2000", 8), it("itm_sj12", 4), lab(2.5)] },
    ],
  },
  {
    id: "tpl_valve",
    name: "Valve replacement",
    serviceType: "valve_repair",
    description: "Replace failed zone valve in existing box.",
    options: [{ name: "Replace valve", description: "Replace failed valve, new waterproof connectors, test zone.", items: [it("itm_pgv", 1), it("itm_ma1", 2), it("itm_dby", 2), it("itm_glue", 0.25, "", "material", "kit"), lab(1.25)] }],
  },
  {
    id: "tpl_main",
    name: "Main line repair",
    serviceType: "main_line_repair",
    description: "Locate and repair pressurized main line break.",
    options: [{ name: "Main line repair", description: "Excavate, repair main line with slip-fix coupling, pressure test, backfill.", items: [it("itm_pvc1", 6), it("itm_slipfix", 2), it("itm_cpl1", 2), it("itm_glue", 0.25, "", "material", "kit"), lab(2.5)] }],
  },
  {
    id: "tpl_lateral",
    name: "Lateral line repair",
    serviceType: "lateral_repair",
    description: "Repair broken lateral pipe.",
    options: [{ name: "Lateral repair", description: "Excavate and repair lateral, flush and test zone.", items: [it("itm_pvc34", 6), it("itm_cpl1", 2), it("itm_tee34", 1), it("itm_glue", 0.25, "", "material", "kit"), lab(1.5)] }],
  },
  {
    id: "tpl_drip",
    name: "Drip conversion",
    serviceType: "drip_conversion",
    description: "Convert spray zone to inline drip.",
    options: [
      { name: "Point-source drip", description: "Cap spray heads, install filter/regulator and emitters to each plant.", tier: "good", items: [it("itm_xcz", 1), it("itm_poly", 150), it("itm_emit", 40), it("itm_flush", 2), it("itm_staple", 40), lab(4, "lab_install")] },
      { name: "Inline dripline grid", description: "Full-coverage inline dripline (Rain Bird XFS) with control kit and flush points.", tier: "better", items: [it("itm_xcz", 1), it("itm_xfs", 350), it("itm_poly", 60), it("itm_flush", 4), it("itm_staple", 120), lab(6, "lab_install")] },
    ],
  },
  {
    id: "tpl_controller",
    name: "Smart controller install",
    serviceType: "smart_controller",
    description: "Replace timer with Wi-Fi smart controller.",
    options: [
      { name: "Rain Bird ESP-TM2 + LNK2", description: "Wi-Fi enabled ESP-TM2 with app control.", tier: "good", items: [it("itm_esptm2", 1), it("itm_lnk2", 1), it("lab_program", 1, "", "labor", "ea"), lab(1)] },
      { name: "Hunter Pro-HC Hydrawise", description: "Hydrawise weather-based scheduling, flow alerts ready.", tier: "better", items: [it("itm_prohc", 1), it("lab_program", 1, "", "labor", "ea"), lab(1.25)] },
      { name: "Pro-HC + Solar Sync + rain sensor", description: "Full smart package with on-site ET sensor.", tier: "best", items: [it("itm_prohc", 1), it("itm_solarsync", 1), it("lab_program", 1, "", "labor", "ea"), lab(2)] },
    ],
  },
  {
    id: "tpl_install",
    name: "New irrigation system",
    serviceType: "new_install",
    description: "Complete front + back irrigation system.",
    options: [
      {
        name: "Standard system",
        description: "Spray heads, PGV valves, ESP-TM2 controller, SCH 40 main.",
        tier: "good",
        items: [it("itm_rb1804", 34), it("itm_rb15", 34), it("itm_pgv", 6), it("itm_pvc1", 160), it("itm_pvc34", 420), it("itm_tee34", 30), it("itm_ell34", 24), it("itm_sj12", 34), it("itm_w187", 180), it("itm_dby", 14), it("itm_vbstd", 2), it("itm_esptm2", 1), it("lab_trench", 600, "", "labor", "ft"), lab(32, "lab_install"), it("eqp_trencher", 1, "", "equipment", "day")],
      },
      {
        name: "High-efficiency system",
        description: "Rotors on large turf, MP Rotators on small areas, Hydrawise controller.",
        tier: "better",
        items: [it("itm_pgpu", 14), it("itm_sj34", 14), it("itm_prs40", 22), it("itm_mp2000", 22), it("itm_sj12", 22), it("itm_pgv", 7), it("itm_pvc1", 180), it("itm_pvc34", 460), it("itm_tee34", 34), it("itm_ell34", 26), it("itm_w187", 200), it("itm_dby", 16), it("itm_vbstd", 2), it("itm_prohc", 1), it("lab_trench", 650, "", "labor", "ft"), lab(38, "lab_install"), it("eqp_trencher", 1, "", "equipment", "day")],
      },
      {
        name: "Premium smart system",
        description: "High-efficiency system plus drip beds, Solar Sync and flow-ready valves.",
        tier: "best",
        items: [it("itm_pgpu", 14), it("itm_sj34", 14), it("itm_prs40", 22), it("itm_mp2000", 22), it("itm_sj12", 22), it("itm_pgvjt", 8), it("itm_xcz", 2), it("itm_xfs", 400), it("itm_pvc1", 200), it("itm_pvc34", 480), it("itm_tee34", 36), it("itm_ell34", 28), it("itm_w1813", 220), it("itm_dby", 20), it("itm_vbstd", 3), it("itm_prohc", 1), it("itm_solarsync", 1), it("lab_trench", 700, "", "labor", "ft"), lab(46, "lab_install"), it("eqp_trencher", 2, "", "equipment", "day")],
      },
    ],
  },
  {
    id: "tpl_audit",
    name: "System audit",
    serviceType: "system_audit",
    description: "Full irrigation audit with catch-can test and report.",
    options: [{ name: "Irrigation audit", description: "Pressure & flow test, catch-can DU test, controller review, written report with recommendations.", items: [it("lab_diag", 2.5, "", "labor", "hr")] }],
  },
  {
    id: "tpl_backflow",
    name: "Backflow repair",
    serviceType: "backflow",
    description: "Rebuild or replace backflow assembly.",
    options: [
      { name: "Rebuild PVB", description: "Replace bonnet & poppet, test and certify.", tier: "good", items: [it("itm_pvbkit", 1), lab(1)] },
      { name: "Replace PVB", description: "Install new Febco 765 PVB, test and certify.", tier: "better", items: [it("itm_pvb", 1), it("itm_ma1", 2), it("itm_pvc1", 4), lab(2)] },
    ],
  },
  {
    id: "tpl_zone",
    name: "Zone addition",
    serviceType: "zone_addition",
    description: "Add a new zone to an existing system.",
    options: [{ name: "Add zone", description: "Tap main line, new valve, lateral and heads, wire to controller.", items: [it("itm_pgv", 1), it("itm_prs40", 8), it("itm_mp2000", 8), it("itm_sj12", 8), it("itm_pvc34", 120), it("itm_tee1", 1), it("itm_tee34", 6), it("itm_ell34", 6), it("itm_w185", 80), it("itm_vb10", 1), it("lab_trench", 120, "", "labor", "ft"), lab(6, "lab_install")] }],
  },
  {
    id: "tpl_reroute",
    name: "Pipe reroute",
    serviceType: "reroute",
    description: "Reroute pipe around new hardscape / trees.",
    options: [{ name: "Reroute", description: "Abandon existing run, trench and install new route, reconnect heads.", items: [it("itm_pvc1", 60), it("itm_ell1", 6), it("itm_cpl1", 4), it("itm_glue", 0.5, "", "material", "kit"), it("lab_trench", 60, "", "labor", "ft"), lab(4, "lab_install")] }],
  },
  {
    id: "tpl_repair",
    name: "General sprinkler repair",
    serviceType: "sprinkler_repair",
    description: "Diagnose and repair sprinkler issues.",
    options: [{ name: "Repair", description: "Diagnose system, repair heads and adjust coverage.", items: [it("itm_rb1804", 2), it("itm_hevan", 3), it("itm_sj12", 2), it("itm_barb", 4), lab(1.5)] }],
  },
];

export const CHECKLISTS: ChecklistTemplate[] = [
  { id: "chk_diag", name: "Diagnostics", serviceTypes: ["diagnostics"], items: ["Review customer complaint", "Check controller programming & power", "Run each zone", "Check static / dynamic pressure", "Test valve solenoids (ohms)", "Locate faults", "Document findings with photos", "Review recommendations with customer"] },
  { id: "chk_repair", name: "Repair", serviceTypes: ["sprinkler_repair", "valve_repair", "main_line_repair", "lateral_repair", "leak_repair", "head_replacement", "reroute", "backflow"], items: ["Locate shutoff", "Check controller", "Run each zone", "Check pressure", "Identify leak", "Complete repair", "Pressure test", "Run repaired zone", "Check coverage", "Clean work area", "Take after photos", "Customer walkthrough"] },
  { id: "chk_install", name: "New install", serviceTypes: ["new_install", "zone_addition", "trenching", "upgrade"], items: ["Call 811 / utilities marked", "Verify layout with customer", "Install backflow & main line", "Install valves & manifold", "Trench & install laterals", "Flush lines before heads", "Install heads & nozzles", "Pressure test main", "Run wire & connect controller", "Coverage test each zone", "Program controller", "Backfill & compact trenches", "Site cleanup", "Customer walkthrough & handoff"] },
  { id: "chk_drip", name: "Drip conversion", serviceTypes: ["drip_conversion"], items: ["Cap / remove spray heads", "Install control kit (filter + regulator)", "Lay dripline / emitters", "Install flush points", "Flush system", "Verify every plant is watered", "Stake tubing & cover with mulch", "Update controller runtime", "After photos"] },
  { id: "chk_controller", name: "Controller install", serviceTypes: ["smart_controller"], items: ["Photograph old wiring", "Label station wires", "Mount new controller", "Connect wires & common", "Connect Wi-Fi / app", "Enter zone details (plant, soil, sun, nozzle)", "Install sensor (if included)", "Test every station", "Walk customer through app"] },
  { id: "chk_audit", name: "Audit", serviceTypes: ["system_audit"], items: ["Static & dynamic pressure test", "Flow test at meter", "Run each zone & note issues", "Catch-can test (DU)", "Record precipitation rates", "Check spacing & nozzle match", "Review controller program", "Record soil / sun / slope", "Photos of issues", "Generate audit report"] },
  { id: "chk_maint", name: "Maintenance", serviceTypes: ["maintenance", "winterization"], items: ["Check controller & battery", "Run each zone", "Adjust & clean heads", "Check for leaks", "Inspect valve boxes", "Check backflow", "Seasonal schedule adjustment", "Report issues & recommendations"] },
];

export const SERVICE_PLANS: ServicePlan[] = [
  { id: "pln_quarterly", name: "Quarterly Irrigation Check", description: "Four visits per year: run every zone, adjust heads, check for leaks, seasonal controller adjustment.", price: 89, billing: "per_visit", frequency: "quarterly", visitsPerYear: 4, includedServices: ["Zone-by-zone inspection", "Head adjustment & cleaning", "Leak check", "Seasonal schedule update"], discountPct: 10, checklistTemplateId: "chk_maint", active: true },
  { id: "pln_spring", name: "Spring Startup", description: "Annual spring startup and system check.", price: 129, billing: "per_visit", frequency: "annual", visitsPerYear: 1, includedServices: ["System pressurization", "Controller programming", "Full inspection"], discountPct: 5, checklistTemplateId: "chk_maint", active: true },
  { id: "pln_summer", name: "Summer Efficiency Check", description: "Mid-summer coverage & efficiency tune-up.", price: 99, billing: "per_visit", frequency: "annual", visitsPerYear: 1, includedServices: ["Coverage check", "Nozzle swaps as needed", "Runtime optimization"], discountPct: 5, checklistTemplateId: "chk_maint", active: true },
  { id: "pln_winter", name: "Winterization", description: "Reduce schedule, protect backflow, rain sensor check.", price: 85, billing: "per_visit", frequency: "annual", visitsPerYear: 1, includedServices: ["Winter schedule", "Backflow insulation", "Rain sensor test"], discountPct: 5, checklistTemplateId: "chk_maint", active: true },
  { id: "pln_audit", name: "Annual Audit", description: "Full annual irrigation audit with written report.", price: 249, billing: "annual", frequency: "annual", visitsPerYear: 1, includedServices: ["Pressure & flow test", "Catch-can DU test", "Audit report", "Priority scheduling"], discountPct: 10, checklistTemplateId: "chk_audit", active: true },
  { id: "pln_smart", name: "Smart Controller Optimization", description: "Monthly remote review of smart controller data with seasonal on-site tune-up.", price: 29, billing: "monthly", frequency: "seasonal", visitsPerYear: 2, includedServices: ["Monthly remote schedule review", "Flow alert monitoring", "2 on-site tune-ups"], discountPct: 10, active: true },
  { id: "pln_commercial", name: "Commercial Monthly Maintenance", description: "Monthly walk-through for HOAs and commercial sites.", price: 325, billing: "monthly", frequency: "monthly", visitsPerYear: 12, includedServices: ["Monthly inspection", "Minor repairs up to 30 min", "Controller management", "Monthly report"], discountPct: 15, checklistTemplateId: "chk_maint", active: true },
];

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { id: "msg_omw", name: "On my way", channel: "sms", subject: "", body: "Hi {{first_name}}, this is {{tech_name}} with {{company}}. Your technician is on the way and should arrive in about {{eta}} minutes.", category: "on_my_way" },
  { id: "msg_est_ready", name: "Estimate ready", channel: "email", subject: "Your irrigation estimate from {{company}}", body: "Hi {{first_name}},\n\nYour estimate is ready. You can review options and approve online here: {{link}}\n\nThanks,\n{{company}}", category: "estimate" },
  { id: "msg_est_fu1", name: "Estimate follow-up #1", channel: "sms", subject: "", body: "Hi {{first_name}}, just checking in on the irrigation estimate we sent ({{estimate_total}}). Any questions? Reply here or approve online: {{link}}", category: "follow_up" },
  { id: "msg_est_fu2", name: "Estimate follow-up #2", channel: "email", subject: "Still interested in your irrigation project?", body: "Hi {{first_name}},\n\nWe wanted to follow up on your estimate. Our schedule is filling up — approve this week and we can usually start within 5–7 days.\n\n{{link}}", category: "follow_up" },
  { id: "msg_appt", name: "Appointment reminder", channel: "sms", subject: "", body: "Reminder: your irrigation service with {{company}} is scheduled for tomorrow, {{date}}, arrival window {{window}}. Reply C to confirm.", category: "appointment" },
  { id: "msg_inv", name: "Invoice sent", channel: "email", subject: "Invoice {{invoice_number}} from {{company}}", body: "Hi {{first_name}},\n\nThank you for your business. Your invoice for {{amount}} is ready: {{link}}", category: "invoice" },
  { id: "msg_inv_overdue", name: "Invoice overdue", channel: "email", subject: "Your invoice is overdue", body: "Hi {{first_name}},\n\nYour invoice {{invoice_number}} for {{balance}} is overdue. You can pay securely online here: {{link}}", category: "invoice" },
  { id: "msg_review", name: "Review request", channel: "sms", subject: "", body: "Thanks for choosing {{company}}, {{first_name}}! If we did a great job, would you leave us a quick review? {{review_link}}", category: "review" },
  { id: "msg_maint", name: "Maintenance reminder", channel: "sms", subject: "", body: "Hi {{first_name}}, your {{plan_name}} visit is coming up. Reply with a day that works or book online: {{link}}", category: "maintenance" },
];

export const AUTOMATIONS: Automation[] = [
  { id: "aut_fu1", name: "Estimate follow-up (2 days)", description: "If an estimate has not been approved after 2 days, send a follow-up text.", trigger: "estimate_sent", delayDays: 2, condition: "not_approved", action: "send_message", templateId: "msg_est_fu1", enabled: true },
  { id: "aut_fu2", name: "Estimate follow-up (5 days)", description: "After 5 days, send a second follow-up email.", trigger: "estimate_sent", delayDays: 5, condition: "not_approved", action: "send_message", templateId: "msg_est_fu2", enabled: true },
  { id: "aut_invoice", name: "Invoice on job completion", description: "When a job is completed, generate a draft invoice.", trigger: "job_completed", delayDays: 0, condition: "always", action: "create_invoice", enabled: true },
  { id: "aut_inv_rem", name: "Invoice reminder (7 days)", description: "If an invoice is unpaid 7 days after it was sent, send a reminder.", trigger: "invoice_sent", delayDays: 7, condition: "unpaid", action: "send_message", templateId: "msg_inv_overdue", enabled: true },
  { id: "aut_review", name: "Review request after repair", description: "When a repair is completed, send a review request the next day.", trigger: "repair_completed", delayDays: 1, condition: "always", action: "send_message", templateId: "msg_review", enabled: true },
  { id: "aut_audit", name: "Annual audit reminder", description: "When an annual audit is due, create a reminder.", trigger: "audit_due", delayDays: 0, condition: "always", action: "create_reminder", enabled: true },
  { id: "aut_inventory", name: "Low inventory purchase alert", description: "If inventory falls below minimum, create a purchase alert.", trigger: "inventory_low", delayDays: 0, condition: "always", action: "create_purchase_alert", enabled: true },
  { id: "aut_lead", name: "New lead alert", description: "Notify the office when a new lead arrives.", trigger: "lead_created", delayDays: 0, condition: "always", action: "notify", enabled: true },
  { id: "aut_appt", name: "Appointment reminder", description: "Text customers the day before a scheduled job.", trigger: "appointment_tomorrow", delayDays: 0, condition: "always", action: "send_message", templateId: "msg_appt", enabled: true },
  { id: "aut_plan", name: "Maintenance visit due", description: "Remind plan customers 7 days before their next visit.", trigger: "plan_visit_due", delayDays: 0, condition: "always", action: "send_message", templateId: "msg_maint", enabled: false },
  { id: "aut_backflow", name: "Backflow test due", description: "Notify when an annual backflow test is due.", trigger: "backflow_test_due", delayDays: 0, condition: "always", action: "notify", enabled: true },
];

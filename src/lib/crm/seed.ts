/**
 * Demo dataset: ~12 months of realistic operating history for a 3-truck
 * irrigation contractor in Riverside County, CA. Deterministic (seeded RNG) and
 * relative to "now", so dashboards always show current activity.
 */
import type {
  ActivityLog,
  Appointment,
  AuditReport,
  Campaign,
  ChangeOrder,
  Controller,
  CrmData,
  CrmDocument,
  CrmSettings,
  Customer,
  Employee,
  Estimate,
  EstimateOption,
  InstallProject,
  InventoryItem,
  InventoryTxn,
  Invoice,
  IrrigationSystem,
  Job,
  JobStatus,
  Lead,
  LeadSource,
  LeadStage,
  LineItem,
  Message,
  Notification,
  Payment,
  PaymentMethod,
  Photo,
  PlanSubscription,
  Property,
  ServiceType,
  TimeEntry,
  Truck,
  TruckStock,
  Warranty,
  Zone,
  ZoneArea,
  ZoneStatus,
} from "./types";
import { emptyData } from "./types";
import { AUTOMATIONS, CHECKLISTS, MESSAGE_TEMPLATES, SERVICE_PLANS, VENDORS, priceBook } from "./catalog";
import { defaultSettings, estimateTemplates, estimateToJob, lineFromItem, optionsFromTemplate, schematicMap, customLine, generateTakeoff, jobToInvoice, checklistFor } from "./workflows";
import { estimateTotal, invoiceTotals, lineTotals, optionTotals, r2 } from "./calc";
import { isoDate } from "./format";

/* ───────────────────────── RNG ───────────────────────── */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rnd = mulberry32(20261003);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;
function wpick<T extends string>(w: Record<T, number>): T {
  const entries = Object.entries(w) as [T, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let x = rnd() * total;
  for (const [k, v] of entries) if ((x -= v) <= 0) return k;
  return entries[0][0];
}
let seq = 0;
const id = (p: string) => `${p}_${(++seq).toString(36).padStart(5, "0")}`;

/* ───────────────────────── Reference data ───────────────────────── */

const FIRST = ["James", "Mary", "Robert", "Patricia", "Michael", "Jennifer", "David", "Linda", "William", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen", "Daniel", "Nancy", "Matthew", "Lisa", "Anthony", "Betty", "Mark", "Sandra", "Steven", "Ashley", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna", "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "Carlos", "Gabriela", "Jose", "Maria", "Juan", "Rosa", "Miguel", "Elena", "Wei", "Mei", "Raj", "Anita", "Hiroshi", "Yuki", "Omar", "Leila", "Trevor", "Brooke", "Derek", "Natalie", "Victor", "Denise", "Ramon", "Claudia", "Grant", "Tara"];
const LAST = ["Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Chen", "Patel", "Kowalski", "Fischer", "Sullivan", "Bennett", "Ortiz", "Vasquez", "Castillo", "Reyes", "Morales", "Gutierrez", "Henderson", "Coleman", "Jenkins", "Perry", "Powell", "Long", "Hughes", "Price", "Myers", "Ford", "Hamilton", "Graham", "Wallace", "Woods", "Cole", "West", "Jordan", "Owens", "Reynolds", "Ellis"];
const STREETS = ["Vista Grande Dr", "Maple Ridge Ct", "Sycamore Ln", "Canyon Crest Dr", "Victoria Ave", "Arlington Ave", "Magnolia Ave", "Mission Grove Pkwy", "Alessandro Blvd", "Overlook Pkwy", "Ridgeview Dr", "Sierra Vista Ln", "Rancho California Rd", "Meadowview Dr", "Paseo del Sol", "Pala Mesa Dr", "Avenida Rio Pinar", "Calle Medusa", "Green Valley Pkwy", "Main St", "Ontario Ave", "Mountain Gate Dr", "Lincoln Ave", "Hidden Valley Pkwy", "Citrus Ave", "Orange Grove Ave", "Jurupa Ave", "Golden Ave", "Hamner Ave", "Riverview Dr", "Crestview Dr", "Willow Springs Rd", "Quail Run Rd", "Hawk Ridge Ct", "Silver Oak Way", "Butterfield Stage Rd", "Pechanga Pkwy", "Clinton Keith Rd", "Los Alamos Rd", "Whitewood Rd", "Railroad Canyon Rd", "Grand Ave", "Lakeshore Dr", "Newport Rd", "Scott Rd", "Iris Ave", "Heacock St", "Sunnymead Ranch Pkwy", "Kitching St", "Cactus Ave"];
const CITIES: [string, string[]][] = [
  ["Riverside", ["92503", "92504", "92506", "92508"]],
  ["Corona", ["92880", "92881", "92882"]],
  ["Temecula", ["92591", "92592"]],
  ["Murrieta", ["92562", "92563"]],
  ["Norco", ["92860"]],
  ["Eastvale", ["92880"]],
  ["Moreno Valley", ["92555", "92557"]],
  ["Menifee", ["92584"]],
  ["Lake Elsinore", ["92532"]],
  ["Canyon Lake", ["92587"]],
];
const SOURCE_W: Record<LeadSource, number> = { google: 22, google_ads: 18, referral: 15, repeat: 0, yelp: 8, facebook: 6, door_hanger: 6, yard_sign: 4, website: 9, instagram: 2, other: 2 };

/* ───────────────────────── Builders ───────────────────────── */

const DAY = 86400000;

export interface SeedResult {
  data: CrmData;
  settings: CrmSettings;
}

export function generateSeed(nowMs = Date.now()): SeedResult {
  rnd = mulberry32(20261003);
  seq = 0;
  const now = new Date(nowMs);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const at = (daysAgo: number, hour = 9, min = 0) => {
    const d = new Date(today.getTime() - daysAgo * DAY);
    d.setHours(Math.floor(hour), min + Math.round((hour % 1) * 60), 0, 0);
    return d;
  };
  const iso = (d: Date) => d.toISOString();
  const settings = defaultSettings();
  const D = emptyData();
  const items = priceBook();
  const itemById = new Map(items.map((i) => [i.id, i]));
  const it = (k: string) => itemById.get(k)!;
  const L = (k: string, qty: number, over: Partial<LineItem> = {}) => lineFromItem(it(k), qty, over);

  D.items = items;
  D.vendors = VENDORS;
  D.checklistTemplates = CHECKLISTS;
  D.servicePlans = SERVICE_PLANS;
  D.messageTemplates = MESSAGE_TEMPLATES;
  D.automations = AUTOMATIONS;
  const templates = estimateTemplates(items);
  D.estimateTemplates = templates;
  const tpl = (k: string) => templates.find((t) => t.id === k)!;

  /* employees & trucks */
  const emp = (i: string, firstName: string, lastName: string, role: Employee["role"], payRate: number, color: string, extra: Partial<Employee> = {}): Employee => ({
    id: i,
    firstName,
    lastName,
    role,
    phone: `(951) 555-${String(int(1000, 9999))}`,
    email: `${firstName.toLowerCase()}@deltaline.example`,
    color,
    payType: "hourly",
    payRate,
    commissionPct: 0,
    certifications: [],
    hireDate: isoDate(at(int(200, 2400))),
    active: true,
    workDays: [1, 2, 3, 4, 5, 6],
    shiftStart: "07:00",
    shiftEnd: "15:30",
    ...extra,
  });
  D.employees = [
    emp("emp_dan", "Dan", "Whitaker", "owner", 95000, "#475569", { payType: "salary", hireDate: "2014-03-01", certifications: [{ name: "CA C-27 Landscaping Contractor", number: "1048821" }, { name: "IA Certified Irrigation Contractor (CIC)" }] }),
    emp("emp_rosa", "Rosa", "Delgado", "office", 26, "#be185d", { workDays: [1, 2, 3, 4, 5], shiftStart: "08:00", shiftEnd: "16:30" }),
    emp("emp_marcus", "Marcus", "Chen", "estimator", 32, "#7c3aed", { commissionPct: 3, certifications: [{ name: "IA Certified Landscape Irrigation Auditor (CLIA)", expires: isoDate(at(-420)) }] }),
    emp("emp_jake", "Jake", "Morales", "crew_lead", 34, "#0f6490", { truckId: "trk_1", commissionPct: 1, certifications: [{ name: "ABPA Backflow Tester", number: "BT-22841", expires: isoDate(at(-35)) }, { name: "Hunter Industries Certified Pro" }] }),
    emp("emp_tyler", "Tyler", "Brooks", "technician", 27, "#0d9488", { truckId: "trk_2", certifications: [{ name: "Rain Bird Academy — Troubleshooting" }] }),
    emp("emp_luis", "Luis", "Ortega", "technician", 28.5, "#ea580c", { truckId: "trk_3", certifications: [{ name: "Hunter Hydrawise Certified" }, { name: "OSHA 10" }] }),
    emp("emp_ethan", "Ethan", "Park", "helper", 19, "#65a30d", {}),
  ];
  const TECHS = ["emp_jake", "emp_tyler", "emp_luis"];
  D.trucks = [
    { id: "trk_1", name: "Truck 1", vehicle: "2021 Ford F-250 w/ utility body", plate: "8XKD214", employeeId: "emp_jake" },
    { id: "trk_2", name: "Truck 2", vehicle: "2019 Chevy Silverado 2500", plate: "8RTL551", employeeId: "emp_tyler" },
    { id: "trk_3", name: "Truck 3", vehicle: "2022 Ford Transit 250", plate: "9BCW083", employeeId: "emp_luis" },
  ] satisfies Truck[];

  /* campaigns */
  const camp = (i: string, name: string, source: Campaign["source"], start: number, spend: number, notes: string, end?: number): Campaign => ({ id: i, name, source, startDate: isoDate(at(start)), endDate: end !== undefined ? isoDate(at(end)) : undefined, spend, notes, active: end === undefined || end < 0 });
  D.campaigns = [
    camp("cmp_gads_spring", "Google Ads — Spring Repairs", "google_ads", 210, 6400, "Search campaign: sprinkler repair, valve repair, leak repair. $35/day."),
    camp("cmp_gads_smart", "Google Ads — Smart Controller Rebate", "google_ads", 120, 1850, "Targets water district rebate searches (Western MWD / EMWD).", -30),
    camp("cmp_doorhang", "Door Hangers — Temecula Wine Country", "door_hanger", 160, 1150, "4,000 hangers, two drops. Offer: free controller check."),
    camp("cmp_signs", "Yard Signs", "yard_sign", 330, 420, "Left at completed install sites for 2 weeks."),
    camp("cmp_fb_drip", "Facebook Ads — Drip Conversion", "facebook", 140, 1600, "Before/after carousel; turf-to-drip rebates.", 20),
    camp("cmp_referral", "Referral Program", "referral", 365, 900, "$50 credit per referred job (credits issued)."),
    camp("cmp_seo", "SEO & Google Business Profile", "seo", 365, 4200, "Agency retainer $350/mo."),
    camp("cmp_yelp", "Yelp Ads", "yelp", 300, 1500, "Paused in summer.", 90),
  ];
  const campaignFor = (s: LeadSource): string | undefined =>
    s === "google_ads" ? "cmp_gads_spring" : s === "door_hanger" ? "cmp_doorhang" : s === "yard_sign" ? "cmp_signs" : s === "facebook" ? "cmp_fb_drip" : s === "referral" ? "cmp_referral" : s === "google" ? "cmp_seo" : s === "yelp" ? "cmp_yelp" : undefined;

  /* activity helper */
  const act = (type: ActivityLog["type"], message: string, entityType: ActivityLog["entityType"], entityId: string, when: Date, extra: Partial<ActivityLog> = {}) => D.activity.push({ id: id("act"), type, message, entityType, entityId, at: iso(when), ...extra });

  /* ───────── customers, properties, systems ───────── */

  const usedNames = new Set<string>();
  function randomName() {
    for (;;) {
      const f = pick(FIRST);
      const l = pick(LAST);
      if (!usedNames.has(f + l)) {
        usedNames.add(f + l);
        return [f, l];
      }
    }
  }
  function randomAddress() {
    const [city, zips] = pick(CITIES);
    return { street: `${int(100, 39999)} ${pick(STREETS)}`, city, state: "CA", zip: pick(zips) };
  }

  type Era = "old" | "mid" | "new";
  type Equip = { valve: string[]; rotor: readonly [string, string]; spray: readonly [string, string]; nozzle: string; controller: [string, string][] };
  const EQUIP: Record<Era, Equip> = {
    old: { valve: ["Irritrol 2400", "Orbit Anti-Siphon", "Rain Bird ASVF (anti-siphon)", "Lawn Genie 3/4\""], rotor: ["Hunter", "PGP (original)"], spray: ["Rain Bird", "1804"], nozzle: "Fixed 15-series", controller: [["Orbit", "6-Station Easy Dial"], ["Rain Bird", "ESP-Modular"], ["Hunter", "SRC-600"], ["Irritrol", "RD-600"]] },
    mid: { valve: ["Hunter PGV-101G", "Rain Bird 100-DV", "Rain Bird 100-DVF"], rotor: ["Rain Bird", "5000 Plus PC"], spray: ["Rain Bird", "1804"], nozzle: "HE-VAN 15", controller: [["Hunter", "Pro-C 12"], ["Rain Bird", "ESP-TM2 12-Station"], ["Hunter", "X-Core 8"]] },
    new: { valve: ["Hunter PGV-101G", "Hunter PGV-100JT-G", "Hunter ICV-101G"], rotor: ["Hunter", "PGP Ultra"], spray: ["Hunter", "Pro-Spray PRS40"], nozzle: "MP Rotator MP2000", controller: [["Hunter", "Hydrawise HPC-400"], ["Hunter", "Pro-HC 12 (Hydrawise)"], ["Rachio", "3 (8-zone)"], ["Rain Bird", "ESP-TM2 + LNK2 WiFi"]] },
  };
  const ZONE_NAMES: [string, ZoneArea][] = [
    ["Front Lawn", "lawn"],
    ["Front Beds", "beds"],
    ["Parkway", "lawn"],
    ["Back Lawn", "lawn"],
    ["Back Beds", "beds"],
    ["Side Yard", "drip"],
    ["Back Lawn East", "lawn"],
    ["Trees — Drip", "trees"],
    ["Slope", "slope"],
    ["Planters — Drip", "drip"],
    ["Citrus Drip", "trees"],
    ["Side Yard East", "beds"],
  ];

  function buildSystem(p: Property, era: Era, zoneCount: number, opts: { issues?: ZoneStatus[][]; rotorBrand?: "rb5000" | "pgp"; controller?: [string, string]; ctrlYear?: number; withMap?: boolean } = {}) {
    const sys: IrrigationSystem = { id: id("sys"), propertyId: p.id, name: "Main system", installedYear: p.systemInstalledYear, notes: "", mapWidth: 1000, mapHeight: 700, mapFtPerUnit: 0.15 };
    D.systems.push(sys);
    const eq = EQUIP[era];
    const [cm, cmod] = opts.controller ?? pick(eq.controller);
    const smart = /hydrawise|rachio|lnk2|wifi/i.test(cmod);
    const ctrl: Controller = { id: id("ctl"), systemId: sys.id, manufacturer: cm, model: cmod, stations: Math.max(zoneCount, cmod.match(/(\d+)/) ? Math.max(zoneCount, 6) : 6), location: pick(["Garage — left wall", "Garage — next to water heater", "Side of house by meter", "Exterior wall, east side", "Pump room"]), smart, wifi: smart, rainSensor: smart || chance(0.2), installedDate: opts.ctrlYear ? `${opts.ctrlYear}-0${int(1, 9)}-1${int(0, 9)}` : p.systemInstalledYear ? `${p.systemInstalledYear}-05-15` : undefined, notes: "" };
    D.controllers.push(ctrl);
    const valveLoc = pick(["Manifold left of garage, 14×19 box", "Manifold by side gate (2 boxes)", "Front planter bed near hose bib", "Behind AC unit, round boxes", "Under rosemary along driveway"]);
    for (let n = 1; n <= zoneCount; n++) {
      const [name, area] = ZONE_NAMES[(n - 1) % ZONE_NAMES.length];
      const isLawn = area === "lawn" || area === "slope";
      const isDrip = area === "drip" || area === "trees";
      const useRotor = isLawn && (zoneCount >= 6 || p.lotSizeSqft! > 9000) && n % 2 === 1;
      const rotor: readonly [string, string] = opts.rotorBrand === "rb5000" ? ["Rain Bird", "5000 Plus PC"] : opts.rotorBrand === "pgp" ? ["Hunter", "PGP Ultra"] : eq.rotor;
      const heads = isDrip ? 0 : useRotor ? int(5, 9) : int(7, 16);
      const z: Zone = {
        id: id("zon"),
        systemId: sys.id,
        number: n,
        name: n > ZONE_NAMES.length ? `${name} ${Math.ceil(n / ZONE_NAMES.length)}` : name,
        area,
        valveType: isDrip && era !== "old" ? "Rain Bird XCZ-100-PRB-COM" : pick(eq.valve),
        valveSize: isDrip ? "1\"" : era === "old" ? "3/4\"" : "1\"",
        valveLocation: valveLoc,
        pipeSize: isDrip ? "1/2\" poly" : "3/4\"",
        pipeMaterial: isDrip ? "Poly tubing" : era === "old" ? "PVC Class 200" : "PVC SCH 40",
        flowGpm: isDrip ? r2(int(15, 45) / 10) : useRotor ? r2(heads * (2.4 + rnd())) : r2(heads * (era === "new" ? 0.45 : 1.3)),
        operatingPsi: isDrip ? 30 : useRotor ? int(40, 55) : int(30, 48),
        sprinklerType: isDrip ? "Drip" : useRotor ? "Rotor" : era === "new" ? "MP Rotator" : "Spray",
        nozzleType: isDrip ? "" : useRotor ? (rotor[0] === "Hunter" ? `#${int(5, 8)} Blue` : `${pick(["2.0", "2.5", "3.0"])} GPM`) : eq.nozzle,
        headCount: heads,
        headSpacingFt: isDrip ? undefined : useRotor ? int(28, 38) : int(10, 15),
        manufacturer: isDrip ? (era === "new" ? "Rain Bird" : "Netafim") : useRotor ? rotor[0] : eq.spray[0],
        model: isDrip ? (era === "new" ? "XFS Dripline" : "Techline CV") : useRotor ? rotor[1] : era === "new" ? "MP2000 on PRS40" : eq.spray[1],
        dripEmitterType: isDrip ? (area === "trees" ? "1 GPH PC emitters (2/tree)" : "Inline 0.6 GPH") : "",
        dripLineType: isDrip ? (era === "new" ? "Rain Bird XFS 0.6 GPH @ 12\"" : "Netafim Techline CV 0.6 GPH @ 12\"") : "",
        controllerStation: n,
        statuses: opts.issues?.[n - 1] ?? ["working"],
        problems: "",
        notes: "",
        installedDate: p.systemInstalledYear ? `${p.systemInstalledYear}-05-15` : undefined,
      };
      if (z.statuses.includes("leaking")) z.problems = "Wet spot near head 3 — likely cracked swing joint.";
      if (z.statuses.includes("valve_issue")) z.problems = "Valve weeps when off; diaphragm worn.";
      if (z.statuses.includes("poor_coverage")) z.problems = "Brown spots on south edge; mismatched nozzles.";
      if (z.statuses.includes("low_pressure")) z.problems = "Heads not fully popping up — too many heads for available flow.";
      D.zones.push(z);
    }
    if (opts.withMap) D.components.push(...schematicMap(sys, D.zones.filter((z) => z.systemId === sys.id), ctrl));
    return sys;
  }

  function addCustomer(c: Partial<Customer> & { firstName: string; lastName: string }, createdDaysAgo: number): Customer {
    const src = c.leadSource ?? wpick(SOURCE_W);
    const cu: Customer = {
      id: id("cus"),
      type: "residential",
      phone: `(951) 555-${String(int(1000, 9999))}`,
      email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase().replace(/[^a-z]/g, "")}@${pick(["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "aol.com"])}`,
      billingAddress: randomAddress(),
      leadSource: src,
      campaignId: campaignFor(src),
      tags: [],
      notes: "",
      preferredContact: pick(["call", "text", "text", "email"]),
      portalEnabled: chance(0.6),
      createdAt: iso(at(createdDaysAgo, int(8, 17))),
      ...c,
    };
    D.customers.push(cu);
    return cu;
  }
  function addProperty(cu: Customer, p: Partial<Property> = {}, era?: Era, zoneCount?: number, sysOpts: Parameters<typeof buildSystem>[3] = {}): Property {
    const year = p.systemInstalledYear ?? (era === "old" ? int(1986, 2004) : era === "new" ? int(2018, 2025) : int(2005, 2017));
    const e: Era = era ?? (year < 2005 ? "old" : year < 2018 ? "mid" : "new");
    const lot = p.lotSizeSqft ?? int(5500, 14000);
    const pr: Property = {
      id: id("prp"),
      customerId: cu.id,
      name: "Home",
      address: cu.billingAddress,
      lotNotes: "",
      lotSizeSqft: lot,
      gateCode: chance(0.35) ? `#${int(1000, 9999)}` : "",
      accessNotes: pick(["Side gate on left (latch sticks)", "Back gate code on keypad", "Access through garage — customer home", "Side gate unlocked", "Call on arrival", ""]),
      pets: pick(["", "", "Dog in backyard — friendly lab", "2 dogs — keep gate closed!", "Cat indoors", ""]),
      landscapeNotes: pick(["Fescue lawn front & back, roses along walk", "Bermuda lawn, citrus trees in back", "St. Augustine lawn, drought-tolerant front", "Artificial turf in back, drip beds", "Mature oaks — watch roots near laterals", "Kikuyu lawn, slope with ice plant"]),
      waterSource: "municipal",
      meterSize: pick(["5/8\"", "3/4\"", "3/4\"", "1\""]),
      serviceLineSize: pick(["3/4\"", "1\""]),
      mainLineSize: e === "old" ? "3/4\"" : "1\"",
      mainLineMaterial: e === "old" ? "PVC Class 315" : "PVC SCH 40",
      staticPsi: int(55, 95),
      dynamicPsi: undefined,
      availableGpm: r2(int(90, 220) / 10),
      backflow: { type: pick(["pvb", "pvb", "rp", "avb"]), make: pick(["Febco 765", "Wilkins 720A", "Watts 800M4", "Zurn 975XL"]), size: "1\"", location: "Front planter by hose bib", serial: `S${int(100000, 999999)}`, lastTestDate: chance(0.5) ? isoDate(at(int(30, 500))) : undefined },
      controllerLocation: "",
      valveLocations: "",
      systemInstalledYear: year,
      recommendedUpgrades: [],
      createdAt: cu.createdAt,
      ...p,
    };
    pr.dynamicPsi = pr.dynamicPsi ?? (pr.staticPsi ? pr.staticPsi - int(12, 22) : undefined);
    D.properties.push(pr);
    const zc = zoneCount ?? (lot > 11000 ? int(8, 11) : lot > 8000 ? int(6, 8) : int(4, 6));
    const sys = buildSystem(pr, e, zc, sysOpts);
    const ctrl = D.controllers.find((c) => c.systemId === sys.id)!;
    pr.controllerLocation = ctrl.location;
    pr.valveLocations = D.zones.find((z) => z.systemId === sys.id)?.valveLocation ?? "";
    if (e === "old") pr.recommendedUpgrades.push("Smart controller", "Replace anti-siphon valves");
    if (!ctrl.smart && e !== "old") pr.recommendedUpgrades.push("Smart controller");
    if (pr.staticPsi && pr.staticPsi > 80) pr.recommendedUpgrades.push("Pressure regulator");
    return pr;
  }

  /* ───────── featured customers (story-driven) ───────── */

  const F: Record<string, { c: Customer; p: Property }> = {};
  const feature = (key: string, c: Partial<Customer> & { firstName: string; lastName: string }, created: number, p: Partial<Property>, era: Era, zones: number, sysOpts: Parameters<typeof buildSystem>[3] = {}) => {
    const cu = addCustomer(c, created);
    const pr = addProperty(cu, { address: cu.billingAddress, ...p }, era, zones, { withMap: true, ...sysOpts });
    F[key] = { c: cu, p: pr };
    return F[key];
  };
  feature("hernandez", { firstName: "Maria", lastName: "Hernandez", phone: "(951) 555-0120", email: "maria.hernandez@gmail.com", billingAddress: { street: "1842 Vista Grande Dr", city: "Riverside", state: "CA", zip: "92506" }, leadSource: "google_ads", campaignId: "cmp_gads_spring", tags: ["High Value"], notes: "Wants smart controller and minimal overspray onto driveway and patio. Prefers texts after 5 PM." }, 12, { lotSizeSqft: 15000, gateCode: "#4417", pets: "Golden retriever (Max) — friendly", staticPsi: 72, dynamicPsi: 58, availableGpm: 16, systemInstalledYear: 1994, landscapeNotes: "Old lawn being regraded. New front design with fescue + drip beds." }, "old", 3);
  feature("smith", { firstName: "John", lastName: "Smith", phone: "(951) 555-0121", email: "jksmith@outlook.com", billingAddress: { street: "412 Maple Ridge Ct", city: "Temecula", state: "CA", zip: "92591" }, leadSource: "referral", campaignId: "cmp_referral", tags: ["High Value"], notes: "Spouse: Karen. Large lawns front and back. Referred by the Walsh family." }, 34, { lotSizeSqft: 16500, staticPsi: 68, dynamicPsi: 54, availableGpm: 18, systemInstalledYear: 2026, landscapeNotes: "New construction landscape — sod going in after irrigation." }, "new", 9, { rotorBrand: "pgp" });
  feature("martinez", { firstName: "Luis", lastName: "Martinez", phone: "(951) 555-0122", billingAddress: { street: "88 Sycamore Ln", city: "Corona", state: "CA", zip: "92882" }, leadSource: "yelp", campaignId: "cmp_yelp" }, 21, { lotSizeSqft: 9600, staticPsi: 60, dynamicPsi: 47, systemInstalledYear: 2001 }, "old", 5, { issues: [["poor_coverage"], ["working"], ["leaking"], ["working"], ["clogged"]] });
  feature("oakview", { firstName: "Patricia", lastName: "Gomez", company: "Oak View HOA", type: "hoa", phone: "(951) 555-0123", email: "board@oakviewhoa.example", billingAddress: { street: "2200 Oak View Pkwy", city: "Murrieta", state: "CA", zip: "92562" }, leadSource: "referral", tags: ["VIP", "Commercial", "Maintenance Plan", "High Value"], notes: "Contact: Patricia Gomez (community manager, Keystone Mgmt). Board approves work > $2,500. Invoices to management company." }, 380, { name: "Main entry & common areas", lotSizeSqft: 82000, staticPsi: 82, dynamicPsi: 66, availableGpm: 38, systemInstalledYear: 2009, meterSize: "1-1/2\"", mainLineSize: "1-1/2\"", backflow: { type: "rp", make: "Wilkins 975XL", size: "1-1/2\"", location: "Entry island, cage", serial: "AX22841", lastTestDate: isoDate(at(352)) } }, "mid", 16, { controller: ["Hunter", "ACC2 (Centralus)"] });
  feature("patterson", { firstName: "Greg", lastName: "Patterson", phone: "(951) 555-0124", email: "gpatterson88@aol.com", billingAddress: { street: "5521 Ridgeview Dr", city: "Riverside", state: "CA", zip: "92506" }, leadSource: "google", campaignId: "cmp_seo", tags: ["Repeat Customer", "Needs Follow-Up"], notes: "Wife: Linda. Original 1988 system — repeated breaks in back lawn zones. Discussed zone rebuild." }, 360, { lotSizeSqft: 12800, staticPsi: 88, dynamicPsi: 70, systemInstalledYear: 1988, landscapeNotes: "Mature ficus & pine — roots crushing laterals in back lawn." }, "old", 7, { controller: ["Orbit", "6-Station Easy Dial"], ctrlYear: 2008, issues: [["working"], ["working"], ["working"], ["leaking", "poor_coverage"], ["broken"], ["working"], ["valve_issue"]] });
  feature("natarajan", { firstName: "Priya", lastName: "Natarajan", phone: "(951) 555-0199", email: "priya.n@gmail.com", billingAddress: { street: "17 Canyon Crest Rd", city: "Riverside", state: "CA", zip: "92507" }, leadSource: "website", tags: [] }, 2, { lotSizeSqft: 7200, systemInstalledYear: 2006 }, "mid", 5);
  feature("kim", { firstName: "Robert", lastName: "Kim", phone: "(951) 555-0125", billingAddress: { street: "940 Silver Oak Way", city: "Corona", state: "CA", zip: "92881" }, leadSource: "google_ads", campaignId: "cmp_gads_spring" }, 16, { lotSizeSqft: 8800, staticPsi: 92, dynamicPsi: 74, systemInstalledYear: 2003 }, "old", 6);
  feature("alvarez", { firstName: "Stephanie", lastName: "Alvarez", phone: "(951) 555-0126", billingAddress: { street: "33 Paseo del Sol", city: "Temecula", state: "CA", zip: "92592" }, leadSource: "door_hanger", campaignId: "cmp_doorhang", tags: ["Maintenance Plan"] }, 150, { systemInstalledYear: 2011 }, "mid", 6);
  feature("cornerstone", { firstName: "Kevin", lastName: "O'Brien", company: "Cornerstone Property Management", type: "property_manager", phone: "(951) 555-0127", email: "kobrien@cornerstonepm.example", billingAddress: { street: "3900 Market St, Suite 210", city: "Riverside", state: "CA", zip: "92501" }, leadSource: "referral", tags: ["Commercial", "Repeat Customer"], notes: "Manages Desert Willow Apts + 2 retail centers. PO number required on every invoice." }, 300, { name: "Desert Willow Apartments", address: { street: "1550 W Blaine St", city: "Riverside", state: "CA", zip: "92507" }, lotSizeSqft: 54000, systemInstalledYear: 2004, meterSize: "1-1/2\"", mainLineSize: "1-1/2\"", accessNotes: "Check in at leasing office. Pool area code #2580." }, "old", 14);
  feature("nguyen", { firstName: "Tom", lastName: "Nguyen", phone: "(951) 555-0128", billingAddress: { street: "7731 Hawk Ridge Ct", city: "Eastvale", state: "CA", zip: "92880" }, leadSource: "google_ads", campaignId: "cmp_gads_smart", notes: "Spouse: Jessica. Applying for Western MWD smart controller rebate — needs photos of old & new controller." }, 9, { systemInstalledYear: 2009 }, "mid", 7, { controller: ["Hunter", "X-Core 8"] });
  feature("russo", { firstName: "Frank", lastName: "Russo", phone: "(951) 555-0129", billingAddress: { street: "212 Quail Run Rd", city: "Norco", state: "CA", zip: "92860" }, leadSource: "yelp", campaignId: "cmp_yelp", tags: ["Problem Customer"], notes: "Disputed last invoice. Get signature before starting any extra work. Do not extend terms." }, 120, { systemInstalledYear: 1999, pets: "Horses — close pasture gate!" }, "old", 5);
  feature("reyes", { firstName: "Ana Sofia", lastName: "Reyes", phone: "(951) 555-0130", billingAddress: { street: "4410 Mission Grove Pkwy", city: "Riverside", state: "CA", zip: "92508" }, leadSource: "instagram", tags: ["VIP", "Maintenance Plan"], notes: "Interior designer — refers clients. Very particular about overspray on new stucco." }, 240, { lotSizeSqft: 10400, systemInstalledYear: 2016 }, "new", 8);
  feature("thompson", { firstName: "Bill", lastName: "Thompson", phone: "(951) 555-0131", billingAddress: { street: "18800 Los Alamos Rd", city: "Murrieta", state: "CA", zip: "92562" }, leadSource: "google", campaignId: "cmp_seo", tags: ["High Value"], notes: "1-acre lot, big lawn. Rain Bird 5000 rotors throughout." }, 200, { lotSizeSqft: 43000, staticPsi: 64, dynamicPsi: 50, availableGpm: 22, systemInstalledYear: 2012, waterSource: "municipal" }, "mid", 12, { rotorBrand: "rb5000" });
  feature("dental", { firstName: "Dr. Helen", lastName: "Park", company: "Canyon Lake Family Dental", type: "commercial", phone: "(951) 555-0132", email: "office@canyonlakedental.example", billingAddress: { street: "31620 Railroad Canyon Rd", city: "Canyon Lake", state: "CA", zip: "92587" }, leadSource: "website", tags: ["Commercial", "Maintenance Plan"] }, 280, { name: "Office building", lotSizeSqft: 18000, systemInstalledYear: 2015, accessNotes: "Service before 8 AM or after 5 PM only (patients)." }, "mid", 6, { controller: ["Hunter", "Hydrawise HPC-400"] });
  feature("carter", { firstName: "Michelle", lastName: "Carter", phone: "(951) 555-0133", billingAddress: { street: "26 Willow Springs Rd", city: "Menifee", state: "CA", zip: "92584" }, leadSource: "facebook", campaignId: "cmp_fb_drip" }, 14, { systemInstalledYear: 2014 }, "mid", 5);
  feature("walsh", { firstName: "David", lastName: "Walsh", phone: "(951) 555-0134", billingAddress: { street: "39120 Butterfield Stage Rd", city: "Temecula", state: "CA", zip: "92592" }, leadSource: "yard_sign", campaignId: "cmp_signs", tags: ["High Value", "Repeat Customer"], notes: "Spouse: Erin. Full new system installed — happy customer, referred the Smiths." }, 75, { lotSizeSqft: 14200, systemInstalledYear: 2026, staticPsi: 70, dynamicPsi: 56 }, "new", 10);
  feature("okafor", { firstName: "Samuel", lastName: "Okafor", phone: "(951) 555-0135", billingAddress: { street: "1202 Hamner Ave", city: "Norco", state: "CA", zip: "92860" }, leadSource: "google" }, 40, { systemInstalledYear: 2007 }, "mid", 6);
  feature("brooks", { firstName: "Heather", lastName: "Brooks", phone: "(951) 555-0136", billingAddress: { street: "655 Clinton Keith Rd", city: "Murrieta", state: "CA", zip: "92563" }, leadSource: "google_ads", campaignId: "cmp_gads_spring" }, 5, { systemInstalledYear: 2010 }, "mid", 6, { issues: [["working"], ["working"], ["leaking"], ["working"], ["working"], ["working"]] });

  // extra properties for multi-property customers
  const oakClub = addProperty(F.oakview.c, { name: "Clubhouse & pool", address: { street: "2250 Oak View Pkwy", city: "Murrieta", state: "CA", zip: "92562" }, lotSizeSqft: 24000, systemInstalledYear: 2009, accessNotes: "Clubhouse key in lockbox #1188" }, "mid", 9, { controller: ["Hunter", "Pro-C 12"], withMap: true });
  const oakNorth = addProperty(F.oakview.c, { name: "North entry & slopes", address: { street: "24100 Oak View Pkwy N", city: "Murrieta", state: "CA", zip: "92562" }, lotSizeSqft: 36000, systemInstalledYear: 2009 }, "mid", 11, { controller: ["Hunter", "Pro-C 12"] });
  const cornerRetail = addProperty(F.cornerstone.c, { name: "Magnolia Plaza (retail)", address: { street: "8880 Magnolia Ave", city: "Riverside", state: "CA", zip: "92503" }, lotSizeSqft: 30000, systemInstalledYear: 2012 }, "mid", 8);
  void oakNorth;
  void cornerRetail;

  /* ───────── generic customer pool built from job history ───────── */

  const JOB_W: Partial<Record<ServiceType, number>> = { sprinkler_repair: 22, head_replacement: 10, valve_repair: 12, leak_repair: 8, main_line_repair: 5, lateral_repair: 7, diagnostics: 7, maintenance: 9, smart_controller: 6, drip_conversion: 4, system_audit: 2.5, backflow: 3, zone_addition: 1.5, reroute: 1.5, winterization: 2 };
  const TEMPLATE_FOR: Partial<Record<ServiceType, string>> = { sprinkler_repair: "tpl_repair", head_replacement: "tpl_heads", valve_repair: "tpl_valve", leak_repair: "tpl_lateral", main_line_repair: "tpl_main", lateral_repair: "tpl_lateral", smart_controller: "tpl_controller", drip_conversion: "tpl_drip", system_audit: "tpl_audit", backflow: "tpl_backflow", zone_addition: "tpl_zone", reroute: "tpl_reroute", new_install: "tpl_install" };
  const TITLES: Partial<Record<ServiceType, string[]>> = {
    sprinkler_repair: ["Sprinkler repair — broken heads front lawn", "Repair sprinklers, adjust coverage", "Zone not turning on + broken heads", "Geyser at back lawn — repair"],
    head_replacement: ["Replace 6 broken spray heads", "Replace rotors in back lawn", "Head replacement — mower damage"],
    valve_repair: ["Valve stuck on — zone 3", "Replace leaking anti-siphon valve", "Rebuild valve manifold", "Replace solenoid + diaphragm"],
    leak_repair: ["Leak at side yard", "Water bubbling in planter", "Soggy lawn — locate leak"],
    main_line_repair: ["Main line break — front yard", "Main line leak under walkway", "High water bill — main line leak"],
    lateral_repair: ["Lateral break from tree roots", "Repair lateral cut by landscaper", "Broken lateral — zone 5"],
    diagnostics: ["Diagnose zones not working", "Controller won't run zones", "System diagnostic — new homeowner"],
    maintenance: ["Quarterly irrigation check", "Seasonal maintenance visit", "Monthly HOA walk-through"],
    smart_controller: ["Install Hunter Hydrawise controller", "Smart controller upgrade (rebate)", "Rain Bird ESP-TM2 + WiFi install"],
    drip_conversion: ["Convert front beds to drip", "Drip conversion — side yard", "Turf removal: drip for new planting"],
    system_audit: ["Irrigation audit + report", "Water efficiency audit"],
    backflow: ["Backflow test & certification", "PVB leaking — rebuild", "Replace backflow preventer"],
    zone_addition: ["Add zone for new planter", "Add drip zone for raised beds"],
    reroute: ["Reroute lateral for new patio", "Reroute main around pool"],
    winterization: ["Winterization & schedule adjust", "Spring startup"],
  };
  const seasonal = (daysAgo: number) => {
    const m = at(daysAgo).getMonth();
    return [0.55, 0.6, 0.95, 1.25, 1.35, 1.4, 1.35, 1.25, 1.05, 0.9, 0.7, 0.5][m];
  };

  const pool: { c: Customer; p: Property }[] = Object.values(F).filter((x) => x.c.type === "residential" && !["natarajan", "brooks", "carter", "hernandez", "smith"].includes(Object.keys(F).find((k) => F[k] === x)!));
  const featuredHistory: { c: Customer; p: Property }[] = [F.oakview, F.cornerstone, F.dental, F.reyes, F.thompson, F.alvarez];

  let estNo = 1001,
    jobNo = 2001,
    invNo = 3001;

  function makeEstimate(c: Customer, p: Property, st: ServiceType, created: Date, status: Estimate["status"], title: string, opts: { tplId?: string; leadId?: string; multi?: boolean; createdBy?: string } = {}): Estimate {
    const t = tpl(opts.tplId ?? TEMPLATE_FOR[st] ?? "tpl_repair");
    let options: EstimateOption[] = optionsFromTemplate(t, itemById);
    if (!opts.multi && options.length > 1) options = [options[Math.min(1, options.length - 1)]];
    // vary quantities a little so totals are realistic, not identical
    const vary = (l: LineItem) => (l.unit === "ft" ? Math.round(l.qty * (0.75 + rnd() * 0.6)) : l.kind === "labor" ? r2(Math.max(0.5, Math.round(l.qty * (0.7 + rnd() * 0.7) * 2) / 2)) : Math.max(1, Math.round(l.qty * (0.7 + rnd() * 0.7))));
    options = options.map((o) => ({ ...o, items: o.items.map((l) => ({ ...l, qty: vary(l) })) }));
    const e: Estimate = {
      id: id("est"),
      number: estNo++,
      customerId: c.id,
      propertyId: p.id,
      leadId: opts.leadId,
      title,
      serviceType: st,
      status,
      options,
      taxPct: settings.taxPct,
      discount: { type: "amount", value: 0 },
      tripCharge: 0,
      diagnosticFee: 0,
      depositPct: st === "new_install" || st === "drip_conversion" || st === "zone_addition" ? 50 : 0,
      customerNotes: "",
      internalNotes: "",
      terms: settings.estimateTerms,
      createdBy: opts.createdBy ?? "emp_marcus",
      createdAt: iso(created),
      validUntil: isoDate(new Date(created.getTime() + 30 * DAY)),
    };
    if (status !== "draft") e.sentAt = iso(new Date(created.getTime() + 2 * 3600000));
    if (["viewed", "approved", "declined"].includes(status)) e.viewedAt = iso(new Date(created.getTime() + int(4, 30) * 3600000));
    if (status === "approved") {
      e.approvedAt = iso(new Date(created.getTime() + int(1, 4) * DAY));
      e.selectedOptionId = options[options.length > 1 ? int(0, options.length - 1) : 0].id;
      e.signature = { name: `${c.firstName} ${c.lastName}`, dataUrl: "", signedAt: e.approvedAt };
    }
    if (status === "declined") e.declinedAt = iso(new Date(created.getTime() + int(3, 9) * DAY));
    D.estimates.push(e);
    return e;
  }

  function finishJob(job: Job, start: Date, tech: string, opts: { laborFactor?: number; materialExtra?: boolean } = {}) {
    job.assignedTo = tech;
    job.crew = job.durationHrs > 5 ? [tech, "emp_ethan"] : [];
    job.scheduledStart = iso(start);
    job.status = "completed";
    const travel = int(12, 40);
    const laborFactor = opts.laborFactor ?? 0.8 + rnd() * 0.55;
    const workH = Math.max(0.5, (job.estimatedLaborHours || job.durationHrs) * laborFactor / (job.crew.length || 1));
    const tStart = new Date(start.getTime() - travel * 60000);
    D.timeEntries.push({ id: id("tim"), employeeId: tech, jobId: job.id, type: "travel", start: iso(tStart), end: iso(start), notes: "" });
    const end = new Date(start.getTime() + workH * 3600000);
    for (const e of job.crew.length ? job.crew : [tech]) D.timeEntries.push({ id: id("tim"), employeeId: e, jobId: job.id, type: "job", start: iso(start), end: iso(end), notes: "" });
    job.startedAt = iso(start);
    job.completedAt = iso(end);
    for (const i of job.items) if (i.kind === "material") i.usedQty = opts.materialExtra && chance(0.5) ? i.qty + (i.unit === "ft" ? int(5, 20) : 1) : i.qty;
    job.checklist = job.checklist.map((c) => ({ ...c, done: true, doneAt: iso(end), doneBy: tech }));
    job.signature = { name: "Customer", dataUrl: "", signedAt: iso(end) };
    return end;
  }

  function invoiceJob(job: Job, end: Date, paidPolicy: "paid" | "open" | "overdue" | "partial" = "paid") {
    const dep = D.invoices.filter((i) => i.estimateId && i.estimateId === job.estimateId && i.kind === "deposit");
    const depCredit = dep.reduce((s, i) => s + invoiceTotals(i, []).total, 0);
    const co = D.changeOrders.filter((c) => c.jobId === job.id && c.status === "approved").flatMap((c) => c.items);
    const inv = jobToInvoice(job, invNo++, { settings, depositCredit: r2(depCredit), approvedChangeOrderLines: co, today: end });
    inv.id = id("inv");
    inv.status = "sent";
    inv.sentAt = iso(new Date(end.getTime() + 3600000));
    if (job.customerId === F.cornerstone.c.id) inv.notes += ` — PO #CPM-${int(10000, 99999)}`;
    D.invoices.push(inv);
    job.invoiceId = inv.id;
    const tot = invoiceTotals(inv, []);
    act("invoice", `Invoice INV-${inv.number} sent — $${tot.total.toFixed(2)}`, "invoice", inv.id, new Date(end.getTime() + 3600000), { customerId: job.customerId, jobId: job.id, amount: tot.total });
    if (paidPolicy === "paid" || paidPolicy === "partial") {
      const payAt = new Date(Math.min(nowMs - 3600000, end.getTime() + (chance(0.55) ? 0.1 : int(1, 18)) * DAY));
      const amount = paidPolicy === "partial" ? r2(tot.balance / 2) : tot.balance;
      const method: PaymentMethod = wpick({ card: 50, check: 22, ach: 12, cash: 10, other: 1 } as Record<PaymentMethod, number>);
      const pay: Payment = { id: id("pay"), invoiceId: inv.id, customerId: job.customerId, amount, method, reference: method === "check" ? `Check #${int(1000, 9999)}` : method === "card" ? `•••• ${int(1000, 9999)}` : "", receivedAt: iso(payAt), isDeposit: false, note: "", processor: method === "card" ? { provider: "stripe", fee: r2(amount * 0.029 + 0.3) } : { provider: "manual" } };
      D.payments.push(pay);
      if (paidPolicy === "paid") inv.paidAt = pay.receivedAt;
      act("payment", `Payment received — $${amount.toFixed(2)} (${method})`, "invoice", inv.id, payAt, { customerId: job.customerId, jobId: job.id, amount });
    }
    if (paidPolicy === "overdue") inv.dueDate = isoDate(new Date(end.getTime() + 15 * DAY));
    return inv;
  }

  function addLead(c: Customer, p: Property | undefined, st: ServiceType, created: Date, stage: LeadStage, value: number, extra: Partial<Lead> = {}): Lead {
    const lead: Lead = {
      id: id("led"),
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      address: p?.address ?? c.billingAddress,
      serviceType: st,
      description: "",
      source: c.leadSource,
      campaignId: c.campaignId,
      stage,
      urgency: "normal",
      estimatedValue: value,
      assignedTo: "emp_marcus",
      lastContactAt: iso(new Date(created.getTime() + 20 * 60000)),
      preferredDates: "",
      notes: "",
      customerId: c.id,
      propertyId: p?.id,
      photoIds: [],
      sort: 0,
      createdAt: iso(created),
      ...extra,
    };
    if (stage === "approved") lead.convertedAt = iso(new Date(created.getTime() + int(1, 6) * DAY));
    D.leads.push(lead);
    act("lead", `Lead created from ${lead.source.replace("_", " ")}`, "lead", lead.id, created, { customerId: c.id });
    return lead;
  }

  /* historical jobs over the past year */
  const historical: { daysAgo: number; st: ServiceType }[] = [];
  for (let d = 365; d >= 1; d--) {
    const dow = at(d).getDay();
    if (dow === 0) continue;
    const n = Math.round((dow === 6 ? 0.8 : 2.1) * seasonal(d) + (rnd() - 0.5));
    for (let k = 0; k < n; k++) historical.push({ daysAgo: d, st: wpick(JOB_W as Record<ServiceType, number>) });
  }
  // a few big installs and drip jobs
  for (const d of [330, 280, 230, 180, 150, 118, 96, 62, 41]) historical.push({ daysAgo: d, st: "new_install" });
  historical.sort((a, b) => b.daysAgo - a.daysAgo);

  const lastJobAt = new Map<string, number>();
  for (const h of historical) {
    let cp: { c: Customer; p: Property };
    const r = rnd();
    if (h.st === "maintenance" && chance(0.6)) cp = pick(featuredHistory);
    else if (r < 0.42 && pool.length > 8) {
      const eligible = pool.filter((x) => new Date(x.c.createdAt).getTime() < at(h.daysAgo).getTime());
      cp = eligible.length ? pick(eligible) : pool[0];
    } else {
      const [f, l] = randomName();
      const c = addCustomer({ firstName: f, lastName: l }, h.daysAgo + int(2, 9));
      const p = addProperty(c);
      cp = { c, p };
      pool.push(cp);
      addLead(c, p, h.st, new Date(c.createdAt), "approved", 0);
    }
    const { c, p } = cp;
    if (lastJobAt.has(c.id) && !c.tags.includes("Repeat Customer") && c.type === "residential") c.tags.push("Repeat Customer");
    lastJobAt.set(c.id, h.daysAgo);
    const start = at(h.daysAgo, pick([7.5, 8, 9, 10, 11, 12.5, 13, 14]));
    const title = h.st === "new_install" ? "New irrigation system — front & back" : pick(TITLES[h.st] ?? ["Irrigation service"]);
    const bigJob = ["new_install", "drip_conversion", "zone_addition", "reroute", "smart_controller", "main_line_repair"].includes(h.st);
    let job: Job;
    const tech = h.st === "system_audit" ? "emp_marcus" : h.st === "new_install" ? "emp_jake" : pick(TECHS);
    if (bigJob || chance(0.25)) {
      const created = new Date(start.getTime() - int(4, 14) * DAY);
      const est = makeEstimate(c, p, h.st, created, "approved", title, { multi: h.st === "new_install" || h.st === "smart_controller" });
      job = estimateToJob(est, jobNo++, { checklists: CHECKLISTS, settings, now: est.approvedAt });
      job.id = id("job");
      est.jobId = job.id;
      act("estimate", `Estimate #${est.number} sent — $${estimateTotal(est).toFixed(0)}`, "estimate", est.id, new Date(est.sentAt!), { customerId: c.id, amount: estimateTotal(est) });
      act("estimate", `Estimate #${est.number} approved`, "estimate", est.id, new Date(est.approvedAt!), { customerId: c.id });
      if (est.depositPct) {
        const dep = invoiceDeposit(est, new Date(est.approvedAt!));
        void dep;
      }
    } else {
      const t = tpl(TEMPLATE_FOR[h.st] ?? "tpl_repair");
      const o = optionsFromTemplate(t, itemById)[0];
      const diag = h.st === "diagnostics" ? [customLine("fee", "Diagnostic fee", 1, settings.diagnosticFee, 0, "ea", false)] : [];
      const lines = h.st === "maintenance" || h.st === "winterization" ? [customLine("labor", pick(["Quarterly irrigation check", "Seasonal maintenance visit", "Winterization & schedule adjustment"]), 1, pick([89, 99, 129, 325]), 30, "visit", false), ...(chance(0.5) ? [L("itm_hevan", int(1, 4)), L("itm_rb1804", int(1, 2))] : [])] : [...diag, ...o.items];
      const tmp: Estimate = { id: "", number: 0, customerId: c.id, propertyId: p.id, title, serviceType: h.st, status: "approved", options: [{ id: "o", name: title, description: "", items: lines.map((l) => ({ ...l, qty: l.kind === "labor" && l.unit === "hr" ? r2(Math.max(0.5, Math.round(l.qty * (0.6 + rnd()) * 2) / 2)) : l.unit === "ft" ? Math.round(l.qty * (0.6 + rnd())) : l.qty })) }], taxPct: settings.taxPct, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "", terms: "", createdAt: iso(start) };
      job = estimateToJob(tmp, jobNo++, { checklists: CHECKLISTS, settings, now: iso(new Date(start.getTime() - int(1, 5) * DAY)) });
      job.id = id("job");
      job.estimateId = undefined;
    }
    job.title = title;
    job.durationHrs = Math.max(1, Math.min(9, job.estimatedLaborHours || 1.5));
    D.jobs.push(job);
    act("job", `Job #${job.number} created — ${title}`, "job", job.id, new Date(job.createdAt), { customerId: c.id, jobId: job.id });
    const end = finishJob(job, start, tech, { materialExtra: chance(0.3), laborFactor: h.st === "main_line_repair" && chance(0.4) ? 1.6 : undefined });
    act("status", `Job #${job.number} completed by ${D.employees.find((e) => e.id === tech)!.firstName}`, "job", job.id, end, { customerId: c.id, jobId: job.id, by: tech });
    // payment status: older work almost always paid; recent work mixed
    const policy = h.daysAgo > 45 ? (chance(0.994) ? "paid" : "overdue") : h.daysAgo > 18 ? (chance(0.85) ? "paid" : chance(0.5) ? "overdue" : "partial") : chance(0.55) ? "paid" : "open";
    invoiceJob(job, end, policy);
    // callbacks (~3% of repairs)
    if (["sprinkler_repair", "valve_repair", "lateral_repair", "main_line_repair", "leak_repair"].includes(h.st) && chance(0.035) && h.daysAgo > 10) {
      const cb: Job = { ...job, id: id("job"), number: jobNo++, title: `Callback — ${title}`, status: "completed", items: [], callbackOfJobId: job.id, estimated: { revenue: 0, materialCost: 0, laborCost: 0, equipmentCost: 0 }, estimatedLaborHours: 1, durationHrs: 1, checklist: [], createdAt: iso(at(h.daysAgo - 5)), invoiceId: undefined, estimateId: undefined };
      D.jobs.push(cb);
      finishJob(cb, at(h.daysAgo - int(3, 9), 13), job.assignedTo!);
      act("job", `Callback created for job #${job.number}`, "job", cb.id, new Date(cb.createdAt), { customerId: c.id, jobId: cb.id });
    }
    // warranties on valves / controllers / installs
    if (["valve_repair", "smart_controller", "new_install", "backflow"].includes(h.st)) {
      const mainItem = job.items.find((i) => i.kind === "material" && /valve|controller|pvb|backflow|hydrawise|esp|rachio/i.test(i.name));
      D.warranties.push({ id: id("war"), jobId: job.id, customerId: c.id, propertyId: p.id, item: h.st === "new_install" ? "Complete irrigation system" : mainItem?.name ?? title, manufacturer: mainItem ? itemById.get(mainItem.itemId ?? "")?.manufacturer ?? "" : "", installedDate: isoDate(end), laborMonths: h.st === "new_install" ? 24 : 12, manufacturerMonths: h.st === "smart_controller" ? 24 : h.st === "valve_repair" ? 24 : h.st === "new_install" ? 60 : 12, notes: "" } satisfies Warranty);
    }
  }

  function invoiceDeposit(est: Estimate, when: Date) {
    const t = optionTotals(est, est.options.find((o) => o.id === est.selectedOptionId) ?? est.options[0]);
    const inv: Invoice = { id: id("inv"), number: invNo++, customerId: est.customerId, propertyId: est.propertyId, estimateId: est.id, kind: "deposit", status: "paid", issueDate: isoDate(when), dueDate: isoDate(when), items: [customLine("fee", `${est.depositPct}% deposit — Estimate #${est.number}: ${est.title}`, 1, t.deposit, 0, "ea", false)], taxPct: 0, discount: { type: "amount", value: 0 }, depositCredit: 0, notes: "Deposit credited on final invoice.", terms: settings.paymentTerms, sentAt: iso(when), paidAt: iso(new Date(when.getTime() + 2 * 3600000)), createdAt: iso(when) };
    D.invoices.push(inv);
    D.payments.push({ id: id("pay"), invoiceId: inv.id, customerId: est.customerId, amount: t.deposit, method: chance(0.6) ? "card" : "check", reference: "", receivedAt: inv.paidAt!, isDeposit: true, note: "Deposit", processor: { provider: "stripe", fee: r2(t.deposit * 0.029 + 0.3) } });
    act("payment", `Deposit paid — $${t.deposit.toFixed(2)}`, "invoice", inv.id, new Date(inv.paidAt!), { customerId: est.customerId, amount: t.deposit });
    return inv;
  }

  /* declined estimates & lost leads across the year (for close-rate trend) */
  for (let k = 0; k < 150; k++) {
    const d = int(3, 360);
    const [f, l] = randomName();
    const c = addCustomer({ firstName: f, lastName: l }, d + 3);
    const p = addProperty(c);
    const st = wpick({ drip_conversion: 3, smart_controller: 3, new_install: 2, valve_repair: 2, sprinkler_repair: 3, zone_addition: 1, reroute: 1 } as Record<ServiceType, number>);
    const lead = addLead(c, p, st, new Date(c.createdAt), "lost", 0, { lostReason: pick(["Price too high", "Went with another contractor", "Decided to wait", "DIY", "No response"]) });
    if (chance(0.8)) {
      const e = makeEstimate(c, p, st, at(d, 10), chance(0.15) ? "expired" : "declined", pick(TITLES[st] ?? ["Irrigation work"]), { leadId: lead.id, multi: true });
      lead.estimateId = e.id;
      lead.estimatedValue = estimateTotal(e);
    }
  }

  /* ───────── featured stories: history and current state ───────── */

  // Patterson: 3 repairs in last 12 months → recommendation
  for (const [d, st, t] of [
    [320, "lateral_repair", "Lateral break — back lawn (roots)"],
    [190, "sprinkler_repair", "Broken heads + geyser back lawn"],
    [64, "valve_repair", "Valve 7 weeping — replace diaphragm"],
  ] as const) {
    const o = optionsFromTemplate(tpl(TEMPLATE_FOR[st]!), itemById)[0];
    const job = estimateToJob({ id: "", number: 0, customerId: F.patterson.c.id, propertyId: F.patterson.p.id, title: t, serviceType: st, status: "approved", options: [o], taxPct: settings.taxPct, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "", terms: "", createdAt: iso(at(d + 2)) }, jobNo++, { checklists: CHECKLISTS, settings, now: iso(at(d + 2)) });
    job.id = id("job");
    job.estimateId = undefined;
    D.jobs.push(job);
    const end = finishJob(job, at(d, 9), "emp_tyler");
    invoiceJob(job, end, "paid");
  }
  const pattZones = D.zones.filter((z) => z.systemId === D.systems.find((s) => s.propertyId === F.patterson.p.id)!.id);
  pattZones[3].lastRepairDate = isoDate(at(190));
  pattZones[6].lastRepairDate = isoDate(at(64));
  pattZones[4].lastRepairDate = isoDate(at(320));
  const pattEst = makeEstimate(F.patterson.c, F.patterson.p, "upgrade", at(1, 15), "draft", "Back lawn zone rebuild + smart controller", { tplId: "tpl_install", multi: true });
  pattEst.options = pattEst.options.map((o, i) => ({ ...o, name: ["Repair existing zones", "Rebuild zones 4–5 with rotors", "Full back-yard rebuild + Hydrawise"][i], description: ["Repair current breaks and replace failed valve. Lowest cost, doesn't address root damage.", "New laterals rerouted away from ficus roots, Hunter PGP Ultra rotors, new PGV valves.", "Complete rebuild of all back zones, new manifold, Pro-HC Hydrawise controller with Solar Sync."][i], items: o.items.map((l) => ({ ...l, qty: l.unit === "ft" ? Math.round(l.qty * [0.25, 0.45, 0.7][i]) : Math.max(1, Math.round(l.qty * [0.25, 0.45, 0.7][i])) })) }));
  pattEst.internalNotes = "Linda wants to see 3 options. Roots from ficus have broken laterals 3× this year.";

  // Robert Kim: main line leak completed last week, callback scheduled
  const kimEst = makeEstimate(F.kim.c, F.kim.p, "main_line_repair", at(9, 9), "approved", "Main line leak — front walkway", { createdBy: "emp_jake" });
  const kimJob = estimateToJob(kimEst, jobNo++, { checklists: CHECKLISTS, settings, now: kimEst.approvedAt });
  kimJob.id = id("job");
  kimEst.jobId = kimJob.id;
  kimJob.otherCosts = [{ id: id("cst"), kind: "dump", label: "Concrete disposal", amount: 45 }];
  D.jobs.push(kimJob);
  const kimEnd = finishJob(kimJob, at(7, 8), "emp_jake", { laborFactor: 1.7, materialExtra: true });
  invoiceJob(kimJob, kimEnd, "paid");

  // Frank Russo: overdue invoice
  const russoJob = estimateToJob(makeEstimate(F.russo.c, F.russo.p, "valve_repair", at(52), "approved", "Replace 3 anti-siphon valves"), jobNo++, { checklists: CHECKLISTS, settings });
  russoJob.id = id("job");
  D.jobs.push(russoJob);
  const russoEnd = finishJob(russoJob, at(48, 10), "emp_luis");
  invoiceJob(russoJob, russoEnd, "overdue");

  // Walsh: full install completed ~5 weeks ago (warranty, yard sign)
  const walshEst = makeEstimate(F.walsh.c, F.walsh.p, "new_install", at(70, 11), "approved", "New irrigation system — front & back", { tplId: "tpl_install", multi: true });
  const walshInstall: InstallProject = { id: id("ins"), name: "Walsh — new irrigation system", customerId: F.walsh.c.id, propertyId: F.walsh.p.id, estimateId: walshEst.id, stage: "warranty", stageDates: {}, design: { availableGpm: 17, staticPsi: 70, dynamicPsi: 56, meterSize: "3/4\"", serviceLineSize: "1\"", mainLineSize: "1\"", pipeSize: "3/4\"", valveSize: "1\"", controllerStations: 12, zones: D.zones.filter((z) => z.systemId === D.systems.find((s) => s.propertyId === F.walsh.p.id)!.id).map((z) => ({ id: z.id, name: z.name, area: z.area, heads: z.headCount, flowGpm: z.flowGpm, psi: z.operatingPsi })) }, takeoff: [], permitRequired: false, permitNumber: "", notes: "", createdAt: iso(at(76)) };
  walshInstall.takeoff = generateTakeoff(walshInstall.design, items);
  ["lead", "site_visit", "measure", "flow_test", "pressure_test", "design", "estimate", "approval", "permit", "material_order", "installation", "final_pressure_test", "coverage_test", "programming", "walkthrough", "final_payment", "warranty"].forEach((s, i) => (walshInstall.stageDates[s as keyof InstallProject["stageDates"]] = iso(at(76 - i * 2.4))));
  walshEst.installId = walshInstall.id;
  D.installs.push(walshInstall);
  invoiceDeposit(walshEst, new Date(walshEst.approvedAt!));
  const walshJob = estimateToJob(walshEst, jobNo++, { checklists: CHECKLISTS, settings });
  walshJob.id = id("job");
  walshJob.installId = walshInstall.id;
  walshEst.jobId = walshJob.id;
  walshInstall.jobId = walshJob.id;
  D.jobs.push(walshJob);
  const walshEnd = finishJob(walshJob, at(44, 7), "emp_jake", { laborFactor: 1.12 });
  invoiceJob(walshJob, walshEnd, "paid");
  D.warranties.push({ id: id("war"), jobId: walshJob.id, customerId: F.walsh.c.id, propertyId: F.walsh.p.id, item: "Complete irrigation system", manufacturer: "Hunter", installedDate: isoDate(walshEnd), laborMonths: 24, manufacturerMonths: 60, notes: "PGP Ultra 5-yr, PGV 2-yr, Pro-HC 2-yr manufacturer warranties." });
  D.warranties.push({ id: id("war"), jobId: walshJob.id, customerId: F.walsh.c.id, propertyId: F.walsh.p.id, item: "Hunter Pro-HC 12-Station Hydrawise Controller", manufacturer: "Hunter", installedDate: isoDate(walshEnd), laborMonths: 12, manufacturerMonths: 24, notes: "" });

  // Smith: install approved with deposit, scheduled in 4 days, install project in material order
  const smithEst = makeEstimate(F.smith.c, F.smith.p, "new_install", at(20, 10), "approved", "New irrigation system — large lawns front & back", { tplId: "tpl_install", multi: true });
  smithEst.selectedOptionId = smithEst.options[1].id;
  const smithInstall: InstallProject = { id: id("ins"), name: "Smith — new irrigation system", customerId: F.smith.c.id, propertyId: F.smith.p.id, estimateId: smithEst.id, stage: "material_order", stageDates: {}, design: { availableGpm: 18, staticPsi: 68, dynamicPsi: 54, meterSize: "1\"", serviceLineSize: "1\"", mainLineSize: "1\"", pipeSize: "3/4\"", valveSize: "1\"", controllerStations: 12, mainLineFt: 210, wireFt: 260, zones: D.zones.filter((z) => z.systemId === D.systems.find((s) => s.propertyId === F.smith.p.id)!.id).map((z) => ({ id: z.id, name: z.name, area: z.area, heads: z.headCount, flowGpm: z.flowGpm, psi: z.operatingPsi })) }, takeoff: [], permitRequired: false, permitNumber: "", notes: "Sod delivery scheduled the week after install — coordinate with landscaper (Rios Landscaping).", createdAt: iso(at(34)) };
  smithInstall.takeoff = generateTakeoff(smithInstall.design, items);
  ["lead", "site_visit", "measure", "flow_test", "pressure_test", "design", "estimate", "approval", "permit"].forEach((s, i) => (smithInstall.stageDates[s as keyof InstallProject["stageDates"]] = iso(at(34 - i * 3))));
  smithEst.installId = smithInstall.id;
  D.installs.push(smithInstall);
  invoiceDeposit(smithEst, new Date(smithEst.approvedAt!));
  const smithJob = estimateToJob(smithEst, jobNo++, { checklists: CHECKLISTS, settings });
  smithJob.id = id("job");
  smithJob.installId = smithInstall.id;
  smithJob.status = "scheduled";
  smithJob.assignedTo = "emp_jake";
  smithJob.crew = ["emp_jake", "emp_ethan", "emp_luis"];
  smithJob.scheduledStart = iso(at(-4, 7));
  smithJob.durationHrs = 9;
  smithJob.arrivalWindow = "7:00 AM";
  smithJob.priority = "high";
  smithEst.jobId = smithJob.id;
  smithInstall.jobId = smithJob.id;
  D.jobs.push(smithJob);
  D.documents.push({ id: id("doc"), name: "Smith — signed installation contract.pdf", type: "contract", url: "data:text/plain;charset=utf-8," + encodeURIComponent("Signed installation contract — demo document"), mime: "application/pdf", size: 184220, entityType: "estimate", entityId: smithEst.id, customerId: F.smith.c.id, uploadedAt: smithEst.approvedAt!, notes: "" });

  // Hernandez: install in design stage (linked to Design Studio project later)
  const hernInstall: InstallProject = { id: id("ins"), name: "Hernandez — full front & back install", customerId: F.hernandez.c.id, propertyId: F.hernandez.p.id, stage: "design", stageDates: {}, design: { availableGpm: 16, staticPsi: 72, dynamicPsi: 58, meterSize: "3/4\"", serviceLineSize: "1\"", mainLineSize: "1\"", pipeSize: "3/4\"", valveSize: "1\"", controllerStations: 6, zones: [{ id: id("dz"), name: "Front lawn rotors", area: "lawn", heads: 7 }, { id: id("dz"), name: "Back lawn rotors", area: "lawn", heads: 10 }, { id: id("dz"), name: "Side yard drip", area: "drip", heads: 0, lateralFt: 120 }] }, takeoff: [], permitRequired: false, permitNumber: "", notes: "Design drafted in Design Studio — 17 rotors, 3 zones.", createdAt: iso(at(12)) };
  ["lead", "site_visit", "measure", "flow_test", "pressure_test"].forEach((s, i) => (hernInstall.stageDates[s as keyof InstallProject["stageDates"]] = iso(at(12 - i * 2))));
  hernInstall.takeoff = generateTakeoff(hernInstall.design, items);
  D.installs.push(hernInstall);
  addLead(F.hernandez.c, F.hernandez.p, "new_install", new Date(F.hernandez.c.createdAt), "site_visit", 14500, { notes: "Measured + flow test done. Design in progress.", nextFollowUpAt: iso(at(-1, 10)), description: "Full front and back irrigation, smart controller." });

  // Martinez: renovation estimate sent 3 days ago, viewed
  const martEst = makeEstimate(F.martinez.c, F.martinez.p, "upgrade", at(3, 16), "viewed", "Backyard irrigation renovation", { tplId: "tpl_heads", multi: true });
  martEst.options.push({ id: id("opt"), name: "Full zone upgrade", description: "Replace all heads in zones 1, 3, 5 with MP Rotators, new PGV valves and pressure-regulated bodies.", tier: "best", items: [L("itm_prs40", 24), L("itm_mp2000", 24), L("itm_sj12", 12), L("itm_pgv", 3), L("itm_ma1", 6), L("itm_dby", 6), L("lab_tech", 7)] });
  martEst.options[0].name = "Repair existing system";
  martEst.options[1].name = "Repair + upgrade heads";
  addLead(F.martinez.c, F.martinez.p, "upgrade", new Date(F.martinez.c.createdAt), "estimate_sent", estimateTotal(martEst), { estimateId: martEst.id, lastContactAt: iso(at(3, 16)), nextFollowUpAt: iso(at(-1, 9)) });

  // Michelle Carter: zone addition sent 5 days ago, not viewed → follow-ups due
  const carterEst = makeEstimate(F.carter.c, F.carter.p, "zone_addition", at(5, 14), "sent", "Add drip zone for new raised beds", { tplId: "tpl_zone" });
  addLead(F.carter.c, F.carter.p, "zone_addition", new Date(F.carter.c.createdAt), "follow_up", estimateTotal(carterEst), { estimateId: carterEst.id, lastContactAt: iso(at(5, 14)), nextFollowUpAt: iso(at(0, 11)), notes: "Wants beds done before planting in 2 weeks." });

  // Natarajan: brand-new drip conversion lead from website
  addLead(F.natarajan.c, F.natarajan.p, "drip_conversion", at(0, 7.2), "new", 2400, { description: "Wants to convert front spray beds to drip; interested in turf rebate. Photos attached.", urgency: "normal", assignedTo: undefined, lastContactAt: undefined, preferredDates: "Weekday mornings", source: "website" });

  // Heather Brooks: lateral repair today (from Google Ads)
  addLead(F.brooks.c, F.brooks.p, "lateral_repair", at(2, 10), "approved", 380, {});

  // Tom Nguyen: smart controller approved, install today
  const nguyenEst = makeEstimate(F.nguyen.c, F.nguyen.p, "smart_controller", at(6, 13), "approved", "Hunter Hydrawise smart controller install", { tplId: "tpl_controller", multi: true });
  nguyenEst.selectedOptionId = nguyenEst.options[1].id;
  addLead(F.nguyen.c, F.nguyen.p, "smart_controller", new Date(F.nguyen.c.createdAt), "approved", estimateTotal(nguyenEst), { estimateId: nguyenEst.id });

  // Okafor: backflow approved but not scheduled
  const okaEst = makeEstimate(F.okafor.c, F.okafor.p, "backflow", at(4, 9), "approved", "Replace leaking PVB", { tplId: "tpl_backflow", multi: true });
  const okaJob = estimateToJob(okaEst, jobNo++, { checklists: CHECKLISTS, settings });
  okaJob.id = id("job");
  okaEst.jobId = okaJob.id;
  D.jobs.push(okaJob);
  // approved estimate with no job yet
  const reyEst = makeEstimate(F.reyes.c, F.reyes.p, "head_replacement", at(2, 11), "approved", "MP Rotator retrofit — front planters", { tplId: "tpl_heads", multi: true });
  void reyEst;

  /* active leads (pipeline) */
  const activeLeads: [LeadStage, ServiceType, number, string, Partial<Lead>][] = [
    ["new", "valve_repair", 0.15, "Valve stuck on, water running all night", { urgency: "high", assignedTo: undefined }],
    ["new", "leak_repair", 0.3, "High water bill, wet spot by driveway", { urgency: "emergency", assignedTo: undefined, source: "google_ads" }],
    ["contacted", "smart_controller", 1.2, "Wants rebate-eligible smart controller", {}],
    ["contacted", "sprinkler_repair", 0.8, "Several heads broken after tree trimming", {}],
    ["site_visit", "drip_conversion", 2.5, "Front yard turf removal → drip", {}],
    ["site_visit", "new_install", 4, "New construction backyard, needs full system", {}],
    ["estimate_scheduled", "zone_addition", 1.5, "Add zone for vegetable garden", {}],
    ["estimate_scheduled", "reroute", 2, "Pool going in — reroute main line", {}],
    ["estimate_sent", "head_replacement", 4.5, "Replace rotors in back lawn", {}],
    ["follow_up", "drip_conversion", 9, "Hillside drip conversion", {}],
    ["follow_up", "smart_controller", 7, "Controller upgrade for 2 properties", {}],
    ["lost", "new_install", 11, "Went with lower bid", { lostReason: "Price too high" }],
  ];
  const leadSort: Record<string, number> = {};
  for (const [stage, st, daysAgoF, desc, extra] of activeLeads) {
    const [f, l] = randomName();
    const created = at(daysAgoF, 8 + (daysAgoF * 7) % 9);
    const c = addCustomer({ firstName: f, lastName: l, leadSource: (extra.source as LeadSource) ?? wpick(SOURCE_W) }, daysAgoF);
    const p = addProperty(c);
    const lead = addLead(c, p, st, created, stage, int(3, 40) * 50 * (st === "new_install" ? 10 : 1), { description: desc, ...extra, sort: (leadSort[stage] = (leadSort[stage] ?? 0) + 1) });
    if (stage === "new") {
      lead.customerId = undefined;
      lead.propertyId = undefined;
      // un-converted leads have no customer record yet
      D.customers = D.customers.filter((x) => x.id !== c.id);
      const pid = p.id;
      const sysIds = D.systems.filter((s) => s.propertyId === pid).map((s) => s.id);
      D.properties = D.properties.filter((x) => x.id !== pid);
      D.systems = D.systems.filter((s) => s.propertyId !== pid);
      D.zones = D.zones.filter((z) => !sysIds.includes(z.systemId));
      D.controllers = D.controllers.filter((z) => !sysIds.includes(z.systemId));
      D.activity = D.activity.filter((a) => a.customerId !== c.id);
      lead.lastContactAt = undefined;
    }
    if (stage === "estimate_sent" || stage === "follow_up") {
      const e = makeEstimate(c, p, st, at(daysAgoF, 15), stage === "follow_up" ? "viewed" : "sent", desc, { leadId: lead.id, multi: true });
      lead.estimateId = e.id;
      lead.estimatedValue = estimateTotal(e);
    }
    if (stage === "estimate_scheduled") {
      D.appointments.push({ id: id("apt"), kind: "estimate", title: `Estimate — ${desc}`, customerId: c.id, propertyId: p.id, leadId: lead.id, employeeIds: ["emp_marcus"], start: iso(at(stage === "estimate_scheduled" && st === "reroute" ? -1 : 0, st === "reroute" ? 9 : 15)), end: iso(at(st === "reroute" ? -1 : 0, st === "reroute" ? 10 : 16)), notes: "Bring flow gauge & pressure gauge." });
      lead.nextFollowUpAt = D.appointments[D.appointments.length - 1].start;
    }
    if (stage === "site_visit") lead.nextFollowUpAt = iso(at(-2, 10));
  }
  for (const l of D.leads.filter((x) => x.stage === "estimate_sent" || x.stage === "follow_up")) l.nextFollowUpAt = l.nextFollowUpAt ?? iso(at(-1, 10));

  /* ───────── today & upcoming schedule ───────── */

  const nowH = Math.min(Math.max(now.getHours() + now.getMinutes() / 60, 9.5), 16.5);
  const tAt = (offsetH: number, day = 0) => {
    const d = new Date(today.getTime() - day * DAY);
    const h = Math.round((nowH + offsetH) * 4) / 4;
    d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    return d;
  };
  type Plan = { c: { c: Customer; p: Property }; st: ServiceType; title: string; tech: string; start: Date; dur: number; status: JobStatus; est?: Estimate; priority?: Job["priority"] };
  const randCp = () => pick(pool.filter((x) => x.c.type === "residential"));
  const todays: Plan[] = [
    { c: F.brooks, st: "lateral_repair", title: "Lateral line repair — zone 3 wet spot", tech: "emp_jake", start: tAt(-2.75), dur: 1.5, status: "completed" },
    { c: F.nguyen, st: "smart_controller", title: "Hunter Hydrawise smart controller install", tech: "emp_jake", start: tAt(-0.75), dur: 2.5, status: "in_progress", est: nguyenEst },
    { c: F.patterson, st: "diagnostics", title: "Zone 5 not turning on — diagnose", tech: "emp_jake", start: tAt(2.25), dur: 1, status: "scheduled" },
    { c: randCp(), st: "valve_repair", title: "Replace leaking valve — front manifold", tech: "emp_tyler", start: tAt(-3), dur: 1.5, status: "completed" },
    { c: F.alvarez, st: "maintenance", title: "Quarterly irrigation check", tech: "emp_tyler", start: tAt(-1.25), dur: 1, status: "completed" },
    { c: randCp(), st: "head_replacement", title: "Replace 8 spray heads — mower damage", tech: "emp_tyler", start: tAt(1.5), dur: 1.5, status: "scheduled" },
    { c: F.dental, st: "maintenance", title: "Monthly maintenance walk-through", tech: "emp_luis", start: tAt(-3.25), dur: 1.5, status: "completed" },
    { c: randCp(), st: "sprinkler_repair", title: "Broken heads + adjust coverage", tech: "emp_luis", start: tAt(-0.25), dur: 1.5, status: "scheduled" },
    { c: randCp(), st: "drip_conversion", title: "Convert side yard beds to drip", tech: "emp_luis", start: tAt(1.75), dur: 3, status: "scheduled" },
  ];
  const upcoming: Plan[] = [];
  for (let d = 1; d <= 12; d++) {
    const day = at(-d);
    if (day.getDay() === 0) continue;
    for (const tech of TECHS) {
      if (tech === "emp_jake" && d >= 4 && d <= 5) continue; // Smith install
      const n = int(1, 3);
      let h = 7.5;
      for (let k = 0; k < n; k++) {
        const st = wpick(JOB_W as Record<ServiceType, number>);
        const dur = pick([1, 1.5, 2, 2.5, 3]);
        const s = new Date(day);
        s.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
        upcoming.push({ c: st === "maintenance" && chance(0.5) ? pick(featuredHistory) : randCp(), st, title: pick(TITLES[st] ?? ["Irrigation service"]), tech, start: s, dur, status: "scheduled" });
        h += dur + pick([0.5, 1, 1.5]);
      }
    }
  }
  for (const pl of [...todays, ...upcoming]) {
    const o = optionsFromTemplate(tpl(TEMPLATE_FOR[pl.st] ?? "tpl_repair"), itemById)[0];
    const lines = pl.st === "maintenance" ? [customLine("labor", "Maintenance visit", 1, pl.c.c.type === "residential" ? 89 : 325, 30, "visit", false)] : o.items;
    const base: Estimate = pl.est ?? { id: "", number: 0, customerId: pl.c.c.id, propertyId: pl.c.p.id, title: pl.title, serviceType: pl.st, status: "approved", options: [{ id: "o", name: pl.title, description: "", items: lines }], taxPct: settings.taxPct, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "", terms: "", createdAt: iso(new Date(pl.start.getTime() - 3 * DAY)) };
    const job = estimateToJob(base, jobNo++, { checklists: CHECKLISTS, settings, now: iso(new Date(pl.start.getTime() - int(1, 6) * DAY)) });
    job.id = id("job");
    if (!pl.est) job.estimateId = undefined;
    else pl.est.jobId = job.id;
    job.title = pl.title;
    job.assignedTo = pl.tech;
    job.scheduledStart = iso(pl.start);
    job.durationHrs = pl.dur;
    job.status = pl.status;
    const hh = pl.start.getHours();
    job.arrivalWindow = hh < 10 ? "8:00 – 10:00 AM" : hh < 12 ? "10:00 AM – 12:00 PM" : hh < 14 ? "12:00 – 2:00 PM" : "2:00 – 4:00 PM";
    D.jobs.push(job);
    if (pl.status === "completed") {
      const end = finishJob(job, pl.start, pl.tech);
      invoiceJob(job, end, chance(0.5) ? "paid" : "open");
    } else if (pl.status === "in_progress") {
      D.timeEntries.push({ id: id("tim"), employeeId: pl.tech, jobId: job.id, type: "travel", start: iso(new Date(pl.start.getTime() - 22 * 60000)), end: iso(pl.start), notes: "" });
      D.timeEntries.push({ id: id("tim"), employeeId: pl.tech, jobId: job.id, type: "job", start: iso(pl.start), notes: "" });
      job.startedAt = iso(pl.start);
      job.checklist = job.checklist.map((c, i) => (i < 4 ? { ...c, done: true, doneAt: iso(pl.start), doneBy: pl.tech } : c));
      for (const i of job.items) if (i.kind === "material") i.usedQty = i.qty;
    }
  }
  // today's open time entries: shifts + Tyler en route
  for (const t of TECHS) D.timeEntries.push({ id: id("tim"), employeeId: t, type: "shift", start: iso(tAt(-3.75)), notes: "" });
  const tylerNext = D.jobs.find((j) => j.assignedTo === "emp_tyler" && j.status === "scheduled" && j.scheduledStart && new Date(j.scheduledStart).toDateString() === today.toDateString());
  if (tylerNext) {
    tylerNext.status = "en_route";
    D.timeEntries.push({ id: id("tim"), employeeId: "emp_tyler", jobId: tylerNext.id, type: "travel", start: iso(new Date(nowMs - 12 * 60000)), notes: "" });
  }

  // unscheduled & waiting
  const unsched: [ServiceType, string, Job["priority"]][] = [
    ["main_line_repair", "Main line leak — water company notice", "urgent"],
    ["valve_repair", "Valve buzzing / won't shut off", "high"],
    ["zone_addition", "Add zone for new side planter", "normal"],
    ["sprinkler_repair", "Coverage issues back lawn", "normal"],
  ];
  for (const [st, title, priority] of unsched) {
    const cp = randCp();
    const o = optionsFromTemplate(tpl(TEMPLATE_FOR[st] ?? "tpl_repair"), itemById)[0];
    const job = estimateToJob({ id: "", number: 0, customerId: cp.c.id, propertyId: cp.p.id, title, serviceType: st, status: "approved", options: [o], taxPct: settings.taxPct, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "", terms: "", createdAt: iso(at(1)) }, jobNo++, { checklists: CHECKLISTS, settings, now: iso(at(int(0, 3), 10)) });
    job.id = id("job");
    job.estimateId = undefined;
    job.priority = priority;
    D.jobs.push(job);
  }
  // waiting on parts
  const wp = D.jobs.find((j) => j.customerId === F.thompson.c.id && j.status === "completed");
  if (wp) {
    const o = optionsFromTemplate(tpl("tpl_valve"), itemById)[0];
    const j2 = estimateToJob({ id: "", number: 0, customerId: F.thompson.c.id, propertyId: F.thompson.p.id, title: "Replace Rain Bird PESB valves (zone 9–10)", serviceType: "valve_repair", status: "approved", options: [{ ...o, items: [L("itm_pesb", 2), L("itm_ma1", 4), L("itm_dby", 4), L("lab_tech", 2.5)] }], taxPct: settings.taxPct, discount: { type: "amount", value: 0 }, tripCharge: 0, diagnosticFee: 0, depositPct: 0, customerNotes: "", internalNotes: "PESB valves on backorder at Ewing — ETA Thursday.", terms: "", createdAt: iso(at(3)) }, jobNo++, { checklists: CHECKLISTS, settings, now: iso(at(3)) });
    j2.id = id("job");
    j2.estimateId = undefined;
    j2.status = "waiting_parts";
    j2.assignedTo = "emp_luis";
    D.jobs.push(j2);
  }
  // open callback & needs follow-up
  const cbOrig = D.jobs.find((j) => j.customerId === F.kim.c.id && j.status === "completed");
  if (cbOrig) {
    const cb: Job = { ...cbOrig, id: id("job"), number: jobNo++, title: "Callback — wet spot returned near main line repair", status: "callback", priority: "high", items: [], checklist: checklistFor("main_line_repair", CHECKLISTS).items, callbackOfJobId: cbOrig.id, estimated: { revenue: 0, materialCost: 0, laborCost: 0, equipmentCost: 0 }, estimatedLaborHours: 1, durationHrs: 1, scheduledStart: iso(at(-1, 8)), assignedTo: "emp_jake", startedAt: undefined, completedAt: undefined, signature: undefined, createdAt: iso(at(1, 15)), invoiceId: undefined, estimateId: undefined, otherCosts: [] };
    D.jobs.push(cb);
  }
  const fu = D.jobs.filter((j) => j.status === "completed" && j.completedAt && new Date(j.completedAt).getTime() > nowMs - 12 * DAY).slice(0, 2);
  for (const j of fu) {
    j.status = "needs_follow_up";
    j.followUp = { required: true, notes: "Customer asked for quote on remaining old valves while we were on site.", dueDate: isoDate(at(-2)) };
  }

  // change order on in-progress job
  const ip = D.jobs.find((j) => j.status === "in_progress");
  if (ip) {
    const co: ChangeOrder = { id: id("co"), jobId: ip.id, number: settings.nextNumbers.changeOrder++, title: "Additional broken valve discovered", description: "Zone 4 valve diaphragm torn — found while testing stations after controller install. Replace valve.", items: [L("itm_pgv", 1), L("itm_ma1", 2), L("itm_dby", 2), L("lab_tech", 1.5)], status: "pending", createdBy: ip.assignedTo, createdAt: iso(new Date(nowMs - 25 * 60000)) };
    D.changeOrders.push(co);
  }

  /* ───────── plans, audits, inventory ───────── */

  const subs: [{ c: Customer; p: Property }, string, number][] = [
    [F.oakview, "pln_commercial", -3],
    [F.dental, "pln_commercial", 26],
    [F.alvarez, "pln_quarterly", 88],
    [F.reyes, "pln_quarterly", 9],
    [F.reyes, "pln_audit", 40],
    [F.thompson, "pln_audit", -6],
    [F.walsh, "pln_smart", 14],
    [F.cornerstone, "pln_commercial", 5],
  ];
  for (const [cp, plan, nextIn] of subs) {
    D.planSubscriptions.push({ id: id("sub"), planId: plan, customerId: cp.c.id, propertyId: cp.p.id, startDate: isoDate(at(int(60, 400))), nextVisitDate: isoDate(at(-nextIn)), lastVisitDate: isoDate(at(int(20, 80))), autoRenew: true, status: "active" } satisfies PlanSubscription);
  }
  for (let k = 0; k < 16; k++) {
    const cp = randCp();
    const plan = pick(["pln_quarterly", "pln_quarterly", "pln_spring", "pln_winter", "pln_smart", "pln_summer"]);
    D.planSubscriptions.push({ id: id("sub"), planId: plan, customerId: cp.c.id, propertyId: cp.p.id, startDate: isoDate(at(int(30, 360))), nextVisitDate: isoDate(at(-int(-10, 60))), autoRenew: chance(0.8), status: chance(0.9) ? "active" : "paused" });
    if (!cp.c.tags.includes("Maintenance Plan")) cp.c.tags.push("Maintenance Plan");
  }

  const sysOf = (p: Property) => D.systems.find((s) => s.propertyId === p.id)!;
  const audit = (cp: { c: Customer; p: Property }, daysAgo: number, a: Partial<AuditReport>): AuditReport => {
    const sys = sysOf(cp.p);
    const zs = D.zones.filter((z) => z.systemId === sys.id);
    const r: AuditReport = { id: id("aud"), propertyId: cp.p.id, systemId: sys.id, technicianId: "emp_marcus", date: isoDate(at(daysAgo)), status: "complete", staticPsi: cp.p.staticPsi, dynamicPsi: cp.p.dynamicPsi, flowGpm: cp.p.availableGpm, precipRate: 0.62, distributionUniformity: 0.68, headSpacingOk: true, nozzleMatch: true, brokenHeads: 0, leaks: 0, overspray: 0, runoff: 0, lowHeads: 0, tiltedHeads: 0, pressureProblems: "", valveIssues: "", controllerSettings: "", wateringSchedule: "", minutesPerWeek: 60, soilType: "sandy_loam", sunExposure: "full", slopePct: 2, plantType: "Fescue lawn + shrubs", irrigatedSqft: Math.round((cp.p.lotSizeSqft ?? 8000) * 0.55), zoneFindings: zs.map((z) => ({ zoneId: z.id, precipRate: z.sprinklerType === "Rotor" ? 0.45 : z.sprinklerType === "Drip" ? undefined : 1.4, du: z.sprinklerType === "Drip" ? undefined : 0.55 + rnd() * 0.25, issues: z.statuses.filter((s) => s !== "working"), note: "" })), notes: "", createdAt: iso(at(daysAgo)), ...a };
    D.audits.push(r);
    sys.lastAuditDate = r.date;
    return r;
  };
  audit(F.thompson, 360, { brokenHeads: 3, leaks: 1, overspray: 4, runoff: 2, lowHeads: 6, tiltedHeads: 4, distributionUniformity: 0.52, nozzleMatch: false, controllerSettings: "Rain Bird ESP-TM2, fixed schedule 3×/week, 20 min rotors / 10 min sprays, no seasonal adjust", wateringSchedule: "M/W/F 4:00 AM", minutesPerWeek: 150, pressureProblems: "", slopePct: 6, notes: "Big lawn with Rain Bird 5000 rotors. Mixed nozzle sizes within zones 2 & 4." });
  audit(F.reyes, 40, { brokenHeads: 1, overspray: 2, lowHeads: 2, distributionUniformity: 0.71, controllerSettings: "Hunter Hydrawise — smart watering on, predictive", wateringSchedule: "Smart (ET)", minutesPerWeek: 70, notes: "Overspray onto new stucco at zone 2 — swap to MP strip nozzles." });
  audit(F.oakview, 2, { status: "draft", brokenHeads: 7, leaks: 2, overspray: 6, runoff: 4, lowHeads: 9, tiltedHeads: 5, distributionUniformity: 0.49, headSpacingOk: false, nozzleMatch: false, controllerSettings: "Hunter ACC2, manual programs, no flow sensor", wateringSchedule: "Daily 11 PM", minutesPerWeek: 210, pressureProblems: "Misting on slope zones — 82 psi static", valveIssues: "Zone 11 valve not closing fully", slopePct: 18, soilType: "clay_loam", plantType: "Turf, ice plant slopes, shrubs", notes: "Board meeting next month — present report + phased repair plan." });
  audit(F.dental, 120, { brokenHeads: 0, overspray: 1, distributionUniformity: 0.74, controllerSettings: "Hydrawise HPC-400, smart watering", wateringSchedule: "Smart (ET)", minutesPerWeek: 55 });

  // truck stock
  const truckItems = ["itm_pgpu", "itm_rb5004", "itm_rb1804", "itm_prs40", "itm_mp2000", "itm_mp1000", "itm_hevan", "itm_rb15", "itm_pgv", "itm_dv", "itm_sol", "itm_dvdia", "itm_pvc1", "itm_pvc34", "itm_funny", "itm_tee34", "itm_ell34", "itm_tee1", "itm_ell1", "itm_cpl1", "itm_slipfix", "itm_ma1", "itm_sj12", "itm_barb", "itm_glue", "itm_poly", "itm_emit", "itm_w185", "itm_dby", "itm_vb10"];
  for (const t of D.trucks) {
    for (const k of truckItems) {
      const item = it(k);
      const base = item.unit === "ft" ? 100 : item.category === "valves" ? 3 : 12;
      const qty = Math.max(0, Math.round(base * (0.3 + rnd())));
      D.truckStock.push({ id: id("tsk"), truckId: t.id, itemId: k, qty, minQty: Math.round(base * 0.5) } satisfies TruckStock);
    }
  }
  // recent usage transactions (last 21 days)
  for (const j of D.jobs.filter((j) => j.completedAt && new Date(j.completedAt).getTime() > nowMs - 21 * DAY)) {
    const truck = D.employees.find((e) => e.id === j.assignedTo)?.truckId;
    for (const i of j.items.filter((x) => x.kind === "material" && x.itemId)) D.inventoryTxns.push({ id: id("txn"), itemId: i.itemId!, location: truck ?? "warehouse", qty: -(i.usedQty ?? i.qty), reason: "used", jobId: j.id, employeeId: j.assignedTo, note: `Job #${j.number}`, at: j.completedAt! } satisfies InventoryTxn);
  }
  D.inventoryTxns.push({ id: id("txn"), itemId: "itm_pvc1", location: "warehouse", qty: 400, reason: "received", note: "Horizon PO 22817", at: iso(at(6, 7)) }, { id: id("txn"), itemId: "itm_pgpu", location: "warehouse", qty: 24, reason: "received", note: "Ewing PO 55120", at: iso(at(6, 7)) }, { id: id("txn"), itemId: "itm_rb1804", location: "trk_2", qty: 12, reason: "transfer", note: "Restock from warehouse", at: iso(at(2, 6.5)) });

  /* ───────── messages, photos, documents, notifications ───────── */

  const sms = (c: Customer, body: string, when: Date, dir: "in" | "out" = "out", extra: Partial<Message> = {}) => D.messages.push({ id: id("msg"), customerId: c.id, channel: "sms", direction: dir, body, status: dir === "in" ? "received" : "delivered", at: iso(when), ...extra });
  sms(F.nguyen.c, `Hi Tom, this is Jake with DeltaLine Irrigation. Your technician is on the way and should arrive in about 20 minutes.`, tAt(-1.1), "out", { templateId: "msg_omw" });
  sms(F.nguyen.c, "Great, gate is open. Old controller is in the garage.", tAt(-1.05), "in");
  sms(F.martinez.c, "Got the estimate, thanks. What's the difference between option 2 and 3 for the back lawn?", at(1, 19), "in");
  sms(F.carter.c, "Hi Michelle, just checking in on the irrigation estimate we sent ($1,6xx). Any questions? Reply here or approve online.", at(3, 10), "out", { templateId: "msg_est_fu1", automationId: "aut_fu1" });
  sms(F.russo.c, "Your invoice is overdue. You can pay securely online.", at(10, 9), "out", { templateId: "msg_inv_overdue", automationId: "aut_inv_rem" });
  sms(F.russo.c, "I'm not paying for the third valve, it was working fine.", at(9, 18), "in");
  D.messages.push({ id: id("msg"), customerId: F.oakview.c.id, channel: "email", direction: "in", subject: "Slope zones misting", body: "Hi team — residents are complaining about misting on the north slope again. Can you include that in the audit report for the board?", status: "received", at: iso(at(3, 11)) });
  D.messages.push({ id: id("msg"), customerId: F.patterson.c.id, channel: "call", direction: "out", body: "Called Greg — Linda wants to see 3 options for the back lawn rebuild. Will send estimate this week.", status: "logged", at: iso(at(1, 14)), by: "emp_marcus" });

  const svgPhoto = (label: string, tone: string, kind: string) =>
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone}"/><stop offset="1" stop-color="#3f3a2e"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><g opacity=".35" stroke="#1f2a1a" stroke-width="2">${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 640}" y1="${300 + ((i * 53) % 160)}" x2="${((i * 37) % 640) + 6}" y2="${280 + ((i * 53) % 160)}"/>`).join("")}</g>${kind === "valve" ? '<rect x="230" y="190" width="180" height="120" rx="10" fill="#1f2937" stroke="#111" stroke-width="4"/><circle cx="320" cy="250" r="34" fill="#111827" stroke="#6b7280" stroke-width="6"/><rect x="300" y="200" width="40" height="22" fill="#9ca3af"/>' : kind === "leak" ? '<ellipse cx="320" cy="300" rx="170" ry="60" fill="#2b3a4a" opacity=".75"/><rect x="200" y="285" width="240" height="18" rx="6" fill="#e5e7eb"/><path d="M318 270 q10 -40 0 -70" stroke="#93c5fd" stroke-width="6" fill="none"/>' : kind === "controller" ? '<rect x="220" y="110" width="200" height="250" rx="14" fill="#e5e7eb" stroke="#475569" stroke-width="4"/><rect x="245" y="140" width="150" height="70" rx="6" fill="#0f172a"/><text x="320" y="182" fill="#22d3ee" font-size="22" text-anchor="middle" font-family="monospace">ZONE 3</text>' : '<circle cx="320" cy="270" r="26" fill="#111827"/><rect x="310" y="210" width="20" height="60" fill="#374151"/>'}<rect x="0" y="430" width="640" height="50" fill="rgba(0,0,0,.45)"/><text x="18" y="462" fill="#fff" font-size="20" font-family="Inter,Arial">${label}</text><text x="622" y="462" fill="#cbd5e1" font-size="14" text-anchor="end" font-family="Inter,Arial">demo photo</text></svg>`,
    );
  const photo = (j: Job, cat: Photo["category"], label: string, tone: string, kind: string, offMin: number, ann: Photo["annotations"] = []) => {
    const when = new Date(new Date(j.startedAt ?? j.scheduledStart ?? j.createdAt).getTime() + offMin * 60000);
    D.photos.push({ id: id("pho"), url: svgPhoto(label, tone, kind), caption: label, category: cat, entityType: "job", entityId: j.id, customerId: j.customerId, propertyId: j.propertyId, jobId: j.id, takenAt: iso(when), takenBy: j.assignedTo, annotations: ann });
  };
  photo(kimJob, "problem", "Main line leak under walkway", "#6b7a4f", "leak", 10, [{ id: "a1", type: "circle", color: "#ef4444", x: 0.5, y: 0.6, r: 0.18 }, { id: "a2", type: "text", color: "#ef4444", x: 0.08, y: 0.12, text: "Cracked 1-inch tee" }]);
  photo(kimJob, "repair", "Slip-fix coupling installed", "#6b7a4f", "leak", 120);
  photo(kimJob, "after", "Backfilled & walkway restored", "#5f7d3a", "head", 200);
  const nguyenJob = D.jobs.find((j) => j.estimateId === nguyenEst.id);
  if (nguyenJob) {
    photo(nguyenJob, "before", "Old Hunter X-Core controller (rebate photo)", "#7c8a99", "controller", 5);
    photo(nguyenJob, "during", "Station wires labeled", "#7c8a99", "controller", 40, [{ id: "a3", type: "arrow", color: "#f59e0b", x: 0.2, y: 0.2, x2: 0.42, y2: 0.4 }]);
  }
  photo(D.jobs.find((j) => j.customerId === F.brooks.c.id)!, "problem", "Wet spot — zone 3 lateral", "#5a6b3c", "leak", 8, [{ id: "a4", type: "circle", color: "#ef4444", x: 0.5, y: 0.62, r: 0.2 }]);
  photo(D.jobs.find((j) => j.customerId === F.brooks.c.id)!, "after", "Lateral repaired, zone tested", "#5f7d3a", "head", 70);
  const pattJob = D.jobs.filter((j) => j.customerId === F.patterson.c.id).pop()!;
  photo(pattJob, "problem", "Valve 7 weeping in box", "#6b6346", "valve", 15, [{ id: "a5", type: "arrow", color: "#ef4444", x: 0.15, y: 0.15, x2: 0.4, y2: 0.45 }, { id: "a6", type: "text", color: "#ef4444", x: 0.06, y: 0.1, text: "Torn diaphragm" }]);

  D.documents.push(
    { id: id("doc"), name: "Oak View — backflow test report 2025.pdf", type: "backflow", url: "data:text/plain;charset=utf-8," + encodeURIComponent("Backflow test report — demo"), mime: "application/pdf", size: 96120, entityType: "property", entityId: F.oakview.p.id, customerId: F.oakview.c.id, uploadedAt: iso(at(352)), notes: "RP passed. Next test due within 12 months." },
    { id: id("doc"), name: "Hunter PGV valve — owner's manual.pdf", type: "manual", url: "https://www.hunterindustries.com/", mime: "text/html", size: 0, entityType: "property", entityId: F.walsh.p.id, customerId: F.walsh.c.id, uploadedAt: iso(at(44)), notes: "Manufacturer link" },
    { id: id("doc"), name: "Walsh — warranty certificate.pdf", type: "warranty", url: "data:text/plain;charset=utf-8," + encodeURIComponent("Warranty certificate — demo"), mime: "application/pdf", size: 54100, entityType: "job", entityId: walshJob.id, customerId: F.walsh.c.id, uploadedAt: iso(at(43)), notes: "" },
    { id: id("doc"), name: "Oak View — 2009 as-built irrigation plan.pdf", type: "diagram", url: "data:text/plain;charset=utf-8," + encodeURIComponent("As-built plan — demo"), mime: "application/pdf", size: 2210440, entityType: "property", entityId: F.oakview.p.id, customerId: F.oakview.c.id, uploadedAt: iso(at(370)), notes: "Scanned from HOA records" },
  );

  const note = (type: Notification["type"], title: string, body: string, link: string, minutesAgo: number, read = false) => D.notifications.push({ id: id("ntf"), type, title, body, link, createdAt: iso(new Date(nowMs - minutesAgo * 60000)), readAt: read ? iso(new Date(nowMs - (minutesAgo - 5) * 60000)) : undefined });
  const natLead = D.leads.find((l) => l.customerId === F.natarajan.c.id)!;
  note("new_lead", "New lead — Priya Natarajan", "Drip conversion · Website booking form", `/leads?open=${natLead.id}`, Math.max(5, (nowMs - new Date(natLead.createdAt).getTime()) / 60000));
  if (ip) note("change_order", "Change order awaiting approval", `Job #${ip.number} — Additional broken valve discovered ($${lineTotals(D.changeOrders[0].items).subtotal.toFixed(0)})`, `/jobs/${ip.id}`, 25);
  note("customer_reply", "Luis Martinez replied", "“What's the difference between option 2 and 3…”", `/customers/${F.martinez.c.id}`, 60 * 15);
  const lastPay = D.payments.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  note("payment_received", "Payment received", `$${lastPay.amount.toFixed(2)} via ${lastPay.method}`, `/payments`, Math.max(10, (nowMs - new Date(lastPay.receivedAt).getTime()) / 60000), true);
  note("estimate_approved", "Estimate approved — Samuel Okafor", `Estimate #${okaEst.number} · Replace leaking PVB`, `/estimates/${okaEst.id}`, 60 * 24 * 3, true);

  /* ───────── finalize ───────── */

  settings.nextNumbers = { estimate: estNo, job: jobNo, invoice: invNo, changeOrder: settings.nextNumbers.changeOrder };
  D.activity.sort((a, b) => b.at.localeCompare(a.at));
  // customer tags derived from history
  for (const c of D.customers) {
    const rev = D.invoices.filter((i) => i.customerId === c.id && i.kind !== "deposit").reduce((s, i) => s + invoiceTotals(i, []).total, 0);
    if (rev > 5000 && !c.tags.includes("High Value")) c.tags.push("High Value");
    if (c.type !== "residential" && !c.tags.includes("Commercial")) c.tags.push("Commercial");
  }
  return { data: D, settings };
}

export type { Appointment, CrmDocument, TimeEntry, InventoryItem };

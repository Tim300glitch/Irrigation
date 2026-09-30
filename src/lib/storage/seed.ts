import { repo } from "./repository";
import { createDemoProject, createSampleProjects } from "../model/demo";
import { analyzeProject, summarize } from "../analysis";
import { defaultMaterialProducts } from "../materials/pricing";
import type { ActivityEntry, Customer, Project, QuickEstimate } from "../model/types";
import { uid } from "../model/factory";
import { renderThumbnail } from "../plan/thumbnail";

const SEED_FLAG = "seeded-v1";

export async function persistProject(p: Project, products = defaultMaterialProducts()) {
  const a = analyzeProject(p, products);
  await repo.saveProject(p, summarize(p, a, renderThumbnail(p)));
}

/** First-run seed so the app opens with realistic data. */
export async function ensureSeeded(): Promise<void> {
  if (await repo.getFlag(SEED_FLAG)) return;
  const products = defaultMaterialProducts();
  await repo.setList("products", products);
  const demo = createDemoProject();
  const samples = createSampleProjects();
  const all = [demo, ...samples];
  // demo is the most recently edited
  demo.updatedAt = new Date().toISOString();
  const customers: Customer[] = all.map((p, i) => ({
    id: uid("cus"),
    name: p.meta.client,
    email: `${p.meta.client.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    phone: `(951) 555-01${String(20 + i).padStart(2, "0")}`,
    address: p.meta.address,
    notes: "",
    createdAt: p.createdAt,
  }));
  customers.push({ id: uid("cus"), name: "Priya Natarajan", email: "priya@example.com", phone: "(951) 555-0199", address: "17 Canyon Crest Rd, Riverside, CA", notes: "Lead from website — wants drip conversion quote.", createdAt: new Date().toISOString() });
  all.forEach((p, i) => (p.meta.customerId = customers[i].id));
  for (const p of all) await persistProject(p, products);
  await repo.setList("customers", customers);
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const activity: ActivityEntry[] = [
    { id: uid("act"), projectId: demo.id, projectName: demo.meta.name, message: "Auto design generated — 3 zones, rotors placed", at: ago(4) },
    { id: uid("act"), projectId: samples[0].id, projectName: samples[0].meta.name, message: "Zone 3 pipe routing updated", at: ago(12) },
    { id: uid("act"), projectId: samples[1].id, projectName: samples[1].meta.name, message: "Estimate sent to customer", at: ago(60 * 26) },
    { id: uid("act"), projectId: samples[2].id, projectName: samples[2].meta.name, message: "Installer plan exported (24×36)", at: ago(60 * 50) },
  ];
  await repo.setList("activity", activity);
  const qe: QuickEstimate[] = [
    {
      id: uid("qe"),
      name: "Valve replacement — zone 2",
      customer: "Priya Natarajan",
      address: "17 Canyon Crest Rd, Riverside, CA",
      kind: "repair",
      items: [
        { id: uid("ci"), category: "Valves", item: '1" Electric control valve', description: "Replace failed diaphragm valve", quantity: 1, unit: "ea", unitCost: 26 },
        { id: uid("ci"), category: "Fittings", item: '1" Male adapter', description: "", quantity: 2, unit: "ea", unitCost: 0.7 },
        { id: uid("ci"), category: "Wire & Electrical", item: "Waterproof wire connector", description: "", quantity: 2, unit: "ea", unitCost: 0.85 },
      ],
      laborHours: 1.5,
      laborRate: 85,
      taxPct: 8.25,
      markupPct: 30,
      status: "sent",
      createdAt: ago(60 * 30),
      updatedAt: ago(60 * 30),
    },
  ];
  await repo.setList("quickEstimates", qe);
  const profile = await repo.getProfile();
  await repo.setProfile({ ...profile, pricesUpdatedAt: new Date().toISOString() });
  await repo.setFlag(SEED_FLAG, true);
}

export async function logActivity(message: string, projectId?: string, projectName?: string) {
  const list = await repo.getList<ActivityEntry>("activity");
  list.unshift({ id: uid("act"), projectId, projectName, message, at: new Date().toISOString() });
  await repo.setList("activity", list.slice(0, 200));
}

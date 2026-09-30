"use client";
/** Global (cross-project) data: product/price database, company profile, dashboard lists. */
import { create } from "zustand";
import type { ActivityEntry, Customer, MaterialProduct, ProjectSummary, QuickEstimate } from "@/lib/model/types";
import { repo, DEFAULT_PROFILE, type CompanyProfile } from "@/lib/storage/repository";
import { ensureSeeded } from "@/lib/storage/seed";
import { defaultMaterialProducts } from "@/lib/materials/pricing";

interface AppState {
  ready: boolean;
  newProjectOpen: boolean;
  openNewProject: (open: boolean) => void;
  products: MaterialProduct[];
  profile: CompanyProfile;
  summaries: ProjectSummary[];
  customers: Customer[];
  activity: ActivityEntry[];
  quickEstimates: QuickEstimate[];
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setProducts: (p: MaterialProduct[]) => Promise<void>;
  setProfile: (p: CompanyProfile) => Promise<void>;
  setCustomers: (c: Customer[]) => Promise<void>;
  setQuickEstimates: (q: QuickEstimate[]) => Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  newProjectOpen: false,
  openNewProject: (open) => set({ newProjectOpen: open }),
  products: defaultMaterialProducts(),
  profile: DEFAULT_PROFILE,
  summaries: [],
  customers: [],
  activity: [],
  quickEstimates: [],
  init: () => {
    if (!initPromise)
      initPromise = (async () => {
        await ensureSeeded();
        await get().refresh();
        set({ ready: true });
      })();
    return initPromise;
  },
  refresh: async () => {
    const [products, profile, summaries, customers, activity, quickEstimates] = await Promise.all([
      repo.getList<MaterialProduct>("products"),
      repo.getProfile(),
      repo.listSummaries(),
      repo.getList<Customer>("customers"),
      repo.getList<ActivityEntry>("activity"),
      repo.getList<QuickEstimate>("quickEstimates"),
    ]);
    set({ products: products.length ? products : defaultMaterialProducts(), profile, summaries, customers, activity, quickEstimates });
  },
  setProducts: async (p) => {
    set({ products: p });
    await repo.setList("products", p);
    const profile = { ...get().profile, pricesUpdatedAt: new Date().toISOString() };
    set({ profile });
    await repo.setProfile(profile);
  },
  setProfile: async (p) => {
    set({ profile: p });
    await repo.setProfile(p);
  },
  setCustomers: async (c) => {
    set({ customers: c });
    await repo.setList("customers", c);
  },
  setQuickEstimates: async (q) => {
    set({ quickEstimates: q });
    await repo.setList("quickEstimates", q);
  },
}));

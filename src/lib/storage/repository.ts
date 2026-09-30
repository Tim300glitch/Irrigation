/**
 * Persistence layer. The app talks to the `Repository` interface only, so the
 * local IndexedDB implementation can be swapped for a PostgreSQL/Supabase
 * backend (with the same shape) to sync projects across devices.
 */
import { createStore, get, set, del, keys } from "idb-keyval";
import type { ActivityEntry, Customer, MaterialProduct, Project, ProjectSummary, QuickEstimate } from "../model/types";
import { migrateProject } from "../model/factory";

export interface ProjectVersion {
  at: string;
  label: string;
}

export interface CompanyProfile {
  company: string;
  designer: string;
  phone: string;
  email: string;
  address: string;
  license: string;
  defaultTaxPct: number;
  defaultLaborRate: number;
  defaultMarkupPct: number;
  mapProvider: "none" | "esri";
  pricesUpdatedAt?: string;
}

export interface Repository {
  listSummaries(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<Project | undefined>;
  saveProject(p: Project, summary: ProjectSummary): Promise<void>;
  deleteProject(id: string): Promise<void>;
  listVersions(id: string): Promise<ProjectVersion[]>;
  saveVersion(p: Project, label: string): Promise<void>;
  getVersion(id: string, at: string): Promise<Project | undefined>;
  getList<T>(name: ListName): Promise<T[]>;
  setList<T>(name: ListName, items: T[]): Promise<void>;
  getProfile(): Promise<CompanyProfile>;
  setProfile(p: CompanyProfile): Promise<void>;
  getFlag(name: string): Promise<boolean>;
  setFlag(name: string, v: boolean): Promise<void>;
}

export type ListName = "customers" | "activity" | "products" | "quickEstimates";
export type ListTypes = { customers: Customer; activity: ActivityEntry; products: MaterialProduct; quickEstimates: QuickEstimate };

const MAX_VERSIONS = 20;

export const DEFAULT_PROFILE: CompanyProfile = {
  company: "DeltaLine Irrigation",
  designer: "Alex Rivera",
  phone: "(951) 555-0142",
  email: "design@deltaline.example",
  address: "Riverside, CA",
  license: "C-27 #000000",
  defaultTaxPct: 8.25,
  defaultLaborRate: 75,
  defaultMarkupPct: 25,
  mapProvider: "esri",
};

class LocalRepository implements Repository {
  private store = typeof indexedDB !== "undefined" ? createStore("deltaline-irrigation", "kv") : undefined;
  private mem = new Map<string, unknown>();

  private async g<T>(k: string): Promise<T | undefined> {
    if (!this.store) return this.mem.get(k) as T | undefined;
    return get<T>(k, this.store);
  }
  private async s(k: string, v: unknown) {
    if (!this.store) {
      this.mem.set(k, v);
      return;
    }
    await set(k, v, this.store);
  }
  private async d(k: string) {
    if (!this.store) {
      this.mem.delete(k);
      return;
    }
    await del(k, this.store);
  }

  async listSummaries() {
    const m = (await this.g<Record<string, ProjectSummary>>("summaries")) ?? {};
    return Object.values(m).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getProject(id: string) {
    const p = await this.g<Project>(`project:${id}`);
    return p ? migrateProject(p) : undefined;
  }
  async saveProject(p: Project, summary: ProjectSummary) {
    await this.s(`project:${p.id}`, p);
    const m = (await this.g<Record<string, ProjectSummary>>("summaries")) ?? {};
    m[p.id] = summary;
    await this.s("summaries", m);
  }
  async deleteProject(id: string) {
    await this.d(`project:${id}`);
    await this.d(`versions:${id}`);
    const m = (await this.g<Record<string, ProjectSummary>>("summaries")) ?? {};
    delete m[id];
    await this.s("summaries", m);
  }
  async listVersions(id: string) {
    const v = (await this.g<{ at: string; label: string }[]>(`versions:${id}`)) ?? [];
    return v.map(({ at, label }) => ({ at, label }));
  }
  async saveVersion(p: Project, label: string) {
    const v = (await this.g<{ at: string; label: string; project: Project }[]>(`versions:${p.id}`)) ?? [];
    v.unshift({ at: new Date().toISOString(), label, project: p });
    await this.s(`versions:${p.id}`, v.slice(0, MAX_VERSIONS));
  }
  async getVersion(id: string, at: string) {
    const v = (await this.g<{ at: string; label: string; project: Project }[]>(`versions:${id}`)) ?? [];
    const f = v.find((x) => x.at === at);
    return f ? migrateProject(f.project) : undefined;
  }
  async getList<T>(name: ListName) {
    return (await this.g<T[]>(`list:${name}`)) ?? [];
  }
  async setList<T>(name: ListName, items: T[]) {
    await this.s(`list:${name}`, items);
  }
  async getProfile() {
    return { ...DEFAULT_PROFILE, ...((await this.g<CompanyProfile>("profile")) ?? {}) };
  }
  async setProfile(p: CompanyProfile) {
    await this.s("profile", p);
  }
  async getFlag(name: string) {
    return !!(await this.g<boolean>(`flag:${name}`));
  }
  async setFlag(name: string, v: boolean) {
    await this.s(`flag:${name}`, v);
  }
  async allKeys() {
    return this.store ? keys(this.store) : [...this.mem.keys()];
  }
}

export const repo: Repository = new LocalRepository();

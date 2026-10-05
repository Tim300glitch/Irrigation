/**
 * CRM persistence. The store talks only to `CrmRepository`:
 *  - LocalCrmRepository  — IndexedDB (offline-first; used when Supabase is not configured)
 *  - SupabaseCrmRepository — PostgREST + Storage against supabase/migrations
 * Select with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
import { createStore, get, set, del } from "idb-keyval";
import type { CollectionName, CrmData, CrmSettings } from "./types";
import { COLLECTIONS, emptyData } from "./types";
import { fromRow, splitChildren, SPEC, SYNC_ORDER, toRow } from "./rowMapping";
import { getSession } from "./auth";

export interface CrmSnapshot {
  data: CrmData;
  settings: CrmSettings | null;
}

export interface CrmRepository {
  readonly kind: "local" | "supabase";
  load(): Promise<CrmSnapshot | null>;
  /** persist changed rows; `all` is the full collection after the change */
  upsert<K extends CollectionName>(name: K, changed: CrmData[K], all: CrmData[K]): Promise<void>;
  remove<K extends CollectionName>(name: K, ids: string[], all: CrmData[K]): Promise<void>;
  saveSettings(s: CrmSettings): Promise<void>;
  replaceAll(snapshot: CrmSnapshot): Promise<void>;
  /** store a file, return a URL usable in <img>/<a> */
  uploadFile(file: Blob, path: string): Promise<string>;
}

/* ───────────────────────── Local (IndexedDB) ───────────────────────── */

const PREFIX = "crm:v1:";

class LocalCrmRepository implements CrmRepository {
  readonly kind = "local" as const;
  private store = typeof indexedDB !== "undefined" ? createStore("deltaline-crm", "kv") : undefined;
  private mem = new Map<string, unknown>();
  private pending = new Map<string, unknown>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  private async g<T>(k: string) {
    return this.store ? get<T>(k, this.store) : (this.mem.get(k) as T | undefined);
  }
  private async s(k: string, v: unknown) {
    if (this.store) await set(k, v, this.store);
    else this.mem.set(k, v);
  }
  /** writes are coalesced so rapid edits (typing, dragging) cost one IndexedDB write */
  private queue(k: string, v: unknown) {
    this.pending.set(k, v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 250);
  }
  async flush() {
    const entries = [...this.pending];
    this.pending.clear();
    this.timer = null;
    await Promise.all(entries.map(([k, v]) => this.s(k, v)));
  }

  async load(): Promise<CrmSnapshot | null> {
    const version = await this.g<number>(PREFIX + "version");
    if (!version) return null;
    const data = emptyData();
    await Promise.all(
      COLLECTIONS.map(async (c) => {
        (data as Record<string, unknown>)[c] = (await this.g<unknown[]>(PREFIX + c)) ?? [];
      }),
    );
    return { data, settings: (await this.g<CrmSettings>(PREFIX + "settings")) ?? null };
  }
  async upsert<K extends CollectionName>(name: K, _changed: CrmData[K], all: CrmData[K]) {
    this.queue(PREFIX + name, all);
  }
  async remove<K extends CollectionName>(name: K, _ids: string[], all: CrmData[K]) {
    this.queue(PREFIX + name, all);
  }
  async saveSettings(s: CrmSettings) {
    this.queue(PREFIX + "settings", s);
  }
  async replaceAll({ data, settings }: CrmSnapshot) {
    this.pending.clear();
    await Promise.all(COLLECTIONS.map((c) => this.s(PREFIX + c, data[c])));
    if (settings) await this.s(PREFIX + "settings", settings);
    await this.s(PREFIX + "version", 1);
  }
  async clear() {
    if (!this.store) return this.mem.clear();
    await Promise.all([...COLLECTIONS, "settings", "version"].map((c) => del(PREFIX + c, this.store)));
  }
  async uploadFile(file: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
}

/* ───────────────────────── Supabase (PostgREST) ───────────────────────── */

export const SUPABASE_URL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL) || "";
export const SUPABASE_KEY = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || "";
export const supabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

class SupabaseCrmRepository implements CrmRepository {
  readonly kind = "supabase" as const;
  constructor(
    private url: string,
    private key: string,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    const token = getSession()?.accessToken ?? this.key;
    return { apikey: this.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
  }
  private async req(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, { ...init, headers: { ...this.headers(), ...(init.headers as Record<string, string>) } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  private orgId() {
    const s = getSession();
    if (!s?.orgId) throw new Error("Not signed in");
    return s.orgId;
  }

  async load(): Promise<CrmSnapshot | null> {
    const data = emptyData();
    await Promise.all(
      COLLECTIONS.map(async (c) => {
        const spec = SPEC[c];
        const embed = spec.children?.map((ch) => `${ch.table}(*)`).join(",");
        const rows = (await this.req(`${spec.table}?select=*${embed ? "," + embed : ""}`)) as Record<string, unknown>[];
        (data as Record<string, unknown>)[c] = rows.map((r) => fromRow(c, r));
      }),
    );
    const org = (await this.req(`organizations?id=eq.${this.orgId()}&select=settings`)) as { settings: CrmSettings }[];
    return { data, settings: org[0]?.settings && Object.keys(org[0].settings).length ? org[0].settings : null };
  }

  async upsert<K extends CollectionName>(name: K, changed: CrmData[K]) {
    if (!changed.length) return;
    const spec = SPEC[name];
    const org = this.orgId();
    const parents = changed.map((e) => toRow(name, e as never, org));
    await this.req(`${spec.table}?on_conflict=${spec.key ?? "id"}`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(parents) });
    // child tables are replaced wholesale for the changed parents
    for (const ch of spec.children ?? []) {
      const ids = changed.map((e) => (e as { id: string }).id);
      await this.req(`${ch.table}?${ch.fk}=in.(${ids.map((i) => `"${i}"`).join(",")})`, { method: "DELETE" });
      const rows = changed.flatMap((e) => splitChildren(name, ch.table, e as never));
      if (rows.length) await this.req(ch.table, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) });
    }
  }
  async remove<K extends CollectionName>(name: K, ids: string[]) {
    if (!ids.length) return;
    await this.req(`${SPEC[name].table}?id=in.(${ids.map((i) => `"${i}"`).join(",")})`, { method: "DELETE" });
  }
  async saveSettings(s: CrmSettings) {
    await this.req(`organizations?id=eq.${this.orgId()}`, { method: "PATCH", body: JSON.stringify({ settings: s, name: s.businessName }) });
  }
  async replaceAll({ data, settings }: CrmSnapshot) {
    // ordered so foreign keys resolve; employees ↔ trucks reference each other, so
    // employees go in first without their truck and are updated after trucks exist
    await this.upsert("employees", data.employees.map((e) => ({ ...e, truckId: undefined })));
    for (const c of SYNC_ORDER) await this.upsert(c, data[c] as never);
    if (settings) await this.saveSettings(settings);
  }
  async uploadFile(file: Blob, path: string) {
    const full = `${this.orgId()}/${path}`;
    const res = await fetch(`${this.url}/storage/v1/object/media/${full}`, { method: "POST", headers: { ...this.headers({ "Content-Type": file.type || "application/octet-stream" }), "x-upsert": "true" }, body: file });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return `${this.url}/storage/v1/object/authenticated/media/${full}`;
  }
}

export const localRepo = new LocalCrmRepository();
export const crmRepo: CrmRepository = supabaseConfigured() ? new SupabaseCrmRepository(SUPABASE_URL, SUPABASE_KEY) : localRepo;

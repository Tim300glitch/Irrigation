import type { Address, Customer, Employee, Lead } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money = (n: number) => usd.format(Number.isFinite(n) ? n : 0);
export const money0 = (n: number) => usd0.format(Number.isFinite(n) ? n : 0);
export function moneyK(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `$${Math.round(n / 1e3)}k`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return money0(n);
}
export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const num = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const fullName = (p?: Pick<Customer, "firstName" | "lastName"> | Pick<Employee, "firstName" | "lastName"> | Pick<Lead, "firstName" | "lastName"> | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "—");
export const customerName = (c?: Customer | null) => (c ? (c.company && c.type !== "residential" ? c.company : fullName(c)) : "—");
export const initials = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase() : "?");
export const addressLine = (a?: Address) => (a ? [a.street, a.city].filter(Boolean).join(", ") : "");
export const addressFull = (a?: Address) => (a ? `${a.street}, ${a.city}, ${a.state} ${a.zip}`.replace(/^, |, $/g, "") : "");
export const mapsUrl = (a?: Address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressFull(a))}`;

export function phone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

const dFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dyFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const tFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const wdFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const toDate = (d: string | number | Date) => (typeof d === "string" && d.length === 10 ? new Date(d + "T12:00:00") : new Date(d));

export function date(d?: string | number | Date | null) {
  if (!d) return "—";
  const x = toDate(d);
  return x.getFullYear() === new Date().getFullYear() ? dFmt.format(x) : dyFmt.format(x);
}
export const dateLong = (d?: string | number | Date | null) => (d ? dyFmt.format(toDate(d)) : "—");
export const time = (d?: string | number | Date | null) => (d ? tFmt.format(toDate(d)) : "—");
export const weekday = (d: string | number | Date) => wdFmt.format(toDate(d));
export const dateTime = (d?: string | number | Date | null) => (d ? `${date(d)}, ${time(d)}` : "—");

export function relative(d?: string | number | Date | null, now = Date.now()) {
  if (!d) return "—";
  const diff = toDate(d).getTime() - now;
  const a = Math.abs(diff);
  const m = Math.round(a / 60000);
  const sfx = (s: string) => (diff < 0 ? `${s} ago` : `in ${s}`);
  if (m < 1) return "just now";
  if (m < 60) return sfx(`${m}m`);
  const h = Math.round(m / 60);
  if (h < 24) return sfx(`${h}h`);
  const days = Math.round(h / 24);
  if (days === 1) return diff < 0 ? "yesterday" : "tomorrow";
  if (days < 30) return sfx(`${days}d`);
  return date(d);
}

export function hours(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1}h` : hh ? `${hh}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
}

export const isoDate = (d: Date | number = Date.now()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const startOfDay = (d: Date | number = Date.now()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date | number, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const sameDay = (a: string | number | Date, b: string | number | Date) => isoDate(toDate(a)) === isoDate(toDate(b));
export const startOfWeek = (d: Date | number = Date.now()) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

/**
 * Integration seams. Every external service sits behind a small interface so
 * providers can be added without touching workflows:
 *   messaging   → Twilio (SMS), Gmail / SMTP (email)
 *   payments    → Stripe, Square
 *   calendar    → Google Calendar
 *   maps        → Google Maps (geocoding, routing / route optimization)
 *   accounting  → QuickBooks Online
 *   files       → Google Drive
 *   automation  → Zapier (outbound webhooks for activity events)
 *   weather     → NWS / OpenWeather (rain delay, ET for scheduling)
 *   catalogs    → manufacturer price/product feeds (Hunter, Rain Bird)
 * Credentials never live in the browser: production providers call Supabase Edge
 * Functions (supabase/functions/<provider>) which hold secrets in Vault.
 * The defaults below are local simulators so every workflow runs end-to-end.
 */
import type { ActivityLog, Channel, Job, Payment, PaymentMethod } from "./types";

export interface OutboundMessage {
  channel: Extract<Channel, "sms" | "email">;
  to: string;
  subject?: string;
  body: string;
}
export interface MessagingProvider {
  id: string;
  send(m: OutboundMessage): Promise<{ status: "sent" | "queued" | "failed"; providerId?: string; error?: string }>;
}
export interface PaymentProvider {
  id: string;
  /** returns a hosted checkout / payment link for an invoice balance */
  createPaymentLink(invoiceId: string, amount: number, description: string): Promise<string>;
  charge?(invoiceId: string, amount: number, method: PaymentMethod): Promise<Pick<Payment, "processor" | "reference">>;
}
export interface CalendarProvider {
  id: string;
  upsertEvent(job: Job, title: string, attendees: string[]): Promise<string>;
}
export interface RoutingProvider {
  id: string;
  /** order stops to minimize drive time; returns indexes in visit order */
  optimize(stops: { lat: number; lng: number }[], start?: { lat: number; lng: number }): Promise<number[]>;
}
export interface AccountingProvider {
  id: string;
  syncInvoice(invoiceId: string): Promise<string>;
  syncPayment(paymentId: string): Promise<string>;
}
export interface WebhookProvider {
  id: string;
  emit(event: string, payload: unknown): Promise<void>;
}
export interface WeatherProvider {
  id: string;
  forecast(lat: number, lng: number): Promise<{ date: string; rainIn: number; etIn: number; highF: number }[]>;
}

/* ───────────────────────── Local simulators ───────────────────────── */

export const localMessaging: MessagingProvider = {
  id: "local",
  async send() {
    return { status: "sent", providerId: `local-${Date.now().toString(36)}` };
  },
};

export const localPayments: PaymentProvider = {
  id: "local",
  async createPaymentLink(invoiceId) {
    return `${typeof location !== "undefined" ? location.origin : ""}/portal?invoice=${invoiceId}`;
  },
};

/** Greedy nearest-neighbour ordering (placeholder until Google Routes is connected). */
export const localRouting: RoutingProvider = {
  id: "local",
  async optimize(stops, start) {
    const left = stops.map((s, i) => ({ ...s, i }));
    const order: number[] = [];
    let cur = start ?? left[0];
    while (left.length) {
      let best = 0;
      let bd = Infinity;
      left.forEach((s, k) => {
        const d = (s.lat - cur.lat) ** 2 + (s.lng - cur.lng) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      const [n] = left.splice(best, 1);
      order.push(n.i);
      cur = n;
    }
    return order;
  },
};

export const localWebhooks: WebhookProvider = {
  id: "local",
  async emit() {
    /* Zapier / custom webhooks attach here */
  },
};

export const providers = {
  messaging: localMessaging,
  payments: localPayments,
  routing: localRouting,
  webhooks: localWebhooks,
};

export function registerProvider<K extends keyof typeof providers>(kind: K, p: (typeof providers)[K]) {
  providers[kind] = p;
}

export const emitActivity = (a: ActivityLog) => providers.webhooks.emit(`activity.${a.type}`, a);

/* ───────────────────────── Catalog of integrations (Settings UI) ───────────────────────── */

export const INTEGRATIONS = [
  { id: "stripe", name: "Stripe", category: "Payments", description: "Card & ACH payments, payment links on invoices, deposits.", seam: "PaymentProvider" },
  { id: "square", name: "Square", category: "Payments", description: "In-person card reader for field collections.", seam: "PaymentProvider" },
  { id: "quickbooks", name: "QuickBooks Online", category: "Accounting", description: "Sync customers, invoices and payments.", seam: "AccountingProvider" },
  { id: "twilio", name: "Twilio", category: "Messaging", description: "Two-way SMS, on-my-way texts, reminders.", seam: "MessagingProvider" },
  { id: "gmail", name: "Gmail", category: "Messaging", description: "Send estimates & invoices from your domain; log replies.", seam: "MessagingProvider" },
  { id: "google_calendar", name: "Google Calendar", category: "Scheduling", description: "Two-way sync of technician schedules.", seam: "CalendarProvider" },
  { id: "google_maps", name: "Google Maps", category: "Scheduling", description: "Geocoding, drive times and route optimization.", seam: "RoutingProvider" },
  { id: "google_drive", name: "Google Drive", category: "Files", description: "Back up documents, photos and plans.", seam: "Storage" },
  { id: "zapier", name: "Zapier", category: "Automation", description: "Trigger zaps from CRM events (lead created, job completed…).", seam: "WebhookProvider" },
  { id: "weather", name: "Weather", category: "Field", description: "Rain-delay alerts and ET data for scheduling.", seam: "WeatherProvider" },
  { id: "manufacturer_catalog", name: "Manufacturer catalogs", category: "Price book", description: "Hunter & Rain Bird product data and price updates.", seam: "Catalog import" },
] as const;

/* ───────────────────────── Templates ───────────────────────── */

export function renderTemplate(body: string, vars: Record<string, string | number | undefined>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars[k] !== undefined && vars[k] !== "" ? String(vars[k]) : `{{${k}}}`));
}

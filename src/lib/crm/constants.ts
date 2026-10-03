import type {
  ComponentType,
  Condition,
  CustomerType,
  DocumentType,
  EstimateStatus,
  InstallStage,
  InvoiceStatus,
  ItemCategory,
  JobStatus,
  LeadSource,
  LeadStage,
  NotificationType,
  Permission,
  PhotoCategory,
  Role,
  ServiceType,
  TimeType,
  ZoneArea,
  ZoneStatus,
} from "./types";

export type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "brand" | "orange" | "teal";

export const LEAD_STAGES: { id: LeadStage; label: string; tone: Tone }[] = [
  { id: "new", label: "New Lead", tone: "blue" },
  { id: "contacted", label: "Contacted", tone: "teal" },
  { id: "site_visit", label: "Site Visit Needed", tone: "violet" },
  { id: "estimate_scheduled", label: "Estimate Scheduled", tone: "brand" },
  { id: "estimate_sent", label: "Estimate Sent", tone: "amber" },
  { id: "follow_up", label: "Follow-Up", tone: "orange" },
  { id: "approved", label: "Approved", tone: "green" },
  { id: "lost", label: "Lost", tone: "slate" },
];

export const LEAD_SOURCES: { id: LeadSource; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "google_ads", label: "Google Ads" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "yelp", label: "Yelp" },
  { id: "referral", label: "Referral" },
  { id: "door_hanger", label: "Door Hanger" },
  { id: "yard_sign", label: "Yard Sign" },
  { id: "website", label: "Website" },
  { id: "repeat", label: "Repeat Customer" },
  { id: "other", label: "Other" },
];
export const sourceLabel = (s: string) => (s === "seo" ? "SEO" : (LEAD_SOURCES.find((x) => x.id === s)?.label ?? s));

export const SERVICE_TYPES: { id: ServiceType; label: string; short: string; color: string }[] = [
  { id: "new_install", label: "New Irrigation Install", short: "Install", color: "#0f6490" },
  { id: "sprinkler_repair", label: "Sprinkler Repair", short: "Repair", color: "#0d9488" },
  { id: "valve_repair", label: "Valve Repair", short: "Valve", color: "#7c3aed" },
  { id: "main_line_repair", label: "Main Line Repair", short: "Main line", color: "#dc2626" },
  { id: "lateral_repair", label: "Lateral Line Repair", short: "Lateral", color: "#ea580c" },
  { id: "drip_conversion", label: "Drip Conversion", short: "Drip", color: "#16a34a" },
  { id: "smart_controller", label: "Smart Controller Install", short: "Controller", color: "#2563eb" },
  { id: "diagnostics", label: "Irrigation Diagnostics", short: "Diagnostic", color: "#64748b" },
  { id: "system_audit", label: "System Audit", short: "Audit", color: "#0891b2" },
  { id: "head_replacement", label: "Sprinkler Head Replacement", short: "Heads", color: "#14b8a6" },
  { id: "reroute", label: "Pipe Reroute", short: "Reroute", color: "#b45309" },
  { id: "trenching", label: "Trenching", short: "Trench", color: "#92400e" },
  { id: "zone_addition", label: "Zone Addition", short: "Zone add", color: "#4f46e5" },
  { id: "leak_repair", label: "Leak Repair", short: "Leak", color: "#e11d48" },
  { id: "upgrade", label: "Landscape Irrigation Upgrade", short: "Upgrade", color: "#0369a1" },
  { id: "maintenance", label: "Recurring Maintenance", short: "Maint.", color: "#65a30d" },
  { id: "backflow", label: "Backflow Test / Repair", short: "Backflow", color: "#a21caf" },
  { id: "winterization", label: "Winterization / Startup", short: "Seasonal", color: "#475569" },
];
export const serviceLabel = (s: string) => SERVICE_TYPES.find((x) => x.id === s)?.label ?? s;
export const serviceShort = (s: string) => SERVICE_TYPES.find((x) => x.id === s)?.short ?? s;
export const serviceColor = (s: string) => SERVICE_TYPES.find((x) => x.id === s)?.color ?? "#64748b";
export const REPAIR_TYPES: ServiceType[] = ["sprinkler_repair", "valve_repair", "main_line_repair", "lateral_repair", "leak_repair", "head_replacement", "diagnostics"];

export const JOB_STATUSES: { id: JobStatus; label: string; tone: Tone }[] = [
  { id: "unscheduled", label: "Unscheduled", tone: "slate" },
  { id: "scheduled", label: "Scheduled", tone: "blue" },
  { id: "en_route", label: "En Route", tone: "violet" },
  { id: "arrived", label: "Arrived", tone: "teal" },
  { id: "in_progress", label: "In Progress", tone: "brand" },
  { id: "waiting_parts", label: "Waiting on Parts", tone: "orange" },
  { id: "paused", label: "Paused", tone: "amber" },
  { id: "completed", label: "Completed", tone: "green" },
  { id: "needs_follow_up", label: "Needs Follow-Up", tone: "amber" },
  { id: "callback", label: "Callback", tone: "red" },
  { id: "cancelled", label: "Cancelled", tone: "slate" },
];
export const ACTIVE_JOB: JobStatus[] = ["en_route", "arrived", "in_progress"];
export const OPEN_JOB: JobStatus[] = ["unscheduled", "scheduled", "en_route", "arrived", "in_progress", "waiting_parts", "paused", "needs_follow_up", "callback"];

export const ESTIMATE_STATUSES: { id: EstimateStatus; label: string; tone: Tone }[] = [
  { id: "draft", label: "Draft", tone: "slate" },
  { id: "sent", label: "Sent", tone: "blue" },
  { id: "viewed", label: "Viewed", tone: "violet" },
  { id: "approved", label: "Approved", tone: "green" },
  { id: "declined", label: "Declined", tone: "red" },
  { id: "expired", label: "Expired", tone: "amber" },
];

export const INVOICE_STATUSES: { id: InvoiceStatus; label: string; tone: Tone }[] = [
  { id: "draft", label: "Draft", tone: "slate" },
  { id: "sent", label: "Sent", tone: "blue" },
  { id: "viewed", label: "Viewed", tone: "violet" },
  { id: "partial", label: "Partial", tone: "amber" },
  { id: "paid", label: "Paid", tone: "green" },
  { id: "overdue", label: "Overdue", tone: "red" },
  { id: "void", label: "Void", tone: "slate" },
];

export const ROLES: { id: Role; label: string }[] = [
  { id: "owner", label: "Owner" },
  { id: "admin", label: "Admin" },
  { id: "estimator", label: "Estimator" },
  { id: "technician", label: "Technician" },
  { id: "crew_lead", label: "Crew Lead" },
  { id: "helper", label: "Helper" },
  { id: "office", label: "Office" },
];
export const roleLabel = (r: string) => ROLES.find((x) => x.id === r)?.label ?? r;
export const FIELD_ROLES: Role[] = ["technician", "crew_lead", "helper"];

export const PERMISSIONS: { id: Permission; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "financials", label: "Financials & costs" },
  { id: "leads", label: "Leads" },
  { id: "customers", label: "Customers & properties" },
  { id: "estimates", label: "Estimates" },
  { id: "jobs", label: "Jobs" },
  { id: "schedule", label: "Schedule" },
  { id: "dispatch", label: "Dispatch" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "systems", label: "Irrigation systems & audits" },
  { id: "inventory", label: "Inventory & price book" },
  { id: "employees", label: "Employees & time" },
  { id: "vendors", label: "Vendors" },
  { id: "reports", label: "Reports" },
  { id: "marketing", label: "Marketing" },
  { id: "documents", label: "Documents" },
  { id: "settings", label: "Settings" },
  { id: "field", label: "Field app" },
];

const ALL = PERMISSIONS.map((p) => p.id);
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  admin: ALL,
  office: ALL.filter((p) => p !== "settings" && p !== "financials"),
  estimator: ["dashboard", "leads", "customers", "estimates", "jobs", "schedule", "systems", "inventory", "documents", "field"],
  crew_lead: ["customers", "jobs", "schedule", "systems", "inventory", "documents", "field"],
  technician: ["customers", "jobs", "schedule", "systems", "documents", "field"],
  helper: ["field"],
};

export const CUSTOMER_TYPES: { id: CustomerType; label: string }[] = [
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "hoa", label: "HOA" },
  { id: "property_manager", label: "Property Manager" },
  { id: "municipal", label: "Municipal" },
];
export const CUSTOMER_TAGS = ["VIP", "Commercial", "Repeat Customer", "High Value", "Maintenance Plan", "Needs Follow-Up", "Problem Customer"];
export const TAG_TONE: Record<string, Tone> = {
  VIP: "violet",
  Commercial: "blue",
  "Repeat Customer": "teal",
  "High Value": "green",
  "Maintenance Plan": "brand",
  "Needs Follow-Up": "amber",
  "Problem Customer": "red",
};

export const ZONE_STATUSES: { id: ZoneStatus; label: string; tone: Tone }[] = [
  { id: "working", label: "Working", tone: "green" },
  { id: "needs_adjustment", label: "Needs Adjustment", tone: "amber" },
  { id: "leaking", label: "Leaking", tone: "red" },
  { id: "broken", label: "Broken", tone: "red" },
  { id: "clogged", label: "Clogged", tone: "orange" },
  { id: "poor_coverage", label: "Poor Coverage", tone: "amber" },
  { id: "low_pressure", label: "Low Pressure", tone: "orange" },
  { id: "high_pressure", label: "High Pressure", tone: "orange" },
  { id: "valve_issue", label: "Valve Issue", tone: "violet" },
  { id: "wiring_issue", label: "Wiring Issue", tone: "violet" },
  { id: "controller_issue", label: "Controller Issue", tone: "violet" },
];
export const ZONE_AREAS: { id: ZoneArea; label: string }[] = [
  { id: "lawn", label: "Lawn" },
  { id: "drip", label: "Drip" },
  { id: "beds", label: "Flower Beds" },
  { id: "trees", label: "Trees" },
  { id: "slope", label: "Slope" },
  { id: "groundcover", label: "Groundcover" },
  { id: "mixed", label: "Mixed" },
];

export const COMPONENT_TYPES: { id: ComponentType; label: string; kind: "point" | "line" | "area"; color: string; dash?: string; group: string }[] = [
  { id: "rotor", label: "Rotor", kind: "point", color: "#0f6490", group: "Heads" },
  { id: "spray", label: "Spray head", kind: "point", color: "#0d9488", group: "Heads" },
  { id: "mp_rotator", label: "MP Rotator", kind: "point", color: "#7c3aed", group: "Heads" },
  { id: "bubbler", label: "Bubbler", kind: "point", color: "#0891b2", group: "Heads" },
  { id: "drip_zone", label: "Drip zone", kind: "point", color: "#16a34a", group: "Heads" },
  { id: "valve", label: "Valve", kind: "point", color: "#dc2626", group: "Control" },
  { id: "valve_box", label: "Valve box", kind: "point", color: "#78716c", group: "Control" },
  { id: "controller", label: "Controller", kind: "point", color: "#1d4ed8", group: "Control" },
  { id: "backflow", label: "Backflow", kind: "point", color: "#a21caf", group: "Control" },
  { id: "meter", label: "Meter", kind: "point", color: "#334155", group: "Control" },
  { id: "shutoff", label: "Shutoff valve", kind: "point", color: "#ea580c", group: "Control" },
  { id: "main_line", label: "Main line", kind: "line", color: "#dc2626", group: "Pipe" },
  { id: "lateral", label: "Lateral", kind: "line", color: "#2563eb", dash: "6 4", group: "Pipe" },
  { id: "drip_line", label: "Drip line", kind: "line", color: "#16a34a", dash: "2 3", group: "Pipe" },
  { id: "sleeve", label: "Sleeve", kind: "line", color: "#78716c", dash: "10 4 2 4", group: "Pipe" },
  { id: "wire", label: "Valve wire", kind: "line", color: "#f59e0b", dash: "1 3", group: "Pipe" },
  { id: "lawn", label: "Lawn area", kind: "area", color: "#22c55e", group: "Landscape" },
  { id: "flower_bed", label: "Flower bed", kind: "area", color: "#a16207", group: "Landscape" },
  { id: "structure", label: "House / structure", kind: "area", color: "#94a3b8", group: "Landscape" },
  { id: "hardscape", label: "Hardscape", kind: "area", color: "#cbd5e1", group: "Landscape" },
  { id: "tree", label: "Tree", kind: "point", color: "#15803d", group: "Landscape" },
  { id: "note", label: "Note", kind: "point", color: "#475569", group: "Landscape" },
];
export const componentMeta = (t: ComponentType) => COMPONENT_TYPES.find((c) => c.id === t)!;

export const CONDITIONS: { id: Condition; label: string; tone: Tone }[] = [
  { id: "good", label: "Good", tone: "green" },
  { id: "fair", label: "Fair", tone: "amber" },
  { id: "poor", label: "Poor", tone: "orange" },
  { id: "failed", label: "Failed", tone: "red" },
  { id: "unknown", label: "Unknown", tone: "slate" },
];

export const ITEM_CATEGORIES: { id: ItemCategory; label: string }[] = [
  { id: "sprinklers", label: "Sprinklers" },
  { id: "rotors", label: "Rotors" },
  { id: "nozzles", label: "Nozzles" },
  { id: "valves", label: "Valves" },
  { id: "pvc", label: "PVC" },
  { id: "fittings", label: "Fittings" },
  { id: "drip", label: "Drip" },
  { id: "controllers", label: "Controllers" },
  { id: "wire", label: "Wire" },
  { id: "backflow", label: "Backflow" },
  { id: "labor", label: "Labor" },
  { id: "equipment", label: "Equipment" },
  { id: "misc", label: "Miscellaneous" },
];

export const PHOTO_CATEGORIES: { id: PhotoCategory; label: string; tone: Tone }[] = [
  { id: "before", label: "Before", tone: "slate" },
  { id: "during", label: "During", tone: "blue" },
  { id: "after", label: "After", tone: "green" },
  { id: "problem", label: "Problem", tone: "red" },
  { id: "repair", label: "Repair", tone: "amber" },
  { id: "system_map", label: "System Map", tone: "violet" },
];

export const DOCUMENT_TYPES: { id: DocumentType; label: string }[] = [
  { id: "contract", label: "Contract" },
  { id: "estimate", label: "Estimate" },
  { id: "invoice", label: "Invoice" },
  { id: "photo", label: "Photo" },
  { id: "diagram", label: "System Diagram" },
  { id: "audit", label: "Audit Report" },
  { id: "permit", label: "Permit" },
  { id: "backflow", label: "Backflow Document" },
  { id: "manual", label: "Manufacturer Manual" },
  { id: "warranty", label: "Warranty" },
  { id: "other", label: "Other" },
];

export const TIME_TYPES: { id: TimeType; label: string; color: string }[] = [
  { id: "shift", label: "Clocked in", color: "#64748b" },
  { id: "travel", label: "Travel", color: "#7c3aed" },
  { id: "job", label: "Job", color: "#0f6490" },
  { id: "break", label: "Break", color: "#f59e0b" },
  { id: "shop", label: "Shop", color: "#0d9488" },
  { id: "material_pickup", label: "Material pickup", color: "#ea580c" },
];

export const INSTALL_STAGES: { id: InstallStage; label: string; group: string }[] = [
  { id: "lead", label: "Lead", group: "Sales" },
  { id: "site_visit", label: "Site visit", group: "Sales" },
  { id: "measure", label: "Measure property", group: "Survey" },
  { id: "flow_test", label: "Flow test", group: "Survey" },
  { id: "pressure_test", label: "Pressure test", group: "Survey" },
  { id: "design", label: "System design", group: "Design" },
  { id: "estimate", label: "Estimate", group: "Design" },
  { id: "approval", label: "Customer approval", group: "Design" },
  { id: "permit", label: "Permit (if needed)", group: "Pre-construction" },
  { id: "material_order", label: "Material order", group: "Pre-construction" },
  { id: "installation", label: "Installation", group: "Construction" },
  { id: "final_pressure_test", label: "Pressure test", group: "Construction" },
  { id: "coverage_test", label: "Coverage test", group: "Construction" },
  { id: "programming", label: "Controller programming", group: "Closeout" },
  { id: "walkthrough", label: "Customer walkthrough", group: "Closeout" },
  { id: "final_payment", label: "Final payment", group: "Closeout" },
  { id: "warranty", label: "Warranty period", group: "Closeout" },
];

export const NOTIFICATION_TYPES: { id: NotificationType; label: string }[] = [
  { id: "new_lead", label: "New lead" },
  { id: "estimate_approved", label: "Estimate approved" },
  { id: "payment_received", label: "Payment received" },
  { id: "invoice_overdue", label: "Invoice overdue" },
  { id: "job_starting", label: "Job starting soon" },
  { id: "tech_late", label: "Technician late" },
  { id: "low_inventory", label: "Low inventory" },
  { id: "maintenance_due", label: "Maintenance due" },
  { id: "customer_reply", label: "Customer reply" },
  { id: "change_order", label: "Change order" },
  { id: "system", label: "System" },
];

export const statusTone = (list: { id: string; tone: Tone }[], id: string): Tone => list.find((x) => x.id === id)?.tone ?? "slate";
export const statusLabel = (list: { id: string; label: string }[], id: string): string => list.find((x) => x.id === id)?.label ?? id;

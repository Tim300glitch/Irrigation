/**
 * CRM domain model. Mirrors the PostgreSQL schema in supabase/migrations
 * (camelCase here, snake_case in SQL). Child rows that are always edited
 * together with their parent (estimate options/items, invoice items, job
 * materials, checklist items) are embedded here and split into their own
 * tables by the Supabase repository.
 *
 * Money is stored in dollars (2-decimal), timestamps as ISO strings, dates
 * (no time) as YYYY-MM-DD.
 */

export type Id = string;
export type ISODate = string;
export type ISODateTime = string;

/* ───────────────────────── People ───────────────────────── */

export type Role = "owner" | "admin" | "estimator" | "technician" | "crew_lead" | "helper" | "office";

export interface Employee {
  id: Id;
  firstName: string;
  lastName: string;
  role: Role;
  phone: string;
  email: string;
  color: string;
  payType: "hourly" | "salary";
  /** hourly wage (or salary / 2080 for costing) */
  payRate: number;
  commissionPct: number;
  certifications: { name: string; number?: string; expires?: ISODate }[];
  truckId?: Id;
  hireDate: ISODate;
  active: boolean;
  /** deleted from the team; kept only so past jobs, hours and pay still show their name */
  archived?: boolean;
  /** weekly schedule, 0 = Sunday */
  workDays: number[];
  shiftStart: string; // "07:00"
  shiftEnd: string;
}

export interface Truck {
  id: Id;
  name: string;
  vehicle: string;
  plate: string;
  employeeId?: Id;
}

export type CustomerType = "residential" | "commercial" | "hoa" | "property_manager" | "municipal";
export type LeadSource = "google" | "google_ads" | "facebook" | "instagram" | "yelp" | "referral" | "door_hanger" | "yard_sign" | "website" | "repeat" | "other";
export type CustomerTag = "VIP" | "Commercial" | "Repeat Customer" | "High Value" | "Maintenance Plan" | "Needs Follow-Up" | "Problem Customer" | string;

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Customer {
  id: Id;
  firstName: string;
  lastName: string;
  company?: string;
  type: CustomerType;
  phone: string;
  altPhone?: string;
  email: string;
  billingAddress: Address;
  leadSource: LeadSource;
  campaignId?: Id;
  tags: CustomerTag[];
  notes: string;
  preferredContact: "call" | "text" | "email";
  portalEnabled: boolean;
  createdAt: ISODateTime;
}

/* ───────────────────────── Properties & systems ───────────────────────── */

export type WaterSource = "municipal" | "well" | "reclaimed" | "pump" | "other";
export type BackflowType = "none" | "pvb" | "rp" | "dcva" | "avb";

export interface Property {
  id: Id;
  customerId: Id;
  name: string;
  address: Address;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  lotNotes: string;
  lotSizeSqft?: number;
  gateCode: string;
  accessNotes: string;
  pets: string;
  landscapeNotes: string;
  waterSource: WaterSource;
  meterSize: string;
  serviceLineSize: string;
  mainLineSize: string;
  mainLineMaterial: string;
  staticPsi?: number;
  dynamicPsi?: number;
  availableGpm?: number;
  backflow: { type: BackflowType; make: string; size: string; location: string; serial: string; lastTestDate?: ISODate };
  controllerLocation: string;
  valveLocations: string;
  systemInstalledYear?: number;
  recommendedUpgrades: string[];
  /** linked Design Studio project (engineering plan) */
  designProjectId?: Id;
  createdAt: ISODateTime;
}

export interface MapBackground {
  url: string;
  kind: "satellite" | "plan" | "drawing";
  opacity: number;
}

export interface IrrigationSystem {
  id: Id;
  propertyId: Id;
  name: string;
  installedYear?: number;
  installedBy?: string;
  lastAuditDate?: ISODate;
  notes: string;
  /** System map canvas (map units: 0..mapWidth × 0..mapHeight) */
  mapBackground?: MapBackground;
  mapWidth: number;
  mapHeight: number;
  /** feet per map unit (for measuring pipe runs) */
  mapFtPerUnit: number;
}

export interface Controller {
  id: Id;
  systemId: Id;
  manufacturer: string;
  model: string;
  stations: number;
  location: string;
  smart: boolean;
  wifi: boolean;
  rainSensor: boolean;
  installedDate?: ISODate;
  notes: string;
}

export type ZoneStatus = "working" | "needs_adjustment" | "leaking" | "broken" | "clogged" | "poor_coverage" | "low_pressure" | "high_pressure" | "valve_issue" | "wiring_issue" | "controller_issue";
export type ZoneArea = "lawn" | "drip" | "beds" | "trees" | "slope" | "groundcover" | "mixed";

export interface Zone {
  id: Id;
  systemId: Id;
  number: number;
  name: string;
  area: ZoneArea;
  valveType: string;
  valveSize: string;
  valveLocation: string;
  pipeSize: string;
  pipeMaterial: string;
  flowGpm?: number;
  operatingPsi?: number;
  sprinklerType: string;
  nozzleType: string;
  headCount: number;
  headSpacingFt?: number;
  manufacturer: string;
  model: string;
  dripEmitterType: string;
  dripLineType: string;
  controllerStation?: number;
  statuses: ZoneStatus[];
  problems: string;
  notes: string;
  installedDate?: ISODate;
  lastRepairDate?: ISODate;
}

export type ComponentType =
  | "rotor"
  | "spray"
  | "mp_rotator"
  | "drip_zone"
  | "bubbler"
  | "valve"
  | "valve_box"
  | "controller"
  | "backflow"
  | "meter"
  | "shutoff"
  | "main_line"
  | "lateral"
  | "drip_line"
  | "sleeve"
  | "wire"
  | "tree"
  | "flower_bed"
  | "lawn"
  | "structure"
  | "hardscape"
  | "note";

export type Condition = "good" | "fair" | "poor" | "failed" | "unknown";

/** Anything placed on a system map. Points are in map units. */
export interface SystemComponent {
  id: Id;
  systemId: Id;
  zoneId?: Id;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  /** polyline (pipes, wire, sleeves) or polygon (lawn, beds) */
  points?: { x: number; y: number }[];
  rotation?: number;
  size: string;
  manufacturer: string;
  model: string;
  installedDate?: ISODate;
  condition: Condition;
  notes: string;
  /** valve detail */
  valve?: { valveType: "anti-siphon" | "inline" | "master" | "drip" | "isolation"; flowControl: boolean; solenoid: string; depthIn?: number };
  /** sprinkler detail */
  sprinkler?: { arcDeg?: number; radiusFt?: number; nozzle: string; popUpIn?: number; flowGpm?: number };
}

/* ───────────────────────── Leads & sales ───────────────────────── */

export type LeadStage = "new" | "contacted" | "site_visit" | "estimate_scheduled" | "estimate_sent" | "follow_up" | "approved" | "lost";

export type ServiceType =
  | "new_install"
  | "sprinkler_repair"
  | "valve_repair"
  | "main_line_repair"
  | "lateral_repair"
  | "drip_conversion"
  | "smart_controller"
  | "diagnostics"
  | "system_audit"
  | "head_replacement"
  | "reroute"
  | "trenching"
  | "zone_addition"
  | "leak_repair"
  | "upgrade"
  | "maintenance"
  | "backflow"
  | "winterization";

export interface Lead {
  id: Id;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: Address;
  serviceType: ServiceType;
  description: string;
  source: LeadSource;
  campaignId?: Id;
  stage: LeadStage;
  urgency: "low" | "normal" | "high" | "emergency";
  estimatedValue: number;
  assignedTo?: Id;
  lastContactAt?: ISODateTime;
  nextFollowUpAt?: ISODateTime;
  preferredDates: string;
  notes: string;
  lostReason?: string;
  customerId?: Id;
  propertyId?: Id;
  estimateId?: Id;
  photoIds: Id[];
  sort: number;
  createdAt: ISODateTime;
  convertedAt?: ISODateTime;
}

export type ItemKind = "material" | "labor" | "equipment" | "fee" | "subcontract" | "other";

export interface LineItem {
  id: Id;
  itemId?: Id; // price book item
  kind: ItemKind;
  name: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  taxable: boolean;
  /** chosen item options, e.g. { Size: "1\"", Zones: "8" } */
  options?: Record<string, string>;
}

export interface EstimateOption {
  id: Id;
  name: string;
  description: string;
  tier?: "good" | "better" | "best";
  items: LineItem[];
  laborHours?: number; // derived from labor lines, cached for costing
}

export type EstimateStatus = "draft" | "sent" | "viewed" | "approved" | "declined" | "expired";

export interface Signature {
  name: string;
  dataUrl: string;
  signedAt: ISODateTime;
  ip?: string;
}

export interface Discount {
  type: "pct" | "amount";
  value: number;
  reason?: string;
}

export interface Estimate {
  id: Id;
  number: number;
  customerId: Id;
  propertyId: Id;
  leadId?: Id;
  title: string;
  serviceType: ServiceType;
  status: EstimateStatus;
  options: EstimateOption[];
  /** set on approval (or for single-option estimates) */
  selectedOptionId?: Id;
  taxPct: number;
  discount: Discount;
  tripCharge: number;
  diagnosticFee: number;
  depositPct: number;
  customerNotes: string;
  internalNotes: string;
  terms: string;
  createdBy?: Id;
  createdAt: ISODateTime;
  validUntil?: ISODate;
  sentAt?: ISODateTime;
  viewedAt?: ISODateTime;
  approvedAt?: ISODateTime;
  declinedAt?: ISODateTime;
  lastFollowUpAt?: ISODateTime;
  signature?: Signature;
  jobId?: Id;
  installId?: Id;
}

export interface EstimateTemplate {
  id: Id;
  name: string;
  serviceType: ServiceType;
  description: string;
  options: { name: string; description: string; tier?: EstimateOption["tier"]; items: Omit<LineItem, "id">[] }[];
}

/* ───────────────────────── Jobs ───────────────────────── */

export type JobStatus = "unscheduled" | "scheduled" | "en_route" | "arrived" | "in_progress" | "waiting_parts" | "paused" | "completed" | "needs_follow_up" | "callback" | "cancelled";

export interface ChecklistItem {
  id: Id;
  label: string;
  done: boolean;
  doneAt?: ISODateTime;
  doneBy?: Id;
}

export interface JobItem extends LineItem {
  /** quantity actually used in the field (materials) */
  usedQty?: number;
  /** added in the field (unexpected work / change order) */
  addedInField?: boolean;
  changeOrderId?: Id;
}

export interface Job {
  id: Id;
  number: number;
  customerId: Id;
  propertyId: Id;
  estimateId?: Id;
  installId?: Id;
  planSubscriptionId?: Id;
  title: string;
  serviceType: ServiceType;
  status: JobStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo?: Id;
  crew: Id[];
  scheduledStart?: ISODateTime;
  durationHrs: number;
  arrivalWindow: string;
  scope: string;
  items: JobItem[];
  equipment: string;
  internalNotes: string;
  customerNotes: string;
  checklist: ChecklistItem[];
  checklistTemplateId?: Id;
  estimatedLaborHours: number;
  /** snapshot from the estimate so actual vs estimated can be compared later */
  estimated: { revenue: number; materialCost: number; laborCost: number; equipmentCost: number };
  otherCosts: { id: Id; kind: "equipment" | "subcontract" | "other" | "dump" | "permit"; label: string; amount: number }[];
  signature?: Signature;
  followUp?: { required: boolean; notes: string; dueDate?: ISODate };
  callbackOfJobId?: Id;
  zoneIds: Id[];
  componentIds: Id[];
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  invoiceId?: Id;
  /** hidden from job lists and boards; history kept */
  archived?: boolean;
  createdAt: ISODateTime;
}

export interface ChangeOrder {
  id: Id;
  jobId: Id;
  number: number;
  title: string;
  description: string;
  items: LineItem[];
  status: "pending" | "approved" | "declined";
  signature?: Signature;
  createdBy?: Id;
  createdAt: ISODateTime;
  decidedAt?: ISODateTime;
}

export interface Appointment {
  id: Id;
  kind: "estimate" | "site_visit" | "meeting" | "follow_up" | "other";
  title: string;
  customerId?: Id;
  propertyId?: Id;
  leadId?: Id;
  employeeIds: Id[];
  start: ISODateTime;
  end: ISODateTime;
  notes: string;
}

export interface ChecklistTemplate {
  id: Id;
  name: string;
  serviceTypes: ServiceType[];
  items: string[];
}

/* ───────────────────────── Billing ───────────────────────── */

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue" | "void";
export type PaymentMethod = "cash" | "card" | "ach" | "check" | "other";

export interface Invoice {
  id: Id;
  number: number;
  customerId: Id;
  propertyId?: Id;
  jobId?: Id;
  estimateId?: Id;
  /** "deposit" invoices bill a share of an approved estimate before work */
  kind: "standard" | "deposit" | "progress" | "service_plan";
  status: InvoiceStatus;
  issueDate: ISODate;
  dueDate: ISODate;
  items: LineItem[];
  taxPct: number;
  discount: Discount;
  /** deposits already invoiced/collected and credited on this invoice */
  depositCredit: number;
  notes: string;
  terms: string;
  sentAt?: ISODateTime;
  viewedAt?: ISODateTime;
  paidAt?: ISODateTime;
  lastReminderAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface Payment {
  id: Id;
  invoiceId?: Id;
  customerId: Id;
  amount: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: ISODateTime;
  isDeposit: boolean;
  note: string;
  /** processor ids (Stripe / Square) once integrated */
  processor?: { provider: "stripe" | "square" | "manual"; chargeId?: string; fee?: number };
}

/* ───────────────────────── Inventory ───────────────────────── */

export type ItemCategory = "sprinklers" | "rotors" | "nozzles" | "valves" | "pvc" | "fittings" | "drip" | "controllers" | "wire" | "backflow" | "labor" | "equipment" | "misc";

export type PricingRule = { type: "multiplier"; value: number } | { type: "markup"; value: number } | { type: "margin"; value: number } | { type: "flat"; value: number };

/** inventory_items: the master price book. Labor/equipment rows are non-stock. */
export interface InventoryItem {
  id: Id;
  name: string;
  sku: string;
  category: ItemCategory;
  manufacturer: string;
  description: string;
  unit: string;
  cost: number;
  pricing: PricingRule;
  taxable: boolean;
  stocked: boolean;
  warehouseQty: number;
  minQty: number;
  reorderQty: number;
  preferredVendorId?: Id;
  vendorSku?: string;
  /** default labor hours to install one unit (for estimate labor suggestions) */
  laborHrsPerUnit?: number;
  active: boolean;
  /** supplier / spec-sheet / manual links */
  links?: ItemLink[];
  /** choices picked per line, e.g. Size, Zones, Conductors, Wire type */
  options?: ItemOption[];
  /** added automatically to new jobs and estimates of these types */
  defaultFor?: { serviceType: ServiceType; qty: number }[];
}

export interface ItemLink {
  label: string;
  url: string;
}

export interface ItemOption {
  name: string;
  values: ItemOptionValue[];
}

export interface ItemOptionValue {
  label: string;
  /** replaces the item's cost when this value is picked (e.g. a 12-zone controller) */
  cost?: number;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export interface PurchaseOrderLine {
  id: Id;
  itemId?: Id;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
}

export interface PurchaseOrder {
  id: Id;
  number: number;
  vendorId?: Id;
  status: PurchaseOrderStatus;
  items: PurchaseOrderLine[];
  /** deliver to the warehouse or straight onto a truck */
  deliverTo: "warehouse" | Id;
  neededBy?: ISODate;
  jobId?: Id;
  notes: string;
  createdBy?: Id;
  createdAt: ISODateTime;
  orderedAt?: ISODateTime;
  receivedAt?: ISODateTime;
}

export interface TruckStock {
  id: Id;
  truckId: Id;
  itemId: Id;
  qty: number;
  minQty: number;
}

export interface InventoryTxn {
  id: Id;
  itemId: Id;
  location: "warehouse" | Id; // truck id
  qty: number; // + received / − used
  reason: "received" | "used" | "transfer" | "adjustment" | "returned";
  jobId?: Id;
  employeeId?: Id;
  note: string;
  at: ISODateTime;
}

export interface Vendor {
  id: Id;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  accountNumber: string;
  address: string;
  categories: ItemCategory[];
  paymentTerms: string;
  notes: string;
}

/* ───────────────────────── Time ───────────────────────── */

export type TimeType = "shift" | "travel" | "job" | "break" | "shop" | "material_pickup";

export interface TimeEntry {
  id: Id;
  employeeId: Id;
  jobId?: Id;
  type: TimeType;
  start: ISODateTime;
  end?: ISODateTime; // open while running
  notes: string;
}

/* ───────────────────────── Service plans ───────────────────────── */

export type PlanFrequency = "monthly" | "quarterly" | "semiannual" | "annual" | "seasonal";

export interface ServicePlan {
  id: Id;
  name: string;
  description: string;
  price: number;
  billing: "per_visit" | "monthly" | "annual";
  frequency: PlanFrequency;
  visitsPerYear: number;
  includedServices: string[];
  discountPct: number;
  checklistTemplateId?: Id;
  active: boolean;
}

export interface PlanSubscription {
  id: Id;
  planId: Id;
  customerId: Id;
  propertyId: Id;
  startDate: ISODate;
  nextVisitDate: ISODate;
  lastVisitDate?: ISODate;
  autoRenew: boolean;
  status: "active" | "paused" | "cancelled";
  priceOverride?: number;
}

/* ───────────────────────── Audits ───────────────────────── */

export interface AuditZoneFinding {
  zoneId: Id;
  precipRate?: number; // in/hr
  du?: number; // 0..1
  issues: ZoneStatus[];
  note: string;
}

export interface AuditReport {
  id: Id;
  propertyId: Id;
  systemId: Id;
  jobId?: Id;
  technicianId?: Id;
  date: ISODate;
  status: "draft" | "complete";
  staticPsi?: number;
  dynamicPsi?: number;
  flowGpm?: number;
  precipRate?: number;
  distributionUniformity?: number; // 0..1 (lower quarter)
  headSpacingOk: boolean;
  nozzleMatch: boolean;
  brokenHeads: number;
  leaks: number;
  overspray: number;
  runoff: number;
  lowHeads: number;
  tiltedHeads: number;
  pressureProblems: string;
  valveIssues: string;
  controllerSettings: string;
  wateringSchedule: string;
  minutesPerWeek?: number;
  soilType: "sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";
  sunExposure: "full" | "partial" | "shade";
  slopePct: number;
  plantType: string;
  irrigatedSqft?: number;
  zoneFindings: AuditZoneFinding[];
  notes: string;
  createdAt: ISODateTime;
}

/* ───────────────────────── Media ───────────────────────── */

export type EntityType = "customer" | "property" | "job" | "estimate" | "invoice" | "zone" | "component" | "audit" | "lead" | "install" | "employee" | "vendor";
export type PhotoCategory = "before" | "during" | "after" | "problem" | "repair" | "system_map";

export interface Annotation {
  id: Id;
  type: "circle" | "arrow" | "text" | "freehand";
  color: string;
  /** normalized 0..1 coordinates */
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  text?: string;
  path?: { x: number; y: number }[];
}

export interface Photo {
  id: Id;
  url: string;
  caption: string;
  category: PhotoCategory;
  entityType: EntityType;
  entityId: Id;
  /** denormalized for fast customer/property galleries */
  customerId?: Id;
  propertyId?: Id;
  jobId?: Id;
  takenAt: ISODateTime;
  takenBy?: Id;
  annotations: Annotation[];
}

export type DocumentType = "contract" | "estimate" | "invoice" | "photo" | "diagram" | "audit" | "permit" | "backflow" | "manual" | "warranty" | "other";

export interface CrmDocument {
  id: Id;
  name: string;
  type: DocumentType;
  url: string;
  mime: string;
  size: number;
  entityType: EntityType;
  entityId: Id;
  customerId?: Id;
  uploadedAt: ISODateTime;
  uploadedBy?: Id;
  notes: string;
}

/* ───────────────────────── Communication & automation ───────────────────────── */

export type Channel = "sms" | "email" | "call" | "note" | "portal";

export interface Message {
  id: Id;
  customerId?: Id;
  leadId?: Id;
  jobId?: Id;
  channel: Channel;
  direction: "in" | "out";
  subject?: string;
  body: string;
  templateId?: Id;
  automationId?: Id;
  status: "queued" | "sent" | "delivered" | "failed" | "received" | "logged";
  at: ISODateTime;
  by?: Id;
}

export interface MessageTemplate {
  id: Id;
  name: string;
  channel: "sms" | "email";
  subject: string;
  body: string;
  category: "on_my_way" | "estimate" | "appointment" | "invoice" | "maintenance" | "review" | "general" | "follow_up";
}

export type AutomationTrigger = "estimate_sent" | "job_completed" | "invoice_sent" | "repair_completed" | "audit_due" | "inventory_low" | "lead_created" | "appointment_tomorrow" | "plan_visit_due" | "backflow_test_due";
export type AutomationAction = "send_message" | "create_invoice" | "notify" | "create_reminder" | "create_purchase_alert";

export interface Automation {
  id: Id;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  delayDays: number;
  /** extra condition, evaluated by the engine */
  condition?: "not_approved" | "unpaid" | "always";
  action: AutomationAction;
  templateId?: Id;
  enabled: boolean;
}

export interface AutomationRun {
  id: Id;
  automationId: Id;
  entityId: Id;
  at: ISODateTime;
  result: string;
}

export interface Campaign {
  id: Id;
  name: string;
  source: LeadSource | "seo";
  startDate: ISODate;
  endDate?: ISODate;
  spend: number;
  notes: string;
  active: boolean;
}

export interface Warranty {
  id: Id;
  jobId?: Id;
  customerId: Id;
  propertyId: Id;
  componentId?: Id;
  item: string;
  manufacturer: string;
  installedDate: ISODate;
  laborMonths: number;
  manufacturerMonths: number;
  notes: string;
}

export type ActivityType =
  | "lead"
  | "call"
  | "text"
  | "email"
  | "note"
  | "estimate"
  | "job"
  | "status"
  | "invoice"
  | "payment"
  | "photo"
  | "document"
  | "system"
  | "automation"
  | "inventory"
  | "audit";

export interface ActivityLog {
  id: Id;
  type: ActivityType;
  message: string;
  entityType: EntityType;
  entityId: Id;
  customerId?: Id;
  jobId?: Id;
  amount?: number;
  by?: Id;
  at: ISODateTime;
}

export type NotificationType = "new_lead" | "estimate_approved" | "payment_received" | "invoice_overdue" | "job_starting" | "tech_late" | "low_inventory" | "maintenance_due" | "customer_reply" | "change_order" | "system";

export interface Notification {
  id: Id;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  createdAt: ISODateTime;
  readAt?: ISODateTime;
  /** dedupe key so engines do not raise the same alert twice */
  key?: string;
}

/* ───────────────────────── New install projects ───────────────────────── */

export type InstallStage =
  | "lead"
  | "site_visit"
  | "measure"
  | "flow_test"
  | "pressure_test"
  | "design"
  | "estimate"
  | "approval"
  | "permit"
  | "material_order"
  | "installation"
  | "final_pressure_test"
  | "coverage_test"
  | "programming"
  | "walkthrough"
  | "final_payment"
  | "warranty";

export interface InstallDesignData {
  availableGpm?: number;
  staticPsi?: number;
  dynamicPsi?: number;
  meterSize: string;
  serviceLineSize: string;
  mainLineSize: string;
  pipeSize: string;
  valveSize: string;
  controllerStations?: number;
  zones: { id: Id; name: string; area: ZoneArea; heads: number; flowGpm?: number; psi?: number; lateralFt?: number }[];
  mainLineFt?: number;
  wireFt?: number;
}

export interface InstallProject {
  id: Id;
  name: string;
  customerId: Id;
  propertyId: Id;
  leadId?: Id;
  estimateId?: Id;
  jobId?: Id;
  stage: InstallStage;
  stageDates: Partial<Record<InstallStage, ISODateTime>>;
  design: InstallDesignData;
  takeoff: LineItem[];
  permitRequired: boolean;
  permitNumber: string;
  notes: string;
  createdAt: ISODateTime;
}

/* ───────────────────────── Settings ───────────────────────── */

export interface CrmSettings {
  businessName: string;
  legalName: string;
  phone: string;
  email: string;
  website: string;
  address: Address;
  license: string;
  logoUrl?: string;
  taxPct: number;
  defaultMarkupPct: number;
  defaultPricing: PricingRule;
  laborRate: number; // billed $/hr
  laborBurdenPct: number; // payroll taxes, workers comp, etc. on top of wage
  tripCharge: number;
  diagnosticFee: number;
  defaultDepositPct: number;
  estimateValidDays: number;
  invoiceDueDays: number;
  estimateTerms: string;
  invoiceTerms: string;
  paymentTerms: string;
  laborWarrantyMonths: number;
  serviceAreas: { name: string; zips: string[] }[];
  statusLabels: Partial<Record<JobStatus | LeadStage, string>>;
  notificationPrefs: Record<NotificationType, boolean>;
  rolePermissions: Record<Role, Permission[]>;
  nextNumbers: { estimate: number; job: number; invoice: number; changeOrder: number; purchaseOrder?: number };
}

export type Permission =
  | "dashboard"
  | "financials"
  | "leads"
  | "customers"
  | "estimates"
  | "jobs"
  | "schedule"
  | "dispatch"
  | "invoices"
  | "payments"
  | "systems"
  | "inventory"
  | "employees"
  | "vendors"
  | "reports"
  | "marketing"
  | "documents"
  | "settings"
  | "field";

/* ───────────────────────── Dataset ───────────────────────── */

export interface CrmCollections {
  employees: Employee;
  trucks: Truck;
  customers: Customer;
  properties: Property;
  systems: IrrigationSystem;
  controllers: Controller;
  zones: Zone;
  components: SystemComponent;
  leads: Lead;
  estimates: Estimate;
  estimateTemplates: EstimateTemplate;
  jobs: Job;
  changeOrders: ChangeOrder;
  appointments: Appointment;
  checklistTemplates: ChecklistTemplate;
  invoices: Invoice;
  payments: Payment;
  items: InventoryItem;
  truckStock: TruckStock;
  inventoryTxns: InventoryTxn;
  vendors: Vendor;
  timeEntries: TimeEntry;
  servicePlans: ServicePlan;
  planSubscriptions: PlanSubscription;
  audits: AuditReport;
  photos: Photo;
  documents: CrmDocument;
  messages: Message;
  messageTemplates: MessageTemplate;
  automations: Automation;
  automationRuns: AutomationRun;
  campaigns: Campaign;
  warranties: Warranty;
  activity: ActivityLog;
  notifications: Notification;
  installs: InstallProject;
  purchaseOrders: PurchaseOrder;
}

export type CollectionName = keyof CrmCollections;
export type CrmData = { [K in CollectionName]: CrmCollections[K][] };

export const COLLECTIONS: CollectionName[] = [
  "employees",
  "trucks",
  "customers",
  "properties",
  "systems",
  "controllers",
  "zones",
  "components",
  "leads",
  "estimates",
  "estimateTemplates",
  "jobs",
  "changeOrders",
  "appointments",
  "checklistTemplates",
  "invoices",
  "payments",
  "items",
  "truckStock",
  "inventoryTxns",
  "vendors",
  "timeEntries",
  "servicePlans",
  "planSubscriptions",
  "audits",
  "photos",
  "documents",
  "messages",
  "messageTemplates",
  "automations",
  "automationRuns",
  "campaigns",
  "warranties",
  "activity",
  "notifications",
  "installs",
  "purchaseOrders",
];

export function emptyData(): CrmData {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as CrmData;
}

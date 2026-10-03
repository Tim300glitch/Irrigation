/**
 * Single-file build entry: the whole app (CRM + Design Studio) in one HTML page
 * with hash routing (#/jobs, #/customers/<id> …). Built by `npm run build:html`.
 * Generated route table — keep in sync with src/app.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
// @ts-expect-error text import handled by esbuild
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs";
import HomePage from "@/app/page";
import AuditsPage from "@/app/audits/page";
import BookPage from "@/app/book/page";
import CustomersPage from "@/app/customers/page";
import DispatchPage from "@/app/dispatch/page";
import DocumentsPage from "@/app/documents/page";
import EmployeesPage from "@/app/employees/page";
import EstimatesPage from "@/app/estimates/page";
import FieldPage from "@/app/field/page";
import InstallsPage from "@/app/installs/page";
import InventoryPage from "@/app/inventory/page";
import InvoicesPage from "@/app/invoices/page";
import JobsPage from "@/app/jobs/page";
import LeadsPage from "@/app/leads/page";
import MarketingPage from "@/app/marketing/page";
import MaterialsPage from "@/app/materials/page";
import PaymentsPage from "@/app/payments/page";
import PortalPage from "@/app/portal/page";
import ProductsPage from "@/app/products/page";
import ProjectsPage from "@/app/projects/page";
import ProjectsEstimatesPage from "@/app/projects/estimates/page";
import ProjectsEstimatesQuickPage from "@/app/projects/estimates/quick/page";
import ProjectsReportsPage from "@/app/projects/reports/page";
import PropertiesPage from "@/app/properties/page";
import ReportsPage from "@/app/reports/page";
import SchedulePage from "@/app/schedule/page";
import ServicePlansPage from "@/app/service-plans/page";
import SettingsPage from "@/app/settings/page";
import SettingsDesignPage from "@/app/settings/design/page";
import StudioPage from "@/app/studio/page";
import SystemsPage from "@/app/systems/page";
import VendorsPage from "@/app/vendors/page";
import { DetailRoute as AuditsDetail } from "@/app/audits/[id]/client";
import { DetailRoute as CustomersDetail } from "@/app/customers/[id]/client";
import { DetailRoute as EstimatesDetail } from "@/app/estimates/[id]/client";
import { DetailRoute as FieldDetail } from "@/app/field/[id]/client";
import { DetailRoute as InstallsDetail } from "@/app/installs/[id]/client";
import { DetailRoute as InvoicesDetail } from "@/app/invoices/[id]/client";
import { DetailRoute as JobsDetail } from "@/app/jobs/[id]/client";
import { DetailRoute as PropertiesDetail } from "@/app/properties/[id]/client";
import { Workspace } from "@/components/editor/Workspace";

(globalThis as { __PDF_WORKER_SRC__?: string }).__PDF_WORKER_SRC__ = URL.createObjectURL(new Blob([pdfWorkerSource as string], { type: "text/javascript" }));

const ROUTES: Record<string, () => React.ReactElement> = {
  "/": () => <HomePage />,
  "/audits": () => <AuditsPage />,
  "/book": () => <BookPage />,
  "/customers": () => <CustomersPage />,
  "/dispatch": () => <DispatchPage />,
  "/documents": () => <DocumentsPage />,
  "/employees": () => <EmployeesPage />,
  "/estimates": () => <EstimatesPage />,
  "/field": () => <FieldPage />,
  "/installs": () => <InstallsPage />,
  "/inventory": () => <InventoryPage />,
  "/invoices": () => <InvoicesPage />,
  "/jobs": () => <JobsPage />,
  "/leads": () => <LeadsPage />,
  "/marketing": () => <MarketingPage />,
  "/materials": () => <MaterialsPage />,
  "/payments": () => <PaymentsPage />,
  "/portal": () => <PortalPage />,
  "/products": () => <ProductsPage />,
  "/projects": () => <ProjectsPage />,
  "/projects/estimates": () => <ProjectsEstimatesPage />,
  "/projects/estimates/quick": () => <ProjectsEstimatesQuickPage />,
  "/projects/reports": () => <ProjectsReportsPage />,
  "/properties": () => <PropertiesPage />,
  "/reports": () => <ReportsPage />,
  "/schedule": () => <SchedulePage />,
  "/service-plans": () => <ServicePlansPage />,
  "/settings": () => <SettingsPage />,
  "/settings/design": () => <SettingsDesignPage />,
  "/studio": () => <StudioPage />,
  "/systems": () => <SystemsPage />,
  "/vendors": () => <VendorsPage />,
};

const DYNAMIC: [RegExp, (id: string) => React.ReactElement][] = [
  [/^\/audits\/([^/]+)$/, (id) => <AuditsDetail key={id} id={id} />],
  [/^\/customers\/([^/]+)$/, (id) => <CustomersDetail key={id} id={id} />],
  [/^\/estimates\/([^/]+)$/, (id) => <EstimatesDetail key={id} id={id} />],
  [/^\/field\/([^/]+)$/, (id) => <FieldDetail key={id} id={id} />],
  [/^\/installs\/([^/]+)$/, (id) => <InstallsDetail key={id} id={id} />],
  [/^\/invoices\/([^/]+)$/, (id) => <InvoicesDetail key={id} id={id} />],
  [/^\/jobs\/([^/]+)$/, (id) => <JobsDetail key={id} id={id} />],
  [/^\/properties\/([^/]+)$/, (id) => <PropertiesDetail key={id} id={id} />],
];

function useHash() {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return h;
}

function App() {
  const hash = useHash();
  const full = hash.replace(/^#/, "") || "/";
  const path = full.split("#")[0].split("?")[0] || "/";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const design = path.match(/^\/design\/(.+)$/);
  if (design) return <Workspace key={design[1]} projectId={decodeURIComponent(design[1])} />;
  for (const [re, render] of DYNAMIC) {
    const m = path.match(re);
    if (m) return render(decodeURIComponent(m[1]));
  }
  const route = ROUTES[path] ?? ROUTES["/"];
  // pages read query params reactively; only remount when the path changes
  return <div key={path}>{route()}</div>;
}

createRoot(document.getElementById("root")!).render(<App />);

/**
 * Single-file build entry: the whole DeltaLine app in one HTML page with
 * hash routing (#/projects, #/design/<id> …). Built by `npm run build:html`.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
// @ts-expect-error text import handled by esbuild
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs";
import Home from "@/app/page";
import ProjectsPage from "@/app/projects/page";
import EstimatesPage from "@/app/estimates/page";
import QuickEstimatePage from "@/app/estimates/quick/page";
import MaterialsPage from "@/app/materials/page";
import ProductsPage from "@/app/products/page";
import CustomersPage from "@/app/customers/page";
import ReportsPage from "@/app/reports/page";
import SettingsPage from "@/app/settings/page";
import { Workspace } from "@/components/editor/Workspace";

(globalThis as { __PDF_WORKER_SRC__?: string }).__PDF_WORKER_SRC__ = URL.createObjectURL(new Blob([pdfWorkerSource as string], { type: "text/javascript" }));

const ROUTES: Record<string, () => React.ReactElement> = {
  "/": () => <Home />,
  "/projects": () => <ProjectsPage />,
  "/estimates": () => <EstimatesPage />,
  "/estimates/quick": () => <QuickEstimatePage />,
  "/materials": () => <MaterialsPage />,
  "/products": () => <ProductsPage />,
  "/customers": () => <CustomersPage />,
  "/reports": () => <ReportsPage />,
  "/settings": () => <SettingsPage />,
};

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
  const route = ROUTES[path] ?? ROUTES["/"];
  // remount on query change so pages re-read their parameters
  return <div key={full.split("#")[0]}>{route()}</div>;
}

createRoot(document.getElementById("root")!).render(<App />);

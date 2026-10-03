import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeltaLine Irrigation CRM",
  description: "The operating system for an irrigation contractor: leads, customers, properties, zone-level system records, estimates, jobs, dispatch, invoicing, inventory, job costing and Design Studio plans.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f6490" };

// applied before paint so dark mode never flashes
const themeScript = `try{var t=localStorage.getItem("crm-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body className="font-sans text-[13px]">{children}</body>
    </html>
  );
}

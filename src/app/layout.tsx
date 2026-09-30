import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeltaLine Irrigation — Design & Planning",
  description: "Professional landscape irrigation design: site drawing, head-to-head sprinkler layout, zoning, hydraulics, material takeoff, estimating and installer-ready PDF plans.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body className="font-sans text-[13px]">{children}</body>
    </html>
  );
}

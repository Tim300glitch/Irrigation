# DeltaLine Irrigation — CRM & Design Studio

The operating system for an irrigation contractor: leads, customers, properties, zone-level
irrigation system records and maps, Good/Better/Best estimates with e-signature, jobs, scheduling,
dispatch, a mobile technician app, invoicing and payments, inventory and truck stock, time
tracking, job costing, service plans, audits, reports, marketing ROI, automations, a customer portal
and an online booking form — plus the **Design Studio** for engineering-grade system design
(hydraulics, coverage, takeoff, PDF plan sets).

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # business-logic & engineering unit tests (vitest)
npm run test:sql     # applies supabase/migrations to an in-memory Postgres and smoke-tests them
npm run typecheck
npm run build        # production build
npm run build:html   # single-file build: dist/deltaline-irrigation.html (hash routing)
```

The app opens on the owner dashboard with a realistic year of demo history (customers, properties,
zones, jobs, invoices, payments, time, inventory, campaigns, plans, audits). Data is stored locally in
IndexedDB until Supabase is configured (`.env.example`). Use the account menu → **View as…** to
preview roles (e.g. a technician lands in the mobile Technician App). Settings → Data resets the demo.

**Architecture, database design, information architecture and workflows:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).**

```
supabase/migrations   PostgreSQL schema (53 tables, RLS, views, global_search, triggers)
src/lib/crm           domain types, row mapping, repository (IndexedDB / Supabase), auth,
                      calc (pricing, estimates, invoices, job costing, audits, warranties),
                      workflows, metrics, recommendations, automations, search, integrations, seed
src/store/crmStore.ts CRM state + workflow actions (optimistic, persisted, activity-logged)
src/components/crm    shell, command palette, quick create, charts, tables, system map,
                      line items, photos, pages/* (one module per area)
src/app               routes (CRM + Design Studio)
```

---

## Design Studio

Browser-based professional landscape irrigation design & planning — site drawing, head-to-head
sprinkler layout, zoning, real hydraulic analysis, design validation, material takeoff, cost
estimating and installer-ready PDF plan sets.

The Design Studio (`/studio`, `/projects`) opens seeded with a complete demo (Hernandez Residence — 17 gear rotors,
3 zones, manifold, mainline, laterals, sleeves, controller) plus sample projects. All data is stored
locally in IndexedDB and autosaved; Settings → "Reset demo data" restores the samples.

## Workflow

1. **New Project** — blank, lot dimensions, uploaded plan (PNG/JPG/PDF, calibrate with 2 clicks) or
   aerial image from an address (Esri imagery / OSM geocoding; no bundled keys).
2. **Draw the site** — polygon / rectangle / circle areas (lawn, beds, house, driveway, pavers, patio,
   pool…), fences, walls, trees, labels. Areas show square footage; vertices are editable.
3. **Water source** — static/dynamic PSI, meter, service line, backflow, PRV, bucket-test calculator.
4. **Sprinklers** — Auto-Design an area (corners → perimeter → interior → gap fill, arcs aimed away
   from hardscape, nozzles matched for precipitation) or place heads manually. Drag the white arc
   handles to change the arc and the **orange handle to adjust throw distance**.
5. **Zones** — Auto zone (flow limit, head type, hydrozone) or assign manually; manifold tools.
6. **Pipe** — Auto route (branched / end-fed / center-fed / looped with a uniformity comparison) or draw
   pipe (P). Pan any time with Space-drag, middle/right-drag or the wheel — pipe runs are committed
   segment by segment so panning never loses work. Place fittings (tee, 90°, 45°, coupling, reducer…).
7. **Checks & Assistant** — errors / warnings / recommendations computed from the design; click to zoom.
8. **Materials, Estimate, Schedule, Export PDF** (Letter, A4, 11×17, A3, 24×36; color or ink-saver).

The top bar has one button per cursor tool (select, pan, pipe, sprinkler, fitting, valve, measure,
dimension, text). Rulers along the canvas edges show distances in feet. Press `?` for shortcuts.

## Architecture

```
src/lib/geometry      2D geometry (feet, y-down), polygon ops, snapping primitives
src/lib/units         imperial formatting/parsing (metric display hooks)
src/lib/model         data model (types.ts), factories, demo projects
src/lib/catalog       sprinkler/nozzle product database (registerCatalog for manufacturer data)
src/lib/hydraulics    formulas.ts (Hazen-Williams, velocity, elevation), pipe IDs, component loss
                      curves, network builder, zone analysis (tree + Hardy-Cross loops)
src/lib/irrigation    sprinkler performance, coverage/heatmap/overspray, auto layout, auto zone,
                      auto route, design check, scheduling & water use, labels
src/lib/materials     takeoff (fittings inferred from network topology), pricing DB, estimate
src/lib/plan          printable plan SVG renderer, symbology, installer reference locations
src/lib/pdf           PDF sheet composition (jsPDF + svg2pdf, vector)
src/lib/maps          MapProvider interface (aerial imagery / geocoding)
src/lib/storage       Repository interface + IndexedDB implementation (swap for Postgres/Supabase)
src/store             zustand stores: project document (undo/redo), editor UI, analysis, app data
src/components/editor workspace shell, SVG canvas engine (tools, handles, hit-test, snapping),
                      panels, dialogs
src/components/app    studio overview, studio shell (inside the CRM shell), new-project flow
src/app               Next.js routes (studio, projects, design/[id], projects/estimates, materials,
                      products, projects/reports, settings/design)
```

Engineering calculations are isolated, documented in code (formulas and assumptions) and covered by
unit tests in `src/lib/__tests__`. Generic product and price data are representative placeholders —
load manufacturer data and supplier pricing for final design and bids.

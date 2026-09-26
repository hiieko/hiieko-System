# HIIEKO Solar Configurator

Entry point for anyone working on the HIIEKO Solar Engineering / PV Mounting System Configurator.

## What this is

A parametric solar-project configuration tool that will grow into a professional PV mounting-system engineering tool (inspired by systems such as ISOTEC Solarpro Configurator), but designed for HIIEKO's own mounting products, PV systems, engineering workflow, inventory, procurement, documents, and future ERP integration.

The core idea: a **single parametric Solar design model is the source of truth**, from which 2D, 3D, BOM, and (later) engineering/document outputs are all derived.

```
                 SOLAR DESIGN MODEL
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
        2D CAD         3D          BOM
```

## Business objective

Add a serious Solar engineering configurator to the existing HIIEKO management platform. Long term this supports roof geometry, PV module placement, mounting-system selection, automatic BOM, technical drawings, 3D visualization, structural engineering calculations, PDF/DXF output, and (later) quotation/inventory/procurement/ERP integration.

> This is **NOT** just a 3D viewer. The parametric model — not the 3D scene — is the database of record.

## Current implementation status

The Solar vertical slice has progressed through three architecture phases:

```
A–G Surface Foundation → H Interactive 2D Editor → I SiteObject Architecture
```

## CURRENT STATUS

**Completed:**
- **A–G — Surface Foundation**: generalized `Surface` (`surface_type`: ROOF/GROUND/GRASS/GRAVEL/ROCK/ASPHALT/CONCRETE/PARKING/CARPORT/CUSTOM), explicit elevation (`origin.z`) + `thickness_mm`, rectangular surface creation UI, 2D + 3D surface representation, module-attachment proof.
- **H — Interactive 2D Editor**: pointer-based module drag, rotation, duplicate, delete, multi-select, zoom/pan/fit, grid + snapping, measurement, undo/redo, debounced persistence, live 2D→3D sync.
- **I — SiteObject Architecture**: generalized `SiteObject` type + `Pose` + `SiteObjectType`, generic editor operations (`T extends Placeable`), a single world transform (`surfaceToPlane`/`objectWorldPosition`); PV module proven through the generalized path (non-destructive).

**Known issues:**
- BOM/mounting are stale after manual edits until `recalculate` (which recomputes and overwrites manual positions).
- 2D shows one active surface at a time (combined site view deferred).
- Obstacles are selectable but not draggable/resizable.
- Undo/redo via toolbar buttons only (no keyboard shortcuts).

**Next:** Persist the first non-module `SiteObject` end-to-end (additive `solar_site_objects` table + minimal 2D/3D renderer), then the combined top-down site plan, then client-side BOM recompute after edits.

The full vertical slice works end-to-end:

```
Project → Solar Design → surface → PV module → layout → interactive 2D plan → 3D preview → prototype BOM
```

Everything is **clearly prototype/demo** where engineering quantities are involved — no structural, Eurocode, or compliance claims are made.

## Where the Solar code lives

| Layer | Path |
|---|---|
| Shared domain (pure) | `shared/src/solar/` |
| Backend module | `backend/src/modules/solar/` |
| Frontend feature | `web/src/features/solar-configurator/` |
| Frontend route | `web/src/app/solar-configurator/` |
| Prisma models | `backend/prisma/schema.prisma` (Solar models + enums) |
| Migrations | `backend/prisma/migrations/20260926090000_add_solar_domain/`, `.../20260926120000_add_surface_type/` |
| Tests | `backend/test/solar-*.spec.ts` |

Key shared modules: `types.ts`, `geometry.ts`, `viewport.ts` (2D viewport/snap), `editor.ts` (generic object ops), `history.ts` (undo/redo), `site-object.ts` (world transform + mapping), `layout.ts`, `mounting.ts`, `bom.ts`.

## What is currently implemented

- Create a `SolarDesign` linked to an existing `Project`.
- Define a **surface** — rectangular (width/length/elevation/slope/azimuth/surface-type/thickness) or arbitrary polygon — persisted as a surface-local polygon + `origin`/`slopeDeg`/`azimuthDeg`.
- Pick a demo PV module + orientation + edge/row/column spacing.
- Automatically compute a module layout (surface-local placements).
- **Interactively edit modules** in the 2D plan: drag, rotate, duplicate, delete, multi-select, zoom/pan/fit, grid + snapping, measurement, undo/redo.
- Persist edits via a debounced bulk-placement save (`PUT /designs/:id/placements`).
- Render the same placement data as an **interactive 2D SVG plan** and a **3D scene** (React Three Fiber) with live synchronization.
- Compute a **prototype BOM** (module count, rail length in mm, hook/clamp/fastener/EPDM counts).
- Generalize placement into a `SiteObject` model (PV module is the first concrete object).
- Enforce JWT auth + role checks + **project isolation** (a user cannot read another project's design by ID).

## What is NOT implemented yet

- **DEFERRED** (schema exists, not yet used): design revisions/snapshots (`SolarDesignVersion`, `SolarBomSnapshot`, `SolarBomItem`), product compatibility, mounting-system families, product catalog management UI.
- **FUTURE**: non-module `SiteObject`s (structures/inverters/cameras/cables), combined top-down site plan, electrical schematic, engineering calculations (wind/snow/deflection), documents/DXF, quotations, inventory/procurement/ERP, customer portal, mobile workflow, GIS/shading, sun path, terrain.
- **NOT VALIDATED**: the migrations have not been run against a real PostgreSQL; no browser/runtime smoke test was executed; no structural calculations are validated.

## Relationship to existing `Project`

`SolarDesign` is a **child of `Project`** (`SolarDesign.project_id → Project.id`, cascade delete). There is no second, independent "project" entity. Conceptually:

```
Project
   └── SolarDesign
          ├── roof sections
          ├── PV layout (placements)
          ├── layout settings
          └── (later) mounting / BOM snapshot / engineering / documents
```

## Relationship to `Material` / inventory (conceptual)

`SolarProduct` (the engineering catalog) is **separate from** `Material` (the inventory/warehouse entity).

- `Material` = generic inventory/warehouse/procurement (stock, lots, movements, PO items).
- `SolarProduct` = engineering attributes (geometry, cross-section, alloy, compatibility, CAD ref, structural parameters).

The intended data flow is: **Engineering catalog → BOM → Inventory/Procurement**, never engineering data inside warehouse rows. `SolarProduct.material_id` is an **optional** bridge to `Material` for later procurement integration (currently reserved — no real products are seeded).

## Current known limitations

- BOM/mounting values are **stale after manual module edits** until `recalculate` (which recomputes the layout and overwrites manual positions).
- 2D shows **one active surface** at a time; the combined top-down site view is deferred.
- Obstacles are **selectable but not draggable/resizable** yet.
- Undo/redo are toolbar buttons only (no keyboard shortcuts).
- 3D renders roof + modules, but **not** rails; modules are individual meshes (not `InstancedMesh`).
- `SiteObject` is a **type-level generalization** — no dedicated `solar_site_objects` table/API yet (PV module remains the only persisted object type).
- Granular `solar.*` permission strings are not implemented; authorization uses role checks (`@Roles`) + project isolation guards.
- Demo catalog is `DEMO`-marked and contains **no** fabricated structural/load values.
- No live PostgreSQL was available, so the migrations are **not deployed/tested**.

## Validation status

- ✅ Shared build (`npm run build --workspace=shared`)
- ✅ Backend typecheck (`npx tsc --noEmit` in `backend/`)
- ✅ Web typecheck (`npx tsc --noEmit` in `web/`)
- ✅ Full backend test suite: **27 suites / 232 tests passing** (includes 7 Solar suites)
- ❌ Browser/runtime smoke test: **NOT EXECUTED** (no browser automation; no live DB/auth)
- ❌ PostgreSQL migration: **NOT DEPLOYED** (no live DB available)

## References in this folder

- `ARCHITECTURE.md` — source-of-truth principle, layers, units, coordinate system, editor/state architecture.
- `DOMAIN-MODEL.md` — every Solar model/type, purpose, fields, relationships, status.
- `API.md` — the actual implemented HTTP API + authorization rules.
- `SITE-OBJECT.md` — the generalized SiteObject placement architecture.
- `PHASES.md` — phase-by-phase progress (A–G, H, I).
- `ROADMAP.md` — roadmap and phase status.
- `DECISIONS.md` — architecture decision records.
- `TESTING.md` — test/validation setup and status.
- `M1-PROGRESS.md` — historical M1 section-by-section progress document.

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

**Milestone 1 (configurator foundation) is implemented.** The full vertical slice works end-to-end (see `M1-PROGRESS.md`):

```
Project → Solar Design → rectangular roof → PV module → automatic layout → 2D plan → 3D preview → prototype BOM
```

Everything in M1 is **clearly prototype/demo** where engineering quantities are involved — no structural, Eurocode, or compliance claims are made.

## Where the Solar code lives

| Layer | Path |
|---|---|
| Shared domain (pure) | `shared/src/solar/` |
| Backend module | `backend/src/modules/solar/` |
| Frontend feature | `web/src/features/solar-configurator/` |
| Frontend route | `web/src/app/solar-configurator/` |
| Prisma models | `backend/prisma/schema.prisma` (Solar models + enums) |
| Migration | `backend/prisma/migrations/20260926090000_add_solar_domain/` |
| Tests | `backend/test/solar-*.spec.ts` |

## What M1 currently does

- Create a `SolarDesign` linked to an existing `Project`.
- Define a **rectangular** roof (width/length in m, slope/azimuth in degrees) — persisted as a roof-local polygon.
- Pick a demo PV module + orientation + edge/row/column spacing.
- Automatically compute a module layout (roof-local placements).
- Render the same placement data as a **2D SVG plan** and a **3D scene** (React Three Fiber).
- Compute a **prototype BOM** (module count, rail length in mm, hook/clamp/fastener/EPDM counts).
- Enforce JWT auth + role checks + **project isolation** (a user cannot read another project's design by ID).

## What is NOT implemented yet

See `M1-PROGRESS.md` for the full status table. Summary:

- **DEFERRED** (schema exists, not yet used): design revisions/snapshots (`SolarDesignVersion`, `SolarBomSnapshot`, `SolarBomItem`), obstacles/keep-out zones, product compatibility, mounting-system families, product catalog management UI.
- **FUTURE**: engineering calculations (wind/snow/deflection), documents/DXF, quotations, inventory/procurement/ERP, customer portal, mobile workflow, GIS/shading.
- **NOT VALIDATED**: the migration has not been run against a real PostgreSQL; no browser/runtime smoke test was executed; no structural calculations are validated.

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

- M1 supports **rectangular roofs + rectangular modules in a regular grid only**. Obstacles/arbitrary polygons are deferred (the layout engine currently uses the roof's axis-aligned bounding box).
- 3D viewer renders roof + modules, but **not** rails; modules are individual meshes (not `InstancedMesh`).
- Granular `solar.*` permission strings are not implemented; authorization uses role checks (`@Roles`) + project isolation guards.
- Demo catalog is `DEMO`-marked and contains **no** fabricated structural/load values.
- No live PostgreSQL was available, so the migration is **not deployed/tested**.

## Validation status

- ✅ Shared build (`npm run build --workspace=shared`)
- ✅ Web typecheck (`npm run typecheck --workspace=web`)
- ✅ Web production build (`npm run build --workspace=web`)
- ⚠️ Backend typecheck: blocked by **pre-existing, unrelated** `TRANSFER_IN`/`TRANSFER_OUT` inventory errors (untouched)
- ✅ Solar tests: **5 suites / 23 tests passing**
- ⚠️ Full backend tests: **84 passing**, one pre-existing inventory suite fails to compile (same unrelated issue)
- ❌ Browser/runtime smoke test: **NOT EXECUTED** (no browser automation; no live DB/auth)
- ❌ PostgreSQL migration: **NOT DEPLOYED** (no DB available)

## References in this folder

- `ARCHITECTURE.md` — source-of-truth principle, layers, units, coordinate system.
- `DOMAIN-MODEL.md` — every Solar model/type, purpose, fields, relationships, status.
- `API.md` — the actual implemented HTTP API + authorization rules.
- `M1-PROGRESS.md` — the main section-by-section progress/status document.

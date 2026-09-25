# Solar Architecture Decisions

Last Updated: 2026-09-25

Architecture Decision Records (ADR) for the HIIEKO Solar Configurator. Each entry documents what was actually decided and its current status.

Status values:

- **ACCEPTED** — decision is implemented in the current code.
- **DEFERRED** — decision is made but the implementation is not yet built (reserved in schema/design where applicable).

---

## D-01 — Solar is an isolated vertical module

- **Decision**: Implement Solar as an isolated vertical slice — `shared/src/solar/`, `backend/src/modules/solar/`, `web/src/features/solar-configurator/`, `web/src/app/solar-configurator/` — rather than weaving Solar into existing generic modules.
- **Reason**: Keeps the Solar domain portable and avoids coupling unrelated business logic (inventory, attendance, procurement) to Solar.
- **Consequence**: Clear boundaries; Solar can later migrate to a newer HIIEKO project with minimal coupling.
- **Status**: ACCEPTED.

## D-02 — `shared/src/solar/` is the portable domain layer

- **Decision**: Put pure Solar domain types and engines in `@solar/shared` under `shared/src/solar/`.
- **Reason**: One source of truth for types/calculations shared by web and backend (and mobile later).
- **Consequence**: `shared/src/solar/` has zero React/DOM/Three.js/Prisma/NestJS dependencies.
- **Status**: ACCEPTED.

## D-03 — The parametric Solar model is the source of truth

- **Decision**: The parametric design model is authoritative; 2D, 3D, and BOM are projections of it. The 3D scene is never the database.
- **Reason**: Changing a parameter must regenerate dependent representations consistently.
- **Consequence**: No geometry state is duplicated across 2D/3D/BOM.
- **Status**: ACCEPTED.

## D-04 — Roof-local coordinates are canonical

- **Decision**: `SolarModulePlacement` uses roof-local coordinates (`localX/localY/localZ`) as the source of truth; world coordinates are derived only by `roofLocalToWorld`.
- **Reason**: Supports multiple roof planes with different slopes/azimuths later without changing the model.
- **Consequence**: World-space XYZ is never persisted; 2D draws roof-local directly, 3D applies the transform.
- **Status**: ACCEPTED.

## D-05 — Geometry uses canonical millimetres

- **Decision**: All Solar geometry is stored/computed in millimetres; angles in degrees (radians only at the rendering boundary).
- **Reason**: Avoid unit mixing; engineering CAD convention.
- **Consequence**: Metres appear only at presentation boundaries; `GEOMETRY_EPSILON_MM` is the shared float-comparison epsilon.
- **Status**: ACCEPTED.

## D-06 — Three.js / React Three Fiber is presentation only

- **Decision**: 3D (three.js + R3F + drei) renders the model; it contains no domain logic and no hard-coded panel grid.
- **Reason**: Keep the model authoritative and the viewer replaceable.
- **Consequence**: `viewer3d/SolarScene.tsx` is client-only (`'use client'`, dynamic import `ssr:false`) and derives positions via `roofLocalToWorld`.
- **Status**: ACCEPTED.

## D-07 — 2D and 3D consume the same placement data

- **Decision**: `RoofPlan2D` and `SolarScene` both consume the same `ModulePlacement[]`.
- **Reason**: Guarantees the 2D plan and 3D scene never diverge.
- **Consequence**: A single placements array feeds both renderers.
- **Status**: ACCEPTED.

## D-08 — `SolarProduct` is separate from `Material`

- **Decision**: Keep the engineering catalog (`SolarProduct`) separate from the inventory/warehouse entity (`Material`).
- **Reason**: `Material` is generic inventory (stock/lots/movements/PO items); engineering attributes (geometry, cross-section, alloy, compatibility, CAD, structural) don't belong in warehouse rows.
- **Consequence**: Data flow is Engineering catalog → BOM → Inventory/Procurement; engineering data never pollutes warehouse queries.
- **Status**: ACCEPTED.

## D-09 — `SolarProduct.material_id` is the future inventory/procurement bridge

- **Decision**: Reserve `SolarProduct.material_id → Material` (nullable, `onDelete: SetNull`) as the optional link to inventory/procurement.
- **Reason**: Separates engineering from procurement now, while reserving the bridge for later BOM→procurement integration.
- **Consequence**: Implemented in the schema; currently unused (no real products are linked to materials).
- **Status**: ACCEPTED (reserved; integration deferred).

## D-10 — Prisma is the Solar migration system

- **Decision**: Use Prisma migrations (`backend/prisma/migrations/`) as the authoritative Solar schema/migration mechanism.
- **Reason**: The active backend uses Prisma; it is the single migration source of truth.
- **Consequence**: The Solar migration is `20260926090000_add_solar_domain/` (generated, additive).
- **Status**: ACCEPTED.

## D-11 — Legacy `database/` Supabase migrations are not used for Solar

- **Decision**: Do not touch `database/migrations/` or `database/archive/` for Solar; they are legacy Supabase dual-run artifacts.
- **Reason**: The active migration system is Prisma; the legacy SQL path is not the Solar migration path.
- **Consequence**: Solar schema/migration live only under `backend/prisma/`.
- **Status**: ACCEPTED.

## D-12 — Solar API is isolated from the generic API layer

- **Decision**: Keep all Solar endpoint methods in `web/src/features/solar-configurator/api/solar.ts`; do not bloat `web/src/lib/api-client.ts`.
- **Reason**: Keep the Solar feature self-contained and portable.
- **Consequence**: `api-client.ts` was touched only to export `API_BASE_URL` and make `request` public; Solar reuses the existing client/token handling.
- **Status**: ACCEPTED.

## D-13 — Project access is enforced server-side

- **Decision**: Every Solar route enforces JWT auth + role checks + project isolation; a user must not access another project's `SolarDesign` by ID.
- **Reason**: Authorization must not rely on client-side filtering.
- **Consequence**: `SolarDesignAccessGuard` (design→project membership) and `ProjectAccessGuard` (list/create) are used; design listing requires `projectId`.
- **Status**: ACCEPTED.

## D-14 — Prototype mounting/BOM logic is not structural engineering

- **Decision**: M1 mounting and BOM rules are clearly marked prototype/demo and are **not** structural engineering calculations.
- **Reason**: Real structural rules depend on validated HIIEKO products and engineering review.
- **Consequence**: No Eurocode/National-Annex/load-capacity compliance is claimed; demo products carry no `structural_properties`.
- **Status**: ACCEPTED.

## D-15 — Historical revisions must be reproducible using snapshot/engine versions

- **Decision**: `SolarDesignVersion.snapshot` must embed schema + engine version metadata so old revisions never silently change when algorithms are upgraded; restore creates a new revision.
- **Reason**: Engineering designs need auditable, reproducible revision history.
- **Consequence**: `engine-versions.ts` defines `SOLAR_ENGINE_VERSIONS`/`SOLAR_SNAPSHOT_SCHEMA_VERSION`; the snapshot-writing code is not yet built (revisions deferred).
- **Status**: DEFERRED (constants defined; no version code yet).

## D-16 — DXF before DWG

- **Decision**: Target DXF output first; DWG only via a licensed/external solution if technically justified.
- **Reason**: DXF is an open, tractable format; DWG is proprietary.
- **Consequence**: Documents/CAD are deferred; no CAD export exists yet.
- **Status**: DEFERRED.

## D-17 — CAD binaries are not stored directly in PostgreSQL

- **Decision**: Reference CAD/DXF/STEP/PDF files via the existing `StorageService` + polymorphic `Attachment` model, never as binary blobs in PostgreSQL.
- **Reason**: Keep binaries out of the relational DB; reuse the existing storage abstraction.
- **Consequence**: Deferred until the documents/CAD milestone; `LocalStorageService`'s MIME map will need CAD extensions.
- **Status**: DEFERRED.

## D-18 — Solar documentation is kept under `Project workflow/solar`

- **Decision**: All Solar documentation lives in `Project workflow/solar/` only.
- **Reason**: Centralize and isolate Solar docs without scattering Markdown across the repo.
- **Consequence**: `README.md`, `ARCHITECTURE.md`, `DOMAIN-MODEL.md`, `API.md`, `M1-PROGRESS.md`, `ROADMAP.md`, `DECISIONS.md`, `TESTING.md`.
- **Status**: ACCEPTED.


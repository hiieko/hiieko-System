# Solar Architecture

## Core principle

> **One parametric Solar model → 2D + 3D + BOM + later engineering/document outputs.**

The parametric Solar design model is the single source of truth. The 3D scene, the 2D plan, and the BOM are all **projections** of the same model — they never store geometry independently, and the 3D scene is **not** the database.

```
              PARAMETRIC SOLAR DESIGN MODEL
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    2D (SVG)         3D (R3F)           BOM
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                  (later) engineering → documents
```

If a roof dimension, slope, polygon, obstacle, module, orientation, or spacing changes, the dependent representations are regenerated from the model.

## Layers

### Shared domain layer — `shared/src/solar/`

Pure TypeScript, zero dependencies on React/DOM/Three.js/Prisma/NestJS. It holds:

| File | Purpose |
|---|---|
| `units.ts` | Canonical units + `degToRad`/`radToDeg`. |
| `types.ts` | Domain types (roof, module, placement, BOM, design model). |
| `geometry.ts` | `GEOMETRY_EPSILON_MM`, polygon ops, `roofLocalToWorld`/`worldToRoofLocal`. |
| `engine-versions.ts` | Snapshot schema + engine version constants. |
| `layout.ts` | Pure PV layout engine (`computeLayout`). |
| `mounting.ts` | **Prototype** mounting rule engine (`computeMounting`). |
| `bom.ts` | Pure BOM derivation (`computeBom`). |

The engines are pure functions, run identically client-side (instant preview) and server-side (canonical persistence/validation). This is what keeps 2D/3D/BOM consistent.

### Backend — `backend/src/modules/solar/`

NestJS module that persists the model and runs the shared engines server-side:

- `solar.controller.ts` — HTTP endpoints.
- `solar.service.ts` — orchestration (CRUD, roof, layout, BOM, catalog).
- `solar.util.ts` — Prisma row ↔ domain model mapping + `runEngines()`.
- `guards/solar-design-access.guard.ts` — project isolation for design-scoped routes.
- `dto/` — class-validator DTOs.

### Frontend — `web/src/features/solar-configurator/` and `web/src/app/solar-configurator/`

- State/handlers live in the page; components are presentational projections.
- `api/solar.ts` — all Solar endpoint methods (isolated from the generic client).
- `layout/RoofPlan2D.tsx` — 2D SVG projection.
- `viewer3d/SolarScene.tsx` — 3D R3F projection (dynamic import, `ssr:false`).
- `bom/BomPanel.tsx`, `components/SummaryPanel.tsx` — BOM/summary projections.

## Canonical units

| Quantity | Unit |
|---|---|
| Geometry | **millimetres (mm)** — never metres, never mixed |
| Mass | kilograms (kg) |
| Force | newtons (N) / kilonewtons (kN) |
| Pressure | kilopascals (kPa) |
| Angles | **degrees** in the domain/persistence model |
| Electrical | volts (V), amperes (A), watts (W) |
| Energy | kilowatt-hours (kWh) — later |

Angles are converted to **radians only at the Three.js rendering boundary** via `degToRad`. Metres appear only at presentation/rendering boundaries (SVG labels, BOM display, `MM_TO_M` in the 3D scene).

## Coordinate system (implemented exactly)

Read from `shared/src/solar/geometry.ts` and `types.ts`:

| Axis / term | Definition |
|---|---|
| local **+X** | roof-plane horizontal (ridge) axis |
| local **+Y** | roof down-slope axis |
| local **+Z** | roof normal (upward, away from the surface) |
| **origin** | world anchor point of the roof section (mm) |
| **azimuth** | direction of +Y (down-slope), measured **clockwise from geographic North** (deg) |
| **slope** | rotation from horizontal about the local +X axis (deg); 0 = flat |
| **world transform** | `world = origin + Rz(-azimuth) · Rx(-slope) · local` |

- `roofLocalToWorld(plane, p)` — local → world (applied in the 3D scene).
- `worldToRoofLocal(plane, p)` — inverse.
- Persisted placement geometry is **roof-local mm** (`localX/localY/localZ`). World-space XYZ is never persisted.
- Each roof section carries its own `origin`/`slopeDeg`/`azimuthDeg`, so multiple roof planes with different slopes/azimuths are supported later without changing the model.

## Projections

- **2D**: `RoofPlan2D` draws `(localX, localY)` directly in SVG.
- **3D**: `SolarScene` builds a per-roof basis matrix from `roofLocalToWorld` and renders modules as boxes in roof-local coordinates inside that basis.
- **BOM**: `computeBom(placements, moduleSpec, mounting)` — derived from placements, never manual.

Both 2D and 3D consume the **same** `ModulePlacement[]`.

## Backend orchestration

`SolarService.calculateLayout()` → `loadDesignModel()` (assemble model) → `runEngines()` (shared `computeLayout`/`computeMounting`/`computeBom`) → persist placements in a transaction → return `{ placements, mounting, bom, totalModules, totalPowerWp }`.

`getBom()` returns the same computed result without persisting.

## Prisma persistence

12 Solar models + 6 enums in `schema.prisma`. The editable working set (design, roof sections, layout settings, placements) is **mutable**; `SolarDesignVersion`/`SolarBomSnapshot`/`SolarBomItem` are designed as **immutable historical data** (deferred — no code writes them yet).

## Authorization / project isolation

- Every Solar route: `JwtAuthGuard` (auth) + `RolesGuard` (role checks).
- Listing requires a `projectId` and `ProjectAccessGuard`; the controller rejects a missing `projectId`.
- Design-scoped routes use `SolarDesignAccessGuard`, which resolves design → `project_id` and checks membership (with Admin/Owner/PM/Manager bypass).
- **A user must not access another project's `SolarDesign` merely by knowing its ID.**

## Portability

`shared/src/solar/`, `web/src/features/solar-configurator/`, and `backend/src/modules/solar/` are deliberately isolated from unrelated business logic, so the Solar vertical slice can later be migrated into a newer HIIEKO project with minimal coupling.

## Dependency boundaries

- `shared/src/solar/` → nothing app-specific (only `./units`, `./types`, `./geometry`).
- `backend/src/modules/solar/` → `@solar/shared`, `common/prisma`, `common/audit`, `common/auth` guards. No other feature modules.
- `web/src/features/solar-configurator/` → `@solar/shared` + its own `api/solar.ts` (reusing the existing `apiClient`).

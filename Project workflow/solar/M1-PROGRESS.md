# M1 Progress — Solar Configurator Foundation

Main status document for the HIIEKO Solar Configurator.

**Status legend**

- ✅ COMPLETE
- ⚠️ PARTIAL / LIMITATION
- ⏳ DEFERRED (schema/type exists, not used yet)
- ❌ NOT IMPLEMENTED / NOT VALIDATED

**M1 scope**: `Project → Solar Design → rectangular roof → PV module → automatic layout → 2D plan → 3D preview → prototype BOM`.

---

## Shared domain (`shared/src/solar/`)

| Area | Status | Notes |
|---|---|---|
| Units (`units.ts`) | ✅ COMPLETE | mm/kg/N/kPa/degrees/V/A/W documented; `degToRad`/`radToDeg`; radians only at 3D boundary. |
| Geometry (`geometry.ts`) | ✅ COMPLETE | `GEOMETRY_EPSILON_MM`, polygon area, point-in-polygon, rect↔polygon intersection, `roofLocalToWorld`/`worldToRoofLocal`. |
| Coordinate system | ✅ COMPLETE | Roof-local +X=ridge, +Y=down-slope, +Z=normal; azimuth clockwise from North; `world = origin + Rz(-azimuth)·Rx(-slope)·local`. |
| Layout (`layout.ts`) | ✅ COMPLETE | `computeLayout` — deterministic grid; ⚠️ uses axis-aligned bounding box (rectangles only; arbitrary polygons deferred). |
| Prototype mounting (`mounting.ts`) | ✅ COMPLETE (prototype) | `computeMounting` — rails/hooks/clamps/fasteners/EPDM, deterministic, clearly non-structural. |
| BOM (`bom.ts`) | ✅ COMPLETE (prototype) | `computeBom` — derived from placements; rail length in mm. |
| Engine versions (`engine-versions.ts`) | ⚠️ PARTIAL | Constants defined (`SOLAR_ENGINE_VERSIONS`, `SOLAR_SNAPSHOT_SCHEMA_VERSION`); ⏳ not yet consumed by any snapshot code (M4). |

---

## Database

| Area | Status | Notes |
|---|---|---|
| Solar schema | ✅ COMPLETE | 12 models + 6 enums in `schema.prisma` (see `DOMAIN-MODEL.md`). |
| Migration | ✅ GENERATED | `20260926090000_add_solar_domain/migration.sql` (additive: create tables/types/indexes/FKs). |
| Migration status | ⚠️ VALIDATED, NOT DEPLOYED | `prisma validate` passes; **not run against a live PostgreSQL** (no DB available). |
| Seed | ✅ COMPLETE | Demo catalog (`DEMO-` module spec + products) integrated into existing `backend/prisma/seed.ts`. |
| PostgreSQL deployment | ❌ NOT DEPLOYED | No `backend/.env`/live DB; `prisma migrate dev`/`deploy` and `seed` were not executed. |

---

## Backend (`backend/src/modules/solar/`)

| Area | Status | Notes |
|---|---|---|
| Solar module | ✅ COMPLETE | `solar.module.ts`, `solar.controller.ts`, `solar.service.ts`, `solar.util.ts`, `guards/solar-design-access.guard.ts`, `dto/`. |
| Design CRUD | ✅ COMPLETE | create / list / get (`GET /api/solar/designs`, `POST /api/solar/designs`, `GET /api/solar/designs/:id`). |
| Roof | ✅ COMPLETE | `addRoofSection`, `listRoofSections`. |
| Layout | ✅ COMPLETE | `upsertLayoutSettings`, `calculateLayout` (runs shared engines, persists placements). |
| BOM | ✅ COMPLETE | `getBom` (computed, not snapshotted). |
| Catalog | ✅ COMPLETE (read-only) | `listModules`, `listProducts`. |
| Authorization | ✅ COMPLETE | `JwtAuthGuard` + `RolesGuard` + `ProjectAccessGuard`/`SolarDesignAccessGuard`; list requires `projectId`; project isolation enforced. |
| Revisions/snapshots | ⏳ DEFERRED | Schema exists (`SolarDesignVersion`, `SolarBomSnapshot`, `SolarBomItem`); no endpoints/code. |
| Obstacles / compatibility / families | ⏳ DEFERRED | Schema exists; no endpoints/UI. |
| Granular `solar.*` permissions | ❌ NOT IMPLEMENTED | Uses `@Roles` (consistent with existing app). |

---

## Frontend (`web/src/features/solar-configurator/`, `web/src/app/solar-configurator/`)

| Area | Status | Notes |
|---|---|---|
| Route `/solar-configurator` | ✅ COMPLETE | Page in `app/solar-configurator/page.tsx`; sidebar link added. |
| Project selector | ✅ COMPLETE | `ProjectSelector.tsx`. |
| Roof editor | ✅ COMPLETE | `RoofEditor.tsx` (width/length m → mm, slope/azimuth deg). |
| Module selector | ✅ COMPLETE | `ModuleSelector.tsx` (module + orientation + margins/spacing). |
| 2D SVG plan | ✅ COMPLETE | `RoofPlan2D.tsx` — roof boundary, dims, module rectangles from placements. |
| 3D viewer | ✅ COMPLETE (⚠️ rails not rendered) | `SolarScene.tsx` (R3F, `ssr:false`, uses `roofLocalToWorld`); ⚠️ no rails, no `InstancedMesh`. |
| BOM panel | ✅ COMPLETE | `BomPanel.tsx` shows backend-derived BOM. |
| Summary panel | ✅ COMPLETE | `SummaryPanel.tsx` (modules, power, mounting counts). |
| API isolation | ✅ COMPLETE | `api/solar.ts` reuses `apiClient`; no Solar methods in generic client. |

---

## Tests & validation

### Solar test suites (all passing)

| Suite | Tests |
|---|---|
| `solar-geometry.spec.ts` | 12 |
| `solar-layout.spec.ts` | 6 |
| `solar-design-access.guard.spec.ts` | 3 |
| `solar.service.spec.ts` | 20 |
| `solar.controller.spec.ts` | 7 |
| **Total** | **48 tests / 5 suites** |

### Validation commands

| Command | Result |
|---|---|
| `npm run build --workspace=shared` | ✅ PASS |
| `npm run typecheck --workspace=web` | ✅ PASS |
| `npm run build --workspace=web` | ✅ PASS (`/solar-configurator` route prerendered) |
| `npm run typecheck --workspace=backend` | ❌ blocked by **pre-existing unrelated** `TRANSFER_IN`/`TRANSFER_OUT` errors (inventory + stock spec) — untouched |
| `npm test` | ⚠️ **84 tests pass**; 1 pre-existing suite (`stock.service.spec.ts`) fails to compile (same unrelated `TRANSFER_*` issue) |
| Browser/runtime smoke test | ❌ NOT EXECUTED (no browser automation; no live DB/auth) |
| PostgreSQL migration | ❌ NOT DEPLOYED (no DB) |

### Known limitations / gaps (M1)

- Layout uses axis-aligned bounding box (rectangles only); obstacles/arbitrary polygons deferred to M2.
- 3D viewer renders roof + modules, not rails; no `InstancedMesh`.
- Granular `solar.*` permissions not implemented (role-based auth used).
- Engine-version constants not yet consumed (M4 revisions).
- Migration not runtime-tested against PostgreSQL.

### Deferred / future (not in M1)

⏳ Obstacles/keep-out zones · revisions/snapshots · product compatibility · mounting-system families · catalog management UI.
❌ Engineering calculations (wind/snow/deflection) · documents/DXF · quotations · inventory/procurement/ERP · portal · mobile · GIS/shading.


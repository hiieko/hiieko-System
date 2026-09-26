# Solar Phases — Progress

Phase-by-phase progress for the HIIEKO Solar Configurator (after M1/M2 foundation; see
`M1-PROGRESS.md` for the historical M1 detail).

**Status legend**

- ✅ COMPLETE
- ⚠️ PARTIAL / LIMITATION
- ⏳ DEFERRED
- ❌ NOT IMPLEMENTED / NOT VALIDATED

---

## CURRENT STATUS

| Phase | Name | Status |
|---|---|---|
| A–G | Surface Foundation | ✅ COMPLETE |
| H | Interactive 2D Editor | ✅ COMPLETE |
| I | SiteObject Architecture | ✅ COMPLETE |
| J | First non-module SiteObject (persistence) | ⏳ NEXT |

**Known issues:** BOM/mounting stale after manual edits until recalculate · 2D shows one active surface · obstacles not draggable · undo/redo buttons only · `SiteObject` is type-level (no table/API yet) · migrations not deployed against live PostgreSQL.

**Next:** J — persist the first non-module SiteObject end-to-end (additive `solar_site_objects` table + minimal renderer).

---

## Phase A–G — Surface Foundation ✅ COMPLETE

Generalized the roof section into a `Surface` without breaking existing designs.

**Implemented**
- `SolarSurfaceTypeEnum` (ROOF/GROUND/GRASS/GRAVEL/ROCK/ASPHALT/CONCRETE/PARKING/CARPORT/CUSTOM).
- Additive columns `surface_type` (NOT NULL default `ROOF`) + `thickness_mm` on `solar_roof_sections` (migration `20260926120000_add_surface_type`).
- Shared `SolarSurfaceType`, `SurfaceModel` alias, `surfaceType` + `thicknessMm?` on `RoofSectionModel`.
- Surface creation UI: rectangular (width/length/elevation/slope/azimuth/surface-type/thickness) + polygon mode.
- 2D/3D surface representation (elevation = `origin.z` via `roofLocalToWorld`).

**Tests:** surface-transform geometry tests (elevation/slope/azimuth → world).

---

## Phase H — Interactive 2D Editor ✅ COMPLETE

Turned the SVG plan into an interactive editing workspace (SVG kept — no Konva/Fabric/Pixi).

**Implemented**
- Pointer-based module drag (one commit per drag), rotation, duplicate, delete, multi-select.
- Viewport (`zoom/panX/panY`) with wheel zoom, pan, fit, reset; configurable grid + snapping.
- Measurement tool (two points → distance in m).
- Undo/redo (pure `createHistory` + `useHistory`; one history entry per logical operation).
- Debounced persistence via `PUT /designs/:id/placements`.
- Live 2D → 3D synchronization (module rotation applied in `SolarScene`).

**Shared modules added:** `viewport.ts`, `editor.ts`, `history.ts`.

---

## Phase I — SiteObject Architecture ✅ COMPLETE

Established the generalized object placement foundation (non-destructive).

**Implemented**
- Shared `SiteObject` type + `Pose` + `SiteObjectType` (extensible).
- Generic editor ops (`T extends Placeable`) — same code for modules and future objects.
- Single world transform (`surfaceToPlane` / `objectWorldPosition` / `moduleWorldCorners` / `siteObjectWorldOrigin` / `toSiteObject`).
- `SolarScene` refactored to `surfaceToPlane` + a `ModuleMesh` object renderer.
- **No schema/API change** — `ModulePlacement` is the first concrete SiteObject (type-level only).

**Tests:** `solar-site-object.spec.ts` (mapping, surface attachment, local→world, rotation, generic non-module editing, PV module through the generalized path).

---

## Tests & validation

| Item | Status |
|---|---|
| Full backend suite | ✅ **27 suites / 232 tests passing** (7 Solar suites) |
| Shared build | ✅ PASS |
| Backend typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| Browser/runtime smoke test | ❌ NOT EXECUTED (no live DB/auth/browser) |
| PostgreSQL migrations | ❌ NOT DEPLOYED (no live DB) |

---

## Related documents

- `README.md` — entry point + current status.
- `ARCHITECTURE.md` — architecture, state model, SiteObject chain.
- `DOMAIN-MODEL.md` — models/types and their status.
- `SITE-OBJECT.md` — generalized SiteObject placement architecture.
- `API.md` — implemented endpoints.
- `DECISIONS.md` — architecture decision records (D-19…D-27 for these phases).
- `TESTING.md` — test setup and validation status.
- `M1-PROGRESS.md` — historical M1 detail.

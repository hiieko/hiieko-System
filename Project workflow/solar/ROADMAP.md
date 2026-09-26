# Solar Roadmap

Last Updated: 2026-09-26

Status legend:

- ✅ **IMPLEMENTED** (code exists and is validated: shared build + backend/web typechecks + tests)
- ⏳ **DEFERRED / PLANNED** (not yet implemented)
- ❌ **FUTURE / NOT IMPLEMENTED**

---

## M1 — Configurator foundation ✅ IMPLEMENTED

- Project (link a `SolarDesign` to an existing `Project`)
- Solar Design (create/list/get)
- Rectangular roof
- PV module (demo catalog)
- Automatic layout
- Basic 2D plan (SVG)
- 3D preview (R3F)
- Prototype BOM

See `M1-PROGRESS.md` for the detailed section-by-section status.

---

## M2 — Geometry ✅ IMPLEMENTED

- Multiple roof sections
- Arbitrary/parametric polygons (concave supported; simple non-self-intersecting only)
- Obstacles
- Keep-out zones
- Setbacks (exact segment-distance clearance)
- Improved collision logic

Geometry is exact (segment-to-segment minimum distance), not corner/edge sampling. See `DOMAIN-MODEL.md` and `TESTING.md`.

---

## A–G — Surface Foundation ✅ IMPLEMENTED

- Generalized `Surface` (`surface_type` enum + `thickness_mm`; additive `surface_type` column on `solar_roof_sections`).
- Explicit elevation (`origin.z`), slope, azimuth.
- Surface geometry = polygon (local mm) + origin (world mm) + slope/azimuth (single transform).
- Rectangular surface creation UI; 2D + 3D surface representation.
- Module-attachment proof (module follows the surface transform).

---

## H — Interactive 2D Editor ✅ IMPLEMENTED

- Pointer-based module drag / rotate / duplicate / delete / multi-select.
- Zoom / pan / fit / reset; configurable grid + snapping.
- Measurement tool (engineering mm → m).
- Undo / redo (one history entry per logical operation).
- Debounced persistence (`PUT /designs/:id/placements`).
- Live 2D → 3D synchronization.

---

## I — SiteObject Architecture ✅ IMPLEMENTED

- `SiteObject` type + `Pose` + `SiteObjectType` (extensible).
- Generic editor operations (`T extends Placeable`).
- Single world transform (`surfaceToPlane` / `objectWorldPosition` / `moduleWorldCorners`).
- PV module proven through the generalized path (non-destructive; no schema change).

---

## J — First non-module SiteObject (persistence) ⏳ NEXT

- Additive `solar_site_objects` table (+ `object_type`).
- Minimal SiteObject API (project-scoped, reuse `SolarDesignAccessGuard` + the `replacePlacements` pattern).
- Placeholder Structure/Inverter renderer in 2D + 3D.
- End-to-end proof: `Surface → SiteObject → local pose → world pose`.

---

## K — Combined top-down site plan ⏳ PLANNED

- World-projected 2D view of all surfaces (drop Z) — not a separate coordinate system.
- Obstacle dragging + marquee multi-select + keyboard undo/redo.
- Client-side BOM/mounting recompute after edits.

---

## M3 — Engineering catalog ⏳ DEFERRED

- Real HIIEKO products
- Mounting families (schema reserved via `SolarMountingFamily`)
- Compatibility (schema reserved via `SolarProductCompatibility`)
- Mounting systems (`SolarMountingSystem` — not yet created)
- Validated catalog data (schema reserved via `SolarCatalogStatusEnum`)

---

## M4 — Revisions ⏳ DEFERRED

- Immutable revisions (schema reserved via `SolarDesignVersion`)
- Snapshots (with engine/schema versions)
- Compare
- Restore
- Audit

---

## M5 — Documents/CAD ⏳ DEFERRED

- PDF
- BOM documents
- Technical drawings
- DXF
- CAD references

---

## M6 — Structural engineering ⏳ DEFERRED

- Wind
- Snow
- Roof loads
- Rail/attachment calculations
- Eurocodes
- Applicable Romanian National Annexes
- Calculation versions
- Engineer review/approval

> No structural compliance is claimed at any point until a validated engineering engine and professional review exist.

---

## M7+ — Commercial / ERP ecosystem ❌ FUTURE

- Quotations
- Inventory integration
- Procurement
- ERP
- Customer portal
- Mobile installer workflow
- GIS/satellite
- Shading

---

## Related documents

- `README.md` — entry point and current status.
- `PHASES.md` — phase-by-phase progress (A–G, H, I).
- `SITE-OBJECT.md` — generalized SiteObject placement architecture.
- `ARCHITECTURE.md` — architecture and principles.
- `DOMAIN-MODEL.md` — models and their status.
- `API.md` — implemented endpoints.
- `DECISIONS.md` — architecture decisions.
- `TESTING.md` — test/validation setup.
- `M1-PROGRESS.md` — historical M1 progress.

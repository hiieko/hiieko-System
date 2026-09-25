# Solar Roadmap

Last Updated: 2026-09-25

Status legend:

- ✅ **IMPLEMENTED** (M1 — code exists and is validated as far as possible in this environment)
- ⏳ **DEFERRED** (planned; not yet implemented)
- ❌ **FUTURE / NOT IMPLEMENTED**

All milestones after M1 are **DEFERRED / FUTURE** — nothing here is described as implemented.

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

## M2 — Geometry ⏳ DEFERRED

- Multiple roof sections
- Arbitrary/parametric polygons (M1 uses axis-aligned bounding box)
- Obstacles
- Keep-out zones
- Setbacks
- Improved collision logic

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
- `ARCHITECTURE.md` — architecture and principles.
- `DOMAIN-MODEL.md` — models and their status.
- `API.md` — implemented endpoints.
- `M1-PROGRESS.md` — main progress/status document.
- `DECISIONS.md` — architecture decisions.
- `TESTING.md` — test/validation setup.

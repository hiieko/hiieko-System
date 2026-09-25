# Solar Domain Model

Documents the Solar domain models/types that **actually exist** in the repository. Status legend used throughout:

- **IMPLEMENTED** — code + schema actively used in M1.
- **DEFERRED** — schema/type exists but no code reads/writes it yet.
- **FUTURE** — not yet created.
- **NOT VALIDATED** — exists but not runtime-tested against a live DB.

There are two representations of the same domain:

1. **Shared domain types** (`shared/src/solar/types.ts`) — pure, portable, used by the engines and the frontend/backend.
2. **Prisma models** (`backend/prisma/schema.prisma`) — the persistence layer (snake_case columns).

## Enums (Prisma)

| Enum | Values |
|---|---|
| `SolarDesignStatusEnum` | `DRAFT`, `IN_PROGRESS`, `REVIEW`, `APPROVED`, `SUPERSEDED` |
| `SolarModuleOrientationEnum` | `PORTRAIT`, `LANDSCAPE` |
| `SolarRoofTypeEnum` | `FLAT`, `PITCHED`, `GABLE`, `HIP`, `COMPLEX` |
| `SolarProductTypeEnum` | `RAIL`, `ROOF_HOOK`, `END_CLAMP`, `MID_CLAMP`, `RAIL_CONNECTOR`, `FASTENER`, `BRACKET`, `TILE_HOOK`, `TRAPEZOID_ATTACHMENT`, `STANDING_SEAM_CLAMP`, `BALLAST`, `EPDM`, `OTHER` |
| `SolarCatalogStatusEnum` | `DEMO`, `DRAFT`, `VALIDATED` |
| `SolarBomItemTypeEnum` | `MODULE`, `RAIL`, `HOOK`, `CLAMP`, `CONNECTOR`, `FASTENER`, `EPDM`, `CUSTOM` |

## Shared domain types (`shared/src/solar/types.ts`)

### `RoofPlane` — IMPLEMENTED

Transform inputs for a roof section (roof-local ↔ world).

- `origin: Point3D` — world anchor (mm).
- `slopeDeg: number` — degrees.
- `azimuthDeg: number` — degrees, clockwise from North.

### `RoofSectionModel` — IMPLEMENTED

- `id`, `designId`, `name`, `roofType` (`FLAT|PITCHED|GABLE|HIP|COMPLEX`), `slopeDeg`, `azimuthDeg`, `roofMaterial?`.
- `polygon: Polygon2D` — roof-local 2D outline (mm, closed).
- `origin: Point3D` — world anchor (mm).

### `ModuleSpecModel` — IMPLEMENTED

- `id`, `manufacturer`, `model`.
- `powerWp?` (W), `lengthMm`, `widthMm` (mm), `thicknessMm?` (mm), `weightKg?` (kg).
- Electrical (reserved for later system design): `voc?` (V), `isc?` (A), `vmp?` (V), `imp?` (A), `technology?`, `moduleType?`.

### `LayoutSettingsModel` — IMPLEMENTED

- `moduleSpecId?`, `orientation` (`PORTRAIT|LANDSCAPE`), `edgeMarginMm`, `rowSpacingMm`, `columnSpacingMm`.

### `ModulePlacement` — IMPLEMENTED (the layout engine output)

- `roofSectionId`, `moduleSpecId?`, `row`, `column`.
- **Roof-local mm**: `localX`, `localY`, `localZ`, `rotationDeg`, `widthMm`, `heightMm`.

### `ObstacleModel` — DEFERRED (type exists, no UI/API writes it in M1)

- `id`, `roofSectionId`, `name?`, `obstacleType?`, `polygon: Polygon2D`, `keepoutMarginMm`.

### `MountingResult` — IMPLEMENTED (prototype)

- `railRuns: RailRun[]`, `railTotalLengthMm`, `hookCount`, `endClampCount`, `midClampCount`, `fastenerCount`, `epdmCount`.

### `BomLine` — IMPLEMENTED (prototype)

- `productId?`, `itemType`, `code`, `name`, `quantityRequired` (engineering qty), `unit`, `cutLengthMm?`.

### `SolarDesignModel` — IMPLEMENTED (the assembled working set)

- `id`, `projectId`, `name`, `status`, `roofSections[]`, `obstacles[]`, `layoutSettings?`, `placements[]`.

## Prisma models (`backend/prisma/schema.prisma`)

### `SolarDesign` — IMPLEMENTED (mutable working state)

The engineering design attached to a `Project`.

- `id`, `project_id` (FK → Project, cascade), `name`, `description?`, `status` (default `DRAFT`), `current_version_id?`, `created_by?`, `created_at`, `updated_at`.
- `@@unique([project_id, name])`; indexes on `project_id`, `status`.
- Relations: `project`, `current_version` (→ `SolarDesignVersion`, `SetNull`), `versions[]`, `roof_sections[]`, `layout_settings?`, `module_placements[]`.
- **Mutable** — holds the editable working set and a pointer to the current revision.

### `SolarDesignVersion` — DEFERRED (schema only; intended immutable history)

- `id`, `design_id` (FK, cascade), `version`, `label?`, `status`, `snapshot Json`, `created_by?`, `created_at`.
- `@@unique([design_id, version])`.
- Relations: `design` (`VersionDesign`), `current_for[]` (`CurrentVersion`), `bom_snapshot?`.
- **Intended immutable** snapshot of the full parametric model + computed results (not yet written by any code).

> The `SolarDesign ↔ SolarDesignVersion` relation is circular and is resolved with two named relations: `"VersionDesign"` (version→design, `onDelete: Cascade`) and `"CurrentVersion"` (design→version pointer, `onDelete: SetNull`).

### `SolarRoofSection` — IMPLEMENTED (mutable)

- `id`, `design_id` (FK, cascade), `name`, `roof_type` (default `FLAT`), `slope_deg` (deg), `azimuth_deg` (deg), `roof_material?`, `polygon Json` (roof-local 2D, mm), `origin Json` (world anchor, mm), timestamps.
- Relations: `design`, `obstacles[]`, `placements[]`.

### `SolarObstacle` — DEFERRED (schema only)

- `id`, `roof_section_id` (FK, cascade), `name?`, `obstacle_type?`, `polygon Json`, `keepout_margin_mm` (default 0).
- Relation: `roof_section`.

### `SolarModuleSpec` — IMPLEMENTED (global catalog)

- `id`, `manufacturer`, `model`, `power_wp?`, `length_mm`, `width_mm`, `thickness_mm?`, `weight_kg?`, `voc?`, `isc?`, `vmp?`, `imp?`, `technology?`, `module_type?`, `is_active`, timestamps.
- `@@unique([manufacturer, model])`.

### `SolarLayoutSettings` — IMPLEMENTED (one per design)

- `id`, `design_id` (`@unique`), `module_spec_id?`, `orientation` (default `PORTRAIT`), `edge_margin_mm` (default 300), `row_spacing_mm` (default 0), `column_spacing_mm` (default 20).

### `SolarModulePlacement` — IMPLEMENTED (computed output, mutable current layout)

- `id`, `design_id` (FK, cascade), `roof_section_id` (FK, cascade), `module_spec_id?`, `row`, `column`.
- **Roof-local mm**: `local_x`, `local_y`, `local_z` (default 0), `rotation_deg` (default 0), `width_mm`, `height_mm`.
- Indexes on `design_id`, `roof_section_id`.
- Regenerated on every layout calculation (delete + recreate in a transaction).

### `SolarMountingFamily` — DEFERRED (schema only, family reservation)

- `id`, `code` (`@unique`), `name`, `description?`.
- Relation: `products[]` (no `systems` relation yet — `SolarMountingSystem` is not created).

### `SolarProduct` — IMPLEMENTED as schema/seed (engineering catalog)

- `id`, `code` (`@unique`), `name`, `family_id?`, `product_type`, `unit` (default `buc`), `length_mm?`, `width_mm?`, `height_mm?`, `weight_kg?`, `alloy?`, `cross_section Json?`, `structural_properties Json?`, `cad_ref?`, `catalog_status` (default `DEMO`), `material_id?`, `is_active`, timestamps.
- Relations: `family?`, `material?` (→ `Material`, `SetNull`), `compat_source[]`, `compat_target[]`, `bom_items[]`.

### `SolarProductCompatibility` — DEFERRED (schema only)

- `id`, `product_id` (FK), `compatible_product_id` (FK), `rule_type?`, `notes?`.
- `@@unique([product_id, compatible_product_id])`.
- A **catalog relationship** (e.g. "rail accepts clamp"), not the engineering rules engine.

### `SolarBomSnapshot` — DEFERRED (schema only, intended immutable history)

- `id`, `design_version_id` (`@unique`, FK cascade), `generated_at`, `total_weight_kg?`, `notes?`.
- Relation: `design_version`, `items[]`.

### `SolarBomItem` — DEFERRED (schema only)

- `id`, `bom_snapshot_id` (FK cascade), `product_id?`, `item_type`, `code`, `name`, `quantity_required` (engineering qty), `unit`, `cut_length_mm?`, `notes?`.
- Relation: `bom_snapshot`, `product?`.

## `SolarProduct` ≠ `Material`

`SolarProduct` and `Material` are **separate** entities on purpose:

- **`Material`** = generic inventory/warehouse/procurement entity (stock balances, lots, movements, purchase-order items, avize). It has no engineering geometry/structural fields.
- **`SolarProduct`** = the engineering catalog (geometry, cross-section, alloy, compatibility, CAD ref, structural parameters).

The optional inventory bridge **is implemented in the schema**: `SolarProduct.material_id → Material` (`onDelete: SetNull`). It is currently unused (no real products are linked to materials); it reserves the later **Engineering catalog → BOM → Inventory/Procurement** flow.

## Demo vs real catalog data

`SolarProduct.catalog_status` defaults to `DEMO`. M1 seeds demo products with a `DEMO-` code prefix and **no** `structural_properties`, so demo/placeholder data cannot be mistaken for validated HIIEKO engineering data.


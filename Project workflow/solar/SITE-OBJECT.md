# SiteObject Architecture

> Generalized object placement foundation for the HIIEKO Solar Site Designer.

## 1. Core chain

```
Surface
   ↓  surface-local coordinates
SiteObject (id + surfaceId + local pose)
   ↓  surface transform (roofLocalToWorld)
World pose (position + orientation)
```

A `SiteObject` is attached to a **surface** at a **local pose** (`localX/localY/localZ`,
`rotationDeg`). Its world placement is *derived* through the single existing transform
`roofLocalToWorld()` — there is **no second transformation system**.

## 2. Shared types (`shared/src/solar/types.ts`)

- `SiteObjectType` — extensible union: `PV_MODULE | STRUCTURE | INVERTER | COMBINER |
  EQUIPMENT | CAMERA | OBSTACLE | CABLE_NODE`. New types are appended, never renamed.
- `Pose` — `{ localX, localY, localZ, rotationDeg }` (mm, degrees).
- `SiteObject` — `Pose` + `{ id, designId, surfaceId, objectType }`.

`ModulePlacement` **is the first concrete SiteObject** (`objectType: 'PV_MODULE'`,
`surfaceId = roofSectionId`) with extra module data (`widthMm/heightMm/row/column/
moduleSpecId`). It is **not** renamed or removed.

## 3. Generic editor (`shared/src/solar/editor.ts`)

`movePlacements`, `rotatePlacements`, `snapPlacements`, `duplicatePlacements`,
`deletePlacements`, `alignPlacementsMinX/Y`, `distributePlacementsX` are now generic over
`T extends Placeable` (`{ id, localX, localY, rotationDeg }`). The same functions move a
PV module today and a structure/inverter/camera tomorrow. `moduleCorners`/`moduleCenter`
remain module-specific.

## 4. Transform + mapping (`shared/src/solar/site-object.ts`)

- `surfaceToPlane(surface)` — extract `RoofPlane` from a surface.
- `objectWorldPosition(surface, local)` — local (mm) → world (mm).
- `siteObjectWorldOrigin(surface, o)` — object origin → world.
- `moduleWorldCorners(surface, p)` — module footprint → world corners.
- `toSiteObject(p, designId)` — non-destructive **view** of a module placement.

## 5. Database / migration strategy

**No destructive migration.** The existing `solar_module_placements` table already stores
the generalized pose (`id`, `roof_section_id`, `local_x/y/z`, `rotation_deg`), so
`SiteObject` is currently a **type-level + editor-level** generalization.

Forward plan (when the first non-module object is persisted):
1. Add a `solar_site_objects` table (id, design_id, surface_id, object_type, local pose)
   via an **additive** migration.
2. Keep `solar_module_placements` untouched; either migrate reads gradually or dual-write
   during transition. `toSiteObject`/`fromSiteObject` form the compatibility layer.

Do **not** drop columns, rename tables, or rewrite history.

## 6. World / local coordinate strategy

- **World frame**: one shared coordinate space for the whole project (mm).
- **Surface-local frame**: `+X` ridge, `+Y` down-slope, `+Z` normal; defined once per
  surface via `origin/slopeDeg/azimuthDeg`.
- **Object-local frame**: the object's `Pose` in its parent surface's frame.
- Object → world = `roofLocalToWorld(surfaceToPlane(surface), localPose)`.

Multiple surfaces coexist in one world frame; each carries its own local geometry.
The eventual combined 2D site view is a **projection** of world positions (drop Z for
top-down), not a separate coordinate system.

## 7. Object attachment (future hierarchy)

A SiteObject attaches to a surface today. The architecture stays open for:

```
Ground Surface → Carport Structure → PV Mounting Plane → PV Module
```

by allowing `surfaceId` to later become a more general `parentId` (surface | structure |
object). Hierarchical attachment is **not** implemented yet.

## 8. 2D / 3D

- **2D** (`RoofPlan2D`): hit-tests and edits objects in surface-local mm via
  `screenToLocal`; generic editor ops apply to any `Placeable`.
- **3D** (`SolarScene`): each surface is a `<group>` carrying the world basis; per-object
  renderers (e.g. `ModuleMesh`) draw in local space and inherit the world transform.
  Future `StructureRenderer`/`InverterRenderer`/`CameraRenderer` are siblings of
  `ModuleMesh` in the same group.

## 9. Source vs. derived data

- **Source**: surfaces, object placements (module/structure/equipment/cable/obstacle).
- **Derived**: module count, power, BOM, mounting, cable length, areas, distances.

Derived values are recomputed by the pure engines (`computeLayout`, `computeMounting`,
`computeBom`) — never stored as duplicated editor state. Manual object moves currently
leave the *last-calculated* BOM/mounting stale until `recalculate`; a future phase will
recompute them client-side after each committed edit.

## 10. API

No new API in this phase. `PUT /designs/:id/placements` already persists placements and
remains project-scoped via `SolarDesignAccessGuard`. When `solar_site_objects` lands, it
reuses the same guard + bulk-replace pattern (`replacePlacements`).

## 11. Not implemented (later phases)

Terrain/GIS/CAD, shading, sun path, structural engineering, electrical schematic, cables,
camera coverage, full carport, transformer/switchgear, advanced BOM.

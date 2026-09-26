/**
 * Generalized SiteObject transform + mapping helpers.
 *
 * Establishes the chain  object → surface → local pose → world pose, reusing
 * the single existing transform (`roofLocalToWorld`) — no competing
 * transformation system. The 2D/3D/eventual-schematic views all resolve an
 * object's world placement through these helpers.
 */
import { roofLocalToWorld } from './geometry';
import { moduleCorners } from './editor';
import { ModulePlacement, Point3D, RoofPlane, RoofSectionModel, SiteObject } from './types';

/** Extract a transform plane from any surface-like object (surface → plane). */
export function surfaceToPlane(
  surface: Pick<RoofSectionModel, 'origin' | 'slopeDeg' | 'azimuthDeg'>,
): RoofPlane {
  return { origin: surface.origin, slopeDeg: surface.slopeDeg, azimuthDeg: surface.azimuthDeg };
}

/** Local (mm) → world (mm) via the surface transform. */
export function objectWorldPosition(
  surface: Pick<RoofSectionModel, 'origin' | 'slopeDeg' | 'azimuthDeg'>,
  local: Point3D,
): Point3D {
  return roofLocalToWorld(surfaceToPlane(surface), local);
}

/** World position of a SiteObject's local origin (local pose → world pose). */
export function siteObjectWorldOrigin(
  surface: Pick<RoofSectionModel, 'origin' | 'slopeDeg' | 'azimuthDeg'>,
  o: Pick<SiteObject, 'localX' | 'localY' | 'localZ'>,
): Point3D {
  return objectWorldPosition(surface, { x: o.localX, y: o.localY, z: o.localZ });
}

/** World-space corners of a module footprint (local footprint → surface transform). */
export function moduleWorldCorners(
  surface: Pick<RoofSectionModel, 'origin' | 'slopeDeg' | 'azimuthDeg'>,
  p: ModulePlacement,
): Point3D[] {
  return moduleCorners(p).map((c) =>
    objectWorldPosition(surface, { x: c.x, y: c.y, z: p.localZ }),
  );
}

/**
 * View a persisted PV module placement as the generalized SiteObject
 * (objectType 'PV_MODULE', surfaceId = roofSectionId). This is a non-destructive
 * view — persistence remains on the existing module placement table.
 */
export function toSiteObject(p: ModulePlacement, designId: string): SiteObject {
  return {
    id: p.id,
    designId,
    surfaceId: p.roofSectionId,
    objectType: 'PV_MODULE',
    localX: p.localX,
    localY: p.localY,
    localZ: p.localZ,
    rotationDeg: p.rotationDeg,
  };
}

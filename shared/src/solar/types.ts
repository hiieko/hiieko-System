// ============================================================================
// Solar domain types (pure, portable, isolated from app business logic).
// Canonical units: mm, kg, N/kN, kPa, degrees, V/A/W/kWh — see units.ts.
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type Polygon2D = Point2D[];

/**
 * Roof plane definition (roof-local -> world transform inputs).
 *
 * Roof-local convention:
 *   +X      = roof-plane horizontal (ridge) axis
 *   +Y      = roof down-slope axis
 *   +Z      = roof normal (upward)
 *   origin  = world anchor point of the roof section (mm)
 *   azimuth = direction of +Y (down-slope), clockwise from geographic North (deg)
 *   slope   = rotation from horizontal about +X (deg); 0 = flat
 *   world   = origin + Rz(-azimuth) . Rx(-slope) . local
 */
export interface RoofPlane {
  origin: Point3D;
  slopeDeg: number;
  azimuthDeg: number;
}

export type SolarRoofType = 'FLAT' | 'PITCHED' | 'GABLE' | 'HIP' | 'COMPLEX';

/**
 * Generalized surface category. A surface is the foundation of the site model:
 * roof, ground, grass, gravel, rock, asphalt, concrete, parking, carport, custom.
 */
export type SolarSurfaceType =
  | 'ROOF'
  | 'GROUND'
  | 'GRASS'
  | 'GRAVEL'
  | 'ROCK'
  | 'ASPHALT'
  | 'CONCRETE'
  | 'PARKING'
  | 'CARPORT'
  | 'CUSTOM';

export interface RoofSectionModel {
  id: string;
  designId: string;
  name: string;
  /** Roof shape (FLAT/PITCHED/...); retained for backward compatibility. */
  roofType: SolarRoofType;
  /** Surface category/material (defaults to ROOF). */
  surfaceType: SolarSurfaceType;
  slopeDeg: number;
  azimuthDeg: number;
  roofMaterial?: string;
  /** Surface thickness (mm) where applicable. */
  thicknessMm?: number;
  /** Roof-local 2D outline, mm, closed. */
  polygon: Polygon2D;
  /** World anchor, mm (elevation = origin.z; defines roof-local <-> world transform). */
  origin: Point3D;
}

/** `SurfaceModel` is the generalized name for `RoofSectionModel`. */
export type SurfaceModel = RoofSectionModel;

export interface ObstacleModel {
  id: string;
  roofSectionId: string;
  name?: string;
  obstacleType?: string;
  /** Roof-local 2D polygon, mm. */
  polygon: Polygon2D;
  keepoutMarginMm: number;
}

export interface ModuleSpecModel {
  id: string;
  manufacturer: string;
  model: string;
  powerWp?: number;
  lengthMm: number;
  widthMm: number;
  thicknessMm?: number;
  weightKg?: number;
  voc?: number;
  isc?: number;
  vmp?: number;
  imp?: number;
  technology?: string;
  moduleType?: string;
}

export type ModuleOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface LayoutSettingsModel {
  moduleSpecId?: string;
  orientation: ModuleOrientation;
  edgeMarginMm: number;
  rowSpacingMm: number;
  columnSpacingMm: number;
}

export interface ModulePlacement {
  /** Stable identifier: DB UUID when persisted; deterministic when computed; fresh when duplicated. */
  id: string;
  roofSectionId: string;
  moduleSpecId?: string;
  row: number;
  column: number;
  /** mm, roof-plane X (ridge axis). */
  localX: number;
  /** mm, roof-plane Y (down-slope axis). */
  localY: number;
  /** mm, roof-normal offset (0 = on plane). */
  localZ: number;
  /** Roof-plane rotation in degrees (0/90 in M1). */
  rotationDeg: number;
  /** In-plane X extent (mm). */
  widthMm: number;
  /** In-plane Y extent (mm). */
  heightMm: number;
}

/**
 * Extensible object-type strategy. PV_MODULE is the first concrete type;
 * future site objects (structures, inverters, cameras, …) reuse the same
 * pose + surface attachment model without a new coordinate system.
 */
export type SiteObjectType =
  | 'PV_MODULE'
  | 'STRUCTURE'
  | 'INVERTER'
  | 'COMBINER'
  | 'EQUIPMENT'
  | 'CAMERA'
  | 'OBSTACLE'
  | 'CABLE_NODE';

/** Local placement of an object in its parent surface's frame (mm, degrees). */
export interface Pose {
  localX: number;
  localY: number;
  localZ: number;
  rotationDeg: number;
}

/**
 * Generalized placed site object: an object attached to a surface at a local
 * pose. `ModulePlacement` is the first concrete implementation (objectType
 * 'PV_MODULE') carrying extra module data (widthMm/heightMm/row/column/
 * moduleSpecId); its `roofSectionId` is the generalized `surfaceId`.
 */
export interface SiteObject extends Pose {
  id: string;
  designId: string;
  surfaceId: string;
  objectType: SiteObjectType;
}

export interface RailRun {
  row: number;
  xStart: number;
  xEnd: number;
  y: number;
  lengthMm: number;
}

export interface MountingResult {
  railRuns: RailRun[];
  railTotalLengthMm: number;
  hookCount: number;
  endClampCount: number;
  midClampCount: number;
  fastenerCount: number;
  epdmCount: number;
}

export type SolarBomItemType =
  | 'MODULE'
  | 'RAIL'
  | 'HOOK'
  | 'CLAMP'
  | 'CONNECTOR'
  | 'FASTENER'
  | 'EPDM'
  | 'CUSTOM';

export interface BomLine {
  productId?: string;
  itemType: SolarBomItemType;
  code: string;
  name: string;
  /** Engineering-required quantity, in the canonical `unit`. */
  quantityRequired: number;
  /** buc | mm | kg | set */
  unit: string;
  cutLengthMm?: number;
}

export interface SolarDesignModel {
  id: string;
  projectId: string;
  name: string;
  status: string;
  roofSections: RoofSectionModel[];
  obstacles: ObstacleModel[];
  layoutSettings?: LayoutSettingsModel;
  placements: ModulePlacement[];
}

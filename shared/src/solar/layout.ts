/**
 * PV layout engine — pure, deterministic.
 *
 * M2: polygon-aware. Candidate modules are generated on a grid seeded from the
 * roof's bounding box (inset by edge margin), then each module footprint is
 * validated for exact containment and clearance against the actual roof polygon
 * and obstacles. Output placements are in ROOF-LOCAL millimetres.
 */
import {
  GEOMETRY_EPSILON_MM,
  polygonBoundaryDistanceMm,
  polygonBounds,
  polygonIsValid,
  rectContainedInPolygon,
  rectIntersectsPolygon,
  rectToPolygon,
  Rect2D,
} from './geometry';
import {
  LayoutSettingsModel,
  ModulePlacement,
  ModuleSpecModel,
  ObstacleModel,
  RoofSectionModel,
} from './types';

export function computeLayout(
  roofSection: RoofSectionModel,
  obstacles: ObstacleModel[],
  moduleSpec: ModuleSpecModel,
  settings: LayoutSettingsModel,
): ModulePlacement[] {
  if (!polygonIsValid(roofSection.polygon).valid) return [];

  const bounds = polygonBounds(roofSection.polygon);
  const edgeMargin = settings.edgeMarginMm;
  const usable: Rect2D = {
    minX: bounds.minX + edgeMargin,
    minY: bounds.minY + edgeMargin,
    maxX: bounds.maxX - edgeMargin,
    maxY: bounds.maxY - edgeMargin,
  };
  const usableW = usable.maxX - usable.minX;
  const usableH = usable.maxY - usable.minY;

  const portrait = settings.orientation === 'PORTRAIT';
  const spanX = portrait ? moduleSpec.widthMm : moduleSpec.lengthMm;
  const spanY = portrait ? moduleSpec.lengthMm : moduleSpec.widthMm;

  if (spanX <= 0 || spanY <= 0) return [];

  const colStep = spanX + settings.columnSpacingMm;
  const rowStep = spanY + settings.rowSpacingMm;
  if (colStep <= 0 || rowStep <= 0) return [];

  const columns = Math.max(
    0,
    Math.floor((usableW + settings.columnSpacingMm + GEOMETRY_EPSILON_MM) / colStep),
  );
  const rows = Math.max(
    0,
    Math.floor((usableH + settings.rowSpacingMm + GEOMETRY_EPSILON_MM) / rowStep),
  );

  const placements: ModulePlacement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const localX = usable.minX + c * colStep;
      const localY = usable.minY + r * rowStep;
      const rect: Rect2D = {
        minX: localX,
        minY: localY,
        maxX: localX + spanX,
        maxY: localY + spanY,
      };

      // 1) module fully contained in the actual roof polygon (no bounding-box fill)
      if (!rectContainedInPolygon(rect, roofSection.polygon)) continue;

      // 2) exact edge setback
      const roofClearance = polygonBoundaryDistanceMm(rectToPolygon(rect), roofSection.polygon);
      if (roofClearance < edgeMargin - GEOMETRY_EPSILON_MM) continue;

      // 3) obstacle keep-out (exact minimum distance)
      let blocked = false;
      for (const o of obstacles) {
        if (rectIntersectsPolygon(rect, o.polygon)) {
          blocked = true;
          break;
        }
        const obsClearance = polygonBoundaryDistanceMm(rectToPolygon(rect), o.polygon);
        if (obsClearance < o.keepoutMarginMm - GEOMETRY_EPSILON_MM) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      placements.push({
        roofSectionId: roofSection.id,
        moduleSpecId: moduleSpec.id,
        row: r,
        column: c,
        localX,
        localY,
        localZ: 0,
        rotationDeg: 0,
        widthMm: spanX,
        heightMm: spanY,
      });
    }
  }

  return placements;
}

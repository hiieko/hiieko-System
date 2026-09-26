/**
 * Editor operations on placed site objects — pure, deterministic, testable.
 *
 * Everything operates on surface-local millimetres and degrees. No React, no
 * SVG, no Three.js. The generic pose helpers (`move/rotate/snap/duplicate/
 * delete/align/distribute`) work on any object that satisfies the minimal
 * `Placeable` contract, so PV modules today and future SiteObjects (structures,
 * inverters, cameras, …) reuse exactly the same interaction model.
 */
import { ModulePlacement, Point2D } from './types';
import { snapToGrid } from './viewport';

/** Minimal structural contract the editor operates on (any SiteObject satisfies it). */
export interface Placeable {
  id: string;
  localX: number;
  localY: number;
  rotationDeg: number;
}

/** Wrap an angle into [0, 360). */
export const normalizeRotationDeg = (deg: number): number => ((deg % 360) + 360) % 360;

const DEG_TO_RAD = Math.PI / 180;

/** Rotate a point CCW about a center (surface-local plane, +Z up). */
export function rotatePointAbout(p: Point2D, center: Point2D, deg: number): Point2D {
  const rad = deg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Center of a module footprint, mm. */
export function moduleCenter(p: ModulePlacement): Point2D {
  return { x: p.localX + p.widthMm / 2, y: p.localY + p.heightMm / 2 };
}

/** The four footprint corners of a module, in surface-local mm (CCW from bottom-left). */
export function moduleCorners(p: ModulePlacement): Point2D[] {
  const c = moduleCenter(p);
  const hw = p.widthMm / 2;
  const hh = p.heightMm / 2;
  const local: Point2D[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map((pt) =>
    p.rotationDeg === 0
      ? { x: c.x + pt.x, y: c.y + pt.y }
      : rotatePointAbout({ x: c.x + pt.x, y: c.y + pt.y }, c, p.rotationDeg),
  );
}

/** Translate the selected objects by a local delta (mm). */
export function movePlacements<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): T[] {
  return list.map((p) =>
    ids.has(p.id) ? { ...p, localX: p.localX + dx, localY: p.localY + dy } : p,
  );
}

/** Rotate the selected objects by `deltaDeg`. */
export function rotatePlacements<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
  deltaDeg: number,
): T[] {
  return list.map((p) =>
    ids.has(p.id) ? { ...p, rotationDeg: normalizeRotationDeg(p.rotationDeg + deltaDeg) } : p,
  );
}

/** Snap the selected objects' origin to an engineering grid (mm). */
export function snapPlacements<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
  gridMm: number,
): T[] {
  return list.map((p) =>
    ids.has(p.id)
      ? { ...p, localX: snapToGrid(p.localX, gridMm), localY: snapToGrid(p.localY, gridMm) }
      : p,
  );
}

/**
 * Duplicate the selected objects. Originals untouched; copies get fresh IDs
 * (via `idFactory`) and an `offsetMm` local offset to avoid stacking.
 */
export function duplicatePlacements<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
  idFactory: () => string,
  offsetMm: number,
): T[] {
  const copies = list
    .filter((p) => ids.has(p.id))
    .map(
      (p): T => ({
        ...p,
        id: idFactory(),
        localX: p.localX + offsetMm,
        localY: p.localY + offsetMm,
      }),
    );
  return [...list, ...copies];
}

/** Remove the selected objects. */
export function deletePlacements<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
): T[] {
  return list.filter((p) => !ids.has(p.id));
}

// ---------------------------------------------------------------------------
// Alignment (groundwork — pure, tested; UI wiring can follow later)
// ---------------------------------------------------------------------------

/** Align selected objects' left edge (min localX) to the group's min X. */
export function alignPlacementsMinX<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
): T[] {
  const sel = list.filter((p) => ids.has(p.id));
  if (sel.length === 0) return list;
  const minX = Math.min(...sel.map((p) => p.localX));
  return list.map((p) => (ids.has(p.id) ? { ...p, localX: minX } : p));
}

/** Align selected objects' bottom edge (min localY) to the group's min Y. */
export function alignPlacementsMinY<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
): T[] {
  const sel = list.filter((p) => ids.has(p.id));
  if (sel.length === 0) return list;
  const minY = Math.min(...sel.map((p) => p.localY));
  return list.map((p) => (ids.has(p.id) ? { ...p, localY: minY } : p));
}

/** Distribute selected objects evenly along X (sorted by localX, edges preserved). */
export function distributePlacementsX<T extends Placeable>(
  list: T[],
  ids: ReadonlySet<string>,
): T[] {
  const sel = list.filter((p) => ids.has(p.id)).sort((a, b) => a.localX - b.localX);
  if (sel.length < 3) return list;
  const minX = sel[0].localX;
  const maxX = sel[sel.length - 1].localX;
  const step = (maxX - minX) / (sel.length - 1);
  const byId = new Map(sel.map((p, i) => [p.id, minX + i * step]));
  return list.map((p) => (byId.has(p.id) ? { ...p, localX: byId.get(p.id)! } : p));
}


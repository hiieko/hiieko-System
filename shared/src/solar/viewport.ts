/**
 * 2D editor viewport + snapping + distance utilities.
 *
 * These are PURE, component-free functions so the editor and the test suite
 * share one source of truth for coordinate conversion. No React/Three.js here.
 *
 * Units: local coordinates are surface-local MILLIMETRES; screen coordinates
 * are pixels in an SVG canvas (X right, Y down — a top-down plan, no Y flip).
 *
 * The transform is:
 *   screen = local * zoom + pan
 *   local  = (screen - pan) / zoom
 *
 * `zoom` is a unit-less scale (px per mm), `pan` is in px. `zoom === 1` means
 * 1 mm == 1 px; `fitViewport` derives a zoom that fits a surface into a canvas.
 */
import { Point2D } from './types';
import { Rect2D } from './geometry';

export interface Viewport {
  /** px per mm. */
  zoom: number;
  /** px offset applied AFTER scaling. */
  panX: number;
  panY: number;
}

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, panX: 0, panY: 0 };

export const clampViewportZoom = (
  zoom: number,
  min = 0.0001,
  max = 1000,
): number => Math.min(max, Math.max(min, zoom));

/** local (mm) -> screen (px). */
export function localToScreen(local: Point2D, viewport: Viewport): Point2D {
  return {
    x: local.x * viewport.zoom + viewport.panX,
    y: local.y * viewport.zoom + viewport.panY,
  };
}

/** screen (px) -> local (mm). */
export function screenToLocal(screen: Point2D, viewport: Viewport): Point2D {
  return {
    x: (screen.x - viewport.panX) / viewport.zoom,
    y: (screen.y - viewport.panY) / viewport.zoom,
  };
}

/**
 * Compute a viewport that fits a surface bounding box into a canvas of
 * `viewW` x `viewH` pixels, centered, with `padding` px around it.
 */
export function fitViewport(
  bounds: Rect2D,
  viewW: number,
  viewH: number,
  padding = 40,
): Viewport {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  if (w <= 0 || h <= 0) return { zoom: 1, panX: 0, panY: 0 };
  const availW = Math.max(1, viewW - padding * 2);
  const availH = Math.max(1, viewH - padding * 2);
  const zoom = clampViewportZoom(Math.min(availW / w, availH / h));
  const panX = (viewW - w * zoom) / 2 - bounds.minX * zoom;
  const panY = (viewH - h * zoom) / 2 - bounds.minY * zoom;
  return { zoom, panX, panY };
}

/** Pan a viewport by a screen-space delta (px). */
export function panViewport(viewport: Viewport, dx: number, dy: number): Viewport {
  return { zoom: viewport.zoom, panX: viewport.panX + dx, panY: viewport.panY + dy };
}

/** Zoom by `factor`, keeping the screen point `anchor` fixed under the cursor. */
export function zoomViewportAt(
  viewport: Viewport,
  anchor: Point2D,
  factor: number,
): Viewport {
  const zoom = clampViewportZoom(viewport.zoom * factor);
  const k = zoom / viewport.zoom;
  return {
    zoom,
    panX: anchor.x - (anchor.x - viewport.panX) * k,
    panY: anchor.y - (anchor.y - viewport.panY) * k,
  };
}

/** Snap a scalar to the nearest multiple of `grid` (both in mm). */
export const snapToGrid = (value: number, grid: number): number => {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
};

/** Snap a point to an engineering grid (both in mm). */
export function snapPoint(p: Point2D, grid: number): Point2D {
  return { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid) };
}

/** Euclidean distance between two points, in mm. */
export function pointDistanceMm(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

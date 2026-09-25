/**
 * Solar geometry primitives and roof-local <-> world transforms.
 *
 * Canonical units: millimetres (mm). Angles in degrees in the domain model;
 * converted to radians internally here only.
 *
 * Roof-local convention (see types.ts RoofPlane):
 *   +X = roof-plane horizontal (ridge) axis
 *   +Y = roof down-slope axis
 *   +Z = roof normal
 *   azimuth = direction of +Y, clockwise from geographic North (deg)
 *   slope   = rotation from horizontal about +X (deg)
 *   world   = origin + Rz(-azimuth) . Rx(-slope) . local
 */
import { degToRad } from './units';
import { Point2D, Point3D, Polygon2D, RoofPlane } from './types';

/** Float-comparison epsilon for geometry, in millimetres. */
export const GEOMETRY_EPSILON_MM = 0.001;

export const approxEq = (a: number, b: number, eps = GEOMETRY_EPSILON_MM): boolean =>
  Math.abs(a - b) <= eps;

export interface Rect2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Signed polygon area (shoelace). Positive for CCW in a standard XY plane. */
export function polygonAreaMm2(polygon: Polygon2D): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Axis-aligned bounding box of a polygon. */
export function polygonBounds(polygon: Polygon2D): Rect2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function expandRect(rect: Rect2D, margin: number): Rect2D {
  return {
    minX: rect.minX - margin,
    minY: rect.minY - margin,
    maxX: rect.maxX + margin,
    maxY: rect.maxY + margin,
  };
}

function cross2(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function pointOnSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  eps = GEOMETRY_EPSILON_MM,
): boolean {
  const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > eps) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < -eps) return false;
  const len2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  return dot <= len2 + eps;
}

/** Ray-casting point-in-polygon test (boundary counts as inside within epsilon). */
export function pointInPolygon(p: Point2D, polygon: Polygon2D): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(p, a, b)) return true;
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function segmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d1 = cross2(p3, p4, p1);
  const d2 = cross2(p3, p4, p2);
  const d3 = cross2(p1, p2, p3);
  const d4 = cross2(p1, p2, p4);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  if (approxEq(d1, 0) && pointOnSegment(p1, p3, p4)) return true;
  if (approxEq(d2, 0) && pointOnSegment(p2, p3, p4)) return true;
  if (approxEq(d3, 0) && pointOnSegment(p3, p1, p2)) return true;
  if (approxEq(d4, 0) && pointOnSegment(p4, p1, p2)) return true;
  return false;
}

/**
 * Axis-aligned rectangle vs polygon intersection (M1 obstacle test).
 * Returns true if the rectangle touches or overlaps the polygon.
 */
export function rectIntersectsPolygon(rect: Rect2D, polygon: Polygon2D): boolean {
  const corners: Point2D[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];

  for (const c of corners) {
    if (pointInPolygon(c, polygon)) return true;
  }
  for (const v of polygon) {
    if (
      v.x >= rect.minX - GEOMETRY_EPSILON_MM &&
      v.x <= rect.maxX + GEOMETRY_EPSILON_MM &&
      v.y >= rect.minY - GEOMETRY_EPSILON_MM &&
      v.y <= rect.maxY + GEOMETRY_EPSILON_MM
    ) {
      return true;
    }
  }

  const rectEdges: Array<[Point2D, Point2D]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pA = polygon[j];
    const pB = polygon[i];
    for (const [rA, rB] of rectEdges) {
      if (segmentsIntersect(rA, rB, pA, pB)) return true;
    }
  }

  return false;
}

/**
 * Roof-local -> world transform (documented convention).
 * world = origin + Rz(-azimuth) . Rx(-slope) . local
 */
export function roofLocalToWorld(plane: RoofPlane, p: Point3D): Point3D {
  const slope = degToRad(plane.slopeDeg);
  const az = degToRad(plane.azimuthDeg);
  const cosS = Math.cos(slope);
  const sinS = Math.sin(slope);
  const cosA = Math.cos(az);
  const sinA = Math.sin(az);

  // Rx(-slope)
  const x1 = p.x;
  const y1 = p.y * cosS + p.z * sinS;
  const z1 = -p.y * sinS + p.z * cosS;

  // Rz(-azimuth)
  const x2 = x1 * cosA + y1 * sinA;
  const y2 = -x1 * sinA + y1 * cosA;
  const z2 = z1;

  return {
    x: plane.origin.x + x2,
    y: plane.origin.y + y2,
    z: plane.origin.z + z2,
  };
}

/** World -> roof-local transform (inverse of roofLocalToWorld). */
export function worldToRoofLocal(plane: RoofPlane, p: Point3D): Point3D {
  const dx = p.x - plane.origin.x;
  const dy = p.y - plane.origin.y;
  const dz = p.z - plane.origin.z;

  const slope = degToRad(plane.slopeDeg);
  const az = degToRad(plane.azimuthDeg);
  const cosS = Math.cos(slope);
  const sinS = Math.sin(slope);
  const cosA = Math.cos(az);
  const sinA = Math.sin(az);

  // Inverse of Rz(-azimuth) = Rz(azimuth)
  const x1 = dx * cosA - dy * sinA;
  const y1 = dx * sinA + dy * cosA;
  const z1 = dz;

  // Inverse of Rx(-slope) = Rx(slope)
  const x = x1;
  const y = y1 * cosS - z1 * sinS;
  const z = y1 * sinS + z1 * cosS;

  return { x, y, z };
}

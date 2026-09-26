import {
  approxEq,
  normalizePolygon,
  pointInPolygon,
  polygonAreaMm2,
  polygonBoundaryDistanceMm,
  polygonContainedInPolygon,
  polygonIsSimple,
  polygonIsValid,
  rectContainedInPolygon,
  rectIntersectsPolygon,
  rectToPolygon,
  roofLocalToWorld,
  segmentToSegmentDistanceMm,
  worldToRoofLocal,
} from '@solar/shared';
import type { Polygon2D, Rect2D } from '@solar/shared';

describe('Solar geometry', () => {
  const rect: Polygon2D = [
    { x: 0, y: 0 },
    { x: 8000, y: 0 },
    { x: 8000, y: 4000 },
    { x: 0, y: 4000 },
  ];

  it('computes signed polygon area via shoelace', () => {
    expect(polygonAreaMm2(rect)).toBe(8000 * 4000);
  });

  it('detects points inside/outside a polygon (ray casting)', () => {
    expect(pointInPolygon({ x: 4000, y: 2000 }, rect)).toBe(true);
    expect(pointInPolygon({ x: 9000, y: 2000 }, rect)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0 }, rect)).toBe(true); // boundary vertex
  });

  it('round-trips roof-local <-> world transforms', () => {
    const plane = { origin: { x: 10, y: 20, z: 0 }, slopeDeg: 30, azimuthDeg: 180 };
    const local = { x: 1234, y: 5678, z: 90 };
    const world = roofLocalToWorld(plane, local);
    const back = worldToRoofLocal(plane, world);
    expect(approxEq(back.x, local.x, 0.01)).toBe(true);
    expect(approxEq(back.y, local.y, 0.01)).toBe(true);
    expect(approxEq(back.z, local.z, 0.01)).toBe(true);
  });

  it('detects rectangle vs polygon overlap for obstacle tests', () => {
    const obstacle: Polygon2D = [
      { x: 2000, y: 2000 },
      { x: 2500, y: 2000 },
      { x: 2500, y: 2500 },
      { x: 2000, y: 2500 },
    ];
    const overlapping: Rect2D = { minX: 2400, minY: 2400, maxX: 3000, maxY: 3000 };
    const disjoint: Rect2D = { minX: 3000, minY: 3000, maxX: 3500, maxY: 3500 };
    expect(rectIntersectsPolygon(overlapping, obstacle)).toBe(true);
    expect(rectIntersectsPolygon(disjoint, obstacle)).toBe(false);
  });
});

describe('Solar geometry (M2 — clearance/containment/validation)', () => {
  const roof: Polygon2D = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ];

  it('finds the closest point in the middle of a segment', () => {
    const d = segmentToSegmentDistanceMm(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 3 },
      { x: 5, y: 5 },
    );
    expect(d).toBeCloseTo(3, 5);
  });

  it('computes exact boundary distance (setback between sample points)', () => {
    const moduleRect: Rect2D = { minX: 100, minY: 100, maxX: 900, maxY: 900 };
    expect(polygonBoundaryDistanceMm(rectToPolygon(moduleRect), roof)).toBeCloseTo(100, 5);
  });

  it('detects module containment inside a polygon (incl. partially outside)', () => {
    const inside: Rect2D = { minX: 100, minY: 100, maxX: 900, maxY: 900 };
    const outside: Rect2D = { minX: -100, minY: 100, maxX: 900, maxY: 900 };
    expect(rectContainedInPolygon(inside, roof)).toBe(true);
    expect(rectContainedInPolygon(outside, roof)).toBe(false);
  });

  it('detects obstacle containment within a roof (crossing rejected)', () => {
    const inner: Polygon2D = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];
    const crossing: Polygon2D = [
      { x: 500, y: 500 },
      { x: 1500, y: 500 },
      { x: 1500, y: 1500 },
      { x: 500, y: 1500 },
    ];
    expect(polygonContainedInPolygon(inner, roof)).toBe(true);
    expect(polygonContainedInPolygon(crossing, roof)).toBe(false);
  });

  it('normalizes a closed polygon to open form (and keeps open unchanged)', () => {
    const closed: Polygon2D = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    expect(normalizePolygon(closed)).toHaveLength(4);

    const open: Polygon2D = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(normalizePolygon(open)).toHaveLength(3);
  });

  it('rejects self-intersecting and degenerate polygons', () => {
    const bowtie: Polygon2D = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(polygonIsSimple(bowtie)).toBe(false);
    expect(polygonIsValid(bowtie).valid).toBe(false);

    const degenerate: Polygon2D = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(polygonIsValid(degenerate).valid).toBe(false);

    expect(polygonIsValid([{ x: 0, y: 0 }, { x: 1, y: 1 }]).valid).toBe(false);
  });

  it('is winding-order independent for containment', () => {
    const cw: Polygon2D = [
      { x: 0, y: 0 },
      { x: 0, y: 1000 },
      { x: 1000, y: 1000 },
      { x: 1000, y: 0 },
    ];
    const ccw: Polygon2D = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const moduleRect: Rect2D = { minX: 100, minY: 100, maxX: 900, maxY: 900 };
    expect(rectContainedInPolygon(moduleRect, cw)).toBe(true);
    expect(rectContainedInPolygon(moduleRect, ccw)).toBe(true);
  });

  it('returns zero distance for touching and intersecting segments', () => {
    expect(
      segmentToSegmentDistanceMm({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }),
    ).toBeCloseTo(0, 5);
    expect(
      segmentToSegmentDistanceMm({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 }),
    ).toBeCloseTo(0, 5);
  });
});

describe('Solar surface transform (Phase E/G — elevation/slope/azimuth)', () => {
  // A module placed in the parent surface's local frame (origin at local origin).
  const moduleLocal = { x: 4000, y: 2000, z: 0 };

  it('maps surface elevation to world Z', () => {
    const world = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 120500 }, slopeDeg: 0, azimuthDeg: 0 },
      moduleLocal,
    );
    expect(world.z).toBeCloseTo(120500, 6);
  });

  it('maps surface slope to a down-slope Z drop (module follows surface)', () => {
    const flat = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 0 }, slopeDeg: 0, azimuthDeg: 0 },
      moduleLocal,
    );
    const pitched = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 0 }, slopeDeg: 30, azimuthDeg: 0 },
      moduleLocal,
    );
    // Down-slope offset = localY * sin(slope); sin(30°) = 0.5.
    expect(pitched.z).toBeCloseTo(flat.z - 1000, 4);
    // X is unchanged for azimuth 0 (rotation only about the down-slope axis).
    expect(pitched.x).toBeCloseTo(flat.x, 6);
  });

  it('maps surface azimuth to a rotated world XY', () => {
    const south = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 0 }, slopeDeg: 0, azimuthDeg: 180 },
      moduleLocal,
    );
    expect(south.x).toBeCloseTo(-4000, 6);
    expect(south.y).toBeCloseTo(-2000, 6);
  });

  it('translates the whole module rigidly with elevation (shared transform)', () => {
    const a = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 1000 }, slopeDeg: 20, azimuthDeg: 45 },
      moduleLocal,
    );
    const b = roofLocalToWorld(
      { origin: { x: 0, y: 0, z: 6000 }, slopeDeg: 20, azimuthDeg: 45 },
      moduleLocal,
    );
    expect(b.z - a.z).toBeCloseTo(5000, 6);
  });
});

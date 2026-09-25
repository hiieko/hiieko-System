import {
  approxEq,
  pointInPolygon,
  polygonAreaMm2,
  rectIntersectsPolygon,
  roofLocalToWorld,
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

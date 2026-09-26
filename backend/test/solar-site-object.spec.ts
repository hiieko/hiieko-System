import {
  ModulePlacement,
  SiteObject,
  alignPlacementsMinX,
  deletePlacements,
  duplicatePlacements,
  moduleWorldCorners,
  movePlacements,
  objectWorldPosition,
  rotatePlacements,
  siteObjectWorldOrigin,
  snapPlacements,
  surfaceToPlane,
  toSiteObject,
} from '@solar/shared';

function modulePlacement(id: string, overrides: Partial<ModulePlacement> = {}): ModulePlacement {
  return {
    id,
    roofSectionId: 'roof-1',
    moduleSpecId: 'spec-1',
    row: 0,
    column: 0,
    localX: 0,
    localY: 0,
    localZ: 0,
    rotationDeg: 0,
    widthMm: 1000,
    heightMm: 500,
    ...overrides,
  };
}

describe('SiteObject model (generalized placement architecture)', () => {
  const flat = { origin: { x: 0, y: 0, z: 0 }, slopeDeg: 0, azimuthDeg: 0 };

  it('views a PV module as a SiteObject (surface attachment + object type)', () => {
    const so = toSiteObject(modulePlacement('m1', { localX: 300, localY: 400 }), 'design-1');
    expect(so).toEqual({
      id: 'm1',
      designId: 'design-1',
      surfaceId: 'roof-1',
      objectType: 'PV_MODULE',
      localX: 300,
      localY: 400,
      localZ: 0,
      rotationDeg: 0,
    });
  });

  it('preserves the stable ID through the generalized view', () => {
    const p = modulePlacement('stable-123');
    expect(toSiteObject(p, 'd1').id).toBe('stable-123');
  });

  it('extracts a transform plane from a surface (surface → plane)', () => {
    const plane = surfaceToPlane({ origin: { x: 1, y: 2, z: 3 }, slopeDeg: 10, azimuthDeg: 45 });
    expect(plane).toEqual({ origin: { x: 1, y: 2, z: 3 }, slopeDeg: 10, azimuthDeg: 45 });
  });

  it('resolves local pose to world position (elevation)', () => {
    const w = siteObjectWorldOrigin(
      { origin: { x: 0, y: 0, z: 120500 }, slopeDeg: 0, azimuthDeg: 0 },
      { localX: 1000, localY: 2000, localZ: 0 },
    );
    expect(w.z).toBeCloseTo(120500, 6);
    expect(w.x).toBeCloseTo(1000, 6);
    expect(w.y).toBeCloseTo(2000, 6);
  });

  it('resolves world position through the surface slope transform', () => {
    const w = objectWorldPosition({ origin: { x: 0, y: 0, z: 0 }, slopeDeg: 30, azimuthDeg: 0 }, {
      x: 0,
      y: 2000,
      z: 0,
    });
    expect(w.z).toBeCloseTo(-1000, 4);
  });

  it('resolves world corners with rotation (moduleWorldCorners)', () => {
    const p = modulePlacement('m1', { localX: 100, localY: 200, rotationDeg: 90 });
    const corners = moduleWorldCorners(flat, p);
    expect(corners[0].x).toBeCloseTo(850, 4);
    expect(corners[0].y).toBeCloseTo(-50, 4);
    expect(corners[0].z).toBeCloseTo(0, 6);
  });

  it('runs the generic editor on a non-module SiteObject (inverter placeholder)', () => {
    const inverter: SiteObject = {
      id: 'inv-1',
      designId: 'd1',
      surfaceId: 'roof-1',
      objectType: 'INVERTER',
      localX: 100,
      localY: 200,
      localZ: 0,
      rotationDeg: 0,
    };

    const moved = movePlacements([inverter], new Set(['inv-1']), 50, -25);
    expect(moved[0].localX).toBe(150);
    expect(moved[0].localY).toBe(175);

    const rotated = rotatePlacements(moved, new Set(['inv-1']), 90);
    expect(rotated[0].rotationDeg).toBe(90);

    const dup = duplicatePlacements(rotated, new Set(['inv-1']), () => 'inv-2', 100);
    expect(dup).toHaveLength(2);
    expect(dup[1].id).toBe('inv-2');
    expect(dup[1].objectType).toBe('INVERTER'); // generic spread preserves objectType
    expect(dup[1].localX).toBe(250);

    const remaining = deletePlacements(dup, new Set(['inv-1']));
    expect(remaining.map((o) => o.id)).toEqual(['inv-2']);
  });

  it('snaps and aligns generic SiteObjects', () => {
    const a: SiteObject = { id: 'a', designId: 'd', surfaceId: 's', objectType: 'CAMERA', localX: 1234, localY: 876, localZ: 0, rotationDeg: 0 };
    const b: SiteObject = { id: 'b', designId: 'd', surfaceId: 's', objectType: 'CAMERA', localX: 3000, localY: 876, localZ: 0, rotationDeg: 0 };
    expect(snapPlacements([a], new Set(['a']), 500)[0].localX).toBe(1000);
    const aligned = alignPlacementsMinX([a, b], new Set(['a', 'b']));
    expect(aligned.every((o) => o.localX === 1234)).toBe(true);
  });

  it('runs a PV module through the generalized path (backward compatible)', () => {
    const p = modulePlacement('m1', { localX: 300, localY: 300 });
    // Direct generic move (ModulePlacement satisfies Placeable).
    expect(movePlacements([p], new Set(['m1']), 100, 100)[0].localX).toBe(400);
    // Via the SiteObject view.
    const so = toSiteObject(p, 'd1');
    expect(movePlacements([so], new Set(['m1']), 100, 100)[0].localX).toBe(400);
  });
});

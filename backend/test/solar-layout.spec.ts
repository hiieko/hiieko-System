import {
  computeBom,
  computeLayout,
  computeMounting,
  pointInPolygon,
  polygonBoundaryDistanceMm,
  rectToPolygon,
} from '@solar/shared';
import type {
  LayoutSettingsModel,
  ModuleSpecModel,
  ObstacleModel,
  RoofSectionModel,
} from '@solar/shared';

describe('PV layout + mounting + BOM engines', () => {
  const roof: RoofSectionModel = {
    id: 'roof-1',
    designId: 'd1',
    name: 'Roof',
    roofType: 'FLAT',
    slopeDeg: 0,
    azimuthDeg: 0,
    polygon: [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    origin: { x: 0, y: 0, z: 0 },
  };

  const module: ModuleSpecModel = {
    id: 'm1',
    manufacturer: 'DemoSolar',
    model: 'DEMO-450',
    powerWp: 450,
    lengthMm: 1722,
    widthMm: 1134,
  };

  const settings: LayoutSettingsModel = {
    orientation: 'PORTRAIT',
    edgeMarginMm: 300,
    rowSpacingMm: 0,
    columnSpacingMm: 20,
  };

  it('places modules in a deterministic grid for a rectangular roof', () => {
    const placements = computeLayout(roof, [], module, settings);
    expect(placements.length).toBeGreaterThan(0);
    expect(placements[0].row).toBe(0);
    expect(placements[0].column).toBe(0);
    // portrait orientation -> in-plane extents are width x length
    expect(placements[0].widthMm).toBe(module.widthMm);
    expect(placements[0].heightMm).toBe(module.lengthMm);
    // all modules stay within the roof bounds minus edge margin
    for (const p of placements) {
      expect(p.localX).toBeGreaterThanOrEqual(300 - 0.001);
      expect(p.localY).toBeGreaterThanOrEqual(300 - 0.001);
      expect(p.localX + p.widthMm).toBeLessThanOrEqual(8000 - 300 + 0.001);
      expect(p.localY + p.heightMm).toBeLessThanOrEqual(4000 - 300 + 0.001);
    }
  });

  it('excludes modules blocked by an obstacle keep-out zone', () => {
    const fullCover: ObstacleModel = {
      id: 'o1',
      roofSectionId: 'roof-1',
      polygon: [
        { x: 0, y: 0 },
        { x: 8000, y: 0 },
        { x: 8000, y: 4000 },
        { x: 0, y: 4000 },
      ],
      keepoutMarginMm: 0,
    };
    expect(computeLayout(roof, [fullCover], module, settings).length).toBe(0);
  });

  it('derives mounting and BOM deterministically from placements', () => {
    const placements = computeLayout(roof, [], module, settings);
    const mounting = computeMounting(placements);
    const bom = computeBom(placements, module, mounting);

    expect(mounting.railTotalLengthMm).toBeGreaterThan(0);
    expect(mounting.railRuns.length).toBeGreaterThan(0);

    const moduleLine = bom.find((b) => b.itemType === 'MODULE');
    expect(moduleLine?.quantityRequired).toBe(placements.length);

    const railLine = bom.find((b) => b.itemType === 'RAIL');
    expect(railLine?.unit).toBe('mm');
  });
});

describe('PV layout (M2 — polygon + obstacles + multiple sections)', () => {
  const module: ModuleSpecModel = {
    id: 'm1',
    manufacturer: 'DemoSolar',
    model: 'DEMO-450',
    powerWp: 450,
    lengthMm: 1722,
    widthMm: 1134,
  };
  const settings: LayoutSettingsModel = {
    orientation: 'PORTRAIT',
    edgeMarginMm: 0,
    rowSpacingMm: 0,
    columnSpacingMm: 0,
  };

  it('does not place modules outside an irregular (L-shaped) polygon', () => {
    const lShape: RoofSectionModel = {
      id: 'roof-L',
      designId: 'd1',
      name: 'L',
      roofType: 'FLAT',
      slopeDeg: 0,
      azimuthDeg: 0,
      origin: { x: 0, y: 0, z: 0 },
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 3000 },
        { x: 3000, y: 3000 },
        { x: 3000, y: 6000 },
        { x: 0, y: 6000 },
      ],
    };

    const placements = computeLayout(lShape, [], module, settings);
    expect(placements.length).toBeGreaterThan(0);

    for (const p of placements) {
      const corners = [
        { x: p.localX, y: p.localY },
        { x: p.localX + p.widthMm, y: p.localY },
        { x: p.localX + p.widthMm, y: p.localY + p.heightMm },
        { x: p.localX, y: p.localY + p.heightMm },
      ];
      for (const c of corners) {
        expect(pointInPolygon(c, lShape.polygon)).toBe(true);
      }
    }
  });

  it('enforces obstacle keep-out margin exactly', () => {
    const roof: RoofSectionModel = {
      id: 'roof-1',
      designId: 'd1',
      name: 'R',
      roofType: 'FLAT',
      slopeDeg: 0,
      azimuthDeg: 0,
      origin: { x: 0, y: 0, z: 0 },
      polygon: [
        { x: 0, y: 0 },
        { x: 8000, y: 0 },
        { x: 8000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    };
    const obstacle: ObstacleModel = {
      id: 'o1',
      roofSectionId: 'roof-1',
      polygon: [
        { x: 2000, y: 1500 },
        { x: 6000, y: 1500 },
        { x: 6000, y: 2500 },
        { x: 2000, y: 2500 },
      ],
      keepoutMarginMm: 300,
    };

    const placements = computeLayout(roof, [obstacle], module, settings);
    expect(placements.length).toBeGreaterThan(0);

    for (const p of placements) {
      const rectPoly = rectToPolygon({
        minX: p.localX,
        minY: p.localY,
        maxX: p.localX + p.widthMm,
        maxY: p.localY + p.heightMm,
      });
      expect(polygonBoundaryDistanceMm(rectPoly, obstacle.polygon)).toBeGreaterThanOrEqual(300 - 1e-6);
    }
  });

  it('tags placements with their roof section across multiple roofs', () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    const roofA: RoofSectionModel = {
      id: 'roof-a', designId: 'd1', name: 'A', roofType: 'FLAT', slopeDeg: 0, azimuthDeg: 0,
      origin: { x: 0, y: 0, z: 0 }, polygon: poly,
    };
    const roofB: RoofSectionModel = {
      id: 'roof-b', designId: 'd1', name: 'B', roofType: 'FLAT', slopeDeg: 20, azimuthDeg: 90,
      origin: { x: 0, y: 0, z: 0 }, polygon: poly,
    };

    const pa = computeLayout(roofA, [], module, settings);
    const pb = computeLayout(roofB, [], module, settings);

    expect(pa.every((p) => p.roofSectionId === 'roof-a')).toBe(true);
    expect(pb.every((p) => p.roofSectionId === 'roof-b')).toBe(true);
    expect(pa.length).toBe(pb.length);
  });
});

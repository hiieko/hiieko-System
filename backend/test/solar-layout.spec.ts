import {
  computeBom,
  computeLayout,
  computeMounting,
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

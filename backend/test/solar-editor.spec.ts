import {
  ModulePlacement,
  alignPlacementsMinX,
  alignPlacementsMinY,
  createHistory,
  deletePlacements,
  distributePlacementsX,
  duplicatePlacements,
  fitViewport,
  localToScreen,
  moduleCorners,
  movePlacements,
  normalizeRotationDeg,
  pointDistanceMm,
  rotatePlacements,
  screenToLocal,
  snapPlacements,
  snapPoint,
  snapToGrid,
  zoomViewportAt,
} from '@solar/shared';

function placement(id: string, overrides: Partial<ModulePlacement> = {}): ModulePlacement {
  return {
    id,
    roofSectionId: 'r1',
    moduleSpecId: 's1',
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

describe('Editor viewport (pointer <-> local, zoom/pan/fit/snap)', () => {
  it('round-trips screen <-> local', () => {
    const vp = { zoom: 0.5, panX: 120, panY: -40 };
    const local = { x: 1234, y: 5678 };
    const back = screenToLocal(localToScreen(local, vp), vp);
    expect(back.x).toBeCloseTo(local.x, 6);
    expect(back.y).toBeCloseTo(local.y, 6);
  });

  it('fits a surface bounds into a canvas, centered', () => {
    const vp = fitViewport({ minX: 0, minY: 0, maxX: 8000, maxY: 4000 }, 800, 520, 40);
    expect(vp.zoom).toBeCloseTo(0.09, 6);
    expect(vp.panX).toBeCloseTo(40, 6);
    expect(vp.panY).toBeCloseTo(80, 6);
  });

  it('zooms about a cursor anchor, keeping the local point fixed', () => {
    const before = { zoom: 1, panX: 0, panY: 0 };
    const anchor = { x: 200, y: 300 };
    const after = zoomViewportAt(before, anchor, 2);
    expect(screenToLocal(anchor, after).x).toBeCloseTo(screenToLocal(anchor, before).x, 6);
    expect(screenToLocal(anchor, after).y).toBeCloseTo(screenToLocal(anchor, before).y, 6);
  });

  it('snaps scalars and points to an engineering grid', () => {
    expect(snapToGrid(1234, 500)).toBe(1000);
    expect(snapToGrid(137, 500)).toBe(0);
    expect(snapToGrid(876, 100)).toBe(900);
    expect(snapPoint({ x: 1234, y: 876 }, 500)).toEqual({ x: 1000, y: 1000 });
  });

  it('computes distance in mm (3-4-5)', () => {
    expect(pointDistanceMm({ x: 0, y: 0 }, { x: 3000, y: 4000 })).toBeCloseTo(5000, 6);
  });
});
describe('Editor module operations (move/rotate/duplicate/delete/align/snap)', () => {
  const a = placement('a', { localX: 0, localY: 0 });
  const b = placement('b', { localX: 2000, localY: 0, rotationDeg: 90 });

  it('computes module corners (identity and rotated)', () => {
    const p = placement('p', { localX: 100, localY: 200, widthMm: 1000, heightMm: 500 });
    expect(moduleCorners(p)).toEqual([
      { x: 100, y: 200 },
      { x: 1100, y: 200 },
      { x: 1100, y: 700 },
      { x: 100, y: 700 },
    ]);

    const r = placement('r', { localX: 100, localY: 200, widthMm: 1000, heightMm: 500, rotationDeg: 90 });
    const corners = moduleCorners(r);
    expect(corners[0].x).toBeCloseTo(850, 4);
    expect(corners[0].y).toBeCloseTo(-50, 4);
  });

  it('moves selected placements (multi-select) by a local delta', () => {
    const moved = movePlacements([a, b], new Set(['a', 'b']), 100, 250);
    expect(moved[0].localX).toBe(100);
    expect(moved[0].localY).toBe(250);
    expect(moved[1].localX).toBe(2100);
    expect(moved[1].localY).toBe(250);
    expect(moved[1].rotationDeg).toBe(90);
  });

  it('rotates selected placements and normalizes degrees', () => {
    const rotated = rotatePlacements([placement('x', { rotationDeg: 350 })], new Set(['x']), 90);
    expect(rotated[0].rotationDeg).toBe(80);
    expect(normalizeRotationDeg(-90)).toBe(270);
  });

  it('duplicates with fresh IDs and an offset, leaving originals unchanged', () => {
    let n = 0;
    const idFactory = () => `copy-${++n}`;
    const result = duplicatePlacements([a], new Set(['a']), idFactory, 200);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(a);
    expect(result[1].id).toBe('copy-1');
    expect(result[1].localX).toBe(200);
    expect(result[1].localY).toBe(200);
    expect(result[1].roofSectionId).toBe(a.roofSectionId);
  });

  it('deletes selected placements (multi-select)', () => {
    const result = deletePlacements([a, b], new Set(['a']));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('snaps selected placements to a grid', () => {
    const moved = snapPlacements([placement('m', { localX: 1234, localY: 876 })], new Set(['m']), 500);
    expect(moved[0].localX).toBe(1000);
    expect(moved[0].localY).toBe(1000);
  });

  it('aligns and distributes selected placements', () => {
    const p1 = placement('p1', { localX: 0 });
    const p2 = placement('p2', { localX: 500 });
    expect(alignPlacementsMinX([p1, p2], new Set(['p1', 'p2'])).every((p) => p.localX === 0)).toBe(true);

    const p3 = placement('p3', { localX: 0 });
    const p4 = placement('p4', { localX: 3000 });
    const p5 = placement('p5', { localX: 9000 });
    const dist = distributePlacementsX([p3, p4, p5], new Set(['p3', 'p4', 'p5']));
    expect(dist.map((p) => p.localX).sort((x, y) => x - y)).toEqual([0, 4500, 9000]);
  });

  it('aligns Y edges', () => {
    const p1 = placement('p1', { localY: 100 });
    const p2 = placement('p2', { localY: 700 });
    expect(alignPlacementsMinY([p1, p2], new Set(['p1', 'p2'])).every((p) => p.localY === 100)).toBe(true);
  });
});

describe('Editor history (undo/redo)', () => {
  it('commits, undoes and redoes', () => {
    const h = createHistory<number[]>([]);
    h.commit([1]);
    h.commit([1, 2]);
    expect(h.get().present).toEqual([1, 2]);
    h.undo();
    expect(h.get().present).toEqual([1]);
    h.undo();
    expect(h.get().present).toEqual([]);
    expect(h.get().past).toHaveLength(0);
    h.redo();
    expect(h.get().present).toEqual([1]);
    h.redo();
    expect(h.get().present).toEqual([1, 2]);
    expect(h.get().future).toHaveLength(0);
  });

  it('clears redo stack on a new commit, and reset clears both stacks', () => {
    const h = createHistory<number>(0);
    h.commit(1);
    h.commit(2);
    h.undo();
    expect(h.get().present).toBe(1);
    h.commit(3);
    expect(h.get().future).toHaveLength(0);
    expect(h.get().present).toBe(3);
    h.reset(9);
    expect(h.get().present).toBe(9);
    expect(h.get().past).toHaveLength(0);
    expect(h.get().future).toHaveLength(0);
  });
});

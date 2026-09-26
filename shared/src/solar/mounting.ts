/**
 * PROTOTYPE mounting rule engine.
 *
 * This is DEMO/PROTOTYPE logic only — it derives plausible quantities from
 * placement geometry for a first vertical slice. It is NOT a structural
 * engineering calculation and MUST NOT be presented as compliant with any
 * Eurocode or Romanian National Annex.
 */
import { ModulePlacement, MountingResult, RailRun } from './types';

export function computeMounting(placements: ModulePlacement[]): MountingResult {
  const byRow = new Map<number, ModulePlacement[]>();
  for (const p of placements) {
    const list = byRow.get(p.row) ?? [];
    list.push(p);
    byRow.set(p.row, list);
  }

  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const railRuns: RailRun[] = [];

  for (const row of rows) {
    const mods = byRow.get(row) ?? [];
    const minX = Math.min(...mods.map((m) => m.localX));
    const maxX = Math.max(...mods.map((m) => m.localX + m.widthMm));
    const minY = Math.min(...mods.map((m) => m.localY));
    const maxY = Math.max(...mods.map((m) => m.localY + m.heightMm));
    const lengthMm = maxX - minX;
    // Two rails per row (top + bottom edge), running along local X.
    railRuns.push({ row, xStart: minX, xEnd: maxX, y: minY, lengthMm });
    railRuns.push({ row, xStart: minX, xEnd: maxX, y: maxY, lengthMm });
  }

  const totalModules = placements.length;
  const rowCount = byRow.size;
  const railTotalLengthMm = railRuns.reduce((sum, r) => sum + r.lengthMm, 0);

  // PROTOTYPE rules (deterministic, not structural):
  const hookCount = [...byRow.values()].reduce((sum, mods) => sum + mods.length * 2, 0);
  const endClampCount = railRuns.length * 2;
  const midClampCount = Math.max(0, totalModules - rowCount) * 2;
  const fastenerCount = endClampCount + midClampCount + hookCount;
  const epdmCount = hookCount;

  return {
    railRuns,
    railTotalLengthMm,
    hookCount,
    endClampCount,
    midClampCount,
    fastenerCount,
    epdmCount,
  };
}

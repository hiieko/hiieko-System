'use client';

import { useState } from 'react';
import { ModuleSpecModel } from '@solar/shared';

export interface LayoutInput {
  moduleSpecId: string;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  edgeMarginMm: number;
  rowSpacingMm: number;
  columnSpacingMm: number;
}

export function ModuleSelector({
  modules,
  initial,
  onApply,
  applying,
}: {
  modules: ModuleSpecModel[];
  initial?: Partial<LayoutInput>;
  onApply: (input: LayoutInput) => void;
  applying: boolean;
}) {
  const [moduleSpecId, setModuleSpecId] = useState(initial?.moduleSpecId ?? '');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>(
    initial?.orientation ?? 'PORTRAIT',
  );
  const [edgeMarginMm, setEdgeMarginMm] = useState(initial?.edgeMarginMm ?? 300);
  const [rowSpacingMm, setRowSpacingMm] = useState(initial?.rowSpacingMm ?? 0);
  const [columnSpacingMm, setColumnSpacingMm] = useState(initial?.columnSpacingMm ?? 20);

  const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white';
  const label = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Modul PV (demo)</label>
        <select value={moduleSpecId} onChange={(e) => setModuleSpecId(e.target.value)} className={field}>
          <option value="">— Selectează modul —</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.manufacturer} {m.model} ({m.lengthMm}×{m.widthMm} mm, {m.powerWp} W)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Orientare</label>
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as 'PORTRAIT' | 'LANDSCAPE')}
          className={field}
        >
          <option value="PORTRAIT">Portret</option>
          <option value="LANDSCAPE">Peisaj</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={label}>Margine (mm)</label>
          <input
            type="number"
            min="0"
            value={edgeMarginMm}
            onChange={(e) => setEdgeMarginMm(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Rând (mm)</label>
          <input
            type="number"
            min="0"
            value={rowSpacingMm}
            onChange={(e) => setRowSpacingMm(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Coloană (mm)</label>
          <input
            type="number"
            min="0"
            value={columnSpacingMm}
            onChange={(e) => setColumnSpacingMm(Number(e.target.value))}
            className={field}
          />
        </div>
      </div>
      <button
        type="button"
        disabled={applying}
        onClick={() =>
          onApply({ moduleSpecId, orientation, edgeMarginMm, rowSpacingMm, columnSpacingMm })
        }
        className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {applying ? 'Se aplică...' : 'Aplică setări'}
      </button>
    </div>
  );
}

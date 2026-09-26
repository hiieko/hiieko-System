'use client';

import { EditorTool } from './types';

interface EditorToolbarProps {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  gridEnabled: boolean;
  onGridToggle: () => void;
  gridSizeMm: number;
  onGridSizeChange: (mm: number) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlignX: () => void;
  onAlignY: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  hasMeasure: boolean;
  onClearMeasure: () => void;
}

const toolBtn = (active: boolean) =>
  `px-2 py-1 text-xs font-semibold rounded-md border ${
    active
      ? 'bg-slate-900 text-white border-slate-900'
      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
  }`;

const actionBtn = (disabled: boolean) =>
  `px-2 py-1 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`;

export function EditorToolbar({
  tool,
  onToolChange,
  hasSelection,
  canUndo,
  canRedo,
  gridEnabled,
  onGridToggle,
  gridSizeMm,
  onGridSizeChange,
  snapEnabled,
  onSnapToggle,
  onRotate,
  onDuplicate,
  onDelete,
  onAlignX,
  onAlignY,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onUndo,
  onRedo,
  hasMeasure,
  onClearMeasure,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Instrument</span>
      <button className={toolBtn(tool === 'select')} onClick={() => onToolChange('select')}>
        Selectează
      </button>
      <button className={toolBtn(tool === 'pan')} onClick={() => onToolChange('pan')}>
        Pan
      </button>
      <button className={toolBtn(tool === 'measure')} onClick={() => onToolChange('measure')}>
        Măsoară
      </button>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <button className={actionBtn(!hasSelection)} disabled={!hasSelection} onClick={onRotate}>
        Rotire 90°
      </button>
      <button className={actionBtn(!hasSelection)} disabled={!hasSelection} onClick={onDuplicate}>
        Duplică
      </button>
      <button className={actionBtn(!hasSelection)} disabled={!hasSelection} onClick={onDelete}>
        Șterge
      </button>
      <button className={actionBtn(!hasSelection)} disabled={!hasSelection} onClick={onAlignX}>
        Aliniază X
      </button>
      <button className={actionBtn(!hasSelection)} disabled={!hasSelection} onClick={onAlignY}>
        Aliniază Y
      </button>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <button className={actionBtn(false)} onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button className={actionBtn(false)} onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <button className={actionBtn(false)} onClick={onZoomIn}>
        +
      </button>
      <button className={actionBtn(false)} onClick={onZoomOut}>
        −
      </button>
      <button className={actionBtn(false)} onClick={onFit}>
        Fit
      </button>
      <button className={actionBtn(false)} onClick={onReset}>
        Reset
      </button>

      <span className="mx-1 h-4 w-px bg-slate-200" />

      <button className={toolBtn(gridEnabled)} onClick={onGridToggle}>
        Grilă
      </button>
      <select
        value={gridSizeMm}
        onChange={(e) => onGridSizeChange(Number(e.target.value))}
        className="rounded-md border border-slate-200 bg-white px-1 py-1 text-xs text-slate-600"
        title="Pas grilă (mm)"
      >
        <option value={100}>100 mm</option>
        <option value={250}>250 mm</option>
        <option value={500}>500 mm</option>
        <option value={1000}>1000 mm</option>
      </select>
      <button className={toolBtn(snapEnabled)} onClick={onSnapToggle}>
        Snap
      </button>

      {hasMeasure && (
        <>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button className={actionBtn(false)} onClick={onClearMeasure}>
            Șterge măsură
          </button>
        </>
      )}
    </div>
  );
}

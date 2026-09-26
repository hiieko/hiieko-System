'use client';

import { useState } from 'react';
import { Point2D } from '@solar/shared';

export interface RoofInput {
  name: string;
  polygon: Point2D[];
  slopeDeg: number;
  azimuthDeg: number;
  roofType: string;
}

function parsePolygon(text: string): Point2D[] {
  return text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [x, y] = line.split(',').map((s) => Number(s.trim()));
      return { x, y };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export function RoofEditor({
  onSave,
  saving,
}: {
  onSave: (input: RoofInput) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('Acoperiș principal');
  const [mode, setMode] = useState<'rectangle' | 'polygon'>('rectangle');
  const [widthM, setWidthM] = useState(8);
  const [lengthM, setLengthM] = useState(4);
  const [polygonText, setPolygonText] = useState('0,0\n8000,0\n8000,4000\n0,4000');
  const [slopeDeg, setSlopeDeg] = useState(30);
  const [azimuthDeg, setAzimuthDeg] = useState(180);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let polygon: Point2D[];
    if (mode === 'rectangle') {
      const w = Math.round(widthM * 1000);
      const l = Math.round(lengthM * 1000);
      polygon = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: l },
        { x: 0, y: l },
      ];
    } else {
      polygon = parsePolygon(polygonText);
      if (polygon.length < 3) return;
    }
    onSave({
      name,
      polygon,
      slopeDeg,
      azimuthDeg,
      roofType: slopeDeg > 0 ? 'PITCHED' : 'FLAT',
    });
  };

  const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white';
  const label = 'block text-xs font-medium text-slate-500 mb-1';
  const modeBtn = (active: boolean) =>
    `flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg border ${
      active
        ? 'bg-amber-500 text-slate-950 border-amber-500'
        : 'bg-white text-slate-600 border-slate-200'
    }`;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={label}>Nume</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('rectangle')} className={modeBtn(mode === 'rectangle')}>
          Dreptunghi
        </button>
        <button type="button" onClick={() => setMode('polygon')} className={modeBtn(mode === 'polygon')}>
          Poligon
        </button>
      </div>

      {mode === 'rectangle' ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Lățime (m)</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={widthM}
              onChange={(e) => setWidthM(Number(e.target.value))}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Lungime (m)</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={lengthM}
              onChange={(e) => setLengthM(Number(e.target.value))}
              className={field}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className={label}>Vârfuri poligon (x,y — câte unul pe linie)</label>
          <textarea
            value={polygonText}
            onChange={(e) => setPolygonText(e.target.value)}
            rows={4}
            className={field}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Pantă (°)</label>
          <input
            type="number"
            step="1"
            min="0"
            max="90"
            value={slopeDeg}
            onChange={(e) => setSlopeDeg(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Azimut (°)</label>
          <input
            type="number"
            step="1"
            min="0"
            max="360"
            value={azimuthDeg}
            onChange={(e) => setAzimuthDeg(Number(e.target.value))}
            className={field}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {saving ? 'Se salvează...' : 'Salvează acoperiș'}
      </button>
    </form>
  );
}


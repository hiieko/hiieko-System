'use client';

import { useState } from 'react';

export interface RoofInput {
  name: string;
  widthMm: number;
  lengthMm: number;
  slopeDeg: number;
  azimuthDeg: number;
}

export function RoofEditor({
  onSave,
  saving,
}: {
  onSave: (input: RoofInput) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('Acoperiș principal');
  const [widthM, setWidthM] = useState(8);
  const [lengthM, setLengthM] = useState(4);
  const [slopeDeg, setSlopeDeg] = useState(30);
  const [azimuthDeg, setAzimuthDeg] = useState(180);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      widthMm: Math.round(widthM * 1000),
      lengthMm: Math.round(lengthM * 1000),
      slopeDeg,
      azimuthDeg,
    });
  };

  const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white';
  const label = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={label}>Nume</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>
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

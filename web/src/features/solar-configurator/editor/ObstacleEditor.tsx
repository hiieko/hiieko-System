'use client';

import { useState } from 'react';
import { Point2D } from '@solar/shared';

export interface ObstacleInput {
  name?: string;
  obstacleType?: string;
  polygon: Point2D[];
  keepoutMarginMm: number;
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

export function ObstacleEditor({
  onAdd,
  adding,
}: {
  onAdd: (input: ObstacleInput) => void;
  adding: boolean;
}) {
  const [name, setName] = useState('');
  const [obstacleType, setObstacleType] = useState('SKYLIGHT');
  const [keepoutMarginMm, setKeepoutMarginMm] = useState(200);
  const [polygonText, setPolygonText] = useState('3000,1000\n4000,1000\n4000,2000\n3000,2000');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const polygon = parsePolygon(polygonText);
    if (polygon.length < 3) return;
    onAdd({
      name: name.trim() || undefined,
      obstacleType,
      polygon,
      keepoutMarginMm,
    });
  };

  const field = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white';
  const label = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Nume</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Fereastră de acoperiș" />
        </div>
        <div>
          <label className={label}>Tip</label>
          <select value={obstacleType} onChange={(e) => setObstacleType(e.target.value)} className={field}>
            <option value="SKYLIGHT">Lucarnă</option>
            <option value="CHIMNEY">Coș</option>
            <option value="VENT">Ventilație</option>
            <option value="SERVICE">Zonă de serviciu</option>
            <option value="OTHER">Altul</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Vârfuri poligon (x,y — câte unul pe linie)</label>
        <textarea value={polygonText} onChange={(e) => setPolygonText(e.target.value)} rows={3} className={field} />
      </div>

      <div>
        <label className={label}>Marjă de siguranță (mm)</label>
        <input
          type="number"
          min="0"
          value={keepoutMarginMm}
          onChange={(e) => setKeepoutMarginMm(Number(e.target.value))}
          className={field}
        />
      </div>

      <button
        type="submit"
        disabled={adding}
        className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {adding ? 'Se adaugă...' : 'Adaugă obstacol'}
      </button>
    </form>
  );
}

'use client';

import { BomLine } from '@solar/shared';

function formatQuantity(qty: number, unit: string): string {
  if (unit === 'mm') {
    return `${(qty / 1000).toFixed(1)} m`;
  }
  return `${Math.round(qty * 100) / 100} ${unit}`;
}

export function BomPanel({
  bom,
  totalModules,
  totalPowerWp,
}: {
  bom: BomLine[];
  totalModules: number;
  totalPowerWp: number;
}) {
  if (bom.length === 0) {
    return (
      <div className="text-sm text-slate-400">BOM indisponibil — calculează mai întâi layout-ul.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Module</span>
        <span className="font-semibold text-slate-800">{totalModules} buc</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Putere totală</span>
        <span className="font-semibold text-slate-800">{totalPowerWp.toFixed(0)} Wp</span>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-1.5 pr-2 font-medium">Componentă</th>
            <th className="py-1.5 pr-2 font-medium text-right">Cantitate</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((line, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-700">
                <div className="font-medium">{line.name}</div>
                <div className="text-[10px] text-slate-400">{line.code}</div>
              </td>
              <td className="py-1.5 text-right font-semibold text-slate-800">
                {formatQuantity(line.quantityRequired, line.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-amber-600">
        PROTOTIP — cantități demonstrative, nu reprezintă calcul ingineresc validat.
      </p>
    </div>
  );
}

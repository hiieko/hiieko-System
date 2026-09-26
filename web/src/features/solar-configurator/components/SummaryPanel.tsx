'use client';

import { MountingResult } from '@solar/shared';

export function SummaryPanel({
  totalModules,
  totalPowerWp,
  mounting,
}: {
  totalModules: number;
  totalPowerWp: number;
  mounting: MountingResult | null;
}) {
  const rows: Array<[string, string]> = [
    ['Module', `${totalModules} buc`],
    ['Putere instalată', `${totalPowerWp.toFixed(0)} Wp`],
    ['Lungime șină (prototip)', mounting ? `${(mounting.railTotalLengthMm / 1000).toFixed(1)} m` : '—'],
    ['Hook-uri (prototip)', mounting ? `${mounting.hookCount}` : '—'],
    ['Clame finale (prototip)', mounting ? `${mounting.endClampCount}` : '—'],
    ['Clame mediane (prototip)', mounting ? `${mounting.midClampCount}` : '—'],
    ['Elemente fixare (prototip)', mounting ? `${mounting.fastenerCount}` : '—'],
    ['EPDM (prototip)', mounting ? `${mounting.epdmCount}` : '—'],
  ];

  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{label}</span>
          <span className="font-semibold text-slate-800">{value}</span>
        </div>
      ))}
    </div>
  );
}

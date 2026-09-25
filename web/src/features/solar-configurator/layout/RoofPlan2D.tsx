'use client';

import { ModulePlacement, RoofSectionModel, polygonBounds } from '@solar/shared';

/**
 * Basic 2D SVG roof plan (M1). Draws the roof boundary, module rectangles,
 * orientation, and dimensions directly from the roof-local placement data.
 * The same placement data also drives the 3D viewer.
 */
export function RoofPlan2D({
  roofSections,
  placements,
}: {
  roofSections: RoofSectionModel[];
  placements: ModulePlacement[];
}) {
  if (roofSections.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400 bg-white border border-slate-200 rounded-lg">
        Niciun plan de acoperiș definit încă
      </div>
    );
  }

  const roof = roofSections[0];
  const bounds = polygonBounds(roof.polygon);
  const widthMm = bounds.maxX - bounds.minX;
  const heightMm = bounds.maxY - bounds.minY;

  const padding = 40;
  const maxSize = 420;
  const scale = maxSize / Math.max(widthMm, heightMm, 1);

  const toX = (x: number) => (x - bounds.minX) * scale + padding;
  const toY = (y: number) => (y - bounds.minY) * scale + padding;

  const svgW = widthMm * scale + padding * 2;
  const svgH = heightMm * scale + padding * 2;

  const polygonPoints = roof.polygon
    .map((p) => `${toX(p.x)},${toY(p.y)}`)
    .join(' ');

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="bg-white border border-slate-200 rounded-lg"
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon points={polygonPoints} fill="#eef2f7" stroke="#475569" strokeWidth={1.5} />

      {placements.map((p, i) => (
        <rect
          key={`${p.row}-${p.column}-${i}`}
          x={toX(p.localX)}
          y={toY(p.localY)}
          width={p.widthMm * scale}
          height={p.heightMm * scale}
          fill="#1d4ed8"
          fillOpacity={0.82}
          stroke="#1e3a8a"
          strokeWidth={0.6}
        />
      ))}

      {/* Roof dimension labels */}
      <text
        x={toX((bounds.minX + bounds.maxX) / 2)}
        y={svgH - 12}
        textAnchor="middle"
        className="fill-slate-600"
        fontSize={11}
      >
        {(widthMm / 1000).toFixed(2)} m
      </text>
      <text
        x={svgW - 12}
        y={toY((bounds.minY + bounds.maxY) / 2)}
        textAnchor="middle"
        transform={`rotate(90 ${svgW - 12} ${toY((bounds.minY + bounds.maxY) / 2)})`}
        className="fill-slate-600"
        fontSize={11}
      >
        {(heightMm / 1000).toFixed(2)} m
      </text>
    </svg>
  );
}

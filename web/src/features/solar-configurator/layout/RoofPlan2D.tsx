'use client';

import { ModulePlacement, ObstacleModel, RoofSectionModel, polygonBounds } from '@solar/shared';

function RoofPlan({
  roof,
  obstacles,
  placements,
  selected,
}: {
  roof: RoofSectionModel;
  obstacles: ObstacleModel[];
  placements: ModulePlacement[];
  selected: boolean;
}) {
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
  const roofPoints = roof.polygon.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ');

  return (
    <div className={selected ? 'ring-2 ring-amber-400 rounded-lg p-1' : 'p-1'}>
      <div className="flex items-center justify-between text-xs mb-1 px-1">
        <span className="font-semibold text-slate-700">{roof.name}</span>
        <span className="text-slate-400">
          {roof.slopeDeg}° / {roof.azimuthDeg}°
        </span>
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="bg-white border border-slate-200 rounded-lg"
        preserveAspectRatio="xMidYMid meet"
      >
        <polygon points={roofPoints} fill="#eef2f7" stroke="#475569" strokeWidth={1.5} />
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
        {obstacles.map((o, i) => (
          <polygon
            key={i}
            points={o.polygon.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
            fill="#dc2626"
            fillOpacity={0.45}
            stroke="#b91c1c"
            strokeWidth={1}
          />
        ))}
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
    </div>
  );
}

export function RoofPlan2D({
  roofSections,
  obstacles,
  placements,
  selectedRoofSectionId,
}: {
  roofSections: RoofSectionModel[];
  obstacles: ObstacleModel[];
  placements: ModulePlacement[];
  selectedRoofSectionId?: string | null;
}) {
  if (roofSections.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400 bg-white border border-slate-200 rounded-lg">
        Niciun plan de acoperiș definit încă
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roofSections.map((roof) => {
        const roofObstacles = obstacles.filter((o) => o.roofSectionId === roof.id);
        const roofPlacements = placements.filter((p) => p.roofSectionId === roof.id);
        return (
          <RoofPlan
            key={roof.id}
            roof={roof}
            obstacles={roofObstacles}
            placements={roofPlacements}
            selected={selectedRoofSectionId === roof.id}
          />
        );
      })}
    </div>
  );
}


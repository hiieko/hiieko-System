'use client';

import { useRef } from 'react';
import {
  ModulePlacement,
  ObstacleModel,
  Point2D,
  RoofSectionModel,
  Viewport,
  localToScreen,
  moduleCorners,
  pointDistanceMm,
  pointInPolygon,
  polygonBounds,
  screenToLocal,
} from '@solar/shared';
import { EditorTool, MeasureState, PLAN_VIEW_H, PLAN_VIEW_W } from '../editor/types';

interface RoofPlan2DProps {
  surface: RoofSectionModel;
  placements: ModulePlacement[];
  obstacles: ObstacleModel[];
  selectedModuleIds: ReadonlySet<string>;
  selectedObstacleIds: ReadonlySet<string>;
  viewport: Viewport;
  tool: EditorTool;
  gridEnabled: boolean;
  gridSizeMm: number;
  measure: MeasureState;
  onViewportChange: (v: Viewport) => void;
  onSelectModule: (id: string, additive: boolean) => void;
  onSelectObstacle: (id: string, additive: boolean) => void;
  onSurfacePointerDown: (local: Point2D) => void;
  onModuleDragStart: (id: string, local: Point2D) => void;
  onModuleDragMove: (local: Point2D) => void;
  onModuleDragEnd: () => void;
  onMeasurePoint: (local: Point2D) => void;
}

export function RoofPlan2D({
  surface,
  placements,
  obstacles,
  selectedModuleIds,
  selectedObstacleIds,
  viewport,
  tool,
  gridEnabled,
  gridSizeMm,
  measure,
  onViewportChange,
  onSelectModule,
  onSelectObstacle,
  onSurfacePointerDown,
  onModuleDragStart,
  onModuleDragMove,
  onModuleDragEnd,
  onMeasurePoint,
}: RoofPlan2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    mode: 'module' | 'pan';
    id?: string;
    start: Point2D;
    startViewport: Viewport;
    moved: boolean;
  } | null>(null);

  const svgPoint = (clientX: number, clientY: number): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * PLAN_VIEW_W,
      y: ((clientY - rect.top) / rect.height) * PLAN_VIEW_H,
    };
  };

  const hitModule = (local: Point2D): ModulePlacement | undefined => {
    for (let i = placements.length - 1; i >= 0; i--) {
      const p = placements[i];
      if (pointInPolygon(local, moduleCorners(p))) return p;
    }
    return undefined;
  };

  const hitObstacle = (local: Point2D): ObstacleModel | undefined => {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (pointInPolygon(local, obstacles[i].polygon)) return obstacles[i];
    }
    return undefined;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e.clientX, e.clientY);
    const local = screenToLocal(p, viewport);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'pan' || e.button === 1) {
      dragRef.current = { mode: 'pan', start: p, startViewport: viewport, moved: false };
      return;
    }

    if (tool === 'measure') {
      onMeasurePoint(local);
      return;
    }

    const mod = hitModule(local);
    if (mod) {
      if (e.shiftKey) {
        onSelectModule(mod.id, true);
      } else {
        dragRef.current = {
          mode: 'module',
          id: mod.id,
          start: local,
          startViewport: viewport,
          moved: false,
        };
        onModuleDragStart(mod.id, local);
      }
      return;
    }

    const obs = hitObstacle(local);
    if (obs) {
      onSelectObstacle(obs.id, e.shiftKey);
      return;
    }

    onSurfacePointerDown(local);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (d.mode === 'pan') {
      onViewportChange({
        zoom: d.startViewport.zoom,
        panX: d.startViewport.panX + (p.x - d.start.x),
        panY: d.startViewport.panY + (p.y - d.start.y),
      });
      d.moved = true;
    } else if (d.mode === 'module') {
      onModuleDragMove(screenToLocal(p, viewport));
      d.moved = true;
    }
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.mode === 'module') onModuleDragEnd();
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const p = svgPoint(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const zoom = Math.min(1000, Math.max(0.0001, viewport.zoom * factor));
    const k = zoom / viewport.zoom;
    onViewportChange({
      zoom,
      panX: p.x - (p.x - viewport.panX) * k,
      panY: p.y - (p.y - viewport.panY) * k,
    });
  };

  const cursor = tool === 'pan' ? 'grab' : tool === 'measure' ? 'crosshair' : 'default';
  const bounds = polygonBounds(surface.polygon);
  const toScreen = (p: Point2D) => localToScreen(p, viewport);
  const polyPoints = (poly: Point2D[]) =>
    poly.map((p) => `${toScreen(p).x},${toScreen(p).y}`).join(' ');
  // Grid (visual + snap reference)
  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (gridEnabled && gridSizeMm > 0) {
    const step = gridSizeMm;
    const maxLines = 400;
    const cols = Math.ceil((bounds.maxX - bounds.minX) / step);
    const rows = Math.ceil((bounds.maxY - bounds.minY) / step);
    const stepX = cols > maxLines ? step * Math.ceil(cols / maxLines) : step;
    const stepY = rows > maxLines ? step * Math.ceil(rows / maxLines) : step;
    const minX = Math.floor(bounds.minX / stepX) * stepX;
    const minY = Math.floor(bounds.minY / stepY) * stepY;
    for (let x = minX; x <= bounds.maxX + 1e-6; x += stepX) {
      const a = toScreen({ x, y: bounds.minY });
      const b = toScreen({ x, y: bounds.maxY });
      gridLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    for (let y = minY; y <= bounds.maxY + 1e-6; y += stepY) {
      const a = toScreen({ x: bounds.minX, y });
      const b = toScreen({ x: bounds.maxX, y });
      gridLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  const measureMm = measure.p1 && measure.p2 ? pointDistanceMm(measure.p1, measure.p2) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          <span className="font-semibold text-slate-700">{surface.name}</span>
          <span className="ml-2 rounded bg-slate-100 px-1 py-0.5 text-[10px] uppercase">{surface.surfaceType}</span>
          <span className="ml-2">{surface.slopeDeg}° / {surface.azimuthDeg}° · h {(surface.origin.z / 1000).toFixed(1)} m</span>
        </span>
        <span>
          {measureMm !== null
            ? `Distanță: ${(measureMm / 1000).toFixed(2)} m`
            : tool === 'measure'
              ? 'Măsoară: apasă 2 puncte'
              : `${(bounds.maxX - bounds.minX) / 1000} m × ${(bounds.maxY - bounds.minY) / 1000} m`}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${PLAN_VIEW_W} ${PLAN_VIEW_H}`}
        width="100%"
        height="100%"
        className="bg-white border border-slate-200 rounded-lg select-none touch-none"
        style={{ cursor }}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
      >
        {gridLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#e2e8f0" strokeWidth={1} />
        ))}

        <polygon points={polyPoints(surface.polygon)} fill="#eef2f7" stroke="#475569" strokeWidth={1.5} />

        {obstacles.map((o) => {
          const selected = selectedObstacleIds.has(o.id);
          return (
            <polygon
              key={o.id}
              points={polyPoints(o.polygon)}
              fill="#dc2626"
              fillOpacity={selected ? 0.7 : 0.45}
              stroke={selected ? '#f59e0b' : '#b91c1c'}
              strokeWidth={selected ? 2 : 1}
              className="cursor-pointer"
            />
          );
        })}

        {placements.map((p) => {
          const selected = selectedModuleIds.has(p.id);
          return (
            <polygon
              key={p.id}
              points={polyPoints(moduleCorners(p))}
              fill={selected ? '#2563eb' : '#1d4ed8'}
              fillOpacity={selected ? 1 : 0.82}
              stroke={selected ? '#f59e0b' : '#1e3a8a'}
              strokeWidth={selected ? 2 : 0.6}
              className="cursor-pointer"
            />
          );
        })}

        {measure.p1 && (
          <circle cx={toScreen(measure.p1).x} cy={toScreen(measure.p1).y} r={4} fill="#0ea5e9" />
        )}
        {measure.p2 && (
          <circle cx={toScreen(measure.p2).x} cy={toScreen(measure.p2).y} r={4} fill="#0ea5e9" />
        )}
        {measure.p1 && measure.p2 && (
          <>
            <line
              x1={toScreen(measure.p1).x}
              y1={toScreen(measure.p1).y}
              x2={toScreen(measure.p2).x}
              y2={toScreen(measure.p2).y}
              stroke="#0ea5e9"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text
              x={(toScreen(measure.p1).x + toScreen(measure.p2).x) / 2}
              y={(toScreen(measure.p1).y + toScreen(measure.p2).y) / 2 - 6}
              textAnchor="middle"
              fontSize={12}
              className="fill-sky-700 pointer-events-none"
            >
              {(measureMm! / 1000).toFixed(2)} m
            </text>
          </>
        )}
      </svg>
    </div>
  );
}




'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BomLine,
  ModulePlacement,
  ModuleSpecModel,
  MountingResult,
  ObstacleModel,
  Point2D,
  SolarDesignModel,
  Viewport,
  IDENTITY_VIEWPORT,
  alignPlacementsMinX,
  alignPlacementsMinY,
  deletePlacements,
  duplicatePlacements,
  fitViewport,
  movePlacements,
  polygonBounds,
  rotatePlacements,
  snapPlacements,
  zoomViewportAt,
} from '@solar/shared';
import { apiClient, ApiError } from '../../lib/api-client';
import * as solarApi from '../../features/solar-configurator/api/solar';
import {
  ProjectOption,
  ProjectSelector,
} from '../../features/solar-configurator/components/ProjectSelector';
import { SummaryPanel } from '../../features/solar-configurator/components/SummaryPanel';
import { BomPanel } from '../../features/solar-configurator/bom/BomPanel';
import { RoofEditor, RoofInput } from '../../features/solar-configurator/editor/RoofEditor';
import {
  ObstacleEditor,
  ObstacleInput,
} from '../../features/solar-configurator/editor/ObstacleEditor';
import {
  LayoutInput,
  ModuleSelector,
} from '../../features/solar-configurator/editor/ModuleSelector';
import { RoofPlan2D } from '../../features/solar-configurator/layout/RoofPlan2D';
import { EditorToolbar } from '../../features/solar-configurator/editor/EditorToolbar';
import { useHistory } from '../../features/solar-configurator/editor/useHistory';
import {
  EditorTool,
  EMPTY_MEASURE,
  MeasureState,
  PLAN_VIEW_H,
  PLAN_VIEW_W,
} from '../../features/solar-configurator/editor/types';

const SolarScene = dynamic(
  () =>
    import('../../features/solar-configurator/viewer3d/SolarScene').then((m) => m.SolarScene),
  { ssr: false },
);

interface LayoutResult {
  placements: ModulePlacement[];
  mounting: MountingResult;
  bom: BomLine[];
  totalModules: number;
  totalPowerWp: number;
}

export default function SolarConfiguratorPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState('');
  const [designs, setDesigns] = useState<Array<{ id: string; name: string }>>([]);
  const [designId, setDesignId] = useState('');
  const [design, setDesign] = useState<SolarDesignModel | null>(null);
  const [modules, setModules] = useState<ModuleSpecModel[]>([]);
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoofSectionId, setSelectedRoofSectionId] = useState<string | null>(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [selectedObstacleIds, setSelectedObstacleIds] = useState<Set<string>>(new Set());

  // Editor state — viewport/grid/tool are visual + interaction state, NOT domain geometry.
  const [tool, setTool] = useState<EditorTool>('select');
  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSizeMm, setGridSizeMm] = useState(500);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [measure, setMeasure] = useState<MeasureState>(EMPTY_MEASURE);
  const [previewPlacements, setPreviewPlacements] = useState<ModulePlacement[] | null>(null);

  // Committed placements are the editable source of truth (undo/redo + debounced save).
  const history = useHistory<ModulePlacement[]>([]);
  const placements = history.present;
  const displayPlacements = previewPlacements ?? placements;

  const dragRef = useRef<{
    ids: Set<string>;
    startLocal: Point2D;
    snapshot: ModulePlacement[];
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<ModulePlacement[] | null>(null);

  const selectModule = (id: string, additive: boolean) => {
    setSelectedObstacleIds(new Set());
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const selectObstacle = (id: string, additive: boolean) => {
    setSelectedModuleIds(new Set());
    setSelectedObstacleIds((prev) => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedModuleIds(new Set());
    setSelectedObstacleIds(new Set());
  };

  useEffect(() => {
    (async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          apiClient.getProjects(),
          solarApi.listSolarModules(),
        ]);
        const active = (pRes.data || []).filter((p: any) => p.is_active);
        setProjects(active.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
        setModules(mRes.data || []);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Eroare la încărcarea datelor');
      }
    })();
  }, []);

  // Debounced persistence: commit placements only after an edit operation completes.
  useEffect(() => {
    if (!designId) return;
    if (lastSavedRef.current === placements) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSavedRef.current = placements;
      solarApi
        .replacePlacements(designId, placements)
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Eroare la salvarea modificărilor'));
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [placements, designId]);

  // Fit the viewport when the active surface changes.
  useEffect(() => {
    const roofs = design?.roofSections ?? [];
    const activeId = selectedRoofSectionId ?? roofs[0]?.id ?? null;
    if (!activeId) return;
    const surf = roofs.find((r) => r.id === activeId);
    if (surf) setViewport(fitViewport(polygonBounds(surf.polygon), PLAN_VIEW_W, PLAN_VIEW_H));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoofSectionId, design?.roofSections]);

  const loadDesigns = async (pid: string) => {
    setDesigns([]);
    setDesignId('');
    setDesign(null);
    setResult(null);
    if (!pid) return;
    try {
      const res = await solarApi.listSolarDesigns(pid);
      setDesigns(res.data || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la încărcarea design-urilor');
    }
  };

  const selectProject = (id: string) => {
    setProjectId(id);
    void loadDesigns(id);
  };

  const loadDesign = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await solarApi.getSolarDesign(id);
      setDesign(res.data);
      setResult(null);
      lastSavedRef.current = res.data.placements ?? [];
      history.reset(res.data.placements ?? []);
      setPreviewPlacements(null);
      setSelectedModuleIds(new Set());
      setSelectedObstacleIds(new Set());
      setSelectedRoofSectionId(res.data.roofSections?.[0]?.id ?? null);
      setMeasure(EMPTY_MEASURE);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la încărcarea design-ului');
    } finally {
      setLoading(false);
    }
  };

  const selectDesign = (id: string) => {
    setDesignId(id);
    if (id) void loadDesign(id);
    else setDesign(null);
  };

  const createDesign = async (name: string) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await solarApi.createSolarDesign({ projectId, name });
      const created = res.data;
      await loadDesigns(projectId);
      setDesignId(created.id);
      await loadDesign(created.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la crearea design-ului');
    } finally {
      setLoading(false);
    }
  };

  const saveRoof = async (input: RoofInput) => {
    if (!designId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await solarApi.addRoofSection(designId, {
        name: input.name,
        roofType: input.roofType,
        surfaceType: input.surfaceType,
        slopeDeg: input.slopeDeg,
        azimuthDeg: input.azimuthDeg,
        thicknessMm: input.thicknessMm,
        polygon: input.polygon,
        origin: { x: 0, y: 0, z: Math.round(input.elevationM * 1000) },
      });
      setSelectedRoofSectionId(res.data?.id ?? null);
      await loadDesign(designId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la salvarea acoperișului');
    } finally {
      setSaving(false);
    }
  };

  const deleteRoof = async (roofSectionId: string) => {
    if (!designId) return;
    setSaving(true);
    setError(null);
    try {
      await solarApi.deleteRoofSection(designId, roofSectionId);
      if (selectedRoofSectionId === roofSectionId) setSelectedRoofSectionId(null);
      await loadDesign(designId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la ștergerea acoperișului');
    } finally {
      setSaving(false);
    }
  };

  const addObstacle = async (input: ObstacleInput) => {
    if (!designId || !selectedRoofSectionId) return;
    setSaving(true);
    setError(null);
    try {
      await solarApi.addObstacle(designId, selectedRoofSectionId, {
        name: input.name,
        obstacleType: input.obstacleType,
        polygon: input.polygon,
        keepoutMarginMm: input.keepoutMarginMm,
      });
      await loadDesign(designId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la adăugarea obstacolului');
    } finally {
      setSaving(false);
    }
  };

  const deleteObstacle = async (obstacleId: string) => {
    if (!designId) return;
    setSaving(true);
    setError(null);
    try {
      await solarApi.deleteObstacle(designId, obstacleId);
      await loadDesign(designId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la ștergerea obstacolului');
    } finally {
      setSaving(false);
    }
  };

  const applyLayout = async (input: LayoutInput) => {
    if (!designId) return;
    setSaving(true);
    setError(null);
    try {
      await solarApi.upsertLayoutSettings(designId, input);
      await loadDesign(designId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la aplicarea setărilor');
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (!designId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await solarApi.calculateLayout(designId);
      await loadDesign(designId);
      setResult(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eroare la calcul');
    } finally {
      setLoading(false);
    }
  };

  // ── Editor operations (pure geometry lives in @solar/shared) ──────────────

  const onModuleDragStart = (id: string, local: Point2D) => {
    setSelectedObstacleIds(new Set());
    let ids: Set<string>;
    if (selectedModuleIds.has(id)) {
      ids = new Set(selectedModuleIds);
    } else {
      ids = new Set([id]);
      setSelectedModuleIds(ids);
    }
    dragRef.current = { ids, startLocal: local, snapshot: placements };
  };

  const onModuleDragMove = (local: Point2D) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = local.x - d.startLocal.x;
    const dy = local.y - d.startLocal.y;
    let next = movePlacements(d.snapshot, d.ids, dx, dy);
    if (snapEnabled) next = snapPlacements(next, d.ids, gridSizeMm);
    setPreviewPlacements(next);
  };

  const onModuleDragEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (previewPlacements !== null) {
      history.set(previewPlacements);
      setPreviewPlacements(null);
    }
  };

  const applyTransform = (next: ModulePlacement[]) => {
    setPreviewPlacements(null);
    history.set(next);
  };

  const rotateSelected = () => {
    if (selectedModuleIds.size === 0) return;
    applyTransform(rotatePlacements(placements, selectedModuleIds, 90));
  };

  const duplicateSelected = () => {
    if (selectedModuleIds.size === 0) return;
    const makeId = () => crypto.randomUUID();
    applyTransform(duplicatePlacements(placements, selectedModuleIds, makeId, 200));
  };

  const deleteSelected = () => {
    if (selectedModuleIds.size === 0) return;
    setSelectedModuleIds(new Set());
    applyTransform(deletePlacements(placements, selectedModuleIds));
  };

  const alignSelectedX = () => {
    if (selectedModuleIds.size < 2) return;
    applyTransform(alignPlacementsMinX(placements, selectedModuleIds));
  };

  const alignSelectedY = () => {
    if (selectedModuleIds.size < 2) return;
    applyTransform(alignPlacementsMinY(placements, selectedModuleIds));
  };

  const onSurfacePointerDown = () => {
    clearSelection();
  };

  const onMeasurePoint = (local: Point2D) => {
    setMeasure((m) => {
      if (!m.p1) return { p1: local, p2: null };
      if (!m.p2) return { p1: m.p1, p2: local };
      return { p1: local, p2: null };
    });
  };

  const zoomIn = () =>
    setViewport((v) => zoomViewportAt(v, { x: PLAN_VIEW_W / 2, y: PLAN_VIEW_H / 2 }, 1.25));
  const zoomOut = () =>
    setViewport((v) => zoomViewportAt(v, { x: PLAN_VIEW_W / 2, y: PLAN_VIEW_H / 2 }, 0.8));
  const fitView = () => {
    const roofs = design?.roofSections ?? [];
    const surf = roofs.find((r) => r.id === (selectedRoofSectionId ?? roofs[0]?.id));
    if (surf) setViewport(fitViewport(polygonBounds(surf.polygon), PLAN_VIEW_W, PLAN_VIEW_H));
  };
  const resetView = () => {
    setTool('select');
    fitView();
  };

  const roofSections = design?.roofSections ?? [];
  const obstacles = design?.obstacles ?? [];
  const totalModules = placements.length;

  const activeSurfaceId = selectedRoofSectionId ?? roofSections[0]?.id ?? null;
  const activeSurface = roofSections.find((r) => r.id === activeSurfaceId) ?? null;
  const activePlacements = displayPlacements.filter((p) => p.roofSectionId === activeSurfaceId);
  const activeObstacles = obstacles.filter((o) => o.roofSectionId === activeSurfaceId);

  const moduleSpec = useMemo(() => {
    const id = design?.layoutSettings?.moduleSpecId;
    return modules.find((m) => m.id === id) ?? modules[0] ?? null;
  }, [modules, design]);
  const totalPowerWp = totalModules * (moduleSpec?.powerWp ?? 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configurator Solar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Prototip de configurare PV — acoperiș, layout, vizualizare 3D și BOM demonstrativ.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left — controls */}
        <div className="col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">1. Proiect & Design</h2>
            <ProjectSelector
              projects={projects}
              projectId={projectId}
              designs={designs}
              designId={designId}
              onSelectProject={selectProject}
              onSelectDesign={selectDesign}
              onCreateDesign={createDesign}
              loading={loading}
            />
          </div>

          {designId && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">2. Acoperiș</h2>
                <RoofEditor onSave={saveRoof} saving={saving} />
              </div>

              {roofSections.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Secțiuni acoperiș</h2>
                  <div className="space-y-1.5">
                    {roofSections.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRoofSectionId(r.id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-sm cursor-pointer ${
                          selectedRoofSectionId === r.id
                            ? 'bg-amber-100 text-slate-900'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="font-medium">{r.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteRoof(r.id);
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold"
                        >
                          Șterge
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRoofSectionId && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">Obstacole</h2>
                  <ObstacleEditor onAdd={addObstacle} adding={saving} />
                  <div className="mt-2 space-y-1.5">
                    {obstacles
                      .filter((o) => o.roofSectionId === selectedRoofSectionId)
                      .map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-xs px-1">
                          <span className="text-slate-600">
                            {o.name || o.obstacleType || 'Obstacol'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteObstacle(o.id)}
                            className="text-red-600 hover:text-red-700 font-semibold"
                          >
                            Șterge
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">3. Modul PV & Layout</h2>
                <ModuleSelector
                  modules={modules}
                  initial={design?.layoutSettings}
                  onApply={applyLayout}
                  applying={saving}
                />
              </div>

              <button
                type="button"
                onClick={recalculate}
                disabled={loading || roofSections.length === 0}
                className="w-full px-3 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-sm font-semibold rounded-lg"
              >
                {loading ? 'Se calculează...' : 'Calculează layout & BOM'}
              </button>
            </>
          )}
        </div>

        {/* Center — 3D + 2D */}
        <div className="col-span-6 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Vizualizare 3D</h2>
            <div className="h-[380px] rounded-lg overflow-hidden border border-slate-100">
              <SolarScene roofSections={roofSections} placements={displayPlacements} obstacles={obstacles} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Plan 2D (editare)</h2>
            <EditorToolbar
              tool={tool}
              onToolChange={setTool}
              hasSelection={selectedModuleIds.size > 0}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              gridEnabled={gridEnabled}
              onGridToggle={() => setGridEnabled((v) => !v)}
              gridSizeMm={gridSizeMm}
              onGridSizeChange={setGridSizeMm}
              snapEnabled={snapEnabled}
              onSnapToggle={() => setSnapEnabled((v) => !v)}
              onRotate={rotateSelected}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onAlignX={alignSelectedX}
              onAlignY={alignSelectedY}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFit={fitView}
              onReset={resetView}
              onUndo={history.undo}
              onRedo={history.redo}
              hasMeasure={measure.p1 !== null || measure.p2 !== null}
              onClearMeasure={() => setMeasure(EMPTY_MEASURE)}
            />
            <div className="h-[420px] mt-3">
              {activeSurface ? (
                <RoofPlan2D
                  surface={activeSurface}
                  placements={activePlacements}
                  obstacles={activeObstacles}
                  selectedModuleIds={selectedModuleIds}
                  selectedObstacleIds={selectedObstacleIds}
                  viewport={viewport}
                  tool={tool}
                  gridEnabled={gridEnabled}
                  gridSizeMm={gridSizeMm}
                  measure={measure}
                  onViewportChange={setViewport}
                  onSelectModule={selectModule}
                  onSelectObstacle={selectObstacle}
                  onSurfacePointerDown={onSurfacePointerDown}
                  onModuleDragStart={onModuleDragStart}
                  onModuleDragMove={onModuleDragMove}
                  onModuleDragEnd={onModuleDragEnd}
                  onMeasurePoint={onMeasurePoint}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Niciun plan de suprafață definit încă
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — summary + BOM */}
        <div className="col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Sumar</h2>
            <SummaryPanel
              totalModules={totalModules}
              totalPowerWp={totalPowerWp}
              mounting={result?.mounting ?? null}
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">BOM (prototip)</h2>
            <BomPanel
              bom={result?.bom ?? []}
              totalModules={totalModules}
              totalPowerWp={totalPowerWp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

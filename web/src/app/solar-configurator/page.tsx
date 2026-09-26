'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BomLine,
  ModulePlacement,
  ModuleSpecModel,
  MountingResult,
  ObstacleModel,
  SolarDesignModel,
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
        slopeDeg: input.slopeDeg,
        azimuthDeg: input.azimuthDeg,
        polygon: input.polygon,
        origin: { x: 0, y: 0, z: 0 },
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

  const placements = useMemo(() => result?.placements ?? design?.placements ?? [], [result, design]);
  const roofSections = design?.roofSections ?? [];
  const obstacles = design?.obstacles ?? [];
  const totalModules = result?.totalModules ?? design?.placements?.length ?? 0;

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
              <SolarScene roofSections={roofSections} placements={placements} obstacles={obstacles} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Plan 2D (acoperiș)</h2>
            <div className="h-[320px] flex items-center justify-center">
              <RoofPlan2D
                roofSections={roofSections}
                obstacles={obstacles}
                placements={placements}
                selectedRoofSectionId={selectedRoofSectionId}
              />
            </div>
          </div>
        </div>

        {/* Right — summary + BOM */}
        <div className="col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Sumar</h2>
            <SummaryPanel
              totalModules={totalModules}
              totalPowerWp={result?.totalPowerWp ?? 0}
              mounting={result?.mounting ?? null}
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">BOM (prototip)</h2>
            <BomPanel
              bom={result?.bom ?? []}
              totalModules={totalModules}
              totalPowerWp={result?.totalPowerWp ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

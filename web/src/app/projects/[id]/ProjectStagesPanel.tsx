'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProjectStage, CreateStageDto } from '../../../features/projects/types';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { t, useLocale } from '@solar/shared';
import { Plus, Loader2, Layers, AlertCircle, Save, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  projectId: string;
}

export function ProjectStagesPanel({ projectId }: Props) {
  const { success, error: showError } = useToast();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });

  const canCreate = user && (user.role === 'admin' || user.role === 'owner' || user.role === 'pm');

  const loadStages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProjectStage[]>(`/api/projects/${projectId}/stages`);
      setStages(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la incarcarea etapelor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadStages(); }, [loadStages]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const dto: CreateStageDto = {
        name: form.name.trim(),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      await apiClient.post(`/api/projects/${projectId}/stages`, dto);
      success(t('projects.stage_created', locale));
      setForm({ name: '', startDate: '', endDate: '' });
      setShowCreate(false);
      loadStages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la crearea etapei';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1";


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-hii-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          {locale === 'en' ? 'Project Stages' : 'Etape Proiect'}
        </h3>
        {canCreate && (
          <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            {locale === 'en' ? 'Add Stage' : 'Adaugă etapă'}
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
          <div>
            <label className={labelCls}>{t('projects.stage_name', locale)}</label>
            <input className={inputCls} placeholder={t('projects.stage_placeholder', locale)} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
        <label className={labelCls}>{locale === 'en' ? 'Start Date' : 'Data început'}</label>
              <input className={inputCls} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{locale === 'en' ? 'End Date' : 'Data sfârșit'}</label>
              <input className={inputCls} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setForm({ name: '', startDate: '', endDate: '' }); }}>
          {locale === 'en' ? 'Cancel' : 'Anulează'}
            </Button>
            <Button variant="primary" size="sm" icon={<Save className="w-4 h-4" />} onClick={handleCreate} loading={saving} disabled={saving || !form.name.trim()}>
              {locale === 'en' ? 'Create' : 'Creează'}
            </Button>
          </div>
        </div>
      )}

      {stages.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {locale === 'en' ? 'No stages defined yet' : 'Nicio etapa definita inca'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-hii-100 flex items-center justify-center text-xs font-bold text-hii-700">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">{stage.name}</p>
              <p className="text-xs text-slate-500">
                {stage.start_date ? stage.start_date.split('T')[0] : '-'} &rarr; {stage.end_date ? stage.end_date.split('T')[0] : '-'}
              </p>
            </div>
            {stage.work_packages && stage.work_packages.length > 0 && (
              <span className="text-xs text-slate-400">{stage.work_packages.length} pachete</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

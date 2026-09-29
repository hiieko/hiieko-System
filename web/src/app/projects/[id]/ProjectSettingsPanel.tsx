'use client';

import React, { useState } from 'react';
import type { Project, ProjectStatus } from '../../../features/projects/types';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_OPTIONS,
} from '../../../features/projects/types';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useLocale } from '@solar/shared';
import { Save, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

interface Props {
  project: Project;
  onUpdate: (updates: any) => void;
}

export function ProjectSettingsPanel({ project, onUpdate }: Props) {
  const { success, error: showError } = useToast();
  const { locale } = useLocale();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: project.status,
    startDate: project.start_date ? project.start_date.split('T')[0] : '',
    targetEndDate: project.target_end_date ? project.target_end_date.split('T')[0] : '',
    budgetTotal: project.budget_total != null ? String(project.budget_total) : '',
    currency: project.currency,
    isActive: project.is_active,
  });

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1";

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updates: any = {
        status: form.status as ProjectStatus,
        startDate: form.startDate || undefined,
        targetEndDate: form.targetEndDate || undefined,
        budgetTotal: form.budgetTotal ? parseFloat(form.budgetTotal) : undefined,
        currency: form.currency,
        isActive: form.isActive,
      };
      const res = await apiClient.patch(`/api/projects/${project.id}`, updates);
      onUpdate(res.data);
      success(locale === 'en' ? 'Project updated' : 'Proiect actualizat');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Eroare la actualizare';
      setErr(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 mb-4">
          {locale === 'en' ? 'Project Settings' : 'Setări Proiect'}
      </h3>
      <div className="space-y-4 max-w-lg">
        <div>
          <label className={labelCls}>{locale === 'en' ? 'Status' : 'Stare'}</label>
          <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}>
            {PROJECT_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {locale === 'en' ? opt.labelEn : opt.labelRo}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
        <label className={labelCls}>{locale === 'en' ? 'Start Date' : 'Data început'}</label>
            <input className={inputCls} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>{locale === 'en' ? 'Target End Date' : 'Data Tinta'}</label>
            <input className={inputCls} type="date" value={form.targetEndDate} onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{locale === 'en' ? 'Budget' : 'Buget'}</label>
            <input className={inputCls} type="number" step="0.01" value={form.budgetTotal} onChange={e => setForm(f => ({ ...f, budgetTotal: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>{locale === 'en' ? 'Currency' : 'Moneda'}</label>
            <select className={inputCls} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-slate-300" />
          <label htmlFor="isActive" className="text-sm text-slate-700">{locale === 'en' ? 'Active' : 'Activ'}</label>
        </div>
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <Button variant="primary" size="sm" icon={<Save className="w-4 h-4" />} onClick={handleSave} loading={saving} disabled={saving}>
          {saving ? (locale === 'en' ? 'Saving...' : 'Se salvează...') : (locale === 'en' ? 'Save Settings' : 'Salvează setări')}
        </Button>
      </div>
    </div>
  );
}

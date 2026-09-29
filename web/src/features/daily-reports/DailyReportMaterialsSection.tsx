'use client';
import React, { useState, useEffect } from 'react';
import { t, useLocale } from '@solar/shared';
import { Plus, Trash2, Package } from 'lucide-react';
import type { DailyReportFormState, ReportMaterialEntry } from './types';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

export function DailyReportMaterialsSection({ form, onChange }: Props) {
  const { locale } = useLocale();
  const [materials, setMaterials] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMatId, setNewMatId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newRemarks, setNewRemarks] = useState('');

  useEffect(() => {
    apiClient.getMaterials().then(r => setMaterials((r.data || []) as any[])).catch(() => {});
  }, []);

  const addMaterial = () => {
    if (!newMatId) return;
    const m = materials.find(x => x.id === newMatId);
    const entry: ReportMaterialEntry = {
      materialId: newMatId, materialName: m?.name || newMatId,
      materialUnit: m?.unit, quantityUsed: Number(newQty) || 0, remarks: newRemarks,
    };
    onChange({ materials: [...form.materials, entry] });
    setNewMatId(''); setNewQty('1'); setNewRemarks(''); setShowAdd(false);
  };

  const removeMaterial = (idx: number) => {
    onChange({ materials: form.materials.filter((_, i) => i !== idx) });
  };

  const updateMaterial = (idx: number, patch: Partial<ReportMaterialEntry>) => {
    onChange({ materials: form.materials.map((m, i) => i === idx ? { ...m, ...patch } : m) });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{t('daily_report.section_materials', locale)}</h3>

      {form.materials.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 italic py-3">{t('daily_report.no_materials', locale)}</p>
      )}

      {form.materials.map((m, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{m.materialName || m.materialId}</p>
            <div className="flex gap-2 mt-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">{t('daily_report.quantity', locale)}:</span>
                <input type="number" min="0" step="0.01" value={m.quantityUsed}
                  onChange={e => updateMaterial(i, { quantityUsed: Number(e.target.value) || 0 })}
                  className="w-20 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hii-500" />
                {m.materialUnit && <span className="text-xs text-slate-400">{m.materialUnit}</span>}
              </div>
            </div>
            <input value={m.remarks || ''} onChange={e => updateMaterial(i, { remarks: e.target.value })}
              placeholder={t('daily_report.remarks', locale)}
              className="mt-1 w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hii-500" />
          </div>
          <button onClick={() => removeMaterial(i)} className="shrink-0 text-slate-400 hover:text-rose-500 p-1.5 rounded-md hover:bg-rose-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="border border-dashed border-hii-300 rounded-lg p-3 space-y-2 bg-hii-50/30">
          <select value={newMatId} onChange={e => setNewMatId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500">
            <option value="">{t('daily_report.select_material', locale)}</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name || m.code} {m.unit ? `(${m.unit})` : ''}</option>
            ))}
          </select>
          <input type="number" min="0" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder={t('daily_report.quantity', locale)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500" />
          <input value={newRemarks} onChange={e => setNewRemarks(e.target.value)}
            placeholder={t('daily_report.remarks', locale)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addMaterial} disabled={!newMatId}>{t('daily_report.add_material', locale)}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>{t('general.cancel', locale)}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} icon={<Package className="w-4 h-4" />}>
          {t('daily_report.add_material', locale)}
        </Button>
      )}
    </div>
  );
}

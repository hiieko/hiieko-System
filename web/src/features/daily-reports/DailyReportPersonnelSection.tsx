'use client';
import React, { useState, useEffect } from 'react';
import { t, useLocale } from '@solar/shared';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import type { DailyReportFormState, ReportWorkerEntry } from './types';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

export function DailyReportPersonnelSection({ form, onChange }: Props) {
  const { locale } = useLocale();
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newDuties, setNewDuties] = useState('');

  useEffect(() => {
    apiClient.getUsers().then(r => setUsers((r.data || []) as any[])).catch(() => {});
  }, []);

  const addWorker = () => {
    if (!newWorkerId) return;
    const u = users.find(x => x.id === newWorkerId);
    const entry: ReportWorkerEntry = {
      workerId: newWorkerId, workerName: u?.full_name || u?.email || newWorkerId,
      hoursWorked: 8, overtimeHours: 0, mainDuties: newDuties, ohsConfirmed: true,
    };
    onChange({ workers: [...form.workers, entry] });
    setNewWorkerId(''); setNewDuties(''); setShowAdd(false);
  };

  const removeWorker = (idx: number) => {
    onChange({ workers: form.workers.filter((_, i) => i !== idx) });
  };

  const updateWorker = (idx: number, patch: Partial<ReportWorkerEntry>) => {
    onChange({ workers: form.workers.map((w, i) => i === idx ? { ...w, ...patch } : w) });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{t('daily_report.section_personnel', locale)}</h3>

      {form.workers.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 italic py-3">{t('daily_report.no_workers', locale)}</p>
      )}

      {form.workers.map((w, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{w.workerName || w.workerId}</p>
            <input value={w.mainDuties} onChange={e => updateWorker(i, { mainDuties: e.target.value })}
              placeholder={t('daily_report.worker_duties', locale)}
              className="mt-1 w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hii-500" />
          </div>
          <button onClick={() => removeWorker(i)} className="shrink-0 text-slate-400 hover:text-rose-500 p-1.5 rounded-md hover:bg-rose-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="border border-dashed border-hii-300 rounded-lg p-3 space-y-2 bg-hii-50/30">
          <select value={newWorkerId} onChange={e => setNewWorkerId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500">
            <option value="">{t('daily_report.select_worker', locale)}</option>
            {users.filter(u => !form.workers.some(w => w.workerId === u.id)).map(u => (
              <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
            ))}
          </select>
          <input value={newDuties} onChange={e => setNewDuties(e.target.value)}
            placeholder={t('daily_report.worker_duties', locale)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addWorker} disabled={!newWorkerId}>{t('daily_report.add_worker', locale)}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>{t('general.cancel', locale)}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} icon={<UserPlus className="w-4 h-4" />}>
          {t('daily_report.add_worker', locale)}
        </Button>
      )}
    </div>
  );
}

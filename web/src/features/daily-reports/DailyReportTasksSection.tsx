'use client';
import React, { useState, useEffect } from 'react';
import { t, useLocale } from '@solar/shared';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import type { DailyReportFormState, ReportTaskEntry } from './types';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui';
import { useProject } from '../../contexts/ProjectContext';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

export function DailyReportTasksSection({ form, onChange }: Props) {
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTaskId, setNewTaskId] = useState('');
  const [newQty, setNewQty] = useState('0');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    if (selectedProjectId) {
      apiClient.getTasks(selectedProjectId).then(r => setTasks((r.data || []) as any[])).catch(() => {});
    }
  }, [selectedProjectId]);

  const addTask = () => {
    if (!newTaskId) return;
    const t = tasks.find(x => x.id === newTaskId);
    const entry: ReportTaskEntry = {
      taskId: newTaskId, taskTitle: t?.title || newTaskId,
      taskUnit: t?.unit_of_measure, quantityDone: Number(newQty) || 0, notes: newNotes,
    };
    onChange({ tasks: [...form.tasks, entry] });
    setNewTaskId(''); setNewQty('0'); setNewNotes(''); setShowAdd(false);
  };

  const removeTask = (idx: number) => {
    onChange({ tasks: form.tasks.filter((_, i) => i !== idx) });
  };

  const updateTask = (idx: number, patch: Partial<ReportTaskEntry>) => {
    onChange({ tasks: form.tasks.map((t, i) => i === idx ? { ...t, ...patch } : t) });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{t('daily_report.section_tasks', locale)}</h3>

      {form.tasks.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 italic py-3">{t('daily_report.no_tasks', locale)}</p>
      )}

      {form.tasks.map((task, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{task.taskTitle || task.taskId}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">{t('daily_report.quantity_done', locale)}:</span>
              <input type="number" min="0" step="0.01" value={task.quantityDone}
                onChange={e => updateTask(i, { quantityDone: Number(e.target.value) || 0 })}
                className="w-20 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hii-500" />
              {task.taskUnit && <span className="text-xs text-slate-400">{task.taskUnit}</span>}
            </div>
            <input value={task.notes || ''} onChange={e => updateTask(i, { notes: e.target.value })}
              placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}
              className="mt-1 w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hii-500" />
          </div>
          <button onClick={() => removeTask(i)} className="shrink-0 text-slate-400 hover:text-rose-500 p-1.5 rounded-md hover:bg-rose-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="border border-dashed border-hii-300 rounded-lg p-3 space-y-2 bg-hii-50/30">
          <select value={newTaskId} onChange={e => setNewTaskId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500">
            <option value="">{t('daily_report.select_task', locale)}</option>
            {tasks.filter(t => !form.tasks.some(ft => ft.taskId === t.id)).map(t => (
              <option key={t.id} value={t.id}>{t.title || t.code} {t.unit_of_measure ? `(${t.unit_of_measure})` : ''}</option>
            ))}
          </select>
          <input type="number" min="0" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder={t('daily_report.quantity_done', locale)}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500" />
          <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
            placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-hii-500" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addTask} disabled={!newTaskId}>{t('daily_report.add_task', locale)}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>{t('general.cancel', locale)}</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} icon={<ClipboardList className="w-4 h-4" />}>
          {t('daily_report.add_task', locale)}
        </Button>
      )}
    </div>
  );
}

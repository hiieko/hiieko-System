'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { t, useLocale } from '@solar/shared';
import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  code: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to_id?: string;
  project_id: string;
  due_date?: string;
  progress?: number;
  created_at: string;
  project?: { name: string; code: string };
  assigned_to?: { id: string; email: string; fullName?: string };
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'De facut', IN_PROGRESS: 'In lucru', DONE: 'Finalizat', BLOCKED: 'Blocat', REVIEW: 'In verificare',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-700', IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-emerald-100 text-emerald-800', BLOCKED: 'bg-red-100 text-red-800', REVIEW: 'bg-amber-100 text-amber-800',
};

const PROGRESS_OPTIONS = [0, 10, 25, 50, 75, 90, 100];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const { user } = useAuth();
  const { locale } = useLocale();

  const loadTasks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await apiClient.getTasks();
      setTasks((response.data || []) as TaskItem[]);
    } catch (err: any) {
      setError(err.message || t('task.load_error', locale));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const myTasks = tasks.filter(t => {
    if (!user) return false;
    const r = user.role?.toLowerCase();
    if (r === 'admin' || r === 'owner' || r === 'manager' || r === 'pm') {
      return filter === 'all' ? true : t.status === filter;
    }
    if (t.assigned_to_id !== user.id) return false;
    return filter === 'all' ? true : t.status === filter;
  });

  const handleUpdateProgress = async (taskId: string, newStatus: string, newProgress?: number) => {
    setUpdatingId(taskId); setUpdateSuccess(null);
    try {
      const body: any = { status: newStatus };
      if (newProgress !== undefined) body.progress = newProgress;
      await apiClient.updateTask(taskId, body);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, progress: newProgress ?? t.progress } : t));
      setUpdateSuccess(t('task.update_success', locale));
      setTimeout(() => setUpdateSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || t('task.update_error', locale));
    } finally { setUpdatingId(null); }
  };

  const getNextStatuses = (s: string): { status: string; label: string }[] => {
    switch (s) {
      case 'TODO': return [{ status: 'IN_PROGRESS', label: t('task.start', locale) }];
      case 'IN_PROGRESS': return [
        { status: 'REVIEW', label: t('task.send_review', locale) },
        { status: 'DONE', label: t('task.mark_done', locale) },
      ];
      case 'REVIEW': return [
        { status: 'IN_PROGRESS', label: 'Reia in lucru' },
        { status: 'DONE', label: 'Confirma finalizat' },
      ];
      case 'BLOCKED': return [{ status: 'IN_PROGRESS', label: 'Reia in lucru' }];
      default: return [];
    }
  };

  const tabs = [
    { k: 'all', l: 'Toate' }, { k: 'TODO', l: 'De facut' }, { k: 'IN_PROGRESS', l: 'In lucru' },
    { k: 'DONE', l: 'Finalizate' }, { k: 'BLOCKED', l: 'Blocate' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task-uri</h1>
          <p className="text-sm text-slate-500 mt-1">Sarcinile si activitatile atribuite</p>
        </div>
        <button onClick={loadTasks} disabled={loading}
          className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
          <RefreshCw className={'w-3.5 h-3.5 mr-1.5 ' + (loading ? 'animate-spin' : '')} />Reimprospateaza
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {updateSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{updateSuccess}</div>}

      <div className="flex items-center space-x-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className={'whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ' + (filter === t.k ? 'bg-hii-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900')}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca task-urile...
          </div>
        ) : myTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-600">Niciun task</h3>
            <p className="text-xs text-slate-400 mt-1">Nu ai task-uri atribuite in acest proiect.</p>
          </div>
        ) : (
          myTasks.map((task) => {
            const isExpanded = expandedId === task.id;
            const isUpdating = updatingId === task.id;
            const nextStatuses = getNextStatuses(task.status);
            const canUpdate = user && (user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'owner' || task.assigned_to_id === user.id);

            return (
              <div key={task.id}
                className={'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ' + (isExpanded ? 'ring-1 ring-hii-200' : '')}>
                <div className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={'px-2 py-0.5 rounded text-[10px] font-bold ' + (STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-700')}>
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{task.code}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm">{task.title}</h3>
                    {task.project && <p className="text-xs text-slate-500 mt-0.5">{task.project.name} ({task.project.code})</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.progress !== undefined && task.progress !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-hii-500 rounded-full transition-all" style={{ width: Math.min(100, Math.max(0, task.progress)) + '%' }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{task.progress}%</span>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {task.description && <p className="text-sm text-slate-600">{task.description}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      {task.due_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{t('task.deadline', locale)} {new Date(task.due_date).toLocaleDateString('ro-RO')}</span>
                      )}
                      {task.assigned_to && (
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{task.assigned_to.fullName || task.assigned_to.email}</span>
                      )}
                    </div>

                    {canUpdate && nextStatuses.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-600 mb-2">{t('task.update_status', locale)}</p>
                        <div className="flex flex-wrap gap-2">
                          {nextStatuses.map(ns => (
                            <button key={ns.status} onClick={() => handleUpdateProgress(task.id, ns.status)}
                              disabled={isUpdating}
                              className="inline-flex items-center px-3 py-1.5 bg-hii-50 hover:bg-hii-100 text-hii-700 font-semibold text-xs rounded-lg border border-hii-200 disabled:opacity-50 transition-colors">
                              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                              {ns.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {canUpdate && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-600 mb-2">{t('task.progress', locale)}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {PROGRESS_OPTIONS.map(pct => (
                            <button key={pct} onClick={() => handleUpdateProgress(task.id, task.progress === 100 ? 'DONE' : task.status, pct)}
                              disabled={isUpdating || task.progress === pct}
                              className={'px-2 py-1 text-xs font-semibold rounded border transition-colors ' + (task.progress === pct ? 'bg-hii-500 text-white border-hii-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50') + ' disabled:opacity-50'}>
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}





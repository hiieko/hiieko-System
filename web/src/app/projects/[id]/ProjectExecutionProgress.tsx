'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, RefreshCw } from 'lucide-react';
import { useLocale } from '@solar/shared';
import { getTasks } from '../../../features/tasks/api';
import type { Task } from '../../../features/tasks/types';

export function ProjectExecutionProgress({ projectId }: { projectId: string }) {
  const { locale } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTasks(projectId);
      if (result.error || !result.data) throw new Error(result.error || 'Could not load project tasks');
      setTasks(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load project tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const complete = tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'VERIFIED').length;
    return {
      total: tasks.length,
      complete,
      active: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      blocked: tasks.filter((task) => task.status === 'BLOCKED').length,
    };
  }, [tasks]);
  const percentage = counts.total ? Math.round((counts.complete / counts.total) * 100) : 0;
  const en = locale === 'en';

  return (
    <section className="rounded-xl border border-chrome-line bg-surface p-5 shadow-sm sm:p-6 lg:col-span-2" aria-labelledby="project-execution-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-execution-progress-title" className="text-base font-semibold text-content">
            {en ? 'Task execution' : 'Progresul task-urilor'}
          </h2>
          <p className="mt-1 text-sm text-content-muted">
            {en ? 'Progress is calculated from tasks returned for this project.' : 'Progres calculat din task-urile returnate pentru acest proiect.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-secondary">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          {en ? 'Task-based measure' : 'Măsură bazată pe task-uri'}
        </span>
      </div>

      {loading ? (
        <div className="mt-5 space-y-4" aria-label={en ? 'Loading project progress' : 'Se încarcă progresul proiectului'}>
          <div className="h-3 animate-pulse rounded-full bg-surface-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-muted" />)}
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-critical/30 bg-critical-soft p-3 text-sm text-critical-foreground" role="alert">
          <span className="inline-flex min-w-0 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</span>
          <button onClick={() => void load()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-critical">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />{en ? 'Retry' : 'Reîncearcă'}
          </button>
        </div>
      ) : counts.total === 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-border-light bg-surface-muted p-4">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-content-muted" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-content">{en ? 'No tasks to measure yet' : 'Nu există încă task-uri de măsurat'}</p>
            <p className="mt-1 text-sm text-content-muted">{en ? 'Project progress will appear here when tasks are added.' : 'Progresul proiectului va apărea aici după adăugarea task-urilor.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-content">{percentage}%</p>
              <p className="mt-1 text-xs text-content-muted">{counts.complete} / {counts.total} {en ? 'tasks complete' : 'task-uri finalizate'}</p>
            </div>
            <CheckCircle2 className="mb-1 h-6 w-6 text-success-foreground" aria-hidden="true" />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label={en ? 'Task completion' : 'Finalizarea task-urilor'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <div className="h-full rounded-full bg-success-foreground transition-[width] duration-300" style={{ width: `${percentage}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric icon={<ClipboardList className="h-4 w-4" />} label={en ? 'Total' : 'Total'} value={counts.total} />
            <Metric icon={<CheckCircle2 className="h-4 w-4" />} label={en ? 'Complete' : 'Finalizate'} value={counts.complete} />
            <Metric icon={<Clock3 className="h-4 w-4" />} label={en ? 'In progress' : 'În lucru'} value={counts.active} />
            <Metric icon={<AlertCircle className="h-4 w-4" />} label={en ? 'Blocked' : 'Blocate'} value={counts.blocked} />
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border-light bg-surface-muted px-3 py-3">
      <span className="shrink-0 text-content-muted" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-content">{value}</span>
    </div>
  );
}

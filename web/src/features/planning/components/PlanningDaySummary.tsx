'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { AlertTriangle, CheckCircle2, ClipboardList, ListTodo, Users } from 'lucide-react';
import type { DailyPlan } from '../types';
import { deriveDaySummary, type DaySummary } from '../summary';

interface PlanningDaySummaryProps {
  plans: DailyPlan[];
  /** 'day' = full project day (supervisors) · 'my-work' = user's own scope */
  variant?: 'day' | 'my-work';
}

/**
 * Truthful day summary derived from the caller's data source only:
 * - supervisor day view: GET /api/daily-plans?projectId=&date= payload
 * - worker/technician and supervisor "My work" view: my-tasks payload
 * No invented numbers, no averages, no completion percentages.
 */
export function PlanningDaySummary({
  plans,
  variant = 'day',
}: PlanningDaySummaryProps) {
  const { locale } = useLocale();
  const summary: DaySummary = deriveDaySummary(plans);

  // Nothing to summarize — render nothing instead of fake zeros.
  if (summary.planCount === 0) return null;

  const plansLabel =
    variant === 'my-work'
      ? t('planning.summary_my_plans', locale)
      : t('planning.summary_plans', locale);
  const tasksLabel =
    variant === 'my-work'
      ? t('planning.summary_my_tasks', locale)
      : t('planning.summary_tasks', locale);
  const teamsText =
    summary.teamNames.length > 0
      ? summary.teamNames.join(', ')
      : t('planning.summary_teams_empty', locale);

  const stats: Array<{
    key: string;
    label: string;
    value: string | number;
    icon: React.ReactNode;
    tone: 'slate' | 'emerald' | 'amber';
    truncate?: boolean;
    title?: string;
  }> = [
    {
      key: 'plans',
      label: plansLabel,
      value: summary.planCount,
      icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'slate',
    },
    {
      key: 'tasks',
      label: tasksLabel,
      value: summary.taskTotal,
      icon: <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'slate',
    },
    {
      key: 'completed',
      label: t('planning.summary_completed', locale),
      value: summary.taskCompleted,
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: summary.taskCompleted > 0 ? 'emerald' : 'slate',
    },
    {
      key: 'blocked',
      label: t('planning.summary_blocked', locale),
      value: summary.taskBlocked,
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: summary.taskBlocked > 0 ? 'amber' : 'slate',
    },
    {
      key: 'teams',
      label: t('planning.summary_teams', locale),
      value: teamsText,
      icon: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'slate',
      truncate: true,
    },
  ];

  const toneClasses: Record<'slate' | 'emerald' | 'amber', string> = {
    slate: 'text-content-muted',
    emerald: 'text-success',
    amber: 'text-warning',
  };

  return (
    <section
      aria-label={t('planning.summary_title', locale)}
      className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="min-w-0 rounded-lg border border-chrome-line bg-surface px-3 py-2.5"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
            {stat.icon}
            <span className="truncate">{stat.label}</span>
          </p>
          <p
            className={`mt-0.5 truncate text-lg font-bold ${
              stat.key === 'teams' ? 'text-base font-semibold' : ''
            } ${stat.key === 'teams' ? 'text-content' : toneClasses[stat.tone]}`}
            title={stat.truncate ? String(stat.value) : undefined}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </section>
  );
}
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from '@solar/shared';
import { RoleGuard } from '../../lib/auth-guard';
import { OPERATIONAL_ROLES } from '../../config/route-roles';
import { useProject } from '../../contexts/ProjectContext';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { getActivity } from '../../features/activity/api';
import type { ActivityEvent } from '../../features/activity/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '../../components/ui';

interface EventMeta {
  icon: LucideIcon;
  tone: string;
  text: string;
  href: string;
  subject: string | null;
}

const ACTION_META: Record<
  string,
  { icon: LucideIcon; tone: string; ro: string; en: string }
> = {
  TASK_CREATED: { icon: Plus, tone: 'bg-info-soft text-info-foreground', ro: 'a creat un task', en: 'created a task' },
  TASK_UPDATED: { icon: Pencil, tone: 'bg-slate-100 text-slate-600', ro: 'a actualizat un task', en: 'updated a task' },
  TASK_STATUS_CHANGED: { icon: Pencil, tone: 'bg-slate-100 text-slate-600', ro: 'a schimbat statusul unui task', en: 'changed the status of a task' },
  TASK_BLOCKED: { icon: AlertTriangle, tone: 'bg-danger-soft text-danger-foreground', ro: 'a raportat un blocaj', en: 'reported a blocker' },
  TASK_UNBLOCKED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', ro: 'a rezolvat un blocaj', en: 'resolved a blocker' },
  DAILY_REPORT_SUBMITTED: { icon: FileText, tone: 'bg-info-soft text-info-foreground', ro: 'a trimis raportul zilnic', en: 'submitted a daily report' },
  DAILY_REPORT_APPROVED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', ro: 'a aprobat raportul zilnic', en: 'approved a daily report' },
  DAILY_REPORT_REJECTED: { icon: XCircle, tone: 'bg-danger-soft text-danger-foreground', ro: 'a respins raportul zilnic', en: 'rejected a daily report' },
  ISSUE_REPORTED: { icon: AlertCircle, tone: 'bg-warning-soft text-warning-foreground', ro: 'a raportat o problemă', en: 'reported an issue' },
  ISSUE_RESOLVED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', ro: 'a rezolvat o problemă', en: 'resolved an issue' },
  FILE_UPLOADED: { icon: Upload, tone: 'bg-slate-100 text-slate-600', ro: 'a încărcat un fișier', en: 'uploaded a file' },
  ATTACHMENT_CREATED: { icon: Camera, tone: 'bg-slate-100 text-slate-600', ro: 'a atașat o fotografie', en: 'attached a photo' },
  ATTENDANCE_CHECK_IN: { icon: LogIn, tone: 'bg-info-soft text-info-foreground', ro: 'a făcut check-in', en: 'checked in' },
  ATTENDANCE_CHECK_OUT: { icon: LogOut, tone: 'bg-slate-100 text-slate-600', ro: 'a făcut check-out', en: 'checked out' },
};

function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ro' ? 'ro' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, 'second');
  const minutes = Math.round(diffSeconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'unknown' : d.toLocaleDateString('en-CA');
}

function dayLabel(iso: string, locale: string): string {
  const key = dayKey(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dayKey(today.toISOString())) return locale === 'ro' ? 'Astăzi' : 'Today';
  if (key === dayKey(yesterday.toISOString())) return locale === 'ro' ? 'Ieri' : 'Yesterday';
  return formatDate(iso, locale === 'ro' ? 'ro' : 'en');
}

function subjectOf(event: ActivityEvent): string | null {
  const after = event.after ?? {};
  const before = event.before ?? {};
  const raw = after.title ?? before.title ?? after.name ?? before.name;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function eventHref(event: ActivityEvent): string {
  switch (event.entity) {
    case 'Task':
      return '/tasks';
    case 'DailyReport':
      return '/rapoarte';
    case 'Issue':
      return '/issues';
    case 'AttendanceRecord':
      return '/pontaj';
    case 'Attachment':
    case 'Document': {
      const target = (event.after?.target_type ?? event.after?.targetType) as string | undefined;
      if (target === 'issue') return '/issues';
      if (target === 'daily_report' || target === 'dailyReport') return '/rapoarte';
      if (target === 'inspection') return '/qa';
      return '/tasks';
    }
    default:
      return '/tasks';
  }
}

function describe(event: ActivityEvent, locale: string): EventMeta {
  const meta = ACTION_META[event.action];
  const icon = meta?.icon ?? Activity;
  const tone = meta?.tone ?? 'bg-slate-100 text-slate-600';
  const known = meta ? meta[locale === 'ro' ? 'ro' : 'en'] : null;
  const text =
    known ??
    (locale === 'ro' ? 'a înregistrat o acțiune' : 'performed an action');
  return { icon, tone, text, href: eventHref(event), subject: subjectOf(event) };
}

function ActivityPageInner() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getActivity({
        projectId: selectedProjectId || undefined,
      });
      setEvents((response.data || []) as ActivityEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la încărcare');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const event of events) {
      const key = dayKey(event.createdAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        className="!mb-0"
        title={locale === 'ro' ? 'Activitate' : 'Activity'}
        subtitle={
          locale === 'ro'
            ? 'Ce s-a întâmplat recent în proiectele tale'
            : 'What happened recently across your projects'
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={load}
            disabled={loading}
          >
            {locale === 'ro' ? 'Reîmprospătează' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <ErrorState
          title={locale === 'ro' ? 'Eroare la încărcarea activității' : 'Failed to load activity'}
          error={error}
          onRetry={load}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !error && events.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={<Activity />}
            title={locale === 'ro' ? 'Nicio activitate încă' : 'No activity yet'}
            description={
              locale === 'ro'
                ? 'Acțiunile din proiecte (task-uri, rapoarte, probleme) vor apărea aici.'
                : 'Project actions (tasks, reports, issues) will appear here.'
            }
          />
        </Card>
      ) : (
        groups.map(([key, items]) => (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
              {dayLabel(items[0].createdAt, locale)}
            </h3>
            <Card padding={false} className="divide-y divide-chrome-line">
              {items.map((event) => {
                const meta = describe(event, locale);
                const actor = event.actor?.name || (locale === 'ro' ? 'Sistem' : 'System');
                const Icon = meta.icon;
                return (
                  <Link
                    key={event.id}
                    href={meta.href}
                    className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-inset"
                  >
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold text-slate-900">{actor}</span>{' '}
                        {meta.text}
                        {meta.subject && (
                          <span className="text-slate-600"> — {meta.subject}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {relativeTime(event.createdAt, locale)} · {formatDateTime(event.createdAt, locale === 'ro' ? 'ro' : 'en')}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 shrink-0 mt-1" aria-hidden="true" />
                  </Link>
                );
              })}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <RoleGuard allowedRoles={OPERATIONAL_ROLES}>
      <ActivityPageInner />
    </RoleGuard>
  );
}

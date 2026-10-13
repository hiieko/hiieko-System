'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from '@solar/shared';
import { RoleGuard } from '../../lib/auth-guard';
import { OPERATIONAL_ROLES } from '../../config/route-roles';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { apiClient } from '../../lib/api-client';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { getActivity } from '../../features/activity/api';
import type {
  ActivityActionFilter,
  ActivityActor,
  ActivityDateRange,
  ActivityEvent,
} from '../../features/activity/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
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

const ACTION_OPTIONS: { value: ActivityActionFilter; ro: string; en: string }[] = [
  { value: 'all', ro: 'Toate', en: 'All' },
  { value: 'tasks', ro: 'Task-uri', en: 'Tasks' },
  { value: 'reports', ro: 'Rapoarte', en: 'Reports' },
  { value: 'issues', ro: 'Probleme', en: 'Issues' },
  { value: 'attendance', ro: 'Pontaj', en: 'Attendance' },
  { value: 'files', ro: 'Fișiere', en: 'Files' },
];

const RANGE_OPTIONS: { value: ActivityDateRange; ro: string; en: string }[] = [
  { value: 'today', ro: 'Astăzi', en: 'Today' },
  { value: 'week', ro: 'Săptămâna', en: 'This week' },
  { value: 'month', ro: 'Luna', en: 'This month' },
  { value: 'all', ro: 'Tot', en: 'All' },
];

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

const KEY_LABELS: Record<string, string> = {
  status: 'Status',
  title: 'Title',
  name: 'Name',
  description: 'Description',
  reason: 'Reason',
  blocked_reason: 'Reason',
  blocked_at: 'Blocked at',
  priority: 'Priority',
  severity: 'Severity',
  actual_quantity: 'Actual quantity',
  planned_quantity: 'Planned quantity',
  unit_of_measure: 'Unit',
  actual_start: 'Actual start',
  actual_end: 'Actual end',
  planned_start: 'Planned start',
  planned_end: 'Planned end',
  assigned_to: 'Assigned to',
  verified_by: 'Verified by',
};

function prettyKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => formatValue(v)).join(', ') : '—';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function changedEntries(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { key: string; label: string; from: string; to: string }[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  const out: { key: string; label: string; from: string; to: string }[] = [];
  for (const key of keys) {
    if (JSON.stringify(b[key]) === JSON.stringify(a[key])) continue;
    out.push({
      key,
      label: prettyKey(key),
      from: formatValue(b[key]),
      to: formatValue(a[key]),
    });
  }
  return out;
}

function eventReason(event: ActivityEvent): string | null {
  const after = event.after ?? {};
  const raw = after.reason ?? after.blocked_reason ?? after.blockedReason;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function eventPhotoUrl(event: ActivityEvent): string | null {
  const after = event.after ?? {};
  const raw = after.url ?? after.file_url ?? after.fileUrl;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function EventRow({ event, locale }: { event: ActivityEvent; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const meta = describe(event, locale);
  const Icon = meta.icon;
  const actorName = event.actor?.name || (locale === 'ro' ? 'Sistem' : 'System');
  const changes = changedEntries(event.before, event.after);
  const reason = eventReason(event);
  const photoUrl = eventPhotoUrl(event);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-inset"
      >
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">
            <span className="font-semibold text-slate-900">{actorName}</span>{' '}
            {meta.text}
            {meta.subject && <span className="text-slate-600"> — {meta.subject}</span>}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {relativeTime(event.createdAt, locale)} · {formatDateTime(event.createdAt, locale === 'ro' ? 'ro' : 'en')}
          </p>
        </div>
        <ChevronDown
          className={`size-4 text-slate-300 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-4 border-t border-chrome-line">
          {/* Actor */}
          {event.actor && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {locale === 'ro' ? 'Autor' : 'Actor'}
              </p>
              <p className="text-sm font-medium text-slate-900">{event.actor.name}</p>
              <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
                {event.actor.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="size-3" aria-hidden="true" /> {event.actor.email}
                  </p>
                )}
                {event.actor.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3" aria-hidden="true" /> {event.actor.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* What changed */}
          {changes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {locale === 'ro' ? 'Ce s-a schimbat' : 'What changed'}
              </p>
              <ul className="space-y-1">
                {changes.map((change) => (
                  <li key={change.key} className="text-sm text-slate-700">
                    <span className="font-medium">{change.label}</span>:{' '}
                    <span className="text-slate-400 line-through">{change.from}</span>{' '}
                    <span className="text-slate-400">→</span>{' '}
                    <span className="text-slate-900">{change.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Subject + view */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              {locale === 'ro' ? 'Obiect' : 'Subject'}
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-800 min-w-0 truncate">
                {meta.subject || event.entity}
              </p>
              <Link
                href={meta.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-hii-600 hover:bg-hii-50"
              >
                {locale === 'ro' ? 'Vezi' : 'View'}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Event-specific extra */}
          {reason && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {locale === 'ro' ? 'Motiv blocaj' : 'Blocker reason'}
              </p>
              <p className="rounded-lg border border-danger bg-danger-soft p-2 text-sm text-danger-foreground whitespace-pre-wrap">
                {reason}
              </p>
            </div>
          )}

          {photoUrl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {locale === 'ro' ? 'Fotografie' : 'Photo'}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={locale === 'ro' ? 'Fotografie atașată' : 'Attached photo'}
                className="max-h-48 rounded-lg border border-chrome-line object-cover"
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-chrome-line pt-2 text-xs text-slate-400">
            <span>{formatDateTime(event.createdAt, locale === 'ro' ? 'ro' : 'en')}</span>
            <span>
              {event.entity} · <span className="font-mono">{event.entityId}</span>
            </span>
          </div>

          {/* Raw JSON */}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
            >
              {showRaw
                ? locale === 'ro'
                  ? 'Ascunde JSON'
                  : 'Hide raw JSON'
                : locale === 'ro'
                  ? 'Arată JSON brut'
                  : 'Show raw JSON'}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify({ before: event.before, after: event.after }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/** Best-effort mapping of a project-member row to an actor option. */
function memberToActor(member: any): ActivityActor | null {
  const user = member?.user ?? member;
  const id = user?.id ?? member?.user_id;
  if (!id) return null;
  const name =
    user?.profile?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.email ||
    id;
  return { id, name, email: user?.email ?? null };
}

function dedupeActors(list: ActivityActor[]): ActivityActor[] {
  const map = new Map<string, ActivityActor>();
  for (const actor of list) if (!map.has(actor.id)) map.set(actor.id, actor);
  return Array.from(map.values());
}

function ActivityPageInner() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberActors, setMemberActors] = useState<ActivityActor[]>([]);
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qParam = searchParams.get('q') ?? '';
  const actionParam = (searchParams.get('action') ?? 'all') as ActivityActionFilter;
  const actorIdParam = searchParams.get('actorId') ?? '';
  const dateRangeParam = (searchParams.get('dateRange') ?? 'all') as ActivityDateRange;

  const [searchInput, setSearchInput] = useState(qParam);

  // Write filter state to the URL. `null`/empty/`all` clears the key.
  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
      });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // Keep the input in sync when the URL changes (back/forward, Clear all).
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Debounce typing → URL `q`.
  useEffect(() => {
    if (searchInput === qParam) return;
    const timer = setTimeout(() => setParams({ q: searchInput || null }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, qParam, setParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getActivity({
        projectId: selectedProjectId || undefined,
        q: qParam || undefined,
        action: actionParam !== 'all' ? actionParam : undefined,
        actorId: actorIdParam || undefined,
        dateRange: dateRangeParam !== 'all' ? dateRangeParam : undefined,
      });
      setEvents((response.data || []) as ActivityEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la încărcare');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, qParam, actionParam, actorIdParam, dateRangeParam]);

  useEffect(() => {
    load();
  }, [load]);

  // Actor dropdown source: project members when a project is selected,
  // otherwise the distinct actors present in the loaded events.
  useEffect(() => {
    if (!selectedProjectId) {
      setMemberActors([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.getProjectMembers(selectedProjectId);
        if (cancelled) return;
        const actors = (response.data || [])
          .map(memberToActor)
          .filter((a): a is ActivityActor => a !== null);
        setMemberActors(dedupeActors(actors));
      } catch {
        if (!cancelled) setMemberActors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const derivedActors = useMemo(() => {
    const map = new Map<string, ActivityActor>();
    for (const event of events) {
      if (event.actor && !map.has(event.actor.id)) map.set(event.actor.id, event.actor);
    }
    return Array.from(map.values());
  }, [events]);

  const actorOptions = selectedProjectId ? memberActors : derivedActors;

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

  const actorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of actorOptions) map.set(actor.id, actor.name);
    return map;
  }, [actorOptions]);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (qParam) {
    activeChips.push({
      key: 'q',
      label: `${locale === 'ro' ? 'Căutare' : 'Search'}: "${qParam}"`,
      clear: () => setParams({ q: null }),
    });
  }
  if (actionParam !== 'all') {
    const opt = ACTION_OPTIONS.find((o) => o.value === actionParam);
    activeChips.push({
      key: 'action',
      label: opt ? (locale === 'ro' ? opt.ro : opt.en) : actionParam,
      clear: () => setParams({ action: null }),
    });
  }
  if (actorIdParam) {
    const label =
      actorIdParam === user?.id
        ? locale === 'ro'
          ? 'Doar eu'
          : 'Only me'
        : actorNameById.get(actorIdParam) || actorIdParam;
    activeChips.push({
      key: 'actorId',
      label,
      clear: () => setParams({ actorId: null }),
    });
  }
  if (dateRangeParam !== 'all') {
    const opt = RANGE_OPTIONS.find((o) => o.value === dateRangeParam);
    activeChips.push({
      key: 'dateRange',
      label: opt ? (locale === 'ro' ? opt.ro : opt.en) : dateRangeParam,
      clear: () => setParams({ dateRange: null }),
    });
  }

  const clearAll = () => {
    setSearchInput('');
    setParams({ q: null, action: null, actorId: null, dateRange: null });
  };

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

      {/* Filter bar */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              label={locale === 'ro' ? 'Caută' : 'Search'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                locale === 'ro'
                  ? 'Caută după nume, email, telefon sau subiect'
                  : 'Search by name, email, phone, or subject'
              }
              suffix={<Search className="size-4 text-slate-400" aria-hidden="true" />}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-action" className="text-sm font-medium text-slate-700">
              {locale === 'ro' ? 'Tip' : 'Type'}
            </label>
            <select
              id="activity-action"
              value={actionParam}
              onChange={(e) => setParams({ action: e.target.value })}
              className="hii-select h-11"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === 'ro' ? opt.ro : opt.en}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-actor" className="text-sm font-medium text-slate-700">
              {locale === 'ro' ? 'Utilizator' : 'Actor'}
            </label>
            <select
              id="activity-actor"
              value={actorIdParam}
              onChange={(e) => setParams({ actorId: e.target.value })}
              className="hii-select h-11"
            >
              <option value="">{locale === 'ro' ? 'Oricine' : 'Anyone'}</option>
              {user?.id && (
                <option value={user.id}>{locale === 'ro' ? 'Doar eu' : 'Only me'}</option>
              )}
              {actorOptions
                .filter((actor) => actor.id !== user?.id)
                .map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Date range chips */}
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.filter((opt) => opt.value !== 'all').map((opt) => (
            <Button
              key={opt.value}
              variant={dateRangeParam === opt.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() =>
                setParams({ dateRange: dateRangeParam === opt.value ? null : opt.value })
              }
            >
              {locale === 'ro' ? opt.ro : opt.en}
            </Button>
          ))}
          {dateRangeParam !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setParams({ dateRange: null })}>
              {locale === 'ro' ? 'Toate' : 'All'}
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-chrome-line pt-3">
            {activeChips.map((chip) => (
              <Badge key={chip.key} variant="info" size="md" className="gap-1 pr-1">
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  aria-label={`${locale === 'ro' ? 'Șterge filtrul' : 'Clear filter'}: ${chip.label}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-xs font-medium text-hii-600 hover:text-hii-700 underline"
            >
              {locale === 'ro' ? 'Șterge toate' : 'Clear all'}
            </button>
          </div>
        )}
      </Card>

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
          {activeChips.length > 0 ? (
            <EmptyState
              icon={<Search />}
              title={
                locale === 'ro'
                  ? 'Nicio activitate nu corespunde filtrelor'
                  : 'No activity matches the filters'
              }
              description={
                locale === 'ro'
                  ? 'Încearcă să schimbi sau să ștergi filtrele active.'
                  : 'Try changing or clearing the active filters.'
              }
              action={{
                label: locale === 'ro' ? 'Șterge filtrele' : 'Clear filters',
                onClick: clearAll,
              }}
            />
          ) : (
            <EmptyState
              icon={<Activity />}
              title={locale === 'ro' ? 'Nicio activitate încă' : 'No activity yet'}
              description={
                locale === 'ro'
                  ? 'Acțiunile din proiecte (task-uri, rapoarte, probleme) vor apărea aici.'
                  : 'Project actions (tasks, reports, issues) will appear here.'
              }
            />
          )}
        </Card>
      ) : (
        groups.map(([key, items]) => (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
              {dayLabel(items[0].createdAt, locale)}
            </h3>
            <Card padding={false} className="divide-y divide-chrome-line">
              {items.map((event) => (
                <EventRow key={event.id} event={event} locale={locale} />
              ))}
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
      <Suspense
        fallback={
          <div className="space-y-3 max-w-4xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        }
      >
        <ActivityPageInner />
      </Suspense>
    </RoleGuard>
  );
}

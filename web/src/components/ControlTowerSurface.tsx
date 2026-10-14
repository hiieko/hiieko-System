'use client';

/**
 * Control Tower surface - extracted verbatim from `/` in UX-R1A C2.
 *
 * Pure structural extraction: markup, API calls, KPI semantics, drill-downs,
 * red flags, filters and project-selection behaviour are unchanged. The only
 * difference from the previous home page is that role branching moved out to
 * `app/page.tsx` (the `/` role router) and `app/control-tower/page.tsx` (the
 * canonical route), so every hook below runs on one stable execution path.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Users,
  Clock,
  Briefcase,
  Boxes,
  Euro,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Activity,
  AlertCircle,
  Camera,
  FileText,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { apiClient, ControlTowerOverviewDto, RedFlag } from '../lib/api-client';
import { getActivity } from '../features/activity/api';
import type { ActivityEvent } from '../features/activity/types';
import { t, useLocale, canCreateProjects } from '@solar/shared';
import { ControlTowerDrilldownDrawer, DrilldownData } from './ControlTowerDrilldownDrawer';
import { ControlTowerRedFlagsCard } from './ControlTowerRedFlagsCard';
import { EmptyState, ErrorState, Skeleton } from './ui';
import { PageTutorial } from './PageTutorial';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { CONTROL_TOWER_ROLES } from '../config/route-roles';

type ActivityBucket = 'hour' | 'today' | 'yesterday';

interface ActivityMeta {
  icon: LucideIcon;
  tone: string;
  ro: string;
  en: string;
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
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

function activityRelativeTime(iso: string, locale: string): string {
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

function activitySubject(event: ActivityEvent): string | null {
  const after = event.after ?? {};
  const before = event.before ?? {};
  const raw = after.title ?? before.title ?? after.name ?? before.name;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function activityHref(event: ActivityEvent): string {
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

function activityMeta(event: ActivityEvent, locale: string): { icon: LucideIcon; tone: string; text: string; href: string; subject: string | null } {
  const meta = ACTIVITY_META[event.action];
  const icon = meta?.icon ?? Activity;
  const tone = meta?.tone ?? 'bg-slate-100 text-slate-600';
  const text = meta ? meta[locale === 'ro' ? 'ro' : 'en'] : locale === 'ro' ? 'a înregistrat o acțiune' : 'performed an action';
  return { icon, tone, text, href: activityHref(event), subject: activitySubject(event) };
}

function activityBucketOf(iso: string): ActivityBucket | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  if (now.getTime() - d.getTime() <= 60 * 60 * 1000) return 'hour';
  const key = (x: Date) => x.toLocaleDateString('en-CA');
  if (key(d) === key(now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key(d) === key(yesterday)) return 'yesterday';
  return null;
}

const ACTIVITY_BUCKET_ORDER: { key: ActivityBucket; ro: string; en: string }[] = [
  { key: 'hour', ro: 'Ultima oră', en: 'Last hour' },
  { key: 'today', ro: 'Astăzi', en: 'Today' },
  { key: 'yesterday', ro: 'Ieri', en: 'Yesterday' },
];

export function ControlTowerSurface() {
  const [overview, setOverview] = useState<ControlTowerOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  // Red flags — GET /api/control-tower/red-flags (separate from the overview payload)
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [redFlagsLoading, setRedFlagsLoading] = useState(true);
  const [redFlagsError, setRedFlagsError] = useState<string | null>(null);
  // Activity since yesterday — GET /api/activity, filtered client-side to the last 24h
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const { locale } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const role = user?.role?.toLowerCase() || 'viewer';
  const roleProfile = (() => {
    switch (role) {
      case 'admin':
        return { title: t('nav.utilizatori', locale), focus: t('control_tower.focus_admin', locale), links: [['/utilizatori', 'nav.utilizatori'], ['/projects', 'nav.projects'], ['/teams', 'nav.teams']] };
      case 'pm':
        return { title: t('nav.projects', locale), focus: t('control_tower.focus_pm', locale), links: [['/projects', 'nav.projects'], ['/planning', 'nav.planning'], ['/issues', 'nav.issues'], ['/rapoarte', 'nav.rapoarte']] };
      case 'manager':
        return { title: t('nav.projects', locale), focus: t('control_tower.focus_manager', locale), links: [['/projects', 'nav.projects'], ['/issues', 'nav.issues'], ['/rapoarte', 'nav.rapoarte']] };
      case 'procurement':
        return { title: t('nav.avize', locale), focus: t('control_tower.focus_procurement', locale), links: [['/avize', 'nav.avize'], ['/furnizori', 'nav.furnizori'], ['/depozite', 'nav.depozite'], ['/stocuri', 'nav.stocuri']] };
      case 'finance':
        return { title: t('nav.cheltuieli', locale), focus: t('control_tower.focus_finance', locale), links: [['/cheltuieli', 'nav.cheltuieli'], ['/aprobare', 'nav.aprobare'], ['/projects', 'nav.projects']] };
      case 'qa_qc':
        return { title: t('nav.qa_qc', locale), focus: t('control_tower.focus_quality', locale), links: [['/qa', 'nav.qa_qc'], ['/issues', 'nav.issues'], ['/rapoarte', 'nav.rapoarte']] };
      case 'site_logistics':
        return { title: t('nav.avize', locale), focus: t('control_tower.focus_logistics', locale), links: [['/avize', 'nav.avize'], ['/stocuri', 'nav.stocuri'], ['/issues', 'nav.issues']] };
      case 'maintenance_director':
        return { title: t('nav.control_tower', locale), focus: t('control_tower.focus_maintenance', locale), links: [['/control-tower', 'nav.control_tower'], ['/projects', 'nav.projects'], ['/issues', 'nav.issues']] };
      case 'technical_director':
        return { title: t('nav.control_tower', locale), focus: t('control_tower.focus_technical', locale), links: [['/control-tower', 'nav.control_tower'], ['/projects', 'nav.projects'], ['/qa', 'nav.qa_qc'], ['/rapoarte', 'nav.rapoarte']] };
      default:
        return { title: t('nav.control_tower', locale), focus: t('control_tower.focus_viewer', locale), links: [['/control-tower', 'nav.control_tower'], ['/projects', 'nav.projects'], ['/rapoarte', 'nav.rapoarte']] };
    }
  })();
  const roleHasControlTower = CONTROL_TOWER_ROLES.includes(role);

  // Drilldown Drawer State — items come from GET /api/control-tower/drilldown
  const [drilldown, setDrilldown] = useState<DrilldownData>({
    isOpen: false,
    title: '',
    category: '',
    ruleExplanation: '',
    items: [],
  });
  const drilldownRequest = useRef<{
    title: string;
    category: string;
    ruleExplanation: string;
    itemId?: string;
  } | null>(null);

  const loadControlTower = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getControlTowerOverview(
          selectedProjectId || undefined,
        );

        if (response.data) {
          setOverview(response.data);
          setLastUpdated(new Date());
        } else {
          setError(response.error || t('control_tower.load_error', locale));
        }
      } catch (err: unknown) {
        // Fallback: If backend is booting, show informative Romanian state
        setError(
          err instanceof Error
            ? `${t('control_tower.connection_error', locale)}: ${err.message}`
            : t('control_tower.server_error', locale),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }

      // Red flags are a separate endpoint; load them on the same triggers
      // (mount, project change, manual refresh) as the overview.
      setRedFlagsLoading(true);
      setRedFlagsError(null);
      try {
        const flagsResponse = await apiClient.getControlTowerRedFlags(
          selectedProjectId || undefined,
        );
        setRedFlags(flagsResponse.data ?? []);
      } catch (err: unknown) {
        setRedFlags([]);
        setRedFlagsError(
          err instanceof Error
            ? err.message
            : t('control_tower.load_error', locale),
        );
      } finally {
        setRedFlagsLoading(false);
      }

      // Activity feed — same triggers. The endpoint has no 24h range, so fetch a
      // generous page and keep the last 24 hours client-side (max 20, newest first).
      setActivityLoading(true);
      setActivityError(null);
      try {
        const activityResponse = await getActivity({
          projectId: selectedProjectId || undefined,
          limit: 100,
        });
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = (activityResponse.data ?? [])
          .filter((event) => new Date(event.createdAt).getTime() >= cutoff)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);
        setActivityEvents(recent);
      } catch (err: unknown) {
        setActivityEvents([]);
        setActivityError(
          err instanceof Error
            ? err.message
            : t('control_tower.load_error', locale),
        );
      } finally {
        setActivityLoading(false);
      }
    },
    [selectedProjectId, locale],
  );

  useEffect(() => {
    loadControlTower();
  }, [loadControlTower]);

  const fetchDrilldown = useCallback(
    async (request: {
      title: string;
      category: string;
      ruleExplanation: string;
      itemId?: string;
    }) => {
      drilldownRequest.current = request;
      // Backend switch handles only these categories; PRODUCTION_BLOCKED is a
      // frontend-only label (blocked work) folded into PRODUCTION.
      const category =
        request.category === 'PRODUCTION_BLOCKED' ? 'PRODUCTION' : request.category;
      setDrilldown({
        isOpen: true,
        title: request.title,
        category: request.category,
        ruleExplanation: request.ruleExplanation,
        items: [],
        loading: true,
        error: null,
      });
      try {
        const response = await apiClient.getControlTowerDrillDown({
          category,
          projectId: selectedProjectId || undefined,
        });
        const data = response.data;
        let items: any[] = data?.items ?? [];
        if (request.itemId) {
          items = items.filter((item: any) => item?.id === request.itemId);
        }
        setDrilldown((prev) => ({
          ...prev,
          loading: false,
          items,
          total: data?.total ?? items.length,
          hasMore: data?.hasMore ?? false,
        }));
      } catch (err: unknown) {
        setDrilldown((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : t('control_tower.load_error', locale),
        }));
      }
    },
    [selectedProjectId, locale],
  );

  // Open drill-down drawer — fetches the real list behind the number
  const openDrilldown = useCallback(
    (title: string, category: string, ruleExplanation: string) => {
      void fetchDrilldown({ title, category, ruleExplanation });
    },
    [fetchDrilldown],
  );

  const retryDrilldown = useCallback(() => {
    if (drilldownRequest.current) {
      void fetchDrilldown(drilldownRequest.current);
    }
  }, [fetchDrilldown]);

  const openRedFlagInspect = (flag: RedFlag) => {
    void fetchDrilldown({
      title: `${t('control_tower.critical_alert', locale)}: ${flag.affectedEntity}`,
      category: 'RED_FLAGS',
      ruleExplanation: flag.reason,
      itemId: flag.id,
    });
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" aria-hidden="true" />
        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-800">
            {t('control_tower.loading', locale)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('control_tower.loading_detail', locale)}
          </p>
        </div>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (val: number, cur = 'RON') => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const hasProjects = (overview?.projects.activeProjectsList.length ?? 0) > 0;

  const activityGroups = ACTIVITY_BUCKET_ORDER.map((bucket) => ({
    ...bucket,
    items: activityEvents.filter(
      (event) => activityBucketOf(event.createdAt) === bucket.key,
    ),
  })).filter((bucket) => bucket.items.length > 0);

  return (
    <div className="space-y-6 pb-12">
      <PageTutorial sectionId="dashboard" />

      <section aria-labelledby="role-focus-title" className="bg-slate-900 rounded-xl p-5 text-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">{roleProfile.title}</p>
            <h2 id="role-focus-title" className="mt-1 text-lg font-bold tracking-tight">{roleProfile.focus}</h2>
          </div>
          <nav aria-label={t('control_tower.role_actions', locale)} className="flex flex-wrap gap-2">
            {roleProfile.links.filter(([href]) => href !== '/control-tower' || roleHasControlTower).map(([href, key]) => (
              <Link key={href} href={href} className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
                {t(key, locale)}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* Control Tower Header & Global Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-warning-soft0 text-slate-950 uppercase tracking-wide">
              {t('control_tower.badge', locale)}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {t('control_tower.last_updated', locale)}: {lastUpdated.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO')}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-950 mt-1 tracking-tight">
            {t('control_tower.title', locale)}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('control_tower.subtitle', locale)}
          </p>
        </div>

        {/* Keeps the 375 px main container free of horizontal overflow: the native
            select cannot shrink below its option text, so the filters stack below sm */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Project selector filter */}
          <div className="relative">
            <label htmlFor="control-tower-project" className="sr-only">{t('control_tower.project_filter', locale)}</label>
            <select
              id="control-tower-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">{t('control_tower.all_active_sites', locale)}</option>
              {overview?.projects.activeProjectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadControlTower(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t('control_tower.refresh', locale)}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-warning-soft border border-warning/20 text-warning-foreground text-xs flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadControlTower(true)}
            className="font-bold underline ml-4 hover:text-amber-950"
          >
            {t('control_tower.retry', locale)}
          </button>
        </div>
      )}

      {/* No projects yet: Control Tower has nothing to aggregate */}
      {overview && !hasProjects && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            icon={<Briefcase />}
            title="No projects yet"
            description="Your Control Tower will populate once projects exist."
            action={
              user && canCreateProjects(user.role as never)
                ? { label: 'New project', onClick: () => router.push('/projects') }
                : undefined
            }
          />
        </div>
      )}

      {/* 1. CRITICAL ALERTS & RED FLAGS (Rule-based exceptions) */}
      {overview && hasProjects &&
        (redFlagsError ? (
          <ErrorState
            title={
              locale === 'ro'
                ? 'Eroare la încărcarea steagurilor roșii'
                : 'Failed to load red flags'
            }
            error={redFlagsError}
            onRetry={() => loadControlTower(true)}
          />
        ) : redFlagsLoading && redFlags.length === 0 ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (
          <ControlTowerRedFlagsCard redFlags={redFlags} onInspect={openRedFlagInspect} />
        ))}

      {/* 2. THE 7 OPERATIONAL DOMAIN CARDS */}
      {overview && hasProjects && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* DOMAIN 1: PROIECTE (Projects) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-info-soft text-info rounded-lg">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.active_projects', locale)}</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.projects.activeProjects}
                </span>
              </div>

              {/* Stage breakdown */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t('control_tower.projects_by_stage', locale)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(overview.projects.projectsByStage).map(
                    ([stage, count]) => (
                      <span
                        key={stage}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {stage}: {count}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.overdue_projects', locale),
                    'PROJECTS',
                    t('control_tower.overdue_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.overdue_projects_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.projects.overdueProjects}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.upcoming_deadlines', locale),
                    'PROJECTS',
                    t('control_tower.upcoming_deadlines_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-warning-soft/50 hover:bg-warning-soft/60 text-warning-foreground transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.upcoming_deadlines_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-warning-soft text-amber-950 rounded">
                  {overview.projects.upcomingDeadlines}
                </span>
              </button>
            </div>
          </div>

          {/* DOMAIN 2: PERSONAL & PONTAJ (Workforce) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-success-soft text-success rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.workforce', locale)}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-900">
                    {overview.workforce.checkedIn}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    /{overview.workforce.scheduledToday}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.scheduled_today', locale)}</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.workforce.scheduledToday}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.valid_attendance', locale)}</span>
                  <strong className="text-success text-sm font-mono">
                    {overview.workforce.checkedIn}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.missing_attendance', locale),
                    'WORKFORCE',
                    t('control_tower.missing_attendance_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.missing_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.workforce.missing}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.overtime_today', locale),
                    'WORKFORCE',
                    t('control_tower.overtime_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-info-soft/50 hover:bg-info-soft/60 text-blue-900 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.overtime_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-info-soft text-blue-950 rounded">
                  {(overview.workforce.overtimeMinutes / 60).toFixed(1)} {t('control_tower.hours', locale)}
                </span>
              </button>
            </div>
          </div>

          {/* DOMAIN 3: PRODUCȚIE & EXECUȚIE (Production) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-warning-soft text-warning rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.production', locale)}</h3>
                </div>
                <span className="text-xl font-black text-warning font-mono">
                  {overview.production.completionPercentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-warning-soft0 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${overview.production.completionPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>{t('control_tower.actual', locale)}: {overview.production.actualToday} {t('control_tower.tasks', locale)}</span>
                  <span>{t('control_tower.plan', locale)}: {overview.production.plannedToday}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.blocked_work', locale),
                    'PRODUCTION_BLOCKED',
                    t('control_tower.blocked_work_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.blocked_work_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-600 text-white rounded">
                  {overview.production.blockedProduction} {t('control_tower.tasks', locale)}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.planned_tasks', locale),
                    'PRODUCTION',
                    t('control_tower.planned_tasks_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.planned_production_label', locale)}</span>
                <span className="font-bold font-mono text-slate-900">
                  {overview.production.plannedToday}
                </span>
              </button>
            </div>
          </div>

          {/* DOMAIN 4: MATERIALE & STOCURI (Materials) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.materials', locale)}</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.materials.pendingDeliveries} avize
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.missing_materials', locale)}</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.materials.missingRequired}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Supraconsum</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.materials.overconsumption}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.low_stock', locale),
                    'MATERIALS',
                    t('control_tower.low_stock_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-warning-soft/50 hover:bg-warning-soft/60 text-warning-foreground transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.low_stock_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-warning-soft text-amber-950 rounded">
                  {overview.materials.lowStock} {t('control_tower.items', locale)}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.deliveries', locale),
                    'MATERIALS',
                    t('control_tower.deliveries_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.pending_deliveries', locale)}</span>
                <span className="font-bold font-mono text-slate-900">
                  {overview.materials.pendingDeliveries}
                </span>
              </button>
            </div>
          </div>

          {/* DOMAIN 5: FINANȚE & BUGETE (Finance) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-success-soft text-success rounded-lg">
                    <Euro className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.finance', locale)}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-1 ${
                    overview.finance.variance >= 0
                      ? 'bg-success-soft text-success-foreground'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {overview.finance.variance >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{overview.finance.variancePercent}%</span>
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Buget Total:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.budget)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{t('control_tower.actual_cost', locale)}</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.actual)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{t('control_tower.committed_cost', locale)}</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.committed)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{t('control_tower.forecast', locale)}</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.forecast)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.finance_by_project', locale),
                    'FINANCE',
                    t('control_tower.finance_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.budget_details', locale)}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* DOMAIN 6: CALITATE & CONFORMITATE (Quality) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.quality', locale)}</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.quality.openNCRs} NCR
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.failed_inspections', locale)}</span>
                  <strong className="text-rose-600 text-sm font-mono">
                    {overview.quality.failedInspections}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.active_corrections', locale)}</span>
                  <strong className="text-warning text-sm font-mono">
                    {overview.quality.pendingCorrections}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.open_ncr', locale),
                    'QUALITY',
                    t('control_tower.open_ncr_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.open_ncr_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.quality.openNCRs}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.failed_inspections', locale),
                    'QUALITY',
                    t('control_tower.failed_inspections_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.failed_inspections', locale)}:</span>
                <span className="font-bold font-mono text-slate-900">
                  {overview.quality.failedInspections}
                </span>
              </button>
            </div>
          </div>

          {/* DOMAIN 7: DOCUMENTAȚIE TEHNICĂ (Documentation) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.documentation', locale)}</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.documentation.supersededDocuments} {t('control_tower.replaced_count', locale)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.missing_documents', locale)}</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.documentation.missingDocuments}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">{t('control_tower.awaiting_approval', locale)}</span>
                  <strong className="text-warning text-sm font-mono">
                    {overview.documentation.awaitingApproval}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.replaced_documents', locale),
                    'DOCUMENTATION',
                    t('control_tower.replaced_documents_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-warning-soft/50 hover:bg-warning-soft/60 text-warning-foreground transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.replaced_documents_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-warning-soft text-amber-950 rounded">
                  {overview.documentation.supersededDocuments}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.awaiting_documents', locale),
                    'DOCUMENTATION',
                    t('control_tower.awaiting_documents_rule', locale),
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.awaiting_label', locale)}</span>
                <span className="font-bold font-mono text-slate-900">
                  {overview.documentation.awaitingApproval}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK WORKFLOW ACCESS */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {t('control_tower.quick_modules', locale)}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('control_tower.quick_modules_detail', locale)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pontaj"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              {t('control_tower.hours', locale)}
            </Link>
            <Link
              href="/rapoarte"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              {t('control_tower.daily_reports', locale)}
            </Link>
            <Link
              href="/avize"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              {t('control_tower.delivery_intake', locale)}
            </Link>
            <Link
              href="/stocuri"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              {t('control_tower.stock', locale)}
            </Link>
            <Link
              href="/cheltuieli"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              {t('control_tower.expenses_ocr', locale)}
            </Link>
          </div>
        </div>
      </div>

      {/* 5. ACTIVITY SINCE YESTERDAY */}
      <section aria-labelledby="activity-since-yesterday-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="activity-since-yesterday-title"
              className="text-base font-bold text-slate-900 tracking-tight"
            >
              {locale === 'ro' ? 'Activitate de ieri' : 'Activity since yesterday'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {locale === 'ro'
                ? 'Ce s-a schimbat în ultimele 24 de ore'
                : 'What changed in the last 24 hours'}
            </p>
          </div>
          <Link
            href="/activity"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {locale === 'ro' ? 'Vezi tot' : 'View all'}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {activityError ? (
          <ErrorState
            title={
              locale === 'ro'
                ? 'Eroare la încărcarea activității'
                : 'Failed to load activity'
            }
            error={activityError}
            onRetry={() => loadControlTower(true)}
          />
        ) : activityLoading && activityEvents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : activityEvents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <EmptyState
              icon={<Activity />}
              title={locale === 'ro' ? 'Nicio activitate recentă' : 'No recent activity'}
              description={
                locale === 'ro'
                  ? 'Nimic nu s-a schimbat în ultimele 24 de ore.'
                  : 'Nothing changed in the last 24 hours.'
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {activityGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
                  {locale === 'ro' ? group.ro : group.en}
                </h3>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-chrome-line">
                  {group.items.map((event) => {
                    const meta = activityMeta(event, locale);
                    const Icon = meta.icon;
                    const actorName =
                      event.actor?.name || (locale === 'ro' ? 'Sistem' : 'System');
                    return (
                      <Link
                        key={event.id}
                        href={meta.href}
                        className="flex items-start gap-3 p-4 transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800">
                            <span className="font-semibold text-slate-900">{actorName}</span>{' '}
                            {meta.text}
                            {meta.subject && (
                              <span className="text-slate-600"> — {meta.subject}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {activityRelativeTime(event.createdAt, locale)}
                          </p>
                        </div>
                        <ExternalLink
                          className="size-4 text-slate-300 shrink-0 mt-1"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SLIDE-OVER DRILLDOWN DRAWER */}
      <ControlTowerDrilldownDrawer
        data={drilldown}
        onRetry={retryDrilldown}
        onClose={() => setDrilldown((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

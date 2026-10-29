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
import {
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Activity,
  AlertCircle,
  Camera,
  FileText,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Upload,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { apiClient, ControlTowerOverviewDto, RedFlag } from '../lib/api-client';
import { formatDate } from '../lib/formatters';
import { getActivity } from '../features/activity/api';
import type { ActivityEvent } from '../features/activity/types';
import { t, useLocale, canCreateProjects, type Locale } from '@solar/shared';
import { ControlTowerDrilldownDrawer, DrilldownData } from './ControlTowerDrilldownDrawer';
import { ControlTowerRedFlagsCard, prioritizeRedFlags } from './ControlTowerRedFlagsCard';
import { ControlTowerProjectMap, type ProjectMapSite } from './ControlTowerProjectMap';
import { ControlTowerSiteDetail } from './ControlTowerSiteDetail';
import { EmptyState, ErrorState, Skeleton, Pagination, Button, Card } from './ui';
import { PageTutorial } from './PageTutorial';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { ROUTE_ROLES } from '../config/route-roles';
import { getAllAttendanceRecords } from '../features/attendance/api';
import type { AttendanceRecord } from '../features/attendance/types';
import { getDailyPlans } from '../features/planning/api';
import type { DailyPlan } from '../features/planning/types';
import { getIssues } from '../features/issues/api';
import type { Issue } from '../features/issues/types';
import { todayCompanyIso } from '../lib/company-time';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  type ProjectStatus,
} from '../features/projects/types';
import type { Project } from '../types/project';

type ActivityBucket = 'hour' | 'today' | 'yesterday';
type RoleHighlight = {
  label: string;
  value: number | string;
  detail?: string;
  category?: string;
  ruleExplanation?: string;
  href?: string;
  tone: 'danger' | 'warning' | 'neutral';
};

interface ActivityMeta {
  icon: LucideIcon;
  tone: string;
  i18nKey: string;
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
  TASK_CREATED: { icon: Plus, tone: 'bg-info-soft text-info-foreground', i18nKey: 'control_tower.activity_action.TASK_CREATED' },
  TASK_UPDATED: { icon: Pencil, tone: 'bg-slate-100 text-slate-600', i18nKey: 'control_tower.activity_action.TASK_UPDATED' },
  TASK_STATUS_CHANGED: { icon: Pencil, tone: 'bg-slate-100 text-slate-600', i18nKey: 'control_tower.activity_action.TASK_STATUS_CHANGED' },
  TASK_BLOCKED: { icon: AlertTriangle, tone: 'bg-danger-soft text-danger-foreground', i18nKey: 'control_tower.activity_action.TASK_BLOCKED' },
  TASK_UNBLOCKED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', i18nKey: 'control_tower.activity_action.TASK_UNBLOCKED' },
  DAILY_REPORT_SUBMITTED: { icon: FileText, tone: 'bg-info-soft text-info-foreground', i18nKey: 'control_tower.activity_action.DAILY_REPORT_SUBMITTED' },
  DAILY_REPORT_APPROVED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', i18nKey: 'control_tower.activity_action.DAILY_REPORT_APPROVED' },
  DAILY_REPORT_REJECTED: { icon: XCircle, tone: 'bg-danger-soft text-danger-foreground', i18nKey: 'control_tower.activity_action.DAILY_REPORT_REJECTED' },
  ISSUE_REPORTED: { icon: AlertCircle, tone: 'bg-warning-soft text-warning-foreground', i18nKey: 'control_tower.activity_action.ISSUE_REPORTED' },
  ISSUE_RESOLVED: { icon: CheckCircle2, tone: 'bg-success-soft text-success-foreground', i18nKey: 'control_tower.activity_action.ISSUE_RESOLVED' },
  FILE_UPLOADED: { icon: Upload, tone: 'bg-slate-100 text-slate-600', i18nKey: 'control_tower.activity_action.FILE_UPLOADED' },
  ATTACHMENT_CREATED: { icon: Camera, tone: 'bg-slate-100 text-slate-600', i18nKey: 'control_tower.activity_action.ATTACHMENT_CREATED' },
  ATTENDANCE_CHECK_IN: { icon: LogIn, tone: 'bg-info-soft text-info-foreground', i18nKey: 'control_tower.activity_action.ATTENDANCE_CHECK_IN' },
  ATTENDANCE_CHECK_OUT: { icon: LogOut, tone: 'bg-slate-100 text-slate-600', i18nKey: 'control_tower.activity_action.ATTENDANCE_CHECK_OUT' },
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

function activityMeta(event: ActivityEvent, locale: Locale): { icon: LucideIcon; tone: string; text: string; href: string; subject: string | null } {
  const meta = ACTIVITY_META[event.action];
  const icon = meta?.icon ?? Activity;
  const tone = meta?.tone ?? 'bg-slate-100 text-slate-600';
  const text = t(meta?.i18nKey ?? 'control_tower.activity_action.default', locale);
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

function projectStageLabel(stage: string, locale: Locale): string {
  const labels = locale === 'en' ? PROJECT_STATUS_LABELS_EN : PROJECT_STATUS_LABELS;
  return labels[stage as ProjectStatus] ?? stage.replace(/_/g, ' ');
}

const ACTIVITY_BUCKET_ORDER: { key: ActivityBucket; i18nKey: string }[] = [
  { key: 'hour', i18nKey: 'control_tower.bucket_hour' },
  { key: 'today', i18nKey: 'control_tower.bucket_today' },
  { key: 'yesterday', i18nKey: 'control_tower.bucket_yesterday' },
];

const ACTIVITY_PAGE_SIZE = 10;
const CT_COLLAPSE_PREFIX = 'hiieko.ct.collapsed.';

function usePersistentCollapse(
  section: string,
  defaultCollapsed: boolean,
): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${CT_COLLAPSE_PREFIX}${section}`);
      if (stored === 'true') setCollapsed(true);
      else if (stored === 'false') setCollapsed(false);
    } catch {
    }
  }, [section]);
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(`${CT_COLLAPSE_PREFIX}${section}`, String(next));
      } catch {
      }
      return next;
    });
  }, [section]);
  return [collapsed, toggle];
}

function ControlTowerSectionHeader({
  id,
  title,
  subtitle,
  collapsed,
  onToggle,
}: {
  id: string;
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="shrink-0"
        iconPosition="right"
        icon={
          <ChevronDown
            className={`size-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            aria-hidden="true"
          />
        }
      >
        {t(collapsed ? 'planning.expand' : 'planning.collapse', locale)}
      </Button>
    </div>
  );
}

export function ControlTowerSurface() {
  const [overview, setOverview] = useState<ControlTowerOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialOverviewLoaded, setInitialOverviewLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  // Red flags — GET /api/control-tower/red-flags (separate from the overview payload)
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [redFlagsLoading, setRedFlagsLoading] = useState(true);
  const [redFlagsError, setRedFlagsError] = useState<string | null>(null);
  // Activity is fetched only when its secondary section is opened.
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const controlTowerRequestId = useRef(0);
  const activityRequestId = useRef(0);
  const attendanceRequestId = useRef(0);
  const dailyPlansRequestId = useRef(0);
  const siteIssuesRequestId = useRef(0);
  const [domainsCollapsed, toggleDomains] = usePersistentCollapse('domains', true);
  const [activityCollapsed, toggleActivity] = usePersistentCollapse('activity', true);
  const [activityPage, setActivityPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [mapSelectedSiteId, setMapSelectedSiteId] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[] | null>(null);
  const [attendanceTotal, setAttendanceTotal] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceIncomplete, setAttendanceIncomplete] = useState(false);
  const [attendanceLastUpdated, setAttendanceLastUpdated] = useState<Date | null>(null);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[] | null>(null);
  const [dailyPlansLoading, setDailyPlansLoading] = useState(false);
  const [dailyPlansError, setDailyPlansError] = useState<string | null>(null);
  const [siteIssues, setSiteIssues] = useState<Issue[] | null>(null);
  const [siteIssuesLoading, setSiteIssuesLoading] = useState(false);
  const [siteIssuesError, setSiteIssuesError] = useState<string | null>(null);
  const { locale } = useLocale();
  const { user } = useAuth();
  const { projects, loading: projectsLoading, selectedProjectId, setSelectedProjectId } = useProject();
  const selectedSiteId = projects.some((project) => project.id === mapSelectedSiteId)
    ? mapSelectedSiteId
    : projects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : projects[0]?.id ?? null;
  const role = user?.role?.toLowerCase() || 'viewer';
  const canRoleOpenRoute = useCallback((path: string) => {
    if (role === 'admin' || role === 'owner') return true;
    if (!Object.prototype.hasOwnProperty.call(ROUTE_ROLES, path)) return false;
    const allowedRoles = ROUTE_ROLES[path as keyof typeof ROUTE_ROLES];
    return allowedRoles === null || (Array.isArray(allowedRoles) && allowedRoles.includes(role));
  }, [role]);
  const roleProfile = (() => {
    switch (role) {
      case 'admin':
      case 'owner':
        return { focus: t('control_tower.focus_admin', locale) };
      case 'pm':
        return { focus: t('control_tower.focus_pm', locale) };
      case 'manager':
      case 'site_manager':
        return { focus: t('control_tower.focus_manager', locale) };
      case 'procurement':
        return { focus: t('control_tower.focus_procurement', locale) };
      case 'finance':
        return { focus: t('control_tower.focus_finance', locale) };
      case 'qa_qc':
        return { focus: t('control_tower.focus_quality', locale) };
      case 'site_logistics':
        return { focus: t('control_tower.focus_logistics', locale) };
      case 'maintenance_director':
        return { focus: t('control_tower.focus_maintenance', locale) };
      case 'technical_director':
        return { focus: t('control_tower.focus_technical', locale) };
      default:
        return { focus: t('control_tower.focus_viewer', locale) };
    }
  })();
  const canOpenProjectRecords = canRoleOpenRoute('/projects');
  const selectMapSite = useCallback((siteId: string) => {
    setMapSelectedSiteId(siteId);
    // Keep the existing dashboard scope aligned when the header is already
    // scoped to one project. Map selection leaves the portfolio-wide filter intact.
    if (selectedProjectId) setSelectedProjectId(siteId);
  }, [selectedProjectId, setSelectedProjectId]);
  const dashboardModuleLinks = [
    { href: '/projects', labelKey: 'nav.projects' },
    { href: '/tasks', labelKey: 'nav.tasks' },
    { href: '/planning', labelKey: 'nav.planning' },
    { href: '/issues', labelKey: 'nav.issues' },
    { href: '/qa', labelKey: 'nav.qa_qc' },
    { href: '/pontaj', labelKey: 'nav.pontaj' },
    { href: '/rapoarte', labelKey: 'nav.rapoarte' },
    { href: '/avize', labelKey: 'nav.avize' },
    { href: '/stocuri', labelKey: 'nav.stocuri' },
    { href: '/cheltuieli', labelKey: 'nav.cheltuieli' },
    { href: '/documente', labelKey: 'nav.documente' },
  ].filter(({ href }) => canRoleOpenRoute(href));

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

  const loadActivity = useCallback(async () => {
    const requestId = ++activityRequestId.current;
    const isCurrentRequest = () => requestId === activityRequestId.current;
    setActivityLoading(true);
    setActivityError(null);
    setActivityEvents([]);
    try {
      const activityResponse = await getActivity({
        projectId: selectedProjectId || undefined,
        limit: 20,
      });
      if (!isCurrentRequest()) return;
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      if (activityResponse.error || !Array.isArray(activityResponse.data)) {
        throw new Error(activityResponse.error || t('control_tower.load_error', locale));
      }
      const recent = activityResponse.data
        .filter((event) => new Date(event.createdAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivityEvents(recent);
    } catch (err: unknown) {
      if (!isCurrentRequest()) return;
      setActivityError(
        err instanceof Error ? err.message : t('control_tower.load_error', locale),
      );
    } finally {
      if (isCurrentRequest()) setActivityLoading(false);
    }
  }, [selectedProjectId, locale]);

  const loadSiteAttendance = useCallback(async () => {
    const requestId = ++attendanceRequestId.current;
    const isCurrentRequest = () => requestId === attendanceRequestId.current;
    if (!selectedSiteId || !selectedDate || !canRoleOpenRoute('/pontaj')) {
      setAttendanceRecords(null);
      setAttendanceTotal(0);
      setAttendanceError(null);
      setAttendanceIncomplete(false);
      setAttendanceLoading(false);
      return;
    }

    setAttendanceLoading(true);
    setAttendanceError(null);
    setAttendanceIncomplete(false);
    setAttendanceRecords(null);
    try {
      const response = await getAllAttendanceRecords({
        projectId: selectedSiteId,
        startDate: selectedDate,
        endDate: selectedDate,
      });
      if (!isCurrentRequest()) return;
      if (response.error || !Array.isArray(response.data)) {
        throw new Error(response.error || t('control_tower.map.attendance_unavailable', locale));
      }
      setAttendanceRecords(response.data);
      setAttendanceTotal(typeof response.total === 'number' ? response.total : response.data.length);
      setAttendanceLastUpdated(new Date());
      setAttendanceIncomplete(response.incomplete || response.truncated);
      setAttendanceError(null);
    } catch (err: unknown) {
      if (!isCurrentRequest()) return;
      setAttendanceIncomplete(false);
      setAttendanceError(err instanceof Error ? err.message : t('control_tower.map.attendance_unavailable', locale));
    } finally {
      if (isCurrentRequest()) setAttendanceLoading(false);
    }
  }, [selectedSiteId, selectedDate, canRoleOpenRoute, locale]);

  const loadSiteDailyPlans = useCallback(async () => {
    const requestId = ++dailyPlansRequestId.current;
    const isCurrentRequest = () => requestId === dailyPlansRequestId.current;
    if (!selectedSiteId || !selectedDate || !canRoleOpenRoute('/planning')) {
      setDailyPlans(null);
      setDailyPlansError(null);
      setDailyPlansLoading(false);
      return;
    }

    setDailyPlansLoading(true);
    setDailyPlansError(null);
    setDailyPlans(null);
    try {
      const response = await getDailyPlans(selectedSiteId, selectedDate);
      if (!isCurrentRequest()) return;
      if (response.error || !Array.isArray(response.data)) {
        throw new Error(response.error || t('control_tower.map.plan_unavailable', locale));
      }
      setDailyPlans(response.data);
    } catch (err: unknown) {
      if (!isCurrentRequest()) return;
      setDailyPlansError(err instanceof Error ? err.message : t('control_tower.map.plan_unavailable', locale));
    } finally {
      if (isCurrentRequest()) setDailyPlansLoading(false);
    }
  }, [selectedSiteId, selectedDate, canRoleOpenRoute, locale]);

  const loadSiteIssues = useCallback(async () => {
    const requestId = ++siteIssuesRequestId.current;
    const isCurrentRequest = () => requestId === siteIssuesRequestId.current;
    if (!selectedSiteId || !canRoleOpenRoute('/issues')) {
      setSiteIssues(null);
      setSiteIssuesError(null);
      setSiteIssuesLoading(false);
      return;
    }

    setSiteIssuesLoading(true);
    setSiteIssuesError(null);
    setSiteIssues(null);
    try {
      const response = await getIssues(selectedSiteId);
      if (!isCurrentRequest()) return;
      if (response.error || !Array.isArray(response.data)) {
        throw new Error(response.error || t('control_tower.map.issues_unavailable', locale));
      }
      setSiteIssues(response.data);
    } catch (err: unknown) {
      if (!isCurrentRequest()) return;
      setSiteIssuesError(err instanceof Error ? err.message : t('control_tower.map.issues_unavailable', locale));
    } finally {
      if (isCurrentRequest()) setSiteIssuesLoading(false);
    }
  }, [selectedSiteId, canRoleOpenRoute, locale]);

  const loadControlTower = useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++controlTowerRequestId.current;
      const isCurrentRequest = () => requestId === controlTowerRequestId.current;

      setLoading(true);
      setRefreshing(isManualRefresh);
      setError(null);
      setOverview(null);
      setRedFlags([]);
      setRedFlagsLoading(true);
      setRedFlagsError(null);

      try {
        const response = await apiClient.getControlTowerOverview(
          selectedProjectId || undefined,
        );

        if (!isCurrentRequest()) return;
        if (response.data) {
          setOverview(response.data);
          setLastUpdated(new Date());
        } else {
          setError(response.error || t('control_tower.load_error', locale));
        }
      } catch (err: unknown) {
        if (!isCurrentRequest()) return;
        // Fallback: If backend is booting, show informative Romanian state
        setError(
          err instanceof Error
            ? `${t('control_tower.connection_error', locale)}: ${err.message}`
            : t('control_tower.server_error', locale),
        );
      } finally {
        if (isCurrentRequest()) {
          setLoading(false);
          setRefreshing(false);
          setInitialOverviewLoaded(true);
        }
      }

      if (!isCurrentRequest()) return;

      // Red flags are a separate endpoint; load them on the same triggers
      // (mount, project change, manual refresh) as the overview.
      try {
        const flagsResponse = await apiClient.getControlTowerRedFlags(
          selectedProjectId || undefined,
        );
        if (!isCurrentRequest()) return;
        if (flagsResponse.error || !Array.isArray(flagsResponse.data)) {
          throw new Error(flagsResponse.error || t('control_tower.load_error', locale));
        }
        setRedFlags(prioritizeRedFlags(flagsResponse.data));
      } catch (err: unknown) {
        if (!isCurrentRequest()) return;
        setRedFlagsError(
          err instanceof Error
            ? err.message
            : t('control_tower.load_error', locale),
        );
      } finally {
        if (isCurrentRequest()) setRedFlagsLoading(false);
      }

    },
    [selectedProjectId, locale],
  );

  useEffect(() => {
    loadControlTower();
    return () => {
      controlTowerRequestId.current += 1;
    };
  }, [loadControlTower]);

  useEffect(() => {
    setSelectedDate(todayCompanyIso());
  }, []);

  useEffect(() => {
    void loadSiteAttendance();
    return () => {
      attendanceRequestId.current += 1;
    };
  }, [loadSiteAttendance]);

  useEffect(() => {
    void loadSiteDailyPlans();
    return () => {
      dailyPlansRequestId.current += 1;
    };
  }, [loadSiteDailyPlans]);

  useEffect(() => {
    void loadSiteIssues();
    return () => {
      siteIssuesRequestId.current += 1;
    };
  }, [loadSiteIssues]);

  useEffect(() => {
    if (activityCollapsed) {
      activityRequestId.current += 1;
      return;
    }
    void loadActivity();
    return () => {
      activityRequestId.current += 1;
    };
  }, [activityCollapsed, loadActivity]);

  const refreshDashboard = () => {
    void loadControlTower(true);
    void loadSiteAttendance();
    void loadSiteDailyPlans();
    void loadSiteIssues();
    if (!activityCollapsed) void loadActivity();
  };

  useEffect(() => {
    setActivityPage(1);
  }, [activityEvents]);

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
      title: `${t('control_tower.red_flags.inspect', locale)}: ${flag.affectedEntity}`,
      category: 'RED_FLAGS',
      ruleExplanation: flag.reason,
      itemId: flag.id,
    });
  };

  const renderProjectDestination = ({
    projectId,
    itemId,
    title,
    ruleExplanation,
    children,
  }: {
    projectId: string;
    itemId: string;
    title: string;
    ruleExplanation: string;
    children: React.ReactNode;
  }) => {
    const className = 'block w-full p-4 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500';
    if (canOpenProjectRecords) {
      return <Link href={`/projects/${projectId}`} className={className}>{children}</Link>;
    }
    return (
      <button
        type="button"
        className={className}
        onClick={() => void fetchDrilldown({ title, category: 'PROJECTS', ruleExplanation, itemId })}
      >
        {children}
      </button>
    );
  };

  const formatCurrency = (val: number, cur = 'RON') => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const roleHighlights = overview
    ? (() => {
        const projects = overview.projects;
        const production = overview.production;
        const materials = overview.materials;
        const finance = overview.finance;
        const quality = overview.quality;
        const highlight = (
          labelKey: string,
          value: number | string,
          category: string,
          ruleKey: string,
          tone: 'danger' | 'warning' | 'neutral' = 'neutral',
          detail?: string,
        ): RoleHighlight => ({
          label: t(labelKey, locale),
          value,
          detail,
          category,
          ruleExplanation: t(ruleKey, locale),
          tone,
        });
        const routeHighlight = (labelKey: string, value: number, href: string): RoleHighlight => ({
          label: t(labelKey, locale),
          value,
          href,
          tone: 'neutral' as const,
        });

        const workforce = overview.workforce;
        const attendance = highlight(
          'control_tower.kpi_attendance',
          workforce.checkedIn,
          'WORKFORCE',
          'control_tower.valid_attendance',
          'neutral',
        );
        const execution = highlight(
          'control_tower.kpi_execution',
          `${production.completionPercentage}%`,
          'PRODUCTION',
          'control_tower.planned_tasks',
          'neutral',
        );
        const blocked = highlight(
          'control_tower.blocked_work',
          production.blockedProduction,
          'PRODUCTION',
          'control_tower.blocked_work_rule',
          production.blockedProduction > 0 ? 'danger' : 'neutral',
        );
        const activeProjects = canOpenProjectRecords
          ? routeHighlight('control_tower.projects_in_scope', projects.activeProjects, '/projects')
          : highlight(
              'control_tower.projects_in_scope',
              projects.activeProjects,
              'PROJECTS',
              'control_tower.active_projects',
            );
        const overdue = highlight(
          'control_tower.kpi_overdue',
          projects.overdueProjects,
          'PROJECTS',
          'control_tower.overdue_rule',
          projects.overdueProjects > 0 ? 'warning' : 'neutral',
        );
        const criticalAlerts = highlight(
          'control_tower.kpi_critical_alerts',
          redFlagsLoading || redFlagsError
            ? '—'
            : redFlags.filter((flag) => flag.severity === 'CRITICAL').length,
          'RED_FLAGS',
          'control_tower.red_flags.subtitle',
          redFlagsLoading || redFlagsError || !redFlags.some((flag) => flag.severity === 'CRITICAL')
            ? 'neutral'
            : 'danger',
        );

        switch (role) {
          case 'admin':
          case 'owner':
            return [activeProjects, attendance, execution, blocked, criticalAlerts];
          case 'pm':
          case 'manager':
          case 'site_manager':
            return [activeProjects, attendance, execution, blocked, overdue];
          case 'procurement':
          case 'site_logistics':
            return [
              activeProjects,
              highlight('control_tower.low_stock', materials.lowStock, 'MATERIALS', 'control_tower.low_stock_rule', 'warning'),
              highlight('control_tower.missing_materials', materials.missingRequired, 'MATERIALS', 'control_tower.low_stock_rule', 'danger'),
              highlight('control_tower.pending_deliveries', materials.pendingDeliveries, 'MATERIALS', 'control_tower.deliveries_rule'),
              blocked,
            ];
          case 'finance':
            return [
              activeProjects,
              highlight('control_tower.budget_total', formatCurrency(finance.budget), 'FINANCE', 'control_tower.finance_rule'),
              highlight('control_tower.actual_cost', formatCurrency(finance.actual), 'FINANCE', 'control_tower.finance_rule'),
              highlight('control_tower.forecast', formatCurrency(finance.forecast), 'FINANCE', 'control_tower.finance_rule'),
              overdue,
            ];
          case 'qa_qc':
            return [
              activeProjects,
              highlight('control_tower.failed_inspections', quality.failedInspections, 'QUALITY', 'control_tower.failed_inspections_rule', 'danger'),
              highlight('control_tower.open_ncr', quality.openNCRs, 'QUALITY', 'control_tower.open_ncr_rule', 'warning'),
              highlight('control_tower.active_corrections', quality.pendingCorrections, 'QUALITY', 'control_tower.open_ncr_rule'),
              criticalAlerts,
            ];
          case 'maintenance_director':
          case 'technical_director':
            return [activeProjects, attendance, execution, blocked, overdue];
          default:
            return [activeProjects, attendance, execution, blocked, overdue];
        }
      })()
    : [];

  if (loading && !overview && !initialOverviewLoaded) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center space-y-3">
        <Loader2 className="size-8 animate-spin text-hii-500" aria-hidden="true" />
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

  const hasProjects = (overview?.projects.activeProjectsList.length ?? 0) > 0;
  const projectProgressById = new Map(
    (overview?.projects.activeProjectsList ?? []).map((project) => [project.id, project]),
  );
  const mapSites: ProjectMapSite[] = projects.map((project: Project) => {
    const summary = projectProgressById.get(project.id);
    const latitudeValue: unknown = project.latitude;
    const longitudeValue: unknown = project.longitude;
    const latitude = latitudeValue === null || latitudeValue === undefined || latitudeValue === ''
      ? null
      : Number(latitudeValue);
    const longitude = longitudeValue === null || longitudeValue === undefined || longitudeValue === ''
      ? null
      : Number(longitudeValue);
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      address: project.address ?? null,
      latitude: latitude !== null && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
      longitude: longitude !== null && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
      status: project.status || 'UNKNOWN',
      targetEndDate: project.target_end_date ?? summary?.targetEndDate ?? null,
      progressPercent: summary?.progressPercent ?? null,
    };
  });
  const selectedProject = projects.find((project) => project.id === selectedSiteId) ?? null;
  const selectedProjectProgress = projectProgressById.get(selectedSiteId ?? '') ?? null;
  const selectedProjectIsTerminal = ['COMPLETED', 'HANDOVER', 'CANCELLED'].includes(selectedProject?.status ?? '');
  const selectedProjectOverdue = !selectedProjectIsTerminal
    ? overview?.projects.overdueProjectsList.find((project) => project.projectId === selectedSiteId)
    : undefined;
  const selectedProjectDueSoon = !selectedProjectIsTerminal
    ? overview?.projects.upcomingDeadlinesList.find((project) => project.projectId === selectedSiteId)
    : undefined;
  const actionableUpcomingDeadlines = overview
    ? overview.projects.upcomingDeadlinesList.filter((deadline) => {
        const project = overview.projects.activeProjectsList.find((item) => item.id === deadline.projectId);
        return project?.stage !== 'COMPLETED' && project?.stage !== 'HANDOVER' && project?.stage !== 'CANCELLED';
      })
    : [];

  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityEvents.length / ACTIVITY_PAGE_SIZE),
  );
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const pagedActivityEvents = activityEvents.slice(
    (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE,
    safeActivityPage * ACTIVITY_PAGE_SIZE,
  );

  const activityGroups = ACTIVITY_BUCKET_ORDER.map((bucket) => ({
    ...bucket,
    items: pagedActivityEvents.filter(
      (event) => activityBucketOf(event.createdAt) === bucket.key,
    ),
  })).filter((bucket) => bucket.items.length > 0);

  return (
    <div className="space-y-3 pb-12 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-hii-500 [&_*:focus-visible]:ring-offset-2">
      <header>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              {t('control_tower.title', locale)}
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              {roleProfile.focus}
              <span className="ml-2 text-slate-400">
                {t('control_tower.last_updated', locale)}: {lastUpdated.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO')}
              </span>
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <label htmlFor="control-tower-project" className="sr-only">{t('control_tower.project_filter', locale)}</label>
            <select
              id="control-tower-project"
              value={selectedProjectId}
              onChange={(e) => {
                setMapSelectedSiteId(e.target.value || null);
                setSelectedProjectId(e.target.value);
              }}
              className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm font-medium text-slate-800 focus:border-hii-500 focus:outline-none focus:ring-2 focus:ring-hii-500 sm:w-auto sm:max-w-xs"
            >
              <option value="">{t('control_tower.all_active_sites', locale)}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            <label htmlFor="control-tower-date" className="sr-only">{t('control_tower.map.selected_date', locale)}</label>
            <input
              id="control-tower-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-hii-500 focus:outline-none focus:ring-2 focus:ring-hii-500 sm:w-auto"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshDashboard}
              disabled={refreshing}
              icon={<RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              {t('control_tower.refresh', locale)}
            </Button>
          </div>
        </div>
      </header>

      {overview && hasProjects && (
        <section aria-label={t('control_tower.role_priority', locale)}>
          <Card padding={false} className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0 xl:grid-cols-5">
              {roleHighlights.map((item) => {
                const content = (
                  <span className="flex min-h-[4.5rem] min-w-0 flex-col justify-center px-3 py-2.5 sm:min-h-[5rem] sm:px-4">
                    <span className="truncate text-xs font-medium text-slate-500">
                      {item.label}
                    </span>
                    <span className={`mt-0.5 truncate text-lg font-bold tabular-nums sm:text-xl ${
                      item.tone === 'danger'
                        ? 'text-danger-foreground'
                        : item.tone === 'warning'
                          ? 'text-warning-foreground'
                          : 'text-slate-950'
                    }`}>
                      {item.value}
                    </span>
                    {item.detail && <span className="truncate text-[11px] text-slate-500">{item.detail}</span>}
                  </span>
                );

                return item.href ? (
                  <Link key={item.label} href={item.href} className="min-w-0 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500">
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.category && item.ruleExplanation) {
                        openDrilldown(item.label, item.category, item.ruleExplanation);
                      }
                    }}
                    className="min-w-0 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-warning-soft border border-warning/20 text-warning-foreground text-xs flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={refreshDashboard}
            className="font-bold underline ml-4 hover:text-amber-950"
          >
            {t('control_tower.retry', locale)}
          </button>
        </div>
      )}

      {overview && hasProjects && (
        <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <ControlTowerProjectMap
            sites={mapSites}
            selectedSiteId={selectedSiteId}
            onSelectSite={selectMapSite}
            loading={projectsLoading}
          />
          <ControlTowerSiteDetail
            project={selectedProject}
            selectedDate={selectedDate}
            progress={selectedProjectProgress}
            overdueDays={selectedProjectOverdue?.daysOverdue ?? null}
            dueSoonDate={selectedProjectDueSoon?.targetDate ?? null}
            overview={overview}
            overviewLoading={loading}
            redFlags={redFlags}
            canReadAttendance={canRoleOpenRoute('/pontaj')}
            attendanceRecords={attendanceRecords}
            attendanceTotal={attendanceTotal}
            attendanceTruncated={attendanceIncomplete}
            attendanceLoading={attendanceLoading}
            attendanceError={attendanceError}
            attendanceLastUpdated={attendanceLastUpdated}
            dailyPlans={dailyPlans}
            dailyPlansLoading={dailyPlansLoading}
            dailyPlansError={dailyPlansError}
            issues={siteIssues}
            issuesLoading={siteIssuesLoading}
            issuesError={siteIssuesError}
            canOpenRoute={canRoleOpenRoute}
          />
        </div>
      )}

      {overview && hasProjects && (
        <section aria-labelledby="active-projects-title" className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <h2 id="active-projects-title" className="text-sm font-bold text-slate-900">
              {t('control_tower.active_projects', locale)}
            </h2>
            <span className="text-xs tabular-nums text-slate-500">{overview.projects.activeProjectsList.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {overview.projects.activeProjectsList.map((project) => {
              const overdue = overview.projects.overdueProjectsList.find((item) => item.projectId === project.id);
              const terminal = ['COMPLETED', 'HANDOVER', 'CANCELLED'].includes(project.stage);
              const dueSoon = terminal
                ? undefined
                : overview.projects.upcomingDeadlinesList.find((item) => item.projectId === project.id);
              const progressMismatch = project.stage === 'COMPLETED' && project.progressPercent < 100;
              const progress = Math.min(100, Math.max(0, project.progressPercent));
              return (
                <li key={project.id} className="px-3 py-2.5 sm:px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{project.name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {project.code} · {projectStageLabel(project.stage, locale)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold">
                      {overdue && (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-800">
                          {t('control_tower.project_overdue_warning', locale)}
                        </span>
                      )}
                      {!overdue && dueSoon && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                          {t('control_tower.project_due_soon_warning', locale)}
                        </span>
                      )}
                      <span className="tabular-nums text-slate-600">{project.progressPercent}%</span>
                    </div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${project.name} ${t('control_tower.map.progress', locale)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={project.progressPercent}
                    title={t('control_tower.project_task_progress_definition', locale)}
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  >
                    <div className="h-full rounded-full bg-hii-500" style={{ width: `${progress}%` }} />
                  </div>
                  {progressMismatch && (
                    <p className="mt-1 text-[10px] leading-4 text-amber-800">
                      {t('control_tower.project_progress_mismatch', locale)
                        .replace('{status}', projectStageLabel(project.stage, locale))
                        .replace('{progress}', String(project.progressPercent))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* No projects yet: Control Tower has nothing to aggregate */}
      {overview && !hasProjects && !projectsLoading && (
        <Card padding={false}>
          <EmptyState
            icon={<Briefcase />}
            title={t('control_tower.empty_projects_title', locale)}
            description={t('control_tower.empty_projects_message', locale)}
            action={
              user && canCreateProjects(user.role as never) && canOpenProjectRecords ? (
                <Link
                  href="/projects"
                  className="inline-flex items-center justify-center rounded-lg bg-hii-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-hii-600 focus-visible:ring-hii-500"
                >
                  {t('control_tower.empty_projects_action', locale)}
                </Link>
              ) : undefined
            }
          />
        </Card>
      )}

      {/* Prioritized alerts stay concise; project context now lives in the map panel. */}
      {overview && hasProjects && (
        <div className="grid items-start gap-4">
          <section aria-labelledby="red-flags-title" className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 id="red-flags-title" className="text-sm font-bold text-slate-900">
                {t('control_tower.red_flags.section', locale)}
              </h2>
              <span className="text-xs text-slate-500">
                {redFlagsLoading ? '…' : redFlags.length}
              </span>
            </div>
            {redFlagsError ? (
              <ErrorState
                title={t('control_tower.red_flags_error_title', locale)}
                error={redFlagsError}
                onRetry={() => loadControlTower(true)}
              />
            ) : redFlagsLoading && redFlags.length === 0 ? (
              <Skeleton className="h-36 rounded-lg" />
            ) : (
              <ControlTowerRedFlagsCard
                redFlags={redFlags}
                onInspect={openRedFlagInspect}
                projectNameForFlag={(flag) => {
                  if (selectedProjectId) {
                    return overview.projects.activeProjectsList.find((project) => project.id === selectedProjectId)?.name ?? null;
                  }
                  return flag.category === 'PROJECTS' || flag.category === 'FINANCE'
                    ? overview.projects.activeProjectsList.find((project) => project.id === flag.entityId)?.name ?? null
                    : null;
                }}
                ageOrDueForFlag={(flag) => {
                  const overdue = overview.projects.overdueProjectsList.find((project) => project.projectId === flag.entityId);
                  return overdue
                    ? `${t('control_tower.drawer.overdue', locale).replace('{days}', String(overdue.daysOverdue))} · ${formatDate(overdue.targetEndDate, locale)}`
                    : flag.timestamp
                      ? activityRelativeTime(flag.timestamp, locale)
                      : null;
                }}
                compact
              />
            )}
          </section>

        </div>
      )}

      {overview && hasProjects && (
        <details className="group rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500">
            <span>{t('control_tower.project_deadlines', locale)}</span>
            <span className="text-xs font-normal text-slate-500">
              {t('control_tower.project_deadlines_description', locale)}
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-3 border-t border-slate-100 p-3 lg:grid-cols-2">
            {overview.projects.overdueProjectsList.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
                {overview.projects.overdueProjectsList.map((item) => (
                  <li key={item.id}>
                    {renderProjectDestination({
                      projectId: item.projectId,
                      itemId: item.id,
                      title: item.projectName,
                      ruleExplanation: t('control_tower.overdue_rule', locale),
                      children: (
                        <span className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-semibold text-slate-800">{item.projectCode} · {item.projectName}</span>
                          <span className="shrink-0 text-danger-foreground">{t('control_tower.drawer.overdue', locale).replace('{days}', String(item.daysOverdue))}</span>
                        </span>
                      ),
                    })}
                  </li>
                ))}
              </ul>
            )}
            {actionableUpcomingDeadlines.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
                {actionableUpcomingDeadlines.map((item) => (
                  <li key={item.id}>
                    {renderProjectDestination({
                      projectId: item.projectId,
                      itemId: item.id,
                      title: item.projectName,
                      ruleExplanation: t('control_tower.upcoming_deadlines_rule', locale),
                      children: (
                        <span className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-semibold text-slate-800">{item.projectCode} · {item.projectName}</span>
                          <span className="shrink-0 text-warning-foreground">{formatDate(item.targetDate, locale)}</span>
                        </span>
                      ),
                    })}
                  </li>
                ))}
              </ul>
            )}
            {overview.projects.overdueProjectsList.length === 0 && actionableUpcomingDeadlines.length === 0 && (
              <p className="px-2 py-1 text-xs text-slate-500">{t('control_tower.project_deadlines_description', locale)}</p>
            )}
          </div>
        </details>
      )}

      {/* Secondary operational detail stays in role-authorized feature modules. */}
      {overview && hasProjects && (
        <section aria-labelledby="domains-title" className="space-y-2">
          <ControlTowerSectionHeader
            id="domains-title"
            title={t('control_tower.module_access', locale)}
            collapsed={domainsCollapsed}
            onToggle={toggleDomains}
          />
          {!domainsCollapsed && (
            <nav aria-label={t('control_tower.module_access', locale)} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {dashboardModuleLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-hii-700 transition-colors hover:border-hii-300 hover:bg-hii-50"
                >
                  {t(labelKey, locale)}
                </Link>
              ))}
            </nav>
          )}
        </section>
      )}
      {/* 5. ACTIVITY SINCE YESTERDAY */}
      <section aria-labelledby="activity-since-yesterday-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="activity-since-yesterday-title"
              className="text-base font-bold text-slate-900 tracking-tight"
            >
              {t('control_tower.activity_title', locale)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('control_tower.activity_subtitle', locale)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canRoleOpenRoute('/activity') && (
              <Link
                href="/activity"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                {t('control_tower.view_all', locale)}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={toggleActivity}
              aria-expanded={!activityCollapsed}
              aria-label={t(activityCollapsed ? 'planning.expand' : 'planning.collapse', locale)}
              icon={
                <ChevronDown
                  className={`size-4 transition-transform ${activityCollapsed ? '-rotate-90' : ''}`}
                  aria-hidden="true"
                />
              }
            />
          </div>
        </div>

        {!activityCollapsed && (activityError ? (
          <ErrorState
            title={t('control_tower.activity_error_title', locale)}
            error={activityError}
            onRetry={loadActivity}
          />
        ) : activityLoading && activityEvents.length === 0 ? (
          <Card padding={false} className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </Card>
        ) : activityEvents.length === 0 ? (
          <Card padding={false}>
            <EmptyState
              icon={<Activity />}
              title={t('control_tower.activity_empty_title', locale)}
              description={t('control_tower.activity_empty_message', locale)}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {activityGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
                  {t(group.i18nKey, locale)}
                </h3>
                <Card padding={false} className="divide-y divide-chrome-line">
                  {group.items.map((event) => {
                    const meta = activityMeta(event, locale);
                    const Icon = meta.icon;
                    const actorName =
                      event.actor?.name || t('activity.system', locale);
                    const content = (
                      <>
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
                        {canRoleOpenRoute(meta.href) && (
                          <ExternalLink
                            className="size-4 text-slate-300 shrink-0 mt-1"
                            aria-hidden="true"
                          />
                        )}
                      </>
                    );
                    return canRoleOpenRoute(meta.href) ? (
                      <Link
                        key={event.id}
                        href={meta.href}
                        className="flex items-start gap-3 p-4 transition-colors hover:bg-slate-50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={event.id} className="flex items-start gap-3 p-4">
                        {content}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        ))}
        {!activityCollapsed && activityEvents.length > 0 && (
          <Pagination
            page={safeActivityPage}
            pageSize={ACTIVITY_PAGE_SIZE}
            total={activityEvents.length}
            onPageChange={setActivityPage}
            className="mt-2"
          />
        )}
      </section>

      <details className="group rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500">
          <span>{t('howItWorks', locale)}</span>
          <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-slate-100 p-3">
          <PageTutorial sectionId="dashboard" />
        </div>
      </details>

      {/* SLIDE-OVER DRILLDOWN DRAWER */}
      <ControlTowerDrilldownDrawer
        data={drilldown}
        onRetry={retryDrilldown}
        onClose={() => setDrilldown((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

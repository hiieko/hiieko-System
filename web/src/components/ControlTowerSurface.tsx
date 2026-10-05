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
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { apiClient, ControlTowerOverviewDto, RedFlag } from '../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { ControlTowerDrilldownDrawer, DrilldownData } from './ControlTowerDrilldownDrawer';
import { ControlTowerRedFlagsCard } from './ControlTowerRedFlagsCard';
import { PageTutorial } from './PageTutorial';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { CONTROL_TOWER_ROLES } from '../config/route-roles';

export function ControlTowerSurface() {
  const [overview, setOverview] = useState<ControlTowerOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { locale } = useLocale();
  const { user } = useAuth();
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

  // Drilldown Drawer State
  const [drilldown, setDrilldown] = useState<DrilldownData>({
    isOpen: false,
    title: '',
    category: '',
    ruleExplanation: '',
    items: [],
  });

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
    },
    [selectedProjectId, locale],
  );

  useEffect(() => {
    loadControlTower();
  }, [loadControlTower]);

  // Open drill-down drawer helper
  const openDrilldown = (
    title: string,
    category: string,
    ruleExplanation: string,
    items: any[],
  ) => {
    setDrilldown({
      isOpen: true,
      title,
      category,
      ruleExplanation,
      items,
    });
  };

  const openRedFlagInspect = (flag: RedFlag) => {
    openDrilldown(
      `${t('control_tower.critical_alert', locale)}: ${flag.affectedEntity}`,
      flag.category,
      flag.reason,
      [flag],
    );
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

  return (
    <div className="space-y-6 pb-12">
      <PageTutorial sectionId="dashboard" />

      <section aria-labelledby="role-focus-title" className="bg-slate-900 rounded-2xl p-5 text-white shadow-sm">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
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
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
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

      {/* 1. CRITICAL ALERTS & RED FLAGS (Rule-based exceptions) */}
      {overview && (
        <ControlTowerRedFlagsCard
          redFlags={overview.redFlags}
          onInspect={openRedFlagInspect}
        />
      )}

      {/* 2. THE 7 OPERATIONAL DOMAIN CARDS */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* DOMAIN 1: PROIECTE (Projects) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-700">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
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
                    overview.projects.overdueProjectsList,
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
                    overview.projects.upcomingDeadlinesList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.upcoming_deadlines_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 text-amber-950 rounded">
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
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
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
                  <strong className="text-emerald-600 text-sm font-mono">
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
                    overview.workforce.missingList,
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
                    overview.workforce.overtimeList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-blue-50/50 hover:bg-blue-100/60 text-blue-900 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.overtime_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-blue-200 text-blue-950 rounded">
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
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.production', locale)}</h3>
                </div>
                <span className="text-xl font-black text-amber-600 font-mono">
                  {overview.production.completionPercentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all duration-500"
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
                    overview.production.blockedTasksList,
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
                    overview.production.plannedTasksList,
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
                    overview.materials.lowStockList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.low_stock_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 text-amber-950 rounded">
                  {overview.materials.lowStock} {t('control_tower.items', locale)}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.deliveries', locale),
                    'MATERIALS',
                    t('control_tower.deliveries_rule', locale),
                    overview.materials.pendingDeliveriesList,
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
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Euro className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{t('control_tower.finance', locale)}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-1 ${
                    overview.finance.variance >= 0
                      ? 'bg-emerald-100 text-emerald-800'
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
                    overview.finance.budgetByProject,
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
                  <strong className="text-amber-600 text-sm font-mono">
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
                    overview.quality.openNCRsList,
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
                    overview.quality.failedInspectionsList,
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
                  <strong className="text-amber-600 text-sm font-mono">
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
                    overview.documentation.supersededDocumentsList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">{t('control_tower.replaced_documents_label', locale)}</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 text-amber-950 rounded">
                  {overview.documentation.supersededDocuments}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    t('control_tower.awaiting_documents', locale),
                    'DOCUMENTATION',
                    t('control_tower.awaiting_documents_rule', locale),
                    overview.documentation.awaitingApprovalList,
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
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800">
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

      {/* SLIDE-OVER DRILLDOWN DRAWER */}
      <ControlTowerDrilldownDrawer
        data={drilldown}
        onClose={() => setDrilldown((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

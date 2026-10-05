'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  HardHat,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import { apiClient, type ControlTowerOverviewDto } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useLocale } from '@solar/shared';
import { ControlTowerDrilldownDrawer, type DrilldownData } from './ControlTowerDrilldownDrawer';
import { PageTutorial } from './PageTutorial';

function formatDay(locale: 'ro' | 'en') {
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ro-RO').format(value);
}

export function V0OperationsHome() {
  const { user } = useAuth();
  const { selectedProjectId, selectedProject } = useProject();
  const { locale } = useLocale();
  const [overview, setOverview] = useState<ControlTowerOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrilldownData | null>(null);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getControlTowerOverview(selectedProjectId || undefined);
      if (!response.data) throw new Error(response.error || 'Nu s-au putut încărca datele operaționale.');
      setOverview(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la încărcarea datelor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeProject = useMemo(() => {
    if (!overview) return null;
    if (selectedProjectId) {
      return overview.projects.activeProjectsList.find((project) => project.id === selectedProjectId) || null;
    }
    return overview.projects.activeProjectsList[0] || null;
  }, [overview, selectedProjectId]);

  const projectProgress = useMemo(() => {
    if (!overview?.projects.activeProjectsList.length) return 0;
    if (activeProject) return Math.round(activeProject.progressPercent);
    const total = overview.projects.activeProjectsList.reduce((sum, project) => sum + project.progressPercent, 0);
    return Math.round(total / overview.projects.activeProjectsList.length);
  }, [activeProject, overview]);

  const inProgressTasks = useMemo(
    () =>
      (overview?.production.actualTasksList || []).filter(
        (task) => task.completionPercent > 0 && task.completionPercent < 100,
      ),
    [overview],
  );

  const attentionItems = useMemo(() => {
    if (!overview) return [];
    const redFlags = overview.redFlags
      .filter((flag) => flag.severity === 'CRITICAL' || flag.severity === 'HIGH')
      .slice(0, 2)
      .map((flag) => ({
        id: `flag-${flag.id}`,
        title: flag.affectedEntity,
        meta: flag.responsiblePerson || flag.category,
        badge: 'Atenție',
        kind: 'flag' as const,
        item: flag,
      }));
    const blocked = overview.production.blockedTasksList.slice(0, 3 - redFlags.length).map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      meta: [task.taskCode, task.zoneName].filter(Boolean).join(' · '),
      badge: 'Blocat',
      kind: 'blocked' as const,
      item: task,
    }));
    return [...redFlags, ...blocked].slice(0, 3);
  }, [overview]);

  const recentActivity = useMemo(() => {
    if (!overview) return [];
    const taskEvents = overview.production.actualTasksList
      .filter((task) => task.actualStart)
      .sort((a, b) => String(b.actualStart).localeCompare(String(a.actualStart)))
      .slice(0, 2)
      .map((task) => ({
        icon: Activity,
        text: `Execuție ${task.taskCode} · ${task.completionPercent}%`,
        meta: `${formatTime(task.actualStart)} · ${task.projectName}`,
      }));
    const attendanceEvents = overview.workforce.scheduledTodayList
      .filter((worker) => worker.checkInTime)
      .sort((a, b) => String(b.checkInTime).localeCompare(String(a.checkInTime)))
      .slice(0, 2)
      .map((worker) => ({
        icon: Clock3,
        text: `${worker.fullName} a intrat în șantier`,
        meta: `${formatTime(worker.checkInTime)} · ${worker.projectName}`,
      }));
    return [...taskEvents, ...attendanceEvents].slice(0, 4);
  }, [overview]);

  const openAttention = (item: (typeof attentionItems)[number]) => {
    if (item.kind === 'flag') {
      const flag = item.item;
      setDrawer({
        isOpen: true,
        title: flag.affectedEntity,
        category: flag.category,
        ruleExplanation: flag.reason,
        items: [flag],
      });
      return;
    }
    const task = item.item;
    setDrawer({
      isOpen: true,
      title: task.title,
      category: 'PRODUCTION_BLOCKED',
      ruleExplanation: task.blockedReason,
      items: [task],
    });
  };

  const currentName = user?.fullName || user?.email || 'Administrator';
  const currentProjectName = activeProject?.name || selectedProject?.name || 'Toate șantierele';
  const currentProjectCode = activeProject?.code || selectedProject?.code || '—';
  const statusOnSchedule =
    (overview?.projects.overdueProjects || 0) === 0 &&
    (overview?.redFlags || []).every((flag) => flag.severity !== 'CRITICAL');

  if (loading && !overview) {
    return (
      <div className="hii-page flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-hii-600" />
          <span className="text-sm">Se încarcă spațiul operațional...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTutorial sectionId="dashboard" />
      <div className="v0-home hii-page">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="v0-eyebrow">
                {formatDay(locale)} · {selectedProject ? 'PROIECT CURENT' : 'OPERAȚIUNI'}
              </div>
              <h1 className="v0-title">Bună dimineața, {currentName.split(' ')[0]}</h1>
              <p className="v0-subtitle">O imagine clară a operațiunilor de astăzi din șantier.</p>
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="v0-secondary-button self-start"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Reîmprospătează
            </button>
          </div>

          <section className="v0-project-banner">
            <div className="v0-icon-box"><MapPin className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="v0-eyebrow">PROIECT CURENT</div>
              <div className="v0-project-name">{currentProjectName}</div>
              <div className="v0-project-meta">{currentProjectCode} · România</div>
            </div>
            <div className="v0-project-status">
              <span className={statusOnSchedule ? 'v0-status v0-status-green' : 'v0-status v0-status-amber'}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {statusOnSchedule ? 'În grafic' : 'Necesită atenție'}
              </span>
              <div className="v0-progress-value">{projectProgress}%</div>
              <div className="v0-project-meta">Progres proiect</div>
            </div>
          </section>

          {error && (
            <div className="v0-error">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
              <button type="button" onClick={() => void load(true)} className="ml-auto font-semibold underline">
                Reîncearcă
              </button>
            </div>
          )}

          {overview && (
            <>
              <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MetricCard
                  icon={CheckCircle2}
                  value={formatNumber(inProgressTasks.length)}
                  label="Sarcini în desfășurare"
                  note={`${formatNumber(overview.production.plannedToday)} planificate astăzi`}
                  tone="green"
                />
                <MetricCard
                  icon={Users}
                  value={`${formatNumber(overview.workforce.checkedIn)} / ${formatNumber(overview.workforce.scheduledToday)}`}
                  label="Echipă prezentă astăzi"
                  note={`${formatNumber(overview.workforce.missing)} de confirmat`}
                  tone="blue"
                />
                <MetricCard
                  icon={AlertTriangle}
                  value={formatNumber(overview.production.blockedProduction + overview.projects.overdueProjects)}
                  label="Blocaje deschise"
                  note={`${formatNumber(overview.projects.overdueProjects)} proiecte depășite`}
                  tone="amber"
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
                <div className="v0-card">
                  <div className="v0-card-header">
                    <div className="flex items-center gap-2">
                      <HardHat className="h-4 w-4 text-slate-700" />
                      <h2>Necesită atenție</h2>
                    </div>
                    <Link href="/issues" className="v0-card-link">Vezi toate <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {attentionItems.length === 0 ? (
                      <div className="p-8 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-hii-600" />
                        <p className="mt-2 text-sm font-semibold text-slate-800">Totul este în regulă</p>
                        <p className="mt-1 text-xs text-slate-500">Nu există blocaje critice active pentru contextul curent.</p>
                      </div>
                    ) : (
                      attentionItems.map((item, index) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openAttention(item)}
                          className="v0-queue-row group w-full text-left"
                        >
                          <span className="v0-queue-index">{String(index + 1).padStart(2, '0')}</span>
                          <span className={`v0-mini-status ${item.kind === 'flag' ? 'v0-mini-status-amber' : 'v0-mini-status-red'}`}>
                            {item.badge}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] text-slate-400">{item.meta}</span>
                            <span className="mt-1 block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-600" />
                        </button>
                      ))
                    )}
                  </div>
                  <Link href="/planning" className="v0-card-footer-link">Deschide planificarea <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>

                <div className="v0-card">
                  <div className="v0-card-header">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-slate-700" />
                      <h2>Activitate recentă</h2>
                    </div>
                    <Link href="/notificari" className="v0-card-link">Vezi toate <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                  <div>
                    {recentActivity.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">Nu există activitate disponibilă pentru acest context.</div>
                    ) : (
                      recentActivity.map((event) => {
                        const Icon = event.icon;
                        return (
                          <div className="v0-activity-row" key={`${event.meta}-${event.text}`}>
                            <span className="v0-activity-icon"><Icon className="h-4 w-4" /></span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-900">{event.text}</span>
                              <span className="mt-0.5 block text-xs text-slate-400">{event.meta}</span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="v0-system-status">
                    <span className="h-2 w-2 rounded-full bg-hii-600" />
                    <span>Toate sistemele sunt funcționale</span>
                    <span className="ml-auto">HIIEKO</span>
                  </div>
                </div>
              </section>

              <section className="v0-project-progress-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="v0-eyebrow">PROGRES PROIECT</div>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">
                      {activeProject?.name || 'Portofoliu activ'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {overview.production.actualTasksList.length} activități cu progres înregistrat · {overview.production.completionPercentage}% execuție agregată
                    </p>
                  </div>
                  <Link href="/projects" className="v0-card-link">Deschide proiectele <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-hii-600 transition-all" style={{ width: `${projectProgress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{projectProgress}% progres</span>
                  <span>{formatNumber(overview.production.actualToday)} realizări · {formatNumber(overview.production.blockedProduction)} blocate</span>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <QuickLink href="/tasks" icon={CheckCircle2} title="Sarcini" body="Alocări, progres și blocaje" />
                <QuickLink href="/planning" icon={CalendarDays} title="Planificare" body="Echipe și lucrări pentru azi" />
                <QuickLink href="/rapoarte" icon={FileCheck2} title="Rapoarte zilnice" body="Trimise și în așteptarea revizuirii" />
              </section>
            </>
          )}
        </div>
      </div>

      <ControlTowerDrilldownDrawer data={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  note: string;
  tone: 'green' | 'blue' | 'amber';
}) {
  return (
    <div className="v0-metric-card">
      <div className={`v0-metric-icon v0-tone-${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold tracking-tight text-slate-950">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-slate-700">{label}</div>
        <div className="mt-1 text-[10px] text-slate-400">{note}</div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, body }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Link href={href} className="v0-quick-link">
      <span className="v0-quick-link-icon"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{body}</span></span>
      <ArrowRight className="h-4 w-4 text-slate-300" />
    </Link>
  );
}

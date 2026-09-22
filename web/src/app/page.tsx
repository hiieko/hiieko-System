'use client';

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
import { ControlTowerDrilldownDrawer, DrilldownData } from '../components/ControlTowerDrilldownDrawer';
import { ControlTowerRedFlagsCard } from '../components/ControlTowerRedFlagsCard';
import { PageTutorial } from '../components/PageTutorial';

export default function ControlTowerDashboardPage() {
  const [overview, setOverview] = useState<ControlTowerOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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
          setError(response.error || 'Nu s-au putut încărca datele din Turnul de Control.');
        }
      } catch (err: unknown) {
        // Fallback: If backend is booting, show informative Romanian state
        setError(
          err instanceof Error
            ? `Eroare conexiune Turn de Control: ${err.message}`
            : 'Eroare la comunicarea cu serverul NestJS.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProjectId],
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
      `Alertă Critică: ${flag.affectedEntity}`,
      flag.category,
      flag.reason,
      [flag],
    );
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-800">
            Se încarcă Turnul de Control...
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Se agregă datele operaționale în timp real din baza de date centrală.
          </p>
        </div>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (val: number, cur = 'RON') => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageTutorial sectionId="dashboard" />

      {/* Control Tower Header & Global Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
              Turn de Control HIIEKO
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Ultima actualizare: {lastUpdated.toLocaleTimeString('ro-RO')}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-950 mt-1 tracking-tight">
            Panou Operațional de Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Decizii bazate pe reguli deterministe, date reale și trasabilitate completă
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Project selector filter */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Toate Șantierele Active</option>
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
            <span>Actualizează</span>
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
            Reîncearcă
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
                  <h3 className="font-bold text-sm text-slate-900">Proiecte Active</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.projects.activeProjects}
                </span>
              </div>

              {/* Stage breakdown */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Proiecte după Fază
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
                    'Proiecte Întârziate',
                    'PROJECTS',
                    'Data țintă de finalizare este depășită, iar proiectul nu este finalizat.',
                    overview.projects.overdueProjectsList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">Proiecte Întârziate:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.projects.overdueProjects}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Termene Limită Viitoare (14 zile)',
                    'PROJECTS',
                    'Proiecte a căror dată țintă se împlinește în următoarele 14 zile.',
                    overview.projects.upcomingDeadlinesList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">Termene Limită (≤14 zile):</span>
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
                  <h3 className="font-bold text-sm text-slate-900">Personal & Pontaj</h3>
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
                  <span className="text-slate-400 block text-[11px]">Programați Astăzi</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.workforce.scheduledToday}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Pontaj Valid (GPS)</span>
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
                    'Personal Lipsă la Pontaj',
                    'WORKFORCE',
                    'Muncitori alocați la șantiere care nu au efectuat pontajul de intrare astăzi.',
                    overview.workforce.missingList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">Lipsă / Neprezentare:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.workforce.missing}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Ore Suplimentare Înregistrate Astăzi',
                    'WORKFORCE',
                    'Muncitori cu ore suplimentare calculate automat conform orelor de pontaj.',
                    overview.workforce.overtimeList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-blue-50/50 hover:bg-blue-100/60 text-blue-900 transition-colors text-left"
              >
                <span className="font-medium">Ore Suplimentare:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-blue-200 text-blue-950 rounded">
                  {(overview.workforce.overtimeMinutes / 60).toFixed(1)} ore
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
                  <h3 className="font-bold text-sm text-slate-900">Producție & Execuție</h3>
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
                  <span>Realizat: {overview.production.actualToday} sarcini</span>
                  <span>Plan: {overview.production.plannedToday}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
              <button
                onClick={() =>
                  openDrilldown(
                    'Lucrări Blocate pe Șantier',
                    'PRODUCTION_BLOCKED',
                    'Sarcini marcate cu status BLOCKED din cauza dependențelor, lipsei de materiale sau problemelor din teren.',
                    overview.production.blockedTasksList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">Lucrări Blocate:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-600 text-white rounded">
                  {overview.production.blockedProduction} sarcini
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Sarcini Planificate Astăzi',
                    'PRODUCTION',
                    'Sarcini incluse în planificarea activă de execuție.',
                    overview.production.plannedTasksList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">Producție Planificată:</span>
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
                  <h3 className="font-bold text-sm text-slate-900">Materiale & Stocuri</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.materials.pendingDeliveries} avize
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Materiale Lipsă</span>
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
                    'Materiale cu Stoc Redus (< Prag Siguranță)',
                    'MATERIALS',
                    'Cantitatea din stoc este inferioară pragului minim de siguranță definit pentru material.',
                    overview.materials.lowStockList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">Stoc Redus (Deficit):</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 text-amber-950 rounded">
                  {overview.materials.lowStock} articole
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Livrări și Avize de Însoțire a Mărfii',
                    'MATERIALS',
                    'Livrări furnizori recepționate cu aviz de însoțire.',
                    overview.materials.pendingDeliveriesList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">Livrări în Așteptare:</span>
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
                  <h3 className="font-bold text-sm text-slate-900">Finanțe & Bugete</h3>
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
                  <span>Cost Actual:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.actual)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Cost Angajat:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatCurrency(overview.finance.committed)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Prognoză (Forecast):</span>
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
                    'Situație Financiară pe Proiecte',
                    'FINANCE',
                    'Comparație între bugetul aprobat, costul efectiv consumat și angajamentele contractuale.',
                    overview.finance.budgetByProject,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">Detalii Bugete Proiecte</span>
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
                  <h3 className="font-bold text-sm text-slate-900">Calitate & QA/QC</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.quality.openNCRs} NCR
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Inspecții Eșuate</span>
                  <strong className="text-rose-600 text-sm font-mono">
                    {overview.quality.failedInspections}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Corecții Active</span>
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
                    'Neconformități Deschise (Open NCRs)',
                    'QUALITY',
                    'Raport de neconformitate deschis în urma inspecțiilor din teren fără acțiune corectivă finalizată.',
                    overview.quality.openNCRsList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 transition-colors text-left"
              >
                <span className="font-medium">NCR-uri Deschise:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-rose-200 text-rose-900 rounded">
                  {overview.quality.openNCRs}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Inspecții Eșuate',
                    'QUALITY',
                    'Fișe de verificare în care cel puțin un parametru măsurat a fost sub nivelul admis.',
                    overview.quality.failedInspectionsList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">Inspecții Eșuate:</span>
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
                  <h3 className="font-bold text-sm text-slate-900">Documentație</h3>
                </div>
                <span className="text-xl font-black text-slate-900">
                  {overview.documentation.supersededDocuments} înlocuite
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Documente Lipsă</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {overview.documentation.missingDocuments}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">În Așteptare Aprobare</span>
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
                    'Documente Înlocuite (Versiuni Vechi în Șantier)',
                    'DOCUMENTATION',
                    'Documente la care există o versiune superioară aprobată, dar pe șantier figurează o versiune veche.',
                    overview.documentation.supersededDocumentsList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 transition-colors text-left"
              >
                <span className="font-medium">Documente Înlocuite:</span>
                <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 text-amber-950 rounded">
                  {overview.documentation.supersededDocuments}
                </span>
              </button>

              <button
                onClick={() =>
                  openDrilldown(
                    'Documente în Așteptarea Aprobării',
                    'DOCUMENTATION',
                    'Documente depuse pentru avizare tehnică.',
                    overview.documentation.awaitingApprovalList,
                  )
                }
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
              >
                <span className="font-medium">În Așteptare:</span>
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
              Module Operaționale de Șantier
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Accesează direct fluxurile de pontaj, recepție avize, cheltuieli și rapoarte de teren
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pontaj"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              Pontaj & Ore
            </Link>
            <Link
              href="/rapoarte"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              Rapoarte Zilnice
            </Link>
            <Link
              href="/avize"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              Avize & Recepție
            </Link>
            <Link
              href="/stocuri"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              Stocuri
            </Link>
            <Link
              href="/cheltuieli"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              Cheltuieli & OCR
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

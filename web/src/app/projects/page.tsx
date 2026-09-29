'use client';

import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  Project,
  CreateProjectDto,
  ProjectStatus,
  UserRole,
} from '../../features/projects/types';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_OPTIONS,
} from '../../features/projects/types';
import * as projectsApi from '../../features/projects/api';
import { useAuth } from '../../contexts/AuthContext';
import { canCreateProjects } from '@solar/shared';
import {
  Loader2, RefreshCw, Plus, Search, X, MapPin,
  ChevronRight, Check, AlertCircle, Building2,
  Globe, Calendar, DollarSign, Users,
  ArrowLeft, ArrowRight, Save,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import { useLocale } from '@solar/shared';

interface WizardStep {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'identity', title: 'Identitate', icon: <Building2 className="w-4 h-4" /> },
  { id: 'location', title: 'Amplasare', icon: <Globe className="w-4 h-4" /> },
  { id: 'technical', title: 'Date Tehnice', icon: <MapPin className="w-4 h-4" /> },
  { id: 'dates', title: 'Date Calendar', icon: <Calendar className="w-4 h-4" /> },
  { id: 'budget', title: 'Buget', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'members', title: 'Membri', icon: <Users className="w-4 h-4" /> },
  { id: 'review', title: 'Confirmare', icon: <Check className="w-4 h-4" /> },
];

function ProjectsPageInner() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { locale } = useLocale();
  const canCreate = user ? canCreateProjects(user.role as any) : false;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', address: '', latitude: '', longitude: '',
    geofenceRadiusMeters: '300', installedCapacityMwp: '', budgetTotal: '',
    currency: 'RON', startDate: '', targetEndDate: '', clientId: '',
  });
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; role: UserRole }[]>([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<UserRole>('WORKER');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.getProjects();
      setProjects(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la incarcarea proiectelor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const statusOptions = PROJECT_STATUS_OPTIONS;

  const tStatus = (status: string) => {
    const key = status as ProjectStatus;
    return locale === 'en'
      ? (PROJECT_STATUS_LABELS_EN[key] || status)
      : (PROJECT_STATUS_LABELS[key] || status);
  };

  const filtered = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }
    return list;
  }, [projects, search, statusFilter]);

  const openWizard = () => {
    setForm({ name: '', code: '', address: '', latitude: '', longitude: '',
      geofenceRadiusMeters: '300', installedCapacityMwp: '', budgetTotal: '',
      currency: 'RON', startDate: '', targetEndDate: '', clientId: '' });
    setSelectedMembers([]);
    setMemberUserId('');
    setMemberRole('WORKER');
    setWizardStep(0);
    setWizardError(null);
    setWizardOpen(true);
  };

  const updateForm = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const validateStep = (step: number): boolean => {
    setWizardError(null);
    if (step === 0) {
      if (!form.name.trim()) {
        setWizardError(locale === 'en' ? 'Project name is required' : 'Numele proiectului este obligatoriu');
        return false;
      }
      if (!form.code.trim()) {
        setWizardError(locale === 'en' ? 'Project code is required' : 'Codul proiectului este obligatoriu');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(wizardStep)) setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };
  const prevStep = () => setWizardStep(s => Math.max(s - 1, 0));

  const handleCreate = async () => {
    if (!validateStep(wizardStep)) return;
    setWizardSaving(true);
    setWizardError(null);
    try {
      const dto: CreateProjectDto = {
        organizationId: user?.organizationId || '',
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        geofenceRadiusMeters: form.geofenceRadiusMeters ? parseInt(form.geofenceRadiusMeters, 10) : undefined,
        installedCapacityMwp: form.installedCapacityMwp ? parseFloat(form.installedCapacityMwp) : undefined,
        budgetTotal: form.budgetTotal ? parseFloat(form.budgetTotal) : undefined,
        currency: form.currency || 'RON',
        startDate: form.startDate || undefined,
        targetEndDate: form.targetEndDate || undefined,
        clientId: form.clientId || undefined,
      };

      const res = await projectsApi.createProject(dto);
      const newProject = res.data;

      if (selectedMembers.length > 0 && newProject?.id) {
        await Promise.allSettled(
          selectedMembers.map(m =>
            projectsApi.addProjectMember(newProject.id, { userId: m.userId, role: m.role })
          )
        );
      }

      success(locale === 'en' ? 'Project created successfully' : 'Proiect creat cu succes');
      setWizardOpen(false);
      loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la crearea proiectului';
      setWizardError(msg);
    } finally {
      setWizardSaving(false);
    }
  };

  const addMemberToSelection = () => {
    if (!memberUserId) return;
    setSelectedMembers(prev => [...prev, { userId: memberUserId, role: memberRole }]);
    setMemberUserId('');
  };

  const removeMemberFromSelection = (userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.userId !== userId));
  };

  const renderWizardStep = () => {
    const step = WIZARD_STEPS[wizardStep];
    if (!step) return null;

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white";
    const labelCls = "block text-sm font-medium text-slate-700 mb-1";

    switch (step.id) {
      case 'identity':
        return (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Project Name *' : 'Nume Proiect *'}</label>
              <input className={inputCls} placeholder={locale === 'en' ? 'e.g. Solar Park Bihor' : 'ex. Parc Fotovoltaic Bihor'} value={form.name} onChange={e => updateForm('name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Project Code *' : 'Cod Proiect *'}</label>
              <input className={inputCls} placeholder="SP-BIHOR-001" value={form.code} onChange={e => updateForm('code', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Client ID' : 'ID Client'}</label>
              <input className={inputCls} placeholder={locale === 'en' ? 'Client catalog not available' : 'Catalog clienti indisponibil'} value={form.clientId} onChange={e => updateForm('clientId', e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">{locale === 'en' ? '(Backend gap: no client catalog endpoint)' : '(Gap backend: endpoint catalog clienti indisponibil)'}</p>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Address' : 'Adresa'}</label>
              <input className={inputCls} placeholder={locale === 'en' ? 'Project address' : 'Adresa proiectului'} value={form.address} onChange={e => updateForm('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Latitude' : 'Latitudine'}</label>
                <input className={inputCls} type="number" step="any" placeholder="46.123" value={form.latitude} onChange={e => updateForm('latitude', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Longitude' : 'Longitudine'}</label>
                <input className={inputCls} type="number" step="any" placeholder="23.456" value={form.longitude} onChange={e => updateForm('longitude', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Geofence Radius (m)' : 'Raza Geofence (m)'}</label>
              <input className={inputCls} type="number" placeholder="300" value={form.geofenceRadiusMeters} onChange={e => updateForm('geofenceRadiusMeters', e.target.value)} />
            </div>
          </div>
        );

      case 'technical':
        return (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{locale === 'en' ? 'Installed Capacity (MWp)' : 'Capacitate Instalata (MWp)'}</label>
              <input className={inputCls} type="number" step="any" placeholder="5.0" value={form.installedCapacityMwp} onChange={e => updateForm('installedCapacityMwp', e.target.value)} />
            </div>
          </div>
        );

      case 'dates':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Start Date' : 'Data Inceput'}</label>
                <input className={inputCls} type="date" value={form.startDate} onChange={e => updateForm('startDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Target End Date' : 'Data Tinta Finalizare'}</label>
                <input className={inputCls} type="date" value={form.targetEndDate} onChange={e => updateForm('targetEndDate', e.target.value)} />
              </div>
            </div>
          </div>
        );

      case 'budget':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Total Budget' : 'Buget Total'}</label>
                <input className={inputCls} type="number" step="0.01" placeholder="1000000" value={form.budgetTotal} onChange={e => updateForm('budgetTotal', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{locale === 'en' ? 'Currency' : 'Moneda'}</label>
                <select className={inputCls} value={form.currency} onChange={e => updateForm('currency', e.target.value)}>
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'members':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {locale === 'en'
                ? 'Add initial project members. Note: user directory limited to ADMIN/MANAGER/PM (G10).'
                : 'Adauga membri initiali. Nota: directorul utilizatorilor limitat la ADMIN/MANAGER/PM (G10).'}
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={labelCls}>{locale === 'en' ? 'User ID' : 'ID Utilizator'}</label>
                <input className={inputCls} placeholder="user-uuid" value={memberUserId} onChange={e => setMemberUserId(e.target.value)} />
              </div>
              <div className="w-40">
                <label className={labelCls}>{locale === 'en' ? 'Role' : 'Rol'}</label>
                <select className={inputCls} value={memberRole} onChange={e => setMemberRole(e.target.value as UserRole)}>
                  <option value="WORKER">Worker</option>
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="FOREMAN">Foreman</option>
                  <option value="SITE_MANAGER">Site Manager</option>
                  <option value="PM">PM</option>
                  <option value="MANAGER">Manager</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <Button variant="outline" size="sm" onClick={addMemberToSelection} disabled={!memberUserId}>
                {locale === 'en' ? 'Add' : 'Adauga'}
              </Button>
            </div>
            {selectedMembers.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {selectedMembers.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-slate-700">{m.userId}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{m.role}</Badge>
                      <button onClick={() => removeMemberFromSelection(m.userId)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedMembers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                {locale === 'en' ? 'No members added. Creator auto-added as PM.' : 'Niciun membru adaugat. Creatorul adaugat automat ca PM.'}
              </p>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Name' : 'Nume'}</span><span className="font-medium">{form.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Code' : 'Cod'}</span><span className="font-medium">{form.code}</span></div>
              {form.address && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Address' : 'Adresa'}</span><span className="font-medium">{form.address}</span></div>}
              {form.budgetTotal && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Budget' : 'Buget'}</span><span className="font-medium">{parseFloat(form.budgetTotal).toLocaleString()} {form.currency}</span></div>}
              {form.startDate && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Start' : 'Inceput'}</span><span className="font-medium">{form.startDate}</span></div>}
              {selectedMembers.length > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Members' : 'Membri'}</span><span className="font-medium">{selectedMembers.length}</span></div>
              )}
            </div>
            {wizardError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{wizardError}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={loadProjects} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title={locale === 'en' ? 'Projects' : 'Proiecte'}
        subtitle={locale === 'en' ? 'Manage your construction projects' : 'Gestioneaza proiectele de constructie'}
        actions={
          canCreate && (
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openWizard}>
              {locale === 'en' ? 'New Project' : 'Proiect Nou'}
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white"
            placeholder={locale === 'en' ? 'Search projects...' : 'Cauta proiecte...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">{locale === 'en' ? 'All Statuses' : 'Toate Starile'}</option>
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{locale === 'en' ? opt.labelEn : opt.labelRo}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadProjects}>
          {locale === 'en' ? 'Refresh' : 'Reimprospateaza'}
        </Button>
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-12 h-12 text-slate-300" />}
          title={locale === 'en' ? 'No projects found' : 'Niciun proiect gasit'}
          description={
            search || statusFilter
              ? (locale === 'en' ? 'Try different search terms' : 'Incearca alti termeni de cautare')
              : (locale === 'en' ? 'Create your first project to get started' : 'Creeaza primul proiect pentru a incepe')
          }
          action={(!search && !statusFilter && canCreate) ? (
            <Button variant="primary" size="sm" onClick={openWizard}>
              {locale === 'en' ? 'New Project' : 'Proiect Nou'}
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{project.code}</p>
                    </div>
                    <Badge className={PROJECT_STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}>
                      {tStatus(project.status)}
                    </Badge>
                  </div>
                  {project.address && (
                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{project.address}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {project.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {project.start_date.split('T')[0]}
                      </span>
                    )}
                    {project.budget_total != null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {Number(project.budget_total).toLocaleString()} {project.currency}
                      </span>
                    )}
                    {project.members && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {project.members.length}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !wizardSaving && setWizardOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Wizard Header */}
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-900">
                  {locale === 'en' ? 'Create New Project' : 'Creaza Proiect Nou'}
                </h2>
                <button onClick={() => !wizardSaving && setWizardOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-1">
                {WIZARD_STEPS.map((s, i) => (
                  <div key={s.id} className={`flex-1 h-1.5 rounded-full ${i <= wizardStep ? 'bg-hii-500' : 'bg-slate-200'}`} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium text-hii-600">
                  {locale === 'en' ? 'Step' : 'Pasul'} {wizardStep + 1} / {WIZARD_STEPS.length}
                </span>
                <span className="text-xs text-slate-400">{WIZARD_STEPS[wizardStep]?.title}</span>
              </div>
            </div>

            <div className="px-6 py-5">
              {renderWizardStep()}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                {wizardStep > 0 && (
                  <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={prevStep} disabled={wizardSaving}>
                    {locale === 'en' ? 'Back' : 'Inapoi'}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {wizardError && <span className="text-xs text-red-500">{wizardError}</span>}
                {wizardStep < WIZARD_STEPS.length - 1 ? (
                  <Button variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4" />} onClick={nextStep} disabled={wizardSaving}>
                    {locale === 'en' ? 'Next' : 'Urmatorul'}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" icon={<Save className="w-4 h-4" />} onClick={handleCreate} loading={wizardSaving} disabled={wizardSaving}>
                    {wizardSaving
                      ? (locale === 'en' ? 'Creating...' : 'Se creeaza...')
                      : (locale === 'en' ? 'Create Project' : 'Creaza Proiect')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/projects']}>
      <ProjectsPageInner />
    </RoleGuard>
  );
}

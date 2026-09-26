'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import React, { useState, useEffect, useMemo } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { MapPin, Loader2, RefreshCw, Plus, Search, X, ChevronDown, ChevronUp, Pencil, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { canCreateProjects } from '@solar/shared';

// ── Types ──────────────────────────────────────────────
interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  user?: { id: string; email: string; profile?: { full_name?: string } };
}
interface Project {
  id: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  capacity_mwp?: number;
  budget?: number;
  currency?: string;
  status?: string;
  phase?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  manager_id?: string;
  members?: ProjectMember[];
  created_at: string;
}

const STATUS_OPTIONS = ['', 'active', 'inactive', 'completed', 'on_hold', 'cancelled'] as const;
const PHASE_OPTIONS = ['', 'planning', 'design', 'construction', 'commissioning', 'operations', 'closed'] as const;

const STATUS_LABELS: Record<string, string> = {
  active: 'Activ', inactive: 'Inactiv', completed: 'Finalizat',
  on_hold: 'In pauza', cancelled: 'Anulat',
};
const PHASE_LABELS: Record<string, string> = {
  planning: 'Planificare', design: 'Proiectare', construction: 'Constructie',
  commissioning: 'Punere in functiune', operations: 'Operare', closed: 'Inchis',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ── Modal Component ────────────────────────────────────
function ProjectModal({
  open, project, onClose, onSaved,
}: {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    name: '', code: '', address: '', latitude: '', longitude: '',
    geofence_radius_meters: '', capacity_mwp: '', budget: '', currency: 'RON',
    start_date: '', end_date: '', status: 'active', phase: 'planning', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (project) {
        setForm({
          name: project.name || '',
          code: project.code || '',
          address: project.address || '',
          latitude: project.latitude?.toString() || '',
          longitude: project.longitude?.toString() || '',
          geofence_radius_meters: project.geofence_radius_meters?.toString() || '',
          capacity_mwp: project.capacity_mwp?.toString() || '',
          budget: project.budget?.toString() || '',
          currency: project.currency || 'RON',
          start_date: project.start_date ? project.start_date.slice(0, 10) : '',
          end_date: project.end_date ? project.end_date.slice(0, 10) : '',
          status: project.status || 'active',
          phase: project.phase || 'planning',
          is_active: project.is_active !== false,
        });
      } else {
        setForm({ name: '', code: '', address: '', latitude: '', longitude: '', geofence_radius_meters: '', capacity_mwp: '', budget: '', currency: 'RON', start_date: '', end_date: '', status: 'active', phase: 'planning', is_active: true });
      }
      setError(null);
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        code: form.code,
        address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        geofence_radius_meters: form.geofence_radius_meters ? parseInt(form.geofence_radius_meters) : undefined,
        capacity_mwp: form.capacity_mwp ? parseFloat(form.capacity_mwp) : undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        currency: form.currency,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        status: form.status,
        phase: form.phase,
        is_active: form.is_active,
      };
      if (isEdit) {
        await apiClient.updateProject(project!.id, payload);
      } else {
        await apiClient.createProject(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la salvarea proiectului');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Editeaza Proiect' : 'Proiect Nou'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Nume proiect *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Cod proiect *</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Adresa</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Latitudine</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Longitudine</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Raza geofence (m)</label>
              <input type="number" value={form.geofence_radius_meters} onChange={(e) => setForm({ ...form, geofence_radius_meters: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Capacitate (MWp)</label>
              <input type="number" step="any" value={form.capacity_mwp} onChange={(e) => setForm({ ...form, capacity_mwp: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Buget total</label>
              <input type="number" step="any" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                <option value="RON">RON</option><option value="EUR">EUR</option><option value="USD">USD</option>
              </select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Data inceput</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Data tinta finalizare</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Stare</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Faza</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                {PHASE_OPTIONS.filter(Boolean).map((p) => <option key={p} value={p}>{PHASE_LABELS[p] || p}</option>)}
              </select></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
            <label htmlFor="is_active" className="text-sm text-slate-700">Proiect activ</label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold rounded-lg disabled:opacity-50">
              {saving ? 'Se salveaza...' : isEdit ? 'Actualizeaza' : 'Creaza Proiect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────
function ProjectsPageInner() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [sortField, setSortField] = useState<string>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const canCreate = user ? canCreateProjects(user.role as any) : false;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getProjects();
      setProjects((response.data || []) as Project[]);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la incarcarea proiectelor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    if (phaseFilter) list = list.filter((p) => p.phase === phaseFilter);
    list.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [projects, search, statusFilter, phaseFilter, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-500" /> : <ChevronDown className="w-3 h-3 text-amber-500" />;
  };

  const openCreate = () => { setEditProject(null); setModalOpen(true); };
  const openEdit = (p: Project) => { setEditProject(p); setModalOpen(true); };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="projects" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proiecte</h1>
          <p className="text-sm text-slate-500 mt-1">Gestioneaza proiectele companiei</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Reimprospateaza
          </button>
          {canCreate && (
            <button onClick={openCreate}
              className="inline-flex items-center px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Proiect Nou
            </button>
          )}
        </div>
      </div>
      {/* Error */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cauta proiect..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
          <option value="">Toate starile</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
          <option value="">Toate fazele</option>
          {PHASE_OPTIONS.filter(Boolean).map((p) => <option key={p} value={p}>{PHASE_LABELS[p] || p}</option>)}
        </select>
        {(search || statusFilter || phaseFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPhaseFilter(''); }}
            className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">
            <X className="w-3.5 h-3.5 inline mr-1" />Sterge filtrele
          </button>
        )}
      </div>
      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca proiectele...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Niciun proiect gasit</h3>
          <p className="text-xs text-slate-400 mt-1">Creeaza un proiect nou pentru a incepe.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('code')}>
                    <span className="flex items-center gap-1">Cod <SortIcon field="code" /></span>
                  </th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">Nume <SortIcon field="name" /></span>
                  </th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="flex items-center gap-1">Stare <SortIcon field="status" /></span>
                  </th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('phase')}>
                    <span className="flex items-center gap-1">Faza <SortIcon field="phase" /></span>
                  </th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('start_date')}>
                    <span className="flex items-center gap-1">Data inceput <SortIcon field="start_date" /></span>
                  </th>
                  <th className="py-3 px-4 text-right">Actiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                        {p.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <Link href={`/projects/${p.id}`} className="hover:text-amber-600">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status || ''] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[p.status || ''] || p.status || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{PHASE_LABELS[p.phase || ''] || p.phase || '-'}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString('ro-RO') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/projects/${p.id}`}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        {canCreate && (
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal */}
      <ProjectModal open={modalOpen} project={editProject} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm']}>
      <ProjectsPageInner />
    </RoleGuard>
  );
}
'use client';

import { PageTutorial } from '../../../components/PageTutorial';
import { RoleGuard } from '../../../lib/auth-guard';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '../../../lib/api-client';
import {
  Loader2, ArrowLeft, RefreshCw, Users, UserPlus, X, Trash2,
  Activity, Building2, Calendar, DollarSign, Sliders,
  Check, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { canCreateProjects } from '@solar/shared';
import { displayName, formatDate, formatDecimal } from '../../../lib/formatters';

interface ProjectMember {
  id: string; project_id: string; user_id: string; role: string;
  user?: { id: string; email: string; role: string; fullName?: string; profile?: { full_name?: string } };
}

interface AppUser {
  id: string; email: string; role: string; is_active: boolean;
  profile?: { full_name?: string; phone?: string };
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Planificare', ENGINEERING: 'Inginerie', PROCUREMENT: 'Achizitii',
  CONSTRUCTION: 'Constructie', TESTING: 'Testare', COMMISSIONING: 'Punere in functiune',
  HANDOVER: 'Predare', COMPLETED: 'Finalizat', ON_HOLD: 'In pauza', CANCELLED: 'Anulat',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-blue-100 text-blue-800', ENGINEERING: 'bg-purple-100 text-purple-800',
  PROCUREMENT: 'bg-amber-100 text-amber-800', CONSTRUCTION: 'bg-emerald-100 text-emerald-800',
  TESTING: 'bg-cyan-100 text-cyan-800', COMMISSIONING: 'bg-teal-100 text-teal-800',
  HANDOVER: 'bg-indigo-100 text-indigo-800', COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800', CANCELLED: 'bg-red-100 text-red-800',
};

const MEMBER_ROLES = ['ADMIN','MANAGER','PM','WORKER','VIEWER','TEAM_LEADER','SITE_MANAGER','TECHNICIAN','PROCUREMENT','FINANCE','QA_QC','FOREMAN','SITE_LOGISTICS','MAINTENANCE_DIRECTOR','TECHNICAL_DIRECTOR'] as const;
const MEMBER_ROLE_LABELS: Record<string, string> = {
  ADMIN:'Admin', MANAGER:'Manager', PM:'Project Manager', WORKER:'Muncitor',
  VIEWER:'Vizualizare', TEAM_LEADER:'Sef Echipa', SITE_MANAGER:'Sef Santier',
  TECHNICIAN:'Tehnician', PROCUREMENT:'Achizitii', FINANCE:'Finante',
  QA_QC:'QA/QC', FOREMAN:'Maistru', SITE_LOGISTICS:'Logistica Santier',
  MAINTENANCE_DIRECTOR:'Director Intretinere', TECHNICAL_DIRECTOR:'Director Tehnic',
};

type TabKey = 'overview' | 'members' | 'teams' | 'activity';

function ProjectDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('WORKER');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const canManage = user ? canCreateProjects(user.role as any) : false;

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const loadProject = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await apiClient.getProject(id); setProject(r.data as any); }
    catch (err) { if (err instanceof ApiError) setError(err.message); else setError('Eroare la incarcarea proiectului'); }
    finally { setLoading(false); }
  }, [id]);

  const loadMembers = useCallback(async () => {
    try { const r = await apiClient.getProjectMembers(id); setMembers((r.data || []) as ProjectMember[]); } catch {}
  }, [id]);

  const loadUsers = useCallback(async () => {
    try { const r = await apiClient.getUsers(); setUsers((r.data || []) as AppUser[]); } catch {}
  }, []);

  useEffect(() => { loadProject(); loadMembers(); loadUsers(); }, [loadProject, loadMembers, loadUsers]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAddingMember(true); setMemberError(null);
    try {
      await apiClient.addProjectMember(id, selectedUserId, selectedRole);
      setSelectedUserId(''); setSelectedRole('WORKER'); setShowAddMember(false);
      showSuccess('Membru adaugat cu succes'); await loadMembers();
    } catch (err) {
      if (err instanceof ApiError) setMemberError(err.message);
      else setMemberError('Eroare la adaugarea membrului');
    } finally { setAddingMember(false); }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try { await apiClient.updateProjectMemberRole(id, userId, newRole); showSuccess('Rol actualizat'); await loadMembers(); }
    catch (err) { if (err instanceof ApiError) setMemberError(err.message); }
  };

  const handleRemoveMember = async (userId: string) => {
    try { await apiClient.removeProjectMember(id, userId); setConfirmRemove(null); showSuccess('Membru eliminat'); await loadMembers(); }
    catch (err) { if (err instanceof ApiError) setMemberError(err.message); }
  };


  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-hii-500 mr-3" />
        <span className="text-slate-500">Se incarca proiectul...</span>
      </div>
    );
  }

  // Error state
  if (error && !project) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Proiect</h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600 mb-2">Eroare la incarcare</h3>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button onClick={loadProject} className="px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-semibold rounded-lg">
            <RefreshCw className="w-4 h-4 inline mr-1" />Reincarca
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const projectName = project.name || 'Fara nume';
  const projectCode = project.code || '—';
  const address = project.address || '—';
  const lat = project.latitude ? Number(project.latitude) : null;
  const lng = project.longitude ? Number(project.longitude) : null;
  const status = project.status || 'PLANNING';
  const isActive = project.is_active !== false;
  const availableUsers = users.filter(
    (u) => u.is_active !== false && !members.some((m) => m.user_id === u.id)
  );


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="project-detail" />
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />{successMsg}
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/projects')} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{projectCode}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>
                {STATUS_LABELS[status] || status}
              </span>
              {!isActive && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">Inactiv</span>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{projectName}</h1>
            {address && <p className="text-sm text-slate-500 mt-0.5">{address}</p>}
          </div>
        </div>
        <button onClick={() => { loadProject(); loadMembers(); }} className="p-2 hover:bg-slate-100 rounded-lg" title="Reimprospateaza">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
        {(['overview', 'members', 'teams', 'activity'] as TabKey[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${tab === t ? 'bg-hii-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t === 'overview' && 'Prezentare Generala'}
            {t === 'members' && 'Membri'}
            {t === 'teams' && 'Echipe'}
            {t === 'activity' && 'Activitate'}
          </button>
        ))}
      </div>


      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-hii-500" />Informatii Generale
            </h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500 block">Denumire</label><p className="text-sm font-medium text-slate-900">{projectName}</p></div>
              <div><label className="text-xs text-slate-500 block">Cod</label><p className="text-sm font-mono text-slate-900">{projectCode}</p></div>
              <div><label className="text-xs text-slate-500 block">Adresa</label><p className="text-sm text-slate-900">{address}</p></div>
              {lat && lng && <div><label className="text-xs text-slate-500 block">Coordonate</label><p className="text-sm text-slate-900">{lat.toFixed(6)}, {lng.toFixed(6)}</p></div>}
              <div><label className="text-xs text-slate-500 block">Raza Geofence</label><p className="text-sm text-slate-900">{project.geofence_radius_meters || 300} m</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-hii-500" />Detalii Proiect
            </h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500 block">Data Inceput</label><p className="text-sm text-slate-900"><Calendar className="w-3.5 h-3.5 inline text-slate-400 mr-1" />{formatDate(project.start_date)}</p></div>
              <div><label className="text-xs text-slate-500 block">Data Finalizare Tinta</label><p className="text-sm text-slate-900"><Calendar className="w-3.5 h-3.5 inline text-slate-400 mr-1" />{formatDate(project.target_end_date)}</p></div>
              <div><label className="text-xs text-slate-500 block">Buget</label><p className="text-sm text-slate-900"><DollarSign className="w-3.5 h-3.5 inline text-slate-400 mr-1" />{formatDecimal(project.budget_total)} {project.currency || 'RON'}</p></div>
              <div><label className="text-xs text-slate-500 block">Capacitate instalata</label><p className="text-sm text-slate-900">{project.installed_capacity_mwp ? `${formatDecimal(project.installed_capacity_mwp, 3)} MWp` : '—'}</p></div>
              <div><label className="text-xs text-slate-500 block">Status</label><span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>{STATUS_LABELS[status] || status}</span></div>
              <div><label className="text-xs text-slate-500 block">Activ</label><span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{isActive ? 'Da' : 'Nu'}</span></div>
            </div>
          </div>
          {project.client && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-hii-500" />Client
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="text-xs text-slate-500 block">Nume</label><p className="text-sm font-medium text-slate-900">{project.client.name}</p></div>
                {project.client.cui && <div><label className="text-xs text-slate-500 block">CUI</label><p className="text-sm text-slate-900">{project.client.cui}</p></div>}
                {project.client.contact_person && <div><label className="text-xs text-slate-500 block">Persoana Contact</label><p className="text-sm text-slate-900">{project.client.contact_person}</p></div>}
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Membri Proiect</h3>
            {canManage && (
              <button onClick={() => setShowAddMember(true)}
                className="inline-flex items-center px-3 py-1.5 bg-hii-500 hover:bg-hii-600 text-white font-bold text-xs rounded-lg transition-colors">
                <UserPlus className="w-3.5 h-3.5 mr-1" />Adauga Membru
              </button>
            )}
          </div>
          {memberError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{memberError}</div>}
          {showAddMember && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Adauga Membru Nou</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Selecteaza utilizator</option>
                  {availableUsers.map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
                </select>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  {MEMBER_ROLES.map((r) => <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleAddMember} disabled={!selectedUserId || addingMember}
                    className="flex-1 px-3 py-2 bg-hii-500 hover:bg-hii-600 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                    {addingMember ? 'Se adauga...' : 'Adauga'}
                  </button>
                  <button onClick={() => setShowAddMember(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}
          {members.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Niciun membru in acest proiect</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m) => {
                const memberName = displayName(m.user);
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-hii-100 flex items-center justify-center text-xs font-bold text-hii-700">
                        {memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{memberName}</div>
                        <div className="text-xs text-slate-500">{m.user?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <select value={m.role} onChange={(e) => handleUpdateRole(m.user_id, e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">{MEMBER_ROLE_LABELS[m.role] || m.role}</span>
                      )}
                      {canManage && (
                        <>
                          {confirmRemove === m.user_id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleRemoveMember(m.user_id)} className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setConfirmRemove(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmRemove(m.user_id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Elimina membru">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {tab === 'teams' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Echipe</h3>
          <p className="text-xs text-slate-400 mt-1">Disponibil in modulul urmator</p>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Activitate</h3>
          <p className="text-xs text-slate-400 mt-1">Disponibil in modulul urmator</p>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm']}>
      <ProjectDetailPageInner />
    </RoleGuard>
  );
}
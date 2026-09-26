'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Loader2, RefreshCw, Search, X, Plus, Check,
  AlertTriangle, User, ArrowLeft, ChevronRight, UserPlus,
  Edit3, Trash2, Save
} from 'lucide-react';
import { displayName, formatDate } from '../../lib/formatters';

interface TeamMember {
  id: string; team_id: string; user_id: string;
  user?: { id: string; email: string; role: string; profile?: { full_name?: string } };
}

interface Team {
  id: string; name: string; code: string;
  leader_id?: string; project_id?: string;
  is_active: boolean; created_at: string;
  members?: TeamMember[];
}

interface AppUser {
  id: string; email: string; role: string; is_active: boolean;
  profile?: { full_name?: string; phone?: string };
}

function TeamsPageInner() {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'worker';
  const canManageTeam = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman'].includes(userRole);
  const canManageMembers = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader'].includes(userRole);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLeaderId, setFormLeaderId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editLeaderId, setEditLeaderId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{teamId: string; userId: string; name: string} | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await apiClient.getTeams(); setTeams((r.data || []) as Team[]); }
    catch (err) { if (err instanceof ApiError) setError(err.message); else setError('Eroare la incarcarea echipelor'); }
    finally { setLoading(false); }
  };
  const loadUsers = async () => {
    try { const r = await apiClient.getUsers(); setUsers((r.data || []) as AppUser[]); } catch {}
  };
  useEffect(() => { load(); loadUsers(); }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !formCode.trim()) { setFormError('Numele si codul sunt obligatorii'); return; }
    setSaving(true); setFormError(null);
    try {
      await apiClient.createTeam({ name: formName.trim(), code: formCode.trim(), leaderId: formLeaderId || undefined });
      setFormName(''); setFormCode(''); setFormLeaderId(''); setShowCreate(false);
      showSuccess('Echipa creata cu succes'); await load();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('Eroare la crearea echipei');
    } finally { setSaving(false); }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addMemberUserId) return;
    setAddingMember(true);
    try {
      await apiClient.addTeamMember(teamId, addMemberUserId);
      setAddMemberUserId(''); showSuccess('Membru adaugat'); await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setAddingMember(false); }
  };

  const openEdit = (t: Team) => {
    setEditName(t.name);
    setEditCode(t.code);
    setEditLeaderId(t.leader_id || '');
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!selectedTeam) return;
    if (!editName.trim() || !editCode.trim()) { setError('Numele si codul sunt obligatorii'); return; }
    setEditSaving(true);
    try {
      await apiClient.updateTeam(selectedTeam.id, {
        name: editName.trim(),
        code: editCode.trim(),
        leaderId: editLeaderId || undefined,
      });
      setShowEdit(false);
      showSuccess('Echipa actualizata');
      await load();
      // Re-select the team to refresh detail view
      const updated = teams.find(t => t.id === selectedTeam.id);
      if (updated) setSelectedTeam(updated);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la actualizare');
    } finally { setEditSaving(false); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setDeleting(true);
    try {
      await apiClient.deleteTeam(teamId);
      setConfirmDelete(null);
      setSelectedTeam(null);
      showSuccess('Echipa arhivata');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la arhivare');
    } finally { setDeleting(false); }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      await apiClient.removeTeamMember(teamId, userId);
      setConfirmRemoveMember(null);
      showSuccess('Membru eliminat');
      await load();
      const updated = teams.find(t => t.id === teamId);
      if (updated) setSelectedTeam(updated);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la eliminare');
    }
  };

  // Detail view
  if (selectedTeam) {
    const t = selectedTeam;
    const leader = t.members?.find((m) => m.user_id === t.leader_id);
    const availableUsers = users.filter(
      (u) => u.is_active !== false && !t.members?.some((m) => m.user_id === u.id)
    );

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{t.code}</span>
              {!t.is_active && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">Inactiv</span>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{t.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {t.is_active && canManageTeam && (
              <>
                <button onClick={() => openEdit(t)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-hii-600 transition-colors"
                  title="Editeaza echipa">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDelete(t.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                  title="Arhiveaza echipa">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Informatii Echipa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 block">Nume</label><p className="text-sm font-medium text-slate-900">{t.name}</p></div>
            <div><label className="text-xs text-slate-500 block">Cod</label><p className="text-sm font-mono text-slate-900">{t.code}</p></div>
            <div><label className="text-xs text-slate-500 block">Lider</label><p className="text-sm text-slate-900">{leader ? displayName(leader.user) : '—'}</p></div>
            <div><label className="text-xs text-slate-500 block">Data crearii</label><p className="text-sm text-slate-900">{formatDate(t.created_at)}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Membri ({t.members?.length || 0})</h3>
            {canManageMembers && availableUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Selecteaza...</option>
                  {availableUsers.map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
                </select>
                <button onClick={() => handleAddMember(t.id)} disabled={!addMemberUserId || addingMember}
                  className="px-3 py-1.5 bg-hii-500 hover:bg-hii-600 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                  <UserPlus className="w-3.5 h-3.5 inline mr-1" />Adauga
                </button>
              </div>
            )}
          </div>

          {t.members && t.members.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {t.members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-hii-100 flex items-center justify-center text-xs font-bold text-hii-700">
                      {displayName(m.user).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {displayName(m.user)}
                        {m.user_id === t.leader_id && <span className="ml-2 px-1.5 py-0.5 bg-hii-100 text-hii-700 rounded text-[10px] font-bold">LIDER</span>}
                      </p>
                      <p className="text-xs text-slate-500">{m.user?.email}</p>
                    </div>
                  </div>
                  {t.is_active && m.user_id !== t.leader_id && (
                    <button onClick={() => setConfirmRemoveMember({ teamId: t.id, userId: m.user_id, name: displayName(m.user) })}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                      title="Elimina membru">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Niciun membru in aceasta echipa</p>
          )}
        </div>
      </div>
    );
  }


  const filteredTeams = teams.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });


  // List view
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="teams" />

      {/* Edit Team Modal */}
      {showEdit && selectedTeam && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Editeaza Echipa</h3>
              <button onClick={() => setShowEdit(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Nume *</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Cod *</label>
                <input value={editCode} onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Lider (optional)</label>
                <select value={editLeaderId} onChange={(e) => setEditLeaderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Fara lider</option>
                  {users.filter(u => u.is_active !== false).map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={handleEditSave} disabled={editSaving || !editName.trim() || !editCode.trim()}
                className="px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {editSaving ? 'Se salveaza...' : <><Save className="w-4 h-4 inline mr-1" />Salveaza</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Team */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Arhiveaza echipa</h3>
                <p className="text-sm text-slate-500">Aceasta actiune va marca echipa ca inactiva. Membrii nu vor fi afectati.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={() => handleDeleteTeam(confirmDelete)} disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {deleting ? 'Se arhiveaza...' : 'Arhiveaza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Member */}
      {confirmRemoveMember && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Elimina membru</h3>
                <p className="text-sm text-slate-500">Elimini pe <strong>{confirmRemoveMember.name}</strong> din echipa?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmRemoveMember(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={() => handleRemoveMember(confirmRemoveMember.teamId, confirmRemoveMember.userId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />{successMsg}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-hii-500" />Echipe
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestionarea echipelor de lucru</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageTeam && (
            <button onClick={() => { setShowCreate(true); setFormError(null); }}
              className="inline-flex items-center px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg transition-colors">
              <Plus className="w-4 h-4 mr-1.5" />Echipa Noua
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Echipa Noua</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Nume *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Cod *</label>
                <input value={formCode} onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Lider (optional)</label>
                <select value={formLeaderId} onChange={(e) => setFormLeaderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Fara lider</option>
                  {users.filter(u => u.is_active !== false).map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={handleCreate} disabled={saving || !formName.trim() || !formCode.trim()}
                className="px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {saving ? 'Se salveaza...' : 'Creeaza Echipa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Cauta echipe..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca...</div>
      ) : filteredTeams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">{search ? 'Niciun rezultat' : 'Nicio echipa'}</h3>
          {search && <p className="text-sm text-slate-400 mt-1">Incearca alt termen de cautare</p>}
          {!search && canManageTeam && <button onClick={() => { setShowCreate(true); setFormError(null); }}
            className="mt-4 px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg"><Plus className="w-4 h-4 inline mr-1" />Creeaza prima echipa</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((t) => {
            const leader = t.members?.find((m) => m.user_id === t.leader_id);
            return (
              <div key={t.id} onClick={() => setSelectedTeam(t)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-hii-300 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs font-mono text-slate-400">{t.code}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <User className="w-3.5 h-3.5" /><span>{leader ? displayName(leader.user) : 'Fara lider'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <Users className="w-3.5 h-3.5" /><span>{t.members?.length || 0} membri</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader']}>
      <TeamsPageInner />
    </RoleGuard>
  );
}

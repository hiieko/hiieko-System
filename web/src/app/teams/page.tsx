'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  Users, RefreshCw, Search, X, Plus, Check,
  User, ArrowLeft, ChevronRight, UserPlus,
  Edit3, Trash2, Save
} from 'lucide-react';
import { displayName, formatDate } from '../../lib/formatters';
import { PageHeader, Button, Card, Badge, Modal, ConfirmDialog, ErrorState, Skeleton, EmptyState } from '../../components/ui';

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
  const { locale } = useLocale();
  const { selectedProjectId, selectedProject } = useProject();
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
    try { const r = await apiClient.getTeams(selectedProjectId || undefined); setTeams((r.data || []) as Team[]); }
    catch (err) { if (err instanceof ApiError) setError(err.message); else setError(t('teams.load_error', locale)); }
    finally { setLoading(false); }
  };
  const loadUsers = async () => {
    try { const r = await apiClient.getUsers(); setUsers((r.data || []) as AppUser[]); } catch {}
  };
  useEffect(() => { load(); loadUsers(); }, [selectedProjectId]);

  const handleCreate = async () => {
    if (!formName.trim() || !formCode.trim()) { setFormError(t('teams.name_code_required', locale)); return; }
    if (!selectedProject?.id) { setFormError(t('teams.select_project_first', locale)); return; }
    setSaving(true); setFormError(null);
    try {
      await apiClient.createTeam({ name: formName.trim(), code: formCode.trim(), leaderId: formLeaderId || undefined, projectId: selectedProject.id });
      setFormName(''); setFormCode(''); setFormLeaderId(''); setShowCreate(false);
      showSuccess(t('teams.create_success', locale)); await load();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError(t('teams.create_error', locale));
    } finally { setSaving(false); }
  };

  const handleAddMember = async (teamId: string) => {
    if (!addMemberUserId) return;
    setAddingMember(true);
    try {
      await apiClient.addTeamMember(teamId, addMemberUserId);
      setAddMemberUserId(''); showSuccess(t('teams.member_added', locale)); await load();
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
    if (!editName.trim() || !editCode.trim()) { setError(t('teams.name_code_required', locale)); return; }
    setEditSaving(true);
    try {
      await apiClient.updateTeam(selectedTeam.id, {
        name: editName.trim(),
        code: editCode.trim(),
        leaderId: editLeaderId || undefined,
      });
      setShowEdit(false);
      showSuccess(t('teams.updated', locale));
      await load();
      // Re-select the team to refresh detail view
      const updated = teams.find(t => t.id === selectedTeam.id);
      if (updated) setSelectedTeam(updated);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('teams.update_error', locale));
    } finally { setEditSaving(false); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setDeleting(true);
    try {
      await apiClient.deleteTeam(teamId);
      setConfirmDelete(null);
      setSelectedTeam(null);
      showSuccess(t('teams.archived', locale));
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('teams.archive_error', locale));
    } finally { setDeleting(false); }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      await apiClient.removeTeamMember(teamId, userId);
      setConfirmRemoveMember(null);
      showSuccess(t('teams.member_removed', locale));
      await load();
      const updated = teams.find(t => t.id === teamId);
      if (updated) setSelectedTeam(updated);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('teams.remove_error', locale));
    }
  };

  // Detail view
  let detailView: React.ReactNode = null;
  if (selectedTeam) {
    const team = selectedTeam;
    const leader = team.members?.find((m) => m.user_id === team.leader_id);
    const availableUsers = users.filter(
      (u) => u.is_active !== false && !team.members?.some((m) => m.user_id === u.id)
    );

    detailView = (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTeam(null)} aria-label={t('teams.back', locale)}>
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm" className="font-mono">{team.code}</Badge>
              {!team.is_active && <Badge variant="neutral" size="md">{t('teams.inactive', locale)}</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{team.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {team.is_active && canManageTeam && (
              <>
                <Button variant="ghost" size="icon" onClick={() => openEdit(team)} title={t('teams.edit_team_title', locale)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(team.id)} title={t('teams.archive_team_title', locale)} className="hover:bg-critical-soft hover:text-critical">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t('teams.info_heading', locale)}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 block">{t('teams.name', locale)}</label><p className="text-sm font-medium text-slate-900">{team.name}</p></div>
            <div><label className="text-xs text-slate-500 block">{t('teams.code', locale)}</label><p className="text-sm font-mono text-slate-900">{team.code}</p></div>
            <div><label className="text-xs text-slate-500 block">{t('teams.leader', locale)}</label><p className="text-sm text-slate-900">{leader ? displayName(leader.user) : '—'}</p></div>
            <div><label className="text-xs text-slate-500 block">{t('teams.created_at', locale)}</label><p className="text-sm text-slate-900">{formatDate(team.created_at)}</p></div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t('teams.members', locale)} ({team.members?.length || 0})</h3>
            {canManageMembers && availableUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)}
                  className="hii-select h-auto w-auto py-1 text-xs">
                  <option value="">{t('teams.select_user', locale)}</option>
                  {availableUsers.map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
                </select>
                <Button variant="primary" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => handleAddMember(team.id)} disabled={!addMemberUserId || addingMember}>
                  {t('teams.add', locale)}
                </Button>
              </div>
            )}
          </div>

          {team.members && team.members.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-hii-100 flex items-center justify-center text-xs font-bold text-hii-700">
                      {displayName(m.user).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {displayName(m.user)}
                        {m.user_id === team.leader_id && <Badge variant="info" size="sm" className="ml-2">{t('teams.leader_badge', locale)}</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">{m.user?.email}</p>
                    </div>
                  </div>
                  {team.is_active && m.user_id !== team.leader_id && (
                    <Button variant="ghost" size="icon" onClick={() => setConfirmRemoveMember({ teamId: team.id, userId: m.user_id, name: displayName(m.user) })}
                      title={t('teams.remove_member_title', locale)} className="hover:bg-critical-soft hover:text-critical">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">{t('teams.no_members', locale)}</p>
          )}
        </Card>
      </div>
    );
  }


  const filteredTeams = teams.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });


  // List view
  return (
    <>
      {detailView ?? (
      <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="teams" />

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />{successMsg}
        </div>
      )}
      <PageHeader
        title={t('teams.title', locale)}
        subtitle={t('teams.subtitle', locale)}
        actions={
          <div className="flex items-center gap-2">
            {canManageTeam && (
              <span title={!selectedProject ? t('teams.select_project_first', locale) : undefined}>
                <Button variant="primary" icon={<Plus className="w-4 h-4" />} disabled={!selectedProject} onClick={() => { setShowCreate(true); setFormError(null); }}>
                  {t('teams.new', locale)}
                </Button>
              </span>
            )}
            <Button variant="secondary" size="icon" onClick={load} disabled={loading} aria-label={t('teams.refresh', locale)}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('teams.create_title', locale)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>{t('teams.cancel', locale)}</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} loading={saving} disabled={!formName.trim() || !formCode.trim()} onClick={handleCreate}>
              {saving ? t('teams.saving', locale) : t('teams.create_action', locale)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label htmlFor="team-create-name" className="hii-label">{t('teams.form_name', locale)} *</label>
              <input id="team-create-name" value={formName} onChange={(e) => setFormName(e.target.value)} className="hii-input" />
            </div>
            <div><label htmlFor="team-create-code" className="hii-label">{t('teams.form_code', locale)} *</label>
              <input id="team-create-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} className="hii-input" />
            </div>
          </div>
          <div><label htmlFor="team-create-leader" className="hii-label">{t('teams.leader_optional', locale)}</label>
            <select id="team-create-leader" value={formLeaderId} onChange={(e) => setFormLeaderId(e.target.value)} className="hii-select">
              <option value="">{t('teams.no_leader', locale)}</option>
              {users.filter(u => u.is_active !== false).map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
            </select>
          </div>
        </div>
      </Modal>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" aria-label={t('teams.search', locale)} placeholder={t('teams.search', locale)} value={search} onChange={(e) => setSearch(e.target.value)}
          className="hii-input pl-10 pr-10" />
        {search && <Button variant="ghost" size="icon" onClick={() => setSearch('')} aria-label={t('teams.clear_search', locale)} className="absolute right-1 top-1/2 -translate-y-1/2"><X className="w-4 h-4" /></Button>}
      </div>

      {loading ? (
        <Skeleton className="h-12" count={6} />
      ) : error ? (
        <ErrorState title={t('teams.load_error', locale)} error={error} onRetry={load} />
      ) : filteredTeams.length === 0 ? (
        <Card padding={false}>
          {search ? (
            <EmptyState
              icon={<Search />}
              title={t('teams.empty_search_title', locale)}
              description={t('teams.empty_search_desc', locale)}
              action={{ label: t('teams.clear_search', locale), onClick: () => setSearch('') }}
            />
          ) : (
            <EmptyState
              icon={<Users />}
              title={t('teams.empty_title', locale)}
              description={t('teams.empty_desc', locale)}
              action={
                canManageTeam && !!selectedProject
                  ? { label: t('teams.new', locale), onClick: () => { setShowCreate(true); setFormError(null); } }
                  : undefined
              }
            />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const leader = team.members?.find((m) => m.user_id === team.leader_id);
            return (
              <div key={team.id} onClick={() => setSelectedTeam(team)} className="cursor-pointer">
                <Card hover padding={false} className="p-5 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{team.name}</p>
                      <p className="text-xs font-mono text-slate-400">{team.code}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <User className="w-3.5 h-3.5" /><span>{leader ? displayName(leader.user) : t('teams.no_leader', locale)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Users className="w-3.5 h-3.5" /><span>{team.members?.length || 0} {t('teams.member_count', locale)}</span>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}

      {/* Edit Team Modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title={t('teams.edit_title', locale)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>{t('teams.cancel', locale)}</Button>
            <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={editSaving} disabled={!editName.trim() || !editCode.trim()} onClick={handleEditSave}>
              {editSaving ? t('teams.saving', locale) : t('teams.save', locale)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div><label htmlFor="team-edit-name" className="hii-label">{t('teams.form_name', locale)} *</label>
            <input id="team-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="hii-input" />
          </div>
          <div><label htmlFor="team-edit-code" className="hii-label">{t('teams.form_code', locale)} *</label>
            <input id="team-edit-code" value={editCode} onChange={(e) => setEditCode(e.target.value)} className="hii-input" />
          </div>
          <div><label htmlFor="team-edit-leader" className="hii-label">{t('teams.leader_optional', locale)}</label>
            <select id="team-edit-leader" value={editLeaderId} onChange={(e) => setEditLeaderId(e.target.value)} className="hii-select">
              <option value="">{t('teams.no_leader', locale)}</option>
              {users.filter(u => u.is_active !== false).map((u) => (<option key={u.id} value={u.id}>{displayName(u)}</option>))}
            </select>
          </div>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          variant="danger"
          title={t('teams.archive_confirm_title', locale)}
          message={t('teams.archive_confirm_message', locale)}
          confirmLabel={deleting ? t('teams.archiving', locale) : t('teams.archive', locale)}
          cancelLabel={t('teams.cancel', locale)}
          loading={deleting}
          onConfirm={() => handleDeleteTeam(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmRemoveMember && (
        <ConfirmDialog
          open={!!confirmRemoveMember}
          variant="danger"
          title={t('teams.remove_member_title', locale)}
          message={t('teams.remove_member_message', locale).replace('{name}', confirmRemoveMember.name)}
          confirmLabel={t('teams.remove_member', locale)}
          cancelLabel={t('teams.cancel', locale)}
          onConfirm={() => handleRemoveMember(confirmRemoveMember.teamId, confirmRemoveMember.userId)}
          onCancel={() => setConfirmRemoveMember(null)}
        />
      )}
    </>
  );
}

export default function TeamsPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/teams']}>
      <TeamsPageInner />
    </RoleGuard>
  );
}

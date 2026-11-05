'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, Shield, Users, XCircle } from 'lucide-react';
import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { getRoleLabel, t, useLocale } from '@solar/shared';
import { PageHeader, Button, Card, Badge, Tabs, ErrorState, Skeleton, EmptyState } from '../../components/ui';

type UserRow = {
  id: string;
  email: string;
  role: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  organization_id?: string;
  microsoft_identity_link?: {
    status: string;
    linked_at: string;
    last_authenticated_at?: string | null;
  } | null;
  profile?: { full_name?: string | null; phone?: string | null };
  project_members?: Array<{ project?: { id: string; name: string; code?: string | null } }>;
};

type PermissionRow = {
  id: string;
  module: string;
  action: string;
  description?: string | null;
};

type SessionRow = {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  created_ip?: string | null;
  user_agent?: string | null;
};

const ENTRA_LINKING_ENABLED = process.env.NEXT_PUBLIC_ENTRA_LINKING_ENABLED === 'true';

type RoleRow = {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  permissions?: Array<{
    permission?: { id: string; module: string; action: string; description?: string | null };
  }>;
};

const roleBadgeVariant = (role: string): 'danger' | 'info' | 'neutral' => {
  const normalized = role.toLowerCase();
  if (normalized === 'admin' || normalized === 'owner') return 'danger';
  if (['manager', 'pm', 'technical_director', 'maintenance_director'].includes(normalized)) return 'info';
  if (['qa_qc', 'hse', 'finance', 'procurement'].includes(normalized)) return 'info';
  if (['worker', 'technician', 'team_leader', 'foreman'].includes(normalized)) return 'neutral';
  return 'neutral';
};

const statusLabel = (status: string | undefined, locale: string) => {
  if (locale === 'en') {
    if (status === 'ACTIVE') return 'Active';
    if (status === 'SUSPENDED') return 'Suspended';
    return 'Pending';
  }
  if (status === 'ACTIVE') return 'Activ';
  if (status === 'SUSPENDED') return 'Suspendat';
  return 'În așteptare';
};

const formatDate = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO') : '—';

function UtilizatoriPageInner() {
  const { locale } = useLocale();
  const { user: currentUser } = useAuth();
  const canManage = ['admin', 'owner'].includes(currentUser?.role?.toLowerCase() || '');
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'OWNER';

  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [identityObjectId, setIdentityObjectId] = useState('');
  const [provisionEmail, setProvisionEmail] = useState('');
  const [provisionName, setProvisionName] = useState('');
  const [provisionRole, setProvisionRole] = useState('WORKER');
  const [replacementUserId, setReplacementUserId] = useState('');
  const [offboardingPreview, setOffboardingPreview] = useState<any | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getUsers();
      setUsers((response.data || []) as UserRow[]);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const response = await apiClient.get<RoleRow[]>('/api/roles');
      setRoles((response.data || []) as RoleRow[]);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load roles.');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const response = await apiClient.get<PermissionRow[]>('/api/permissions');
      setPermissions((response.data || []) as PermissionRow[]);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load permissions.');
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadUsers();
    void loadRoles();
  }, [loadRoles, loadUsers]);

  useEffect(() => {
    if (isSuperAdmin) void loadPermissions();
  }, [isSuperAdmin, loadPermissions]);

  const loadUserDetails = useCallback(async (id: string) => {
    setSelectedUserId(id);
    setDetailLoading(true);
    setError(null);
    try {
      const [sessionResponse, activityResponse] = await Promise.all([
        apiClient.getUserSessions(id),
        apiClient.getUserActivity(id),
      ]);
      setSessions((sessionResponse.data || []) as SessionRow[]);
      setActivity((activityResponse.data || []) as any[]);
      setIdentityObjectId('');
      setOffboardingPreview(null);
      const replacement = users.find((candidate) =>
        candidate.id !== id && candidate.status === 'ACTIVE',
      );
      setReplacementUserId(replacement?.id || '');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load user details.');
    } finally {
      setDetailLoading(false);
    }
  }, [users]);

  const provisionEmployee = async () => {
    setActing('provision');
    setError(null);
    try {
      await apiClient.provisionUser({ email: provisionEmail, fullName: provisionName, role: provisionRole });
      setProvisionEmail('');
      setProvisionName('');
      setProvisionRole('WORKER');
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to provision user.');
    } finally {
      setActing(null);
    }
  };

  const linkIdentity = async (id: string) => {
    setActing(id);
    setError(null);
    try {
      await apiClient.linkMicrosoftIdentity(id, identityObjectId.trim());
      setIdentityObjectId('');
      await loadUsers();
      await loadUserDetails(id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to link Microsoft identity.');
    } finally {
      setActing(null);
    }
  };

  const revokeSession = async (userId: string, sessionId?: string) => {
    setActing(userId);
    setError(null);
    try {
      if (sessionId) await apiClient.revokeUserSession(userId, sessionId);
      else await apiClient.revokeAllUserSessions(userId);
      await loadUserDetails(userId);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to revoke sessions.');
    } finally {
      setActing(null);
    }
  };

  const previewEmployeeOffboarding = async (id: string) => {
    setActing(id);
    setError(null);
    try {
      const response = await apiClient.getOffboardingPreview(id);
      setOffboardingPreview(response.data);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to preview offboarding.');
    } finally {
      setActing(null);
    }
  };

  const offboardEmployee = async (id: string) => {
    if (!replacementUserId) return;
    if (!window.confirm('Reassign project/task assignments and suspend this employee? Business records will be retained.')) return;
    setActing(id);
    setError(null);
    try {
      await apiClient.offboardUser(id, replacementUserId);
      setOffboardingPreview(null);
      await loadUsers();
      await loadUserDetails(id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to offboard employee.');
    } finally {
      setActing(null);
    }
  };

  const saveRolePermissions = async (roleCode: string) => {
    setActing(`role:${roleCode}`);
    setError(null);
    try {
      await apiClient.setRolePermissions(roleCode, permissionDraft);
      setEditingRole(null);
      await loadRoles();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to save role permissions.');
    } finally {
      setActing(null);
    }
  };

  const selectedUser = users.find((item) => item.id === selectedUserId) || null;
  const activeReplacementUsers = users.filter(
    (item) => item.id !== selectedUserId && item.status === 'ACTIVE',
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((item) => {
      const name = item.profile?.full_name || '';
      const matchesSearch = !query || name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || (item.status || (item.is_active ? 'ACTIVE' : 'SUSPENDED')) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const updateRole = async (id: string, role: string) => {
    if (!canManage || id === currentUser?.id || (!isSuperAdmin && role === 'OWNER')) return;
    setActing(id);
    setError(null);
    try {
      await apiClient.updateUserRole(id, role);
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setActing(null);
    }
  };

  const updateStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'PENDING') => {
    if (!canManage || id === currentUser?.id) return;
    setActing(id);
    setError(null);
    try {
      await apiClient.patch('/api/users/' + id + '/status', { status });
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setActing(null);
    }
  };

  const renderRoleControl = (item: UserRow) => {
    const isSelf = item.id === currentUser?.id;
    const protectedOwner = item.role === 'OWNER' && !isSuperAdmin;
    if (canManage && !isSelf && !protectedOwner && roles.length > 0) {
      return (
        <select value={item.role} disabled={acting === item.id} onChange={(event) => void updateRole(item.id, event.target.value)}
          aria-label={t('users.change_role', locale)}
          className="hii-select h-auto w-auto py-1 text-xs">
          {roles.filter((role) => isSuperAdmin || role.code !== 'OWNER').map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
        </select>
      );
    }
    return (
      <Badge variant={roleBadgeVariant(item.role)} size="md">
        <Shield className="w-3 h-3" />{getRoleLabel(item.role.toLowerCase(), locale) || item.role}
      </Badge>
    );
  };

  const renderStatusControl = (item: UserRow) => {
    const isSelf = item.id === currentUser?.id;
    const protectedOwner = item.role === 'OWNER' && !isSuperAdmin;
    const currentStatus = item.status || (item.is_active ? 'ACTIVE' : 'SUSPENDED');
    if (canManage && !isSelf && !protectedOwner) {
      return (
        <select value={currentStatus} disabled={acting === item.id}
          onChange={(event) => void updateStatus(item.id, event.target.value as 'ACTIVE' | 'SUSPENDED' | 'PENDING')}
          aria-label={t('users.change_status', locale)}
          className="hii-select h-auto w-auto py-1 text-xs">
          <option value="ACTIVE">{statusLabel('ACTIVE', locale)}</option>
          <option value="PENDING">{statusLabel('PENDING', locale)}</option>
          <option value="SUSPENDED">{statusLabel('SUSPENDED', locale)}</option>
        </select>
      );
    }
    return (
      <Badge variant={currentStatus === 'ACTIVE' ? 'success' : 'neutral'} size="md">
        {currentStatus === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {statusLabel(currentStatus, locale)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="users" />
      <PageHeader
        title={t('users.title', locale)}
        subtitle={t('users.page_subtitle', locale)}
        actions={
          <Button onClick={() => { void loadUsers(); void loadRoles(); }} disabled={loading || rolesLoading} variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading || rolesLoading ? 'animate-spin' : ''}`} />}>
            {t('general.refresh', locale)}
          </Button>
        }
      />

      {canManage && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">{t('users.provision_title', locale)}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('users.provision_help', locale)}
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-4">
              <input
                className="hii-input"
                type="email"
                value={provisionEmail}
                onChange={(event) => setProvisionEmail(event.target.value)}
                placeholder="employee@hiieko.ro"
                aria-label={t('users.company_email', locale)}
              />
              <input
                className="hii-input"
                value={provisionName}
                onChange={(event) => setProvisionName(event.target.value)}
                placeholder={t('users.full_name', locale)}
                aria-label={t('users.full_name', locale)}
              />
              <select
                className="hii-select"
                value={provisionRole}
                onChange={(event) => setProvisionRole(event.target.value)}
                aria-label={t('users.initial_role', locale)}
              >
                {roles.filter((role) => isSuperAdmin || role.code !== 'OWNER').map((role) => (
                  <option key={role.code} value={role.code}>
                    {getRoleLabel(role.code.toLowerCase(), locale) || role.code}
                  </option>
                ))}
              </select>
              <Button
                disabled={acting === 'provision' || !provisionEmail || !provisionName.trim()}
                onClick={() => void provisionEmployee()}
              >
                {acting === 'provision' ? t('users.provisioning', locale) : t('users.create_pending', locale)}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error ? (
        <ErrorState
          title={t('users.load_error_title', locale)}
          error={error}
          onRetry={() => { void loadUsers(); void loadRoles(); }}
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { key: 'users', label: `${t('nav.users', locale)} (${users.length})` },
              { key: 'roles', label: `${t('users.tab_roles', locale)} (${roles.length})` },
            ]}
            activeTab={tab}
            onTabChange={(key) => setTab(key as 'users' | 'roles')}
          />

          {tab === 'users' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('users.search_placeholder', locale)}
                    aria-label={t('users.search_placeholder', locale)}
                    className="hii-input pl-9" />
                </label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label={t('users.filter_role', locale)} className="hii-select">
                  <option value="ALL">{t('users.all_roles', locale)}</option>
                  {roles.map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('users.filter_status', locale)} className="hii-select">
                  <option value="ALL">{t('users.all_statuses', locale)}</option>
                  <option value="ACTIVE">{statusLabel('ACTIVE', locale)}</option>
                  <option value="PENDING">{statusLabel('PENDING', locale)}</option>
                  <option value="SUSPENDED">{statusLabel('SUSPENDED', locale)}</option>
                </select>
              </div>

              {loading ? (
                <Skeleton className="h-12" count={6} />
              ) : filteredUsers.length === 0 ? (
                <Card padding={false}>
                  <EmptyState
                    icon={<Users />}
                    title={t('users.empty_title', locale)}
                  />
                </Card>
              ) : (
                <Card padding={false} className="overflow-hidden">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="hii-table">
                      <thead><tr>
                        <th>{t('users.col_user', locale)}</th>
                        <th>{t('users.role', locale)}</th>
                        <th>{t('users.col_status', locale)}</th>
                        <th>{t('users.projects', locale)}</th>
                        <th>{t('users.last_login', locale)}</th>
                        <th>{t('users.modified', locale)}</th>
                        <th>{t('users.administration', locale)}</th>
                      </tr></thead>
                      <tbody>
                        {filteredUsers.map((item) => {
                          const isSelf = item.id === currentUser?.id;
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="font-medium text-slate-900">{item.profile?.full_name || '—'}</div>
                                <div className="text-xs text-slate-500">{item.email}</div>
                              </td>
                              <td>{renderRoleControl(item)}</td>
                              <td>{renderStatusControl(item)}</td>
                              <td className="text-xs text-slate-600">
                                {item.project_members?.length || 0}{isSelf && <span className="ml-2 text-slate-400">({t('users.you', locale)})</span>}
                              </td>
                              <td className="text-xs text-slate-600">{formatDate(item.last_login_at, locale)}</td>
                              <td className="text-xs text-slate-600">{formatDate(item.updated_at, locale)}</td>
                              <td>
                                {canManage && (isSuperAdmin || item.role !== 'OWNER') && (
                                  <Button variant="secondary" size="sm" onClick={() => void loadUserDetails(item.id)}>
                                    {t('users.manage', locale)}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y divide-slate-100">
                    {filteredUsers.map((item) => {
                      const isSelf = item.id === currentUser?.id;
                      return (
                        <div key={item.id} className="p-4 space-y-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.profile?.full_name || '—'}</div>
                            <div className="text-xs text-slate-500">{item.email}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {renderRoleControl(item)}
                            {renderStatusControl(item)}
                          </div>
                          <div className="text-xs text-slate-600">
                            {t('users.projects', locale)}: {item.project_members?.length || 0}
                            {isSelf && <span className="ml-2 text-slate-400">({t('users.you', locale)})</span>}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t('users.last_login', locale)}: {formatDate(item.last_login_at, locale)} · {t('users.modified', locale)}: {formatDate(item.updated_at, locale)}
                          </div>
                          {canManage && (isSuperAdmin || item.role !== 'OWNER') && (
                            <Button variant="secondary" size="sm" onClick={() => void loadUserDetails(item.id)}>
                              {t('users.manage_account', locale)}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {canManage && selectedUser && (
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedUser.profile?.full_name || selectedUser.email}</h2>
                      <p className="text-sm text-slate-500">{selectedUser.email} · {selectedUser.id}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedUserId(null)}>
                      {t('users.close', locale)}
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div><span className="text-slate-500">{t('users.created', locale)}</span><div>{formatDate(selectedUser.created_at, locale)}</div></div>
                    <div><span className="text-slate-500">{t('users.modified', locale)}</span><div>{formatDate(selectedUser.updated_at, locale)}</div></div>
                    <div><span className="text-slate-500">{t('users.last_login', locale)}</span><div>{formatDate(selectedUser.last_login_at, locale)}</div></div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-900">{t('users.microsoft_identity', locale)}</h3>
                      {selectedUser.microsoft_identity_link ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <p>{t('users.linked', locale)} · {selectedUser.microsoft_identity_link.status}</p>
                          <p>{t('users.linked', locale)} {formatDate(selectedUser.microsoft_identity_link.linked_at, locale)}</p>
                          <p>{t('users.last_authenticated', locale)} {formatDate(selectedUser.microsoft_identity_link.last_authenticated_at, locale)}</p>
                        </div>
                      ) : ENTRA_LINKING_ENABLED ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-slate-500">{t('users.verify_object_id', locale)}</p>
                          <input
                            className="hii-input"
                            value={identityObjectId}
                            onChange={(event) => setIdentityObjectId(event.target.value)}
                            placeholder={t('users.object_id', locale)}
                            aria-label={t('users.object_id', locale)}
                          />
                          <Button
                            variant="secondary"
                            disabled={acting === selectedUser.id || !identityObjectId.trim() || (selectedUser.role === 'OWNER' && !isSuperAdmin)}
                            onClick={() => void linkIdentity(selectedUser.id)}
                          >
                            {t('users.link_identity', locale)}
                          </Button>
                          <p className="text-xs text-amber-700">{t('users.entra_disabled_notice', locale)}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">{t('users.identity_linking_disabled', locale)}</p>
                      )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{t('users.sessions', locale)}</h3>
                          <p className="text-xs text-slate-500">{t('users.tokens_hidden', locale)}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={acting === selectedUser.id || !sessions.some((session) => !session.revoked_at) || (selectedUser.role === 'OWNER' && !isSuperAdmin)}
                          onClick={() => void revokeSession(selectedUser.id)}
                        >
                          {t('users.revoke_all', locale)}
                        </Button>
                      </div>
                      {detailLoading ? <Skeleton className="mt-3 h-10" count={2} /> : sessions.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">{t('users.no_sessions', locale)}</p>
                      ) : (
                        <ul className="mt-3 divide-y divide-slate-100">
                          {sessions.map((session) => (
                            <li key={session.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-700">{session.user_agent || t('users.unknown_client', locale)}</div>
                                <div className="text-slate-500">{session.created_ip || t('users.ip_unavailable', locale)} · {t('users.last_used', locale)} {formatDate(session.last_used_at, locale)}</div>
                                <div className="text-slate-500">{t('users.expires', locale)} {formatDate(session.expires_at, locale)}{session.revoked_at ? ` · ${t('users.revoked', locale)} (${session.revoked_reason || 'unknown'})` : ''}</div>
                              </div>
                              {!session.revoked_at && !(selectedUser.role === 'OWNER' && !isSuperAdmin) && (
                                <Button variant="secondary" size="sm" disabled={acting === selectedUser.id} onClick={() => void revokeSession(selectedUser.id, session.id)}>
                                  {t('users.revoke', locale)}
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{t('users.offboarding', locale)}</h3>
                          <p className="text-sm text-slate-500">{t('users.offboarding_help', locale)}</p>
                        </div>
                        <Button variant="secondary" size="sm" disabled={acting === selectedUser.id || selectedUser.id === currentUser?.id || (selectedUser.role === 'OWNER' && !isSuperAdmin)} onClick={() => void previewEmployeeOffboarding(selectedUser.id)}>
                          {t('users.preview', locale)}
                        </Button>
                      </div>
                      {offboardingPreview && (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm">{offboardingPreview.counts?.projects || 0} {t('users.project_memberships', locale)} · {offboardingPreview.counts?.tasks || 0} {t('users.task_assignments', locale)}</p>
                          <p className="text-xs text-amber-700">{t('users.leads_unavailable', locale)}</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                            <select className="hii-select" value={replacementUserId} onChange={(event) => setReplacementUserId(event.target.value)} aria-label={t('users.replacement', locale)}>
                              <option value="">{t('users.select_active_replacement', locale)}</option>
                              {activeReplacementUsers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.profile?.full_name || candidate.email}</option>)}
                            </select>
                            <Button variant="secondary" disabled={!replacementUserId || acting === selectedUser.id || selectedUser.id === currentUser?.id || (selectedUser.role === 'OWNER' && !isSuperAdmin)} onClick={() => void offboardEmployee(selectedUser.id)}>
                              {t('users.reassign_deactivate', locale)}
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
                      <h3 className="font-semibold text-slate-900">{t('users.recent_activity', locale)}</h3>
                      {detailLoading ? <Skeleton className="mt-3 h-10" count={3} /> : activity.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">{t('users.no_activity', locale)}</p>
                      ) : (
                        <ul className="mt-3 divide-y divide-slate-100">
                          {activity.map((event) => (
                            <li key={event.id} className="py-2 text-sm">
                              <span className="font-medium">{event.action}</span>
                              <span className="text-slate-500"> · {event.entity} · {formatDate(event.created_at, locale)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {rolesLoading ? (
                <div className="lg:col-span-2">
                  <Skeleton className="h-12" count={4} />
                </div>
              ) : roles.length === 0 ? (
                <Card padding={false} className="lg:col-span-2">
                  <EmptyState
                    icon={<Shield />}
                    title={t('users.no_roles', locale)}
                  />
                </Card>
              ) : roles.map((role) => {
                const selected = new Set((role.permissions || []).map((entry) => entry.permission?.id).filter(Boolean));
                return (
                  <Card key={role.code}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-warning" />
                          <h2 className="font-semibold text-slate-900">{getRoleLabel(role.code.toLowerCase(), locale) || role.name || role.code}</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{role.description || role.code}</p>
                      </div>
                      <Badge variant={roleBadgeVariant(role.code)} size="sm">{role.code}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(role.permissions || []).map((entry) => {
                        const permission = entry.permission;
                        if (!permission) return null;
                        return <Badge key={permission.id} variant="neutral" size="sm">{permission.module}:{permission.action}</Badge>;
                      })}
                    </div>
                    {isSuperAdmin && !['ADMIN', 'OWNER'].includes(role.code) && editingRole !== role.code && (
                      <Button
                        className="mt-4"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingRole(role.code);
                          setPermissionDraft([...selected] as string[]);
                        }}
                      >
                        {t('users.edit_grants', locale)}
                      </Button>
                    )}
                    {isSuperAdmin && editingRole === role.code && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="mb-3 text-xs text-slate-500">{t('users.explicit_grants_help', locale)}</p>
                        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                          {permissions.map((permission) => (
                            <label key={permission.id} className="flex items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={permissionDraft.includes(permission.id)}
                                onChange={(event) => setPermissionDraft((current) => event.target.checked
                                  ? [...current, permission.id]
                                  : current.filter((id) => id !== permission.id))}
                              />
                              <span>{permission.module}:{permission.action}<span className="block text-xs text-slate-500">{permission.description}</span></span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" disabled={acting === `role:${role.code}`} onClick={() => void saveRolePermissions(role.code)}>
                            {t('users.save_grants', locale)}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingRole(null)}>
                            {t('users.cancel', locale)}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UtilizatoriPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/utilizatori']}>
      <UtilizatoriPageInner />
    </RoleGuard>
  );
}

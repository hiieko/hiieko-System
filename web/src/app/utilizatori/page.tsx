'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Search, Shield, Users, XCircle } from 'lucide-react';
import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { getRoleLabel, t, useLocale } from '@solar/shared';

type UserRow = {
  id: string;
  email: string;
  role: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  is_active: boolean;
  created_at: string;
  organization_id?: string;
  profile?: { full_name?: string | null; phone?: string | null };
  project_members?: Array<{ project?: { id: string; name: string; code?: string | null } }>;
};

type RoleRow = {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  permissions?: Array<{
    permission?: { id: string; module: string; action: string; description?: string | null };
  }>;
};

const roleBadge = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized === 'admin' || normalized === 'owner') return 'bg-red-100 text-red-800';
  if (['manager', 'pm', 'technical_director', 'maintenance_director'].includes(normalized)) return 'bg-blue-100 text-blue-800';
  if (['qa_qc', 'hse', 'finance', 'procurement'].includes(normalized)) return 'bg-violet-100 text-violet-800';
  if (['worker', 'technician', 'team_leader', 'foreman'].includes(normalized)) return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-700';
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

function UtilizatoriPageInner() {
  const { locale } = useLocale();
  const { user: currentUser } = useAuth();
  const canManage = ['admin', 'owner'].includes(currentUser?.role?.toLowerCase() || '');

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

  useEffect(() => {
    void loadUsers();
    void loadRoles();
  }, [loadRoles, loadUsers]);

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
    if (!canManage || id === currentUser?.id) return;
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="users" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600" />
            {t('users.title', locale)}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {locale === 'en' ? 'Manage organization users, roles, status, and permissions.' : 'Gestionează utilizatorii organizației, rolurile, statusul și permisiunile.'}
          </p>
        </div>
        <button onClick={() => { void loadUsers(); void loadRoles(); }} disabled={loading || rolesLoading}
          className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />{t('general.refresh', locale)}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
        <button onClick={() => setTab('users')}
          className={'px-4 py-1.5 text-xs font-semibold rounded-md ' + (tab === 'users' ? 'bg-amber-500 text-slate-950' : 'text-slate-600')}>
          {locale === 'en' ? 'Users' : 'Utilizatori'} ({users.length})
        </button>
        <button onClick={() => setTab('roles')}
          className={'px-4 py-1.5 text-xs font-semibold rounded-md ' + (tab === 'roles' ? 'bg-amber-500 text-slate-950' : 'text-slate-600')}>
          {locale === 'en' ? 'Roles & permissions' : 'Roluri și permisiuni'} ({roles.length})
        </button>
      </div>

      {tab === 'users' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder={locale === 'en' ? 'Search name or email' : 'Caută nume sau email'}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="ALL">{locale === 'en' ? 'All roles' : 'Toate rolurile'}</option>
              {roles.map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="ALL">{locale === 'en' ? 'All statuses' : 'Toate statusurile'}</option>
              <option value="ACTIVE">{statusLabel('ACTIVE', locale)}</option>
              <option value="PENDING">{statusLabel('PENDING', locale)}</option>
              <option value="SUSPENDED">{statusLabel('SUSPENDED', locale)}</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />{t('general.loading', locale)}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-600">{locale === 'en' ? 'No users found' : 'Nu există utilizatori'}</h3>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">{locale === 'en' ? 'User' : 'Utilizator'}</th>
                    <th className="py-3 px-4">{locale === 'en' ? 'Role' : 'Rol'}</th>
                    <th className="py-3 px-4">{locale === 'en' ? 'Status' : 'Status'}</th>
                    <th className="py-3 px-4">{locale === 'en' ? 'Projects' : 'Proiecte'}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((item) => {
                      const isSelf = item.id === currentUser?.id;
                      const currentStatus = item.status || (item.is_active ? 'ACTIVE' : 'SUSPENDED');
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{item.profile?.full_name || '—'}</div>
                            <div className="text-xs text-slate-500">{item.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            {canManage && !isSelf && roles.length > 0 ? (
                              <select value={item.role} disabled={acting === item.id} onChange={(event) => void updateRole(item.id, event.target.value)}
                                className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                                {roles.map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
                              </select>
                            ) : (
                              <span className={'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ' + roleBadge(item.role)}>
                                <Shield className="w-3 h-3 mr-1" />{getRoleLabel(item.role.toLowerCase(), locale) || item.role}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {canManage && !isSelf ? (
                              <select value={currentStatus} disabled={acting === item.id}
                                onChange={(event) => void updateStatus(item.id, event.target.value as 'ACTIVE' | 'SUSPENDED' | 'PENDING')}
                                className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                                <option value="ACTIVE">{statusLabel('ACTIVE', locale)}</option>
                                <option value="PENDING">{statusLabel('PENDING', locale)}</option>
                                <option value="SUSPENDED">{statusLabel('SUSPENDED', locale)}</option>
                              </select>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                                {currentStatus === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                                {statusLabel(currentStatus, locale)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {item.project_members?.length || 0}{isSelf && <span className="ml-2 text-slate-400">({locale === 'en' ? 'you' : 'tu'})</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 lg:col-span-2"><Loader2 className="w-6 h-6 animate-spin mr-2" />{t('general.loading', locale)}</div>
          ) : roles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center lg:col-span-2">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-600">{locale === 'en' ? 'No roles returned by the API' : 'API-ul nu a returnat roluri'}</h3>
            </div>
          ) : roles.map((role) => (
            <section key={role.code} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-amber-600" />
                    <h2 className="font-semibold text-slate-900">{getRoleLabel(role.code.toLowerCase(), locale) || role.name || role.code}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{role.description || role.code}</p>
                </div>
                <span className={'px-2 py-1 rounded-full text-[11px] font-semibold ' + roleBadge(role.code)}>{role.code}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(role.permissions || []).map((entry) => {
                  const permission = entry.permission;
                  if (!permission) return null;
                  return <span key={permission.id} className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px]">{permission.module}:{permission.action}</span>;
                })}
              </div>
            </section>
          ))}
        </div>
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

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
      <PageHeader
        icon={<Users className="w-6 h-6 text-warning" />}
        title={t('users.title', locale)}
        subtitle={locale === 'en' ? 'Manage organization users, roles, status, and permissions.' : 'Gestionează utilizatorii organizației, rolurile, statusul și permisiunile.'}
        actions={
          <Button onClick={() => { void loadUsers(); void loadRoles(); }} disabled={loading || rolesLoading} variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading || rolesLoading ? 'animate-spin' : ''}`} />}>
            {t('general.refresh', locale)}
          </Button>
        }
      />

      {error ? (
        <ErrorState
          title={locale === 'en' ? 'Could not load users and roles' : 'Nu s-au putut încărca utilizatorii și rolurile'}
          error={error}
          onRetry={() => { void loadUsers(); void loadRoles(); }}
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { key: 'users', label: `${locale === 'en' ? 'Users' : 'Utilizatori'} (${users.length})` },
              { key: 'roles', label: `${locale === 'en' ? 'Roles & permissions' : 'Roluri și permisiuni'} (${roles.length})` },
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
                    placeholder={locale === 'en' ? 'Search name or email' : 'Caută nume sau email'}
                    className="hii-input pl-9" />
                </label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="hii-select">
                  <option value="ALL">{locale === 'en' ? 'All roles' : 'Toate rolurile'}</option>
                  {roles.map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="hii-select">
                  <option value="ALL">{locale === 'en' ? 'All statuses' : 'Toate statusurile'}</option>
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
                    icon={<Users className="w-7 h-7" />}
                    title={locale === 'en' ? 'No users found' : 'Nu există utilizatori'}
                  />
                </Card>
              ) : (
                <Card padding={false} className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="hii-table">
                      <thead><tr>
                        <th>{locale === 'en' ? 'User' : 'Utilizator'}</th>
                        <th>{locale === 'en' ? 'Role' : 'Rol'}</th>
                        <th>{locale === 'en' ? 'Status' : 'Status'}</th>
                        <th>{locale === 'en' ? 'Projects' : 'Proiecte'}</th>
                      </tr></thead>
                      <tbody>
                        {filteredUsers.map((item) => {
                          const isSelf = item.id === currentUser?.id;
                          const currentStatus = item.status || (item.is_active ? 'ACTIVE' : 'SUSPENDED');
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="font-medium text-slate-900">{item.profile?.full_name || '—'}</div>
                                <div className="text-xs text-slate-500">{item.email}</div>
                              </td>
                              <td>
                                {canManage && !isSelf && roles.length > 0 ? (
                                  <select value={item.role} disabled={acting === item.id} onChange={(event) => void updateRole(item.id, event.target.value)}
                                    className="hii-select h-auto w-auto py-1 text-xs">
                                    {roles.map((role) => <option key={role.code} value={role.code}>{getRoleLabel(role.code.toLowerCase(), locale) || role.code}</option>)}
                                  </select>
                                ) : (
                                  <Badge variant={roleBadgeVariant(item.role)} size="md">
                                    <Shield className="w-3 h-3" />{getRoleLabel(item.role.toLowerCase(), locale) || item.role}
                                  </Badge>
                                )}
                              </td>
                              <td>
                                {canManage && !isSelf ? (
                                  <select value={currentStatus} disabled={acting === item.id}
                                    onChange={(event) => void updateStatus(item.id, event.target.value as 'ACTIVE' | 'SUSPENDED' | 'PENDING')}
                                    className="hii-select h-auto w-auto py-1 text-xs">
                                    <option value="ACTIVE">{statusLabel('ACTIVE', locale)}</option>
                                    <option value="PENDING">{statusLabel('PENDING', locale)}</option>
                                    <option value="SUSPENDED">{statusLabel('SUSPENDED', locale)}</option>
                                  </select>
                                ) : (
                                  <Badge variant={currentStatus === 'ACTIVE' ? 'success' : 'neutral'} size="md">
                                    {currentStatus === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {statusLabel(currentStatus, locale)}
                                  </Badge>
                                )}
                              </td>
                              <td className="text-xs text-slate-600">
                                {item.project_members?.length || 0}{isSelf && <span className="ml-2 text-slate-400">({locale === 'en' ? 'you' : 'tu'})</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
                    icon={<Shield className="w-7 h-7" />}
                    title={locale === 'en' ? 'No roles returned by the API' : 'API-ul nu a returnat roluri'}
                  />
                </Card>
              ) : roles.map((role) => (
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
                </Card>
              ))}
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

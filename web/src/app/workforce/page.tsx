'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { getRoleLabel, t, useLocale } from '@solar/shared';
import { Users, RefreshCw, Search, X, Edit3, Trash2, Check, Plus, Save } from 'lucide-react';
import { displayName } from '../../lib/formatters';
import { PageHeader, Button, Card, Badge, Modal, ConfirmDialog, ErrorState, Skeleton, EmptyState, Pagination } from '../../components/ui';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Employee {
  id: string; first_name: string; last_name: string;
  position?: string; hourly_rate?: number; is_active: boolean;
  user?: { id: string; email: string; role: string };
}

function WorkforcePageInner() {
  const { locale } = useLocale();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createPosition, setCreatePosition] = useState('');
  const [createHourlyRate, setCreateHourlyRate] = useState('');
  const [createUserId, setCreateUserId] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.getEmployees();
      setEmployees((res.data || []) as Employee[]);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('workforce.load_error', locale));
    } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try { const r = await apiClient.getUsers(); setUsers((r.data || []) as any[]); } catch {}
  };

  useEffect(() => { load(); loadUsers(); }, []);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const openEdit = (e: Employee) => {
    setEditEmployee(e);
    setEditFirstName(e.first_name);
    setEditLastName(e.last_name);
    setEditPosition(e.position || '');
    setEditHourlyRate(e.hourly_rate ? String(Number(e.hourly_rate)) : '');
    setEditUserId(e.user?.id || '');
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!editEmployee) return;
    if (!editFirstName.trim() || !editLastName.trim()) { setError(t('workforce.name_required', locale)); return; }
    setEditSaving(true);
    try {
      await apiClient.updateEmployee(editEmployee.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        position: editPosition.trim() || undefined,
        hourlyRate: editHourlyRate ? parseFloat(editHourlyRate) : undefined,
        userId: editUserId || undefined,
      });
      setShowEdit(false);
      showSuccess(t('workforce.updated', locale));
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('workforce.update_error', locale));
    } finally { setEditSaving(false); }
  };

  const handleDeleteEmployee = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.deleteEmployee(id);
      setConfirmDelete(null);
      showSuccess(t('workforce.archived', locale));
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('workforce.archive_error', locale));
    } finally { setDeleting(false); }
  };

  const handleCreate = async () => {
    if (!createFirstName.trim() || !createLastName.trim()) { setError(t('workforce.name_required', locale)); return; }
    setCreateSaving(true);
    try {
      await apiClient.createEmployee({
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        position: createPosition.trim() || undefined,
        hourlyRate: createHourlyRate ? parseFloat(createHourlyRate) : undefined,
        userId: createUserId || undefined,
      });
      setCreateFirstName(''); setCreateLastName(''); setCreatePosition(''); setCreateHourlyRate(''); setCreateUserId('');
      setShowCreate(false);
      showSuccess(t('workforce.create_success', locale));
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t('workforce.create_error', locale));
    } finally { setCreateSaving(false); }
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (e.first_name + ' ' + e.last_name).toLowerCase().includes(q)
      || (e.user?.email || '').toLowerCase().includes(q)
      || (e.position || '').toLowerCase().includes(q);
  });

  const totalFiltered = filtered.length;
  const activeCount = filtered.filter(e => e.is_active !== false).length;
  const inactiveCount = totalFiltered - activeCount;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEmployees = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const summaryCards = [
    { label: 'Total', value: totalFiltered, tone: 'text-content' },
    { label: t('workforce.active', locale), value: activeCount, tone: 'text-success-foreground' },
    { label: t('workforce.inactive', locale), value: inactiveCount, tone: 'text-content-muted' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="workforce" />
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />{successMsg}
        </div>
      )}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
      <PageHeader
        className="py-3 !mb-0"
        title={t('workforce.title', locale)}
        subtitle={t('workforce.subtitle', locale)}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowCreate(true); }}>
              {t('workforce.new', locale)}
            </Button>
            <Button type="button" variant="secondary" size="icon" onClick={load} disabled={loading} aria-label={t('workforce.reload', locale)}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        }
      />
      <div className="pb-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" aria-label={t('workforce.search_aria', locale)} placeholder={t('workforce.search', locale)} value={search} onChange={(e) => setSearch(e.target.value)}
            className="hii-input pl-10 pr-10" />
          {search && <Button type="button" variant="ghost" size="icon" aria-label={t('workforce.clear_search', locale)} onClick={() => setSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2"><X className="w-4 h-4" aria-hidden="true" /></Button>}
        </div>
      </div>
      </div>

      {!loading && !error && (
        <section aria-label={t('workforce.title', locale)} className="grid grid-cols-3 gap-3">
          {summaryCards.map(({ label, value, tone }) => (
            <div key={label} className="rounded-xl border border-chrome-line bg-surface p-4">
              <p className="text-xs font-medium text-content-muted">{label}</p>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </section>
      )}
      {loading ? (
        <Skeleton className="h-12" count={6} />
      ) : error ? (
        <ErrorState title={t('workforce.load_error', locale)} error={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          {search ? (
            <EmptyState
              icon={<Search />}
              title={t('workforce.empty_search_title', locale)}
              description={t('workforce.empty_search_desc', locale)}
              action={{ label: t('workforce.clear_search', locale), onClick: () => setSearch('') }}
            />
          ) : (
            <EmptyState
              icon={<Users />}
              title={t('workforce.empty_title', locale)}
              description={t('workforce.empty_desc', locale)}
              action={{ label: t('workforce.new', locale), onClick: () => setShowCreate(true) }}
            />
          )}
        </Card>
      ) : (
        <>
        <Card padding={false} className="hidden overflow-x-auto xl:block">
          <table className="hii-table min-w-[1050px]">
            <thead>
              <tr>
                <th>{t('workforce.name', locale)}</th>
                <th>{t('workforce.email', locale)}</th>
                <th>{t('workforce.position', locale)}</th>
                <th>{t('workforce.role', locale)}</th>
                <th className="text-right">{t('workforce.rate', locale)}</th>
                <th className="text-center">{t('workforce.status', locale)}</th>
                <th className="text-center">{t('workforce.actions', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {pagedEmployees.map(e => (
                <tr key={e.id}>
                  <td className="font-medium">{e.first_name} {e.last_name}</td>
                  <td className="text-xs text-slate-600">{e.user?.email || '—'}</td>
                  <td className="text-xs text-slate-700">{e.position || '—'}</td>
                  <td><Badge variant="neutral" size="sm">{getRoleLabel(e.user?.role, locale) || '—'}</Badge></td>
                  <td className="text-right text-xs">{e.hourly_rate ? Number(e.hourly_rate).toFixed(2) + ' RON' : '—'}</td>
                  <td className="text-center"><Badge variant={e.is_active !== false ? 'success' : 'neutral'} size="sm">{e.is_active !== false ? t('workforce.active', locale) : t('workforce.inactive', locale)}</Badge></td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}
                        title={t('workforce.edit', locale)} aria-label={`${t('workforce.edit', locale)} ${e.first_name} ${e.last_name}`}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      {e.is_active !== false && (
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(e.id)}
                          title={t('workforce.archive', locale)} aria-label={`${t('workforce.archive', locale)} ${e.first_name} ${e.last_name}`} className="hover:bg-critical-soft hover:text-critical">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid gap-3 xl:hidden">
          {pagedEmployees.map((employee) => (
            <Card key={employee.id} padding={false} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-bold text-slate-900">{employee.first_name} {employee.last_name}</h2>
                  <p className="mt-1 break-all text-xs text-slate-600">{employee.user?.email || t('workforce.no_email', locale)}</p>
                </div>
                <Badge variant={employee.is_active !== false ? 'success' : 'neutral'} size="md" className="shrink-0">{employee.is_active !== false ? t('workforce.active', locale) : t('workforce.inactive', locale)}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                <div><dt className="text-slate-500">{t('workforce.position', locale)}</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.position || '—'}</dd></div>
                <div><dt className="text-slate-500">{t('workforce.role', locale)}</dt><dd className="mt-0.5 font-medium text-slate-800">{getRoleLabel(employee.user?.role, locale) || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">{t('workforce.rate', locale)}</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.hourly_rate ? `${Number(employee.hourly_rate).toFixed(2)} RON` : '—'}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="secondary" onClick={() => openEdit(employee)} className="min-h-10 flex-1 text-xs font-semibold">{t('workforce.edit_details', locale)}</Button>
                {employee.is_active !== false && <Button type="button" variant="danger" onClick={() => setConfirmDelete(employee.id)} className="min-h-10 flex-1 text-xs font-semibold">{t('workforce.archive_employee', locale)}</Button>}
              </div>
            </Card>
          ))}
        </div>
        <Pagination page={safePage} pageSize={pageSize} total={totalFiltered} onPageChange={setPage} />
        </>
      )}

      {/* Edit Employee Modal */}
      <Modal
        open={showEdit && !!editEmployee}
        onClose={() => setShowEdit(false)}
        title={t('workforce.edit_title', locale)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>{t('workforce.cancel', locale)}</Button>
            <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={editSaving} disabled={!editFirstName.trim() || !editLastName.trim()} onClick={handleEditSave}>
              {editSaving ? t('workforce.saving', locale) : t('workforce.save', locale)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="hii-label">{t('workforce.first_name', locale)} *</label>
              <input aria-label={t('workforce.first_name', locale)} value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="hii-input" />
            </div>
            <div><label className="hii-label">{t('workforce.last_name', locale)} *</label>
              <input aria-label={t('workforce.last_name', locale)} value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="hii-input" />
            </div>
          </div>
          <div><label className="hii-label">{t('workforce.position', locale)}</label>
            <input aria-label={t('workforce.position', locale)} value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">{t('workforce.hourly_rate_ron', locale)}</label>
            <input aria-label={t('workforce.hourly_rate_aria', locale)} type="number" step="0.01" min="0" value={editHourlyRate} onChange={(e) => setEditHourlyRate(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">{t('workforce.user_account_label', locale)}</label>
            <select aria-label={t('workforce.user_account_label', locale)} value={editUserId} onChange={(e) => setEditUserId(e.target.value)} className="hii-select">
              <option value="">{t('workforce.no_account', locale)}</option>
              {users.filter((u: any) => u.is_active !== false).map((u: any) => (
                <option key={u.id} value={u.id}>{displayName(u)} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          variant="danger"
          title={t('workforce.archive_confirm_title', locale)}
          message={t('workforce.archive_confirm_message', locale)}
          confirmLabel={deleting ? t('workforce.archiving', locale) : t('workforce.archive', locale)}
          cancelLabel={t('workforce.cancel', locale)}
          loading={deleting}
          onConfirm={() => handleDeleteEmployee(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Create Employee Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('workforce.new', locale)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>{t('workforce.cancel', locale)}</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} loading={createSaving} disabled={!createFirstName.trim() || !createLastName.trim()} onClick={handleCreate}>
              {createSaving ? t('workforce.saving', locale) : t('workforce.create', locale)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="hii-label">{t('workforce.first_name', locale)} *</label>
              <input aria-label={t('workforce.first_name', locale)} value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} className="hii-input" />
            </div>
            <div><label className="hii-label">{t('workforce.last_name', locale)} *</label>
              <input aria-label={t('workforce.last_name', locale)} value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} className="hii-input" />
            </div>
          </div>
          <div><label className="hii-label">{t('workforce.position', locale)}</label>
            <input aria-label={t('workforce.position', locale)} value={createPosition} onChange={(e) => setCreatePosition(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">{t('workforce.hourly_rate_ron', locale)}</label>
            <input aria-label={t('workforce.hourly_rate_aria', locale)} type="number" step="0.01" min="0" value={createHourlyRate} onChange={(e) => setCreateHourlyRate(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">{t('workforce.user_account_label', locale)}</label>
            <select aria-label={t('workforce.user_account_label', locale)} value={createUserId} onChange={(e) => setCreateUserId(e.target.value)} className="hii-select">
              <option value="">{t('workforce.no_account', locale)}</option>
              {users.filter((u: any) => u.is_active !== false).map((u: any) => (
                <option key={u.id} value={u.id}>{displayName(u)} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function WorkforcePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/workforce']}>
      <WorkforcePageInner />
    </RoleGuard>
  );
}

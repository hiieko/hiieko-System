'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { Users, RefreshCw, Search, X, Edit3, Trash2, Check, Plus, Save } from 'lucide-react';
import { displayName } from '../../lib/formatters';
import { PageHeader, Button, Card, Badge, Modal, ConfirmDialog, ErrorState, Skeleton, EmptyState } from '../../components/ui';

interface Employee {
  id: string; first_name: string; last_name: string;
  position?: string; hourly_rate?: number; is_active: boolean;
  user?: { id: string; email: string; role: string };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:'Admin',MANAGER:'Manager',TEAM_LEADER:'Șef echipă',WORKER:'Muncitor',
  PM:'Project Manager',SITE_MANAGER:'Șef șantier',VIEWER:'Vizualizare',
};

function WorkforcePageInner() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      else setError('Eroare la încărcare');
    } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try { const r = await apiClient.getUsers(); setUsers((r.data || []) as any[]); } catch {}
  };

  useEffect(() => { load(); loadUsers(); }, []);

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
    if (!editFirstName.trim() || !editLastName.trim()) { setError('Prenumele și numele sunt obligatorii'); return; }
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
      showSuccess('Angajat actualizat');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la actualizare');
    } finally { setEditSaving(false); }
  };

  const handleDeleteEmployee = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.deleteEmployee(id);
      setConfirmDelete(null);
      showSuccess('Angajat arhivat');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la arhivare');
    } finally { setDeleting(false); }
  };

  const handleCreate = async () => {
    if (!createFirstName.trim() || !createLastName.trim()) { setError('Prenumele și numele sunt obligatorii'); return; }
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
      showSuccess('Angajat creat cu succes');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Eroare la creare');
    } finally { setCreateSaving(false); }
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (e.first_name + ' ' + e.last_name).toLowerCase().includes(q)
      || (e.user?.email || '').toLowerCase().includes(q)
      || (e.position || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="workforce" />
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />{successMsg}
        </div>
      )}
      <PageHeader
        icon={<Users className="w-6 h-6 text-hii-500" />}
        title="Forța de Muncă"
        subtitle="Angajați și personal activ"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowCreate(true); }}>
              Angajat Nou
            </Button>
            <Button type="button" variant="secondary" size="icon" onClick={load} disabled={loading} aria-label="Reîncarcă angajații">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        }
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" aria-label="Caută angajați" placeholder="Caută angajați..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="hii-input pl-10 pr-10" />
        {search && <Button type="button" variant="ghost" size="icon" aria-label="Șterge căutarea" onClick={() => setSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2"><X className="w-4 h-4" aria-hidden="true" /></Button>}
      </div>
      {loading ? (
        <Skeleton className="h-12" count={6} />
      ) : error ? (
        <ErrorState title="Eroare la încărcarea angajaților" error={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          {search ? (
            <EmptyState
              icon={<Search className="w-7 h-7" />}
              title="No matching results"
              description="No employees match the current search."
              action={{ label: 'Clear search', onClick: () => setSearch('') }}
            />
          ) : (
            <EmptyState
              icon={<Users className="w-7 h-7" />}
              title="No employees yet"
              description="Add employees to assign them to teams and tasks."
              action={{ label: 'Add employee', onClick: () => setShowCreate(true) }}
            />
          )}
        </Card>
      ) : (
        <>
        <Card padding={false} className="hidden overflow-x-auto xl:block">
          <table className="hii-table min-w-[1050px]">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Email</th>
                <th>Poziție</th>
                <th>Rol</th>
                <th className="text-right">Tarif</th>
                <th className="text-center">Stare</th>
                <th className="text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="font-medium">{e.first_name} {e.last_name}</td>
                  <td className="text-xs text-slate-600">{e.user?.email || '—'}</td>
                  <td className="text-xs text-slate-700">{e.position || '—'}</td>
                  <td><Badge variant="neutral" size="sm">{ROLE_LABELS[e.user?.role || ''] || e.user?.role || '—'}</Badge></td>
                  <td className="text-right text-xs">{e.hourly_rate ? Number(e.hourly_rate).toFixed(2) + ' RON' : '—'}</td>
                  <td className="text-center"><Badge variant={e.is_active !== false ? 'success' : 'neutral'} size="sm">{e.is_active !== false ? 'Activ' : 'Inactiv'}</Badge></td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}
                        title="Editează" aria-label={`Editează ${e.first_name} ${e.last_name}`}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      {e.is_active !== false && (
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(e.id)}
                          title="Arhivează" aria-label={`Arhivează ${e.first_name} ${e.last_name}`} className="hover:bg-red-50 hover:text-red-500">
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
          {filtered.map((employee) => (
            <Card key={employee.id} padding={false} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-bold text-slate-900">{employee.first_name} {employee.last_name}</h2>
                  <p className="mt-1 break-all text-xs text-slate-600">{employee.user?.email || 'Fără e-mail asociat'}</p>
                </div>
                <Badge variant={employee.is_active !== false ? 'success' : 'neutral'} size="md" className="shrink-0">{employee.is_active !== false ? 'Activ' : 'Inactiv'}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                <div><dt className="text-slate-500">Poziție</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.position || '—'}</dd></div>
                <div><dt className="text-slate-500">Rol</dt><dd className="mt-0.5 font-medium text-slate-800">{ROLE_LABELS[employee.user?.role || ''] || employee.user?.role || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Tarif</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.hourly_rate ? `${Number(employee.hourly_rate).toFixed(2)} RON` : '—'}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="secondary" onClick={() => openEdit(employee)} className="min-h-10 flex-1 text-xs font-semibold">Editează datele</Button>
                {employee.is_active !== false && <Button type="button" variant="danger" onClick={() => setConfirmDelete(employee.id)} className="min-h-10 flex-1 text-xs font-semibold">Arhivează angajatul</Button>}
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Edit Employee Modal */}
      <Modal
        open={showEdit && !!editEmployee}
        onClose={() => setShowEdit(false)}
        title="Editează angajat"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>Anulează</Button>
            <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={editSaving} disabled={!editFirstName.trim() || !editLastName.trim()} onClick={handleEditSave}>
              {editSaving ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="hii-label">Prenume *</label>
              <input aria-label="Prenume" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="hii-input" />
            </div>
            <div><label className="hii-label">Nume *</label>
              <input aria-label="Nume" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="hii-input" />
            </div>
          </div>
          <div><label className="hii-label">Poziție</label>
            <input aria-label="Poziție" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">Tarif orar (RON)</label>
            <input aria-label="Tarif orar în RON" type="number" step="0.01" min="0" value={editHourlyRate} onChange={(e) => setEditHourlyRate(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">Utilizator asociat</label>
            <select aria-label="Utilizator asociat" value={editUserId} onChange={(e) => setEditUserId(e.target.value)} className="hii-select">
              <option value="">Fără cont</option>
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
          title="Arhivează angajatul?"
          message="Angajatul va fi marcat ca inactiv si nu va mai aparea in listele active."
          confirmLabel={deleting ? 'Se arhiveaza...' : 'Arhiveaza'}
          cancelLabel="Anulează"
          loading={deleting}
          onConfirm={() => handleDeleteEmployee(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Create Employee Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Angajat nou"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Anulează</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} loading={createSaving} disabled={!createFirstName.trim() || !createLastName.trim()} onClick={handleCreate}>
              {createSaving ? 'Se salvează...' : 'Creează'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="hii-label">Prenume *</label>
              <input aria-label="Prenume" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} className="hii-input" />
            </div>
            <div><label className="hii-label">Nume *</label>
              <input aria-label="Nume" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} className="hii-input" />
            </div>
          </div>
          <div><label className="hii-label">Poziție</label>
            <input aria-label="Poziție" value={createPosition} onChange={(e) => setCreatePosition(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">Tarif orar (RON)</label>
            <input aria-label="Tarif orar în RON" type="number" step="0.01" min="0" value={createHourlyRate} onChange={(e) => setCreateHourlyRate(e.target.value)} className="hii-input" />
          </div>
          <div><label className="hii-label">Utilizator asociat</label>
            <select aria-label="Utilizator asociat" value={createUserId} onChange={(e) => setCreateUserId(e.target.value)} className="hii-select">
              <option value="">Fără cont</option>
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

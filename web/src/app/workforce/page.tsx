'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useRef } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { Users, Loader2, RefreshCw, Search, X, AlertTriangle, Edit3, Trash2, Check, Plus, Save } from 'lucide-react';
import { displayName } from '../../lib/formatters';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogOpen = showEdit || showCreate || confirmDelete !== null;

  useFocusTrap(dialogRef, dialogOpen);
  useEffect(() => {
    if (!dialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || editSaving || createSaving || deleting) return;
      if (confirmDelete) setConfirmDelete(null);
      else if (showEdit) setShowEdit(false);
      else setShowCreate(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, confirmDelete, showEdit, editSaving, createSaving, deleting]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-hii-500" />Forța de Muncă
          </h1>
          <p className="text-sm text-slate-500 mt-1">Angajați și personal activ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCreate(true); }}
            className="inline-flex items-center px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg transition-colors">
            <Plus className="w-4 h-4 mr-1.5" />Angajat Nou
          </button>
          <button type="button" onClick={load} disabled={loading} aria-label="Reîncarcă angajații"
            className="inline-flex items-center px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" aria-label="Caută angajați" placeholder="Caută angajați..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
        {search && <button type="button" aria-label="Șterge căutarea" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" aria-hidden="true" /></button>}
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Se încarcă...</div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-800"><p>{error}</p><button type="button" onClick={load} className="mt-3 min-h-10 rounded-md border border-rose-300 bg-white px-3 font-semibold">Reîncearcă</button></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">{search ? 'Niciun rezultat' : 'Niciun angajat'}</h3>
        </div>
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm xl:block">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Nume</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Poziție</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4 text-right">Tarif</th>
                <th className="py-3 px-4 text-center">Stare</th>
                <th className="py-3 px-4 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{e.first_name} {e.last_name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{e.user?.email || '—'}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">{e.position || '—'}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{ROLE_LABELS[e.user?.role || ''] || e.user?.role || '—'}</span></td>
                  <td className="py-3 px-4 text-right text-xs">{e.hourly_rate ? Number(e.hourly_rate).toFixed(2) + ' RON' : '—'}</td>
                  <td className="py-3 px-4 text-center text-xs font-semibold">{e.is_active !== false ? <span className="text-emerald-700">Activ</span> : <span className="text-slate-500">Inactiv</span>}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(e)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-hii-600 transition-colors"
                        title="Editează" aria-label={`Editează ${e.first_name} ${e.last_name}`}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {e.is_active !== false && (
                        <button onClick={() => setConfirmDelete(e.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                          title="Arhivează" aria-label={`Arhivează ${e.first_name} ${e.last_name}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 xl:hidden">
          {filtered.map((employee) => (
            <article key={employee.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-bold text-slate-900">{employee.first_name} {employee.last_name}</h2>
                  <p className="mt-1 break-all text-xs text-slate-600">{employee.user?.email || 'Fără e-mail asociat'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${employee.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{employee.is_active !== false ? 'Activ' : 'Inactiv'}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                <div><dt className="text-slate-500">Poziție</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.position || '—'}</dd></div>
                <div><dt className="text-slate-500">Rol</dt><dd className="mt-0.5 font-medium text-slate-800">{ROLE_LABELS[employee.user?.role || ''] || employee.user?.role || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Tarif</dt><dd className="mt-0.5 font-medium text-slate-800">{employee.hourly_rate ? `${Number(employee.hourly_rate).toFixed(2)} RON` : '—'}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => openEdit(employee)} className="min-h-10 flex-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">Editează datele</button>
                {employee.is_active !== false && <button type="button" onClick={() => setConfirmDelete(employee.id)} className="min-h-10 flex-1 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700">Arhivează angajatul</button>}
              </div>
            </article>
          ))}
        </div>
        </>
      )}

      {/* Edit Employee Modal */}
      {showEdit && editEmployee && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workforce-edit-title" className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="workforce-edit-title" className="text-base font-bold text-slate-900">Editează angajat</h3>
              <button type="button" aria-label="Închide editarea angajatului" onClick={() => setShowEdit(false)} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="text-xs font-semibold text-slate-700 block mb-1">Prenume *</label>
                  <input aria-label="Prenume" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
                </div>
                <div><label className="text-xs font-semibold text-slate-700 block mb-1">Nume *</label>
                  <input aria-label="Nume" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
                </div>
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Poziție</label>
                <input aria-label="Poziție" value={editPosition} onChange={(e) => setEditPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Tarif orar (RON)</label>
                <input aria-label="Tarif orar în RON" type="number" step="0.01" min="0" value={editHourlyRate} onChange={(e) => setEditHourlyRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Utilizator asociat</label>
                <select aria-label="Utilizator asociat" value={editUserId} onChange={(e) => setEditUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Fără cont</option>
                  {users.filter((u: any) => u.is_active !== false).map((u: any) => (
                    <option key={u.id} value={u.id}>{displayName(u)} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anulează</button>
              <button onClick={handleEditSave} disabled={editSaving || !editFirstName.trim() || !editLastName.trim()}
                className="px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {editSaving ? 'Se salvează...' : <><Save className="w-4 h-4 inline mr-1" />Salvează</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Employee */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="workforce-archive-title" className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 id="workforce-archive-title" className="text-base font-bold text-slate-900">Arhivează angajatul?</h3>
                <p className="text-sm text-slate-500">Angajatul va fi marcat ca inactiv si nu va mai aparea in listele active.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anulează</button>
              <button onClick={() => handleDeleteEmployee(confirmDelete)} disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {deleting ? 'Se arhiveaza...' : 'Arhiveaza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workforce-create-title" className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="workforce-create-title" className="text-base font-bold text-slate-900">Angajat nou</h3>
              <button type="button" aria-label="Închide formularul de angajat nou" onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="text-xs font-semibold text-slate-700 block mb-1">Prenume *</label>
                  <input aria-label="Prenume" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
                </div>
                <div><label className="text-xs font-semibold text-slate-700 block mb-1">Nume *</label>
                  <input aria-label="Nume" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
                </div>
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Poziție</label>
                <input aria-label="Poziție" value={createPosition} onChange={(e) => setCreatePosition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Tarif orar (RON)</label>
                <input aria-label="Tarif orar în RON" type="number" step="0.01" min="0" value={createHourlyRate} onChange={(e) => setCreateHourlyRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
              </div>
              <div><label className="text-xs font-semibold text-slate-700 block mb-1">Utilizator asociat</label>
                <select aria-label="Utilizator asociat" value={createUserId} onChange={(e) => setCreateUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="">Fără cont</option>
                  {users.filter((u: any) => u.is_active !== false).map((u: any) => (
                    <option key={u.id} value={u.id}>{displayName(u)} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anulează</button>
              <button onClick={handleCreate} disabled={createSaving || !createFirstName.trim() || !createLastName.trim()}
                className="px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {createSaving ? 'Se salvează...' : <><Plus className="w-4 h-4 inline mr-1" />Creează</>}
              </button>
            </div>
          </div>
        </div>
      )}
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

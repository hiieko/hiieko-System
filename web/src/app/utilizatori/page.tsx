'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { Users, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Mail, Shield } from 'lucide-react';

interface ProfileRow { id: string; email: string; full_name: string; role: string; phone_number?: string; is_active: boolean; created_at: string; }
interface AppRow { id: string; first_name: string; last_name: string; email: string; phone?: string; requested_role: string; status: string; created_at: string; }
const RC: Record<string, string> = { admin: 'bg-red-100 text-red-800', manager: 'bg-blue-100 text-blue-800', team_leader: 'bg-amber-100 text-amber-800', worker: 'bg-emerald-100 text-emerald-800' };
const RL: Record<string, string> = { admin: 'Admin', manager: 'Manager', team_leader: 'Sef Santier', worker: 'Muncitor' };

function UtilizatoriPageInner() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [tab, setTab] = useState<'emp' | 'app'>('emp');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use apiClient to get users from NestJS backend
      const usersResponse = await apiClient.getUsers();
      const usersData = (usersResponse.data || []) as any[];
      
      // Map from NestJS user model to legacy ProfileRow format
      // NestJS returns: { id, email, role, is_active, created_at, profile: { full_name, phone } }
      const mappedProfiles = usersData.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.profile?.full_name || user.fullName || user.email,
        role: user.role?.toLowerCase() || 'worker',
        phone_number: user.profile?.phone || user.phone,
        is_active: user.is_active !== false,
        created_at: user.created_at || new Date().toISOString(),
      }));
      
      // Sort by created_at descending
      mappedProfiles.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setProfiles(mappedProfiles as ProfileRow[]);
      // Account applications not yet migrated - empty array for now
      setApps([]);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la incarcarea utilizatorilor.');
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  // Account applications endpoints not yet migrated to NestJS
  const approve = async (a: AppRow) => { 
    setActing(a.id); 
    try { 
      setError('Cererea de cont este in curs de migrare. Aceasta actiune nu este disponibila momentan.');
    } catch (e: unknown) { 
      setError(e instanceof Error ? e.message : 'Eroare'); 
    } finally { 
      setActing(null); 
    } 
  };
  const reject = async (a: AppRow) => { 
    setActing(a.id); 
    try { 
      setError('Cererea de cont este in curs de migrare. Aceasta actiune nu este disponibila momentan.');
    } catch (e: unknown) { 
      setError(e instanceof Error ? e.message : 'Eroare'); 
    } finally { 
      setActing(null); 
    } 
  };
  const pending = apps.filter(a => a.status === 'pending').length;
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="users" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" />Utilizatori</h1>
          <p className="text-sm text-slate-500 mt-1">Gestionarea angajatilor si aprobarile cererilor de cont nou.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reimprospateaza
        </button>
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
        <button onClick={() => setTab('emp')} className={`px-4 py-1.5 text-xs font-semibold rounded-md ${tab === 'emp' ? 'bg-amber-500 text-slate-950' : 'text-slate-600'}`}>Angajati ({profiles.length})</button>
        <button onClick={() => setTab('app')} className={`px-4 py-1.5 text-xs font-semibold rounded-md ${tab === 'app' ? 'bg-amber-500 text-slate-950' : 'text-slate-600'}`}>Cereri ({pending})</button>
      </div>
      {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca...</div>
      : tab === 'emp' ? (
        profiles.length === 0 ? <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center"><Users className="w-12 h-12 text-slate-300 mx-auto mb-3" /><h3 className="text-base font-semibold text-slate-600">Niciun angajat</h3></div>
        : <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <th className="py-3 px-4">Nume</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Rol</th><th className="py-3 px-4 text-center">Stare</th>
        </tr></thead><tbody className="divide-y divide-slate-100">{profiles.map(p => <tr key={p.id} className="hover:bg-slate-50">
          <td className="py-3 px-4 font-medium">{p.full_name || '—'}</td><td className="py-3 px-4 text-xs text-slate-600">{p.email}</td>
          <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RC[p.role] || 'bg-slate-100'}`}><Shield className="w-3 h-3 inline mr-1" />{RL[p.role] || p.role}</span></td>
          <td className="py-3 px-4 text-center text-xs font-semibold">{p.is_active ? <span className="text-emerald-700">Activ</span> : <span className="text-slate-500">Inactiv</span>}</td>
        </tr>)}</tbody></table></div>
      ) : apps.length === 0 ? <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center"><Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-600">Nicio cerere</h3></div>
      : <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">{apps.map(a => <div key={a.id} className={`p-5 flex items-center justify-between gap-4 ${a.status === 'pending' ? 'bg-amber-50/30' : ''}`}>
        <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-semibold">{a.first_name} {a.last_name}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status === 'pending' ? 'bg-amber-100 text-amber-800' : a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{a.status === 'pending' ? 'In Asteptare' : a.status === 'approved' ? 'Aprobat' : 'Respins'}</span></div>
          <div className="text-xs text-slate-500"><Mail className="w-3 h-3 inline mr-1" />{a.email} | Rol: {a.requested_role}</div></div>
        {a.status === 'pending' && <div className="flex gap-2">
          <button onClick={() => approve(a)} disabled={acting === a.id} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"><CheckCircle2 className="w-4 h-4 inline mr-1" />Aproba</button>
          <button onClick={() => reject(a)} disabled={acting === a.id} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"><XCircle className="w-4 h-4 inline mr-1" />Respinge</button>
        </div>}
      </div>)}</div>
      }
    </div>
  );
}

export default function UtilizatoriPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <UtilizatoriPageInner />
    </RoleGuard>
  );
}

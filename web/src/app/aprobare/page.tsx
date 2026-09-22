'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Euro, User, MapPin, Calendar,
  ClipboardCheck, CheckCircle2, XCircle, AlertCircle, Clock,
  Search, Eye, MessageSquare, Loader2, RefreshCw,
} from 'lucide-react';
import { Expense } from '@solar/shared';
import { supabase, isSupabaseConfigured, supabaseConfigMessage } from '../../lib/supabase';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Ciorna', color: 'text-slate-600', bg: 'bg-slate-100' },
  submitted: { label: 'Trimisa', color: 'text-blue-700', bg: 'bg-blue-100' },
  under_review: { label: 'In Analiza', color: 'text-amber-700', bg: 'bg-amber-100' },
  approved: { label: 'Aprobata', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  rejected: { label: 'Respinsa', color: 'text-rose-700', bg: 'bg-rose-100' },
  needs_correction: { label: 'Corectii', color: 'text-orange-700', bg: 'bg-orange-100' },
  reimbursement_pending: { label: 'Rambursare', color: 'text-purple-700', bg: 'bg-purple-100' },
  reimbursed: { label: 'Rambursata', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Anulata', color: 'text-slate-500', bg: 'bg-slate-100' },
};

const CAT_MAP: Record<string, string> = {
  fuel: 'Combustibil', accommodation: 'Cazare', food: 'Mancare',
  transport: 'Transport', parking: 'Parcare', tolls: 'Taxe Drum',
  materials: 'Materiale', tools: 'Unelte', equipment: 'Echipamente',
  phone_internet: 'Telefon/Internet', other: 'Altele',
};

export default function AprobarePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError(supabaseConfigMessage ?? 'Supabase nu este configurat.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('expenses').select('*');
      if (filter === 'pending') {
        query = query.in('status', ['submitted', 'under_review']);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      const { data, error: fetchErr } = await query.order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setExpenses((data as Expense[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la incarcarea cheltuielilor.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = expenses.filter(e => {
    if (filter === 'pending' && e.status !== 'submitted' && e.status !== 'under_review') return false;
    if (filter !== 'all' && filter !== 'pending' && e.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q);
    }
    return true;
  });

  const pending = expenses.filter(e => e.status === 'submitted' || e.status === 'under_review').length;

  const act = async (id: string, action: 'approved' | 'rejected' | 'correction_requested', st: Expense['status']) => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      const update: Record<string, unknown> = { status: st, reviewed_at: new Date().toISOString() };
      if (action === 'rejected') update.rejection_reason = note;
      if (action === 'correction_requested') update.correction_notes = note;
      await supabase.from('expenses').update(update).eq('id', id);
      await supabase.from('expense_approvals').insert({ expense_id: id, action, reason: note || null });
    }
    setExpenses(p => p.filter(e => e.id !== id));
    setSelId(null); setNote(''); setLoading(false);
  };

  const tabs = [
    { k: 'pending', l: 'In Asteptare' },
    { k: 'all', l: 'Toate' },
    { k: 'approved', l: 'Aprobate' },
    { k: 'rejected', l: 'Respinse' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="approvals" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aprobare Cheltuieli</h1>
          <p className="text-sm text-slate-500 mt-1">
            Verificare si aprobare cheltuieli trimise de angajati conform §6.6.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
          <Clock className="w-3.5 h-3.5 mr-1.5" />{pending} in asteptare
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === t.k ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input type="text" placeholder="Cauta cheltuiala..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm text-slate-800 focus:outline-none placeholder:text-slate-400" />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">Totul la zi!</h3>
            <p className="text-sm text-slate-500 mt-1">Nu exista cheltuieli de analizat.</p>
          </div>
        ) : filtered.map(exp => {
          const st = STATUS_MAP[exp.status] || STATUS_MAP.draft;
          const cat = CAT_MAP[exp.category] || exp.category;
          return (
            <div key={exp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                    <Euro className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-slate-900">{cat}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{exp.description || 'Fara descriere'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <span className="flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400" />{exp.user_id}
                      </span>
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />{exp.site_id}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {new Date(exp.submitted_at || exp.created_at).toLocaleDateString('ro-RO')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-slate-900">
                      {exp.amount.toFixed(2)} <span className="text-xs font-normal text-slate-500">{exp.currency}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {exp.payment_method === 'personal' ? 'Rambursabil' : 'Card/Firma'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button type="button" onClick={() => setSelId(selId === exp.id ? null : exp.id)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => act(exp.id, 'approved', 'approved')} disabled={loading}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => act(exp.id, 'rejected', 'rejected')} disabled={loading}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {selId === exp.id && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1" />Nota revizuire
                    </label>
                    <textarea value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Motiv pentru aprobare/respingere..." rows={2}
                      className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => act(exp.id, 'approved', 'approved')} disabled={loading}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />Aproba
                    </button>
                    <button type="button" onClick={() => act(exp.id, 'correction_requested', 'needs_correction')} disabled={loading}
                      className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-lg disabled:opacity-50">
                      <AlertCircle className="w-4 h-4 mr-1.5" />Corectii
                    </button>
                    <button type="button" onClick={() => act(exp.id, 'rejected', 'rejected')} disabled={loading}
                      className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50">
                      <XCircle className="w-4 h-4 mr-1.5" />Respinge
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



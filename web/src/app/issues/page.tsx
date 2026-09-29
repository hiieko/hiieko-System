'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
} from 'lucide-react';
import type { IssueSeverity } from '../../features/issues/types';

interface IssueItem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reported_by?: string;
  created_at: string;
  updated_at: string;
  reporter?: { id: string; email: string; profile?: { full_name?: string } };
  project?: { name: string; code: string };
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Scazuta', MEDIUM: 'Medie', HIGH: 'Ridicata', CRITICAL: 'Critica',
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Deschis', INVESTIGATING: 'In investigare',
  CORRECTIVE_ACTION_PROPOSED: 'Actiune propusa', RESOLVED: 'Rezolvat', CLOSED: 'Inchis',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800', INVESTIGATING: 'bg-blue-100 text-blue-800',
  CORRECTIVE_ACTION_PROPOSED: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800', CLOSED: 'bg-slate-100 text-slate-700',
};

function IssuesPageInner() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSeverity, setFormSeverity] = useState<IssueSeverity>('MEDIUM');
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();

  const canReport = selectedProjectId && ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker'].includes(userRole || '');

  const loadIssues = useCallback(async () => {
    if (!selectedProjectId) { setIssues([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await apiClient.getIssues({ projectId: selectedProjectId });
      setIssues((response.data || []) as IssueItem[]);
    } catch (err: any) { setError(err.message || 'Eroare la incarcare'); }
    finally { setLoading(false); }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) { loadIssues(); }
    else { setIssues([]); setLoading(false); }
  }, [loadIssues, selectedProjectId]);

  const handleCreate = async () => {
    if (!formTitle.trim()) { setFormError('Titlul este obligatoriu'); return; }
    if (!formDescription.trim()) { setFormError('Descrierea este obligatorie'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await apiClient.createIssue({ projectId: selectedProjectId!, title: formTitle.trim(), description: formDescription.trim(), severity: formSeverity });
      setShowCreate(false); setFormTitle(''); setFormDescription(''); setFormSeverity('MEDIUM');
      setSuccessMsg('Problema a fost raportata!');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadIssues();
    } catch (err: any) { setFormError(err.message || 'Eroare la raportare'); }
    finally { setSubmitting(false); }
  };

  const filtered = filter === 'all' ? issues : issues.filter(i => {
    if (filter === 'open') return i.status === 'OPEN' || i.status === 'INVESTIGATING';
    return i.status === filter;
  });


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="issues" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Probleme & Blocaje</h1>
          <p className="text-sm text-slate-500 mt-1">Raporteaza problemele intalnite pe santier si urmareste rezolvarea lor</p>
        </div>
        <div className="flex items-center gap-2">
          {canReport && (
            <button onClick={() => { setShowCreate(true); setFormError(null); }}
              className="inline-flex items-center px-3 py-2 bg-hii-500 hover:bg-hii-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Raporteaza
            </button>
          )}
          <button onClick={loadIssues} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Reimprospateaza
          </button>
        </div>
      </div>


      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {!selectedProjectId ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Selecteaza un proiect</h3>
          <p className="text-sm text-slate-400 mt-1">Foloseste selectorul de proiect din bara de sus</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
            {[{ k: 'all', l: 'Toate' }, { k: 'open', l: 'Deschise' }, { k: 'RESOLVED', l: 'Rezolvate' }, { k: 'CLOSED', l: 'Inchise' }].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === t.k ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{t.l}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-600">Nicio problema raportata</h3>
              <p className="text-sm text-slate-400 mt-1">Totul este in regula pe acest santier</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((issue) => (
                <div key={issue.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{issue.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SEVERITY_COLORS[issue.severity] || 'bg-slate-100 text-slate-700'}`}>
                          {SEVERITY_LABELS[issue.severity] || issue.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[issue.status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABELS[issue.status] || issue.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{issue.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(issue.created_at).toLocaleDateString('ro-RO')}</span>
                        {issue.reporter && <span><User className="w-3 h-3 inline mr-1" />{issue.reporter.profile?.full_name || issue.reporter.email}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}


      {/* Create Issue Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-lg mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Raporteaza Problema</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {formError && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>)}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Titlu *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none"
                  placeholder="Ex: Echipament defect, Material lipsa..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Descriere *</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none resize-none"
                  placeholder="Descrie problema in detaliu..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Severitate</label>
                <select value={formSeverity} onChange={e => setFormSeverity(e.target.value as IssueSeverity)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none bg-white">
                  <option value="LOW">Scazuta</option>
                  <option value="MEDIUM">Medie</option>
                  <option value="HIGH">Ridicata</option>
                  <option value="CRITICAL">Critica</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={handleCreate} disabled={submitting || !formTitle.trim() || !formDescription.trim()}
                className="inline-flex items-center px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <AlertTriangle className="w-4 h-4 mr-1.5" />}
                Raporteaza
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssuesPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']}>
      <IssuesPageInner />
    </RoleGuard>
  );
}


'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, RefreshCw, Upload, Download, X, CheckCircle2 } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';

type Project = { id: string; name: string; code?: string };
type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  project_id?: string | null;
  current_version: number;
  updated_at: string;
  versions?: Array<{ version: number; file_size: number; uploaded_by?: string | null; storage_path: string }>;
};

const TYPES = [
  ['BON_FISCAL', 'Bon fiscal'],
  ['FACTURA', 'Factură'],
  ['AVIZ', 'Aviz'],
  ['CERTIFICAT_CONFORMITATE', 'Certificat de conformitate'],
  ['PROCES_VERBAL', 'Proces verbal'],
  ['PLAN_TEHNIC', 'Plan tehnic'],
  ['CONTRACT', 'Contract'],
  ['RAPORT_TESTARE', 'Raport testare'],
  ['OTHER', 'Altele'],
] as const;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/xml', 'text/xml'];
const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function DocumentsPage() {
  const { locale } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('OTHER');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const projectName = useMemo(
    () => projects.find((p) => p.id === projectId)?.name || '',
    [projects, projectId],
  );

  const loadProjects = async () => {
    const response = await apiClient.getProjects();
    const rows = (response.data || []) as Project[];
    setProjects(rows);
    if (!projectId && rows[0]?.id) setProjectId(rows[0].id);
  };

  const loadDocuments = async (selectedProjectId = projectId) => {
    if (!selectedProjectId) {
      setDocuments([]);
      return;
    }
    const response = await apiClient.getDocuments(selectedProjectId);
    setDocuments((response.data || []) as DocumentRow[]);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadProjects();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Eroare la încărcarea proiectelor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (projectId) void loadDocuments(projectId).catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Eroare la încărcarea documentelor.');
    });
  }, [projectId]);

  const submitUpload = async () => {
    setError(null);
    setSuccess(null);
    if (!projectId) return setError('Selectează un proiect.');
    if (!file) return setError('Selectează un fișier.');
    if (!ALLOWED.includes(file.type)) return setError('Tip de fișier nesuportat. Sunt acceptate JPG, PNG, WEBP, PDF și XML.');
    if (file.size > MAX_BYTES) return setError('Fișierul depășește limita de 10 MB.');

    setUploading(true);
    try {
      await apiClient.uploadDocument(file, {
        projectId,
        documentType,
        title: title.trim() || file.name,
      });
      setSuccess('Documentul a fost încărcat cu succes.');
      setFile(null);
      setTitle('');
      setDocumentType('OTHER');
      if (inputRef.current) inputRef.current.value = '';
      await loadDocuments(projectId);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Încărcarea documentului a eșuat.');
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc: DocumentRow) => {
    setError(null);
    try {
      const blob = await apiClient.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = doc.title;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Descărcarea documentului a eșuat.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-600" />
            Documente
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Documente reale, stocate pe server și asociate proiectului selectat.
          </p>
        </div>
        <button
          onClick={() => void loadDocuments()}
          disabled={loading || uploading || !projectId}
          className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />{t('general.refresh', locale)}
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4" />{success}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Proiect</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loading || uploading}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Selectează proiectul</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code ? project.code + ' — ' : ''}{project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tip document</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Titlu</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name || 'Titlu document'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fișier</label>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.xml"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {projectName ? `Proiect: ${projectName} · ` : ''}Maxim 10 MB. Fișierul este trimis către API-ul NestJS, nu este salvat în browser.
          </p>
          <button
            onClick={() => void submitUpload()}
            disabled={uploading || !projectId || !file}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Se încarcă…' : 'Încarcă documentul'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Documente proiect</h2>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Nu există documente pentru acest proiect.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const latest = doc.versions?.[0];
              return (
                <div key={doc.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {TYPES.find(([value]) => value === doc.document_type)?.[1] || doc.document_type}
                      {' · '}v{doc.current_version}
                      {' · '}{formatSize(latest?.file_size || 0)}
                      {' · '}{doc.updated_at ? new Date(doc.updated_at).toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB') : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => void download(doc)}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4 mr-1.5" />Descarcă
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default DocumentsPage;

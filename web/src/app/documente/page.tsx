'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, RefreshCw, Upload, Download, X, CheckCircle2 } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { PageHeader, Button, Card, ErrorState, Skeleton, EmptyState } from '../../components/ui';

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

function errMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
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
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      await loadProjects();
    } catch (err: unknown) {
      setLoadError(errMessage(err, 'Eroare la încărcarea proiectelor.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (projectId) void loadDocuments(projectId).catch((err: unknown) => {
      setLoadError(errMessage(err, 'Eroare la încărcarea documentelor.'));
    });
  }, [projectId]);

  const retryLoad = () => {
    setLoadError(null);
    void load();
    void loadDocuments().catch((err: unknown) => {
      setLoadError(errMessage(err, 'Eroare la încărcarea documentelor.'));
    });
  };

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
      setError(errMessage(err, 'Încărcarea documentului a eșuat.'));
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
      setError(errMessage(err, 'Descărcarea documentului a eșuat.'));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={<FileText className="w-6 h-6 text-warning" />}
        title="Documente"
        subtitle="Documente reale, stocate pe server și asociate proiectului selectat."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadDocuments()}
            disabled={loading || uploading || !projectId}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            {t('general.refresh', locale)}
          </Button>
        }
      />

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-critical-soft bg-critical-soft p-3 text-sm text-critical-foreground">
          <span>{error}</span>
          <Button variant="ghost" size="icon" onClick={() => setError(null)} aria-label="Închide">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-success-soft bg-success-soft p-3 text-sm text-success-foreground">
          <CheckCircle2 className="w-4 h-4" />{success}
        </div>
      )}

      {loadError ? (
        <ErrorState
          title="Eroare la încărcarea documentelor"
          error={loadError}
          onRetry={retryLoad}
        />
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <label htmlFor="documente-project" className="block text-xs font-semibold text-slate-600 mb-1">Proiect</label>
              <select
                id="documente-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loading || uploading}
                className="hii-select"
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
                <label htmlFor="documente-type" className="block text-xs font-semibold text-slate-600 mb-1">Tip document</label>
                <select
                  id="documente-type"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="hii-select"
                >
                  {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="documente-title" className="block text-xs font-semibold text-slate-600 mb-1">Titlu</label>
                <input
                  id="documente-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={file?.name || 'Titlu document'}
                  className="hii-input"
                />
              </div>
              <div>
                <label htmlFor="documente-file" className="block text-xs font-semibold text-slate-600 mb-1">Fișier</label>
                <input
                  id="documente-file"
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
              <Button
                variant="primary"
                onClick={() => void submitUpload()}
                disabled={!projectId || !file}
                loading={uploading}
                icon={<Upload className="w-4 h-4" />}
              >
                {uploading ? 'Se încarcă…' : 'Încarcă documentul'}
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">Documente proiect</h2>
            {loading ? (
              <Skeleton className="h-16" count={3} />
            ) : documents.length === 0 ? (
              <Card padding={false}>
                <EmptyState
                  icon={<FileText />}
                  title="No documents yet"
                  description="Upload project documents to keep them organized."
                  action={{ label: 'Upload document', onClick: () => inputRef.current?.click() }}
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const latest = doc.versions?.[0];
                  return (
                    <Card key={doc.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {TYPES.find(([value]) => value === doc.document_type)?.[1] || doc.document_type}
                            {' · '}v{doc.current_version}
                            {' · '}{formatSize(latest?.file_size || 0)}
                            {' · '}{doc.updated_at ? new Date(doc.updated_at).toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB') : '—'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download className="w-4 h-4" />}
                        onClick={() => void download(doc)}
                        className="shrink-0"
                      >
                        Descarcă
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DocumentsPage;

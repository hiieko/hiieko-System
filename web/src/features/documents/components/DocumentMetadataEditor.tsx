'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lightbulb, LoaderCircle, MapPin, Tag } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient, ApiError, type DocumentDetail } from '../../../lib/api-client';
import { Button, Modal } from '../../../components/ui';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL_KEYS } from '../documents.constants';
import {
  parseClassificationExplanation,
  suggestDescriptiveFilename,
  suggestDocumentClassification,
} from '../documents.classification';
import type { UploadProject } from './DocumentUploadCard';

interface DocumentMetadataEditorProps {
  documentId: string | null;
  open: boolean;
  projects: UploadProject[];
  onClose: () => void;
  onSaved: (document: DocumentDetail) => void;
}

function confidenceLabel(value: 'high' | 'medium', locale: 'ro' | 'en'): string {
  return t(value === 'high' ? 'documents.classification_confidence_high' : 'documents.classification_confidence_medium', locale);
}

export function DocumentMetadataEditor({
  documentId,
  open,
  projects,
  onClose,
  onSaved,
}: DocumentMetadataEditorProps) {
  const { locale } = useLocale();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void apiClient.getDocument(documentId)
      .then((response) => {
        if (cancelled) return;
        if (response.error || !response.data) throw new Error(response.error || t('documents.details_error', locale));
        const document = response.data;
        setDetail(document);
        setTitle(document.title);
        setCode(document.code ?? '');
        setDocumentType(document.document_type);
        setProjectId(document.project_id ?? '');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error || reason instanceof ApiError ? reason.message : t('documents.details_error', locale));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, documentId, locale]);

  const suggestions = useMemo(() => suggestDocumentClassification({
    fileName: detail?.title,
    title,
    code,
    mimeType: detail?.mime_type,
    currentCategory: detail?.document_type,
    projects,
  }), [detail, title, code, projects]);

  const filenameSuggestion = useMemo(() => {
    const selectedProject = projects.find((project) => project.id === projectId);
    const projectCode = selectedProject?.code ?? (projectId === detail?.project_id ? detail?.project_code : null);
    return suggestDescriptiveFilename({
      sourceName: detail?.title,
      title,
      code,
      projectCode,
      documentType,
      mimeType: detail?.mime_type,
    });
  }, [detail, title, code, projectId, documentType, projects]);

  const projectName = (id: string) => {
    if (id === detail?.project_id && detail.project_name) {
      return `${detail.project_code ? `${detail.project_code} — ` : ''}${detail.project_name}`;
    }
    const project = projects.find((item) => item.id === id);
    return project ? `${project.code ? `${project.code} — ` : ''}${project.name}` : t('documents.no_project', locale);
  };

  const applyCategorySuggestion = (suggested: string) => setDocumentType(suggested);
  const applyProjectSuggestion = (suggested: string) => setProjectId(suggested);

  const save = async () => {
    if (!detail || !documentId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiClient.updateDocumentMetadata(documentId, {
        title: title.trim(),
        code: code.trim() || null,
        documentType,
        ...(projectId && projectId !== detail.project_id ? { projectId } : {}),
      });
      if (response.error || !response.data) throw new Error(response.error || t('documents.metadata_save_error', locale));
      onSaved(response.data);
      onClose();
    } catch (reason: unknown) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : t('documents.metadata_save_error', locale));
    } finally {
      setSaving(false);
    }
  };

  const renderCandidateReason = (explanation: string) => {
    const parsed = parseClassificationExplanation(explanation);
    return `${t(parsed.key, locale)}${parsed.evidence ? `: ${parsed.evidence}` : ''}`;
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      size="xl"
      title={t('documents.metadata_editor_title', locale)}
      footer={detail && !loading ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{t('documents.metadata_no_file_change', locale)}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('general.cancel', locale)}</Button>
            <Button type="button" variant="primary" onClick={() => void save()} disabled={saving || !documentType || !title.trim()} loading={saving} icon={<Check className="size-4" />}>
              {t('documents.metadata_save', locale)}
            </Button>
          </div>
        </div>
      ) : null}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />{t('documents.preview_loading', locale)}</div>
      ) : error && !detail ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>
      ) : detail ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <section className="space-y-4" aria-label={t('documents.metadata_current_values', locale)}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">{t('documents.metadata_current_values', locale)}</p>
              <p className="mt-1 break-words text-sm font-semibold text-slate-900">{detail.title}</p>
              <p className="mt-1 text-xs text-slate-600">{t(DOCUMENT_TYPE_LABEL_KEYS[detail.document_type as keyof typeof DOCUMENT_TYPE_LABEL_KEYS], locale)} · {projectName(detail.project_id ?? '')}</p>
            </div>

            <div>
              <label htmlFor="document-metadata-title" className="mb-1 block text-sm font-medium text-slate-700">{t('documents.field_title', locale)}</label>
              <input id="document-metadata-title" className="hii-input w-full" maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="document-metadata-category" className="mb-1 block text-sm font-medium text-slate-700">{t('documents.field_type', locale)}</label>
                <select id="document-metadata-category" className="hii-select w-full" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  <option value="">{t('documents.classification_choose', locale)}</option>
                  {DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{t(DOCUMENT_TYPE_LABEL_KEYS[value], locale)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="document-metadata-code" className="mb-1 block text-sm font-medium text-slate-700">{t('documents.field_code', locale)}</label>
                <input id="document-metadata-code" className="hii-input w-full" maxLength={64} value={code} onChange={(event) => setCode(event.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="document-metadata-project" className="mb-1 block text-sm font-medium text-slate-700">{t('documents.field_project', locale)}</label>
              <select id="document-metadata-project" className="hii-select w-full" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {detail.project_id && !projects.some((item) => item.id === detail.project_id) && <option value={detail.project_id}>{projectName(detail.project_id)}</option>}
                <option value="" disabled={Boolean(detail.project_id)}>{t('documents.no_project', locale)}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.code ? `${project.code} — ` : ''}{project.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{t('documents.metadata_project_confirm_note', locale)}</p>
            </div>
            {filenameSuggestion && filenameSuggestion.filename !== title && (
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">{t('documents.filename_suggestion_title', locale)}</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-900">{filenameSuggestion.filename}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500">{t(filenameSuggestion.explanation, locale)} {t('documents.filename_metadata_only', locale)}</p>
                <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setTitle(filenameSuggestion.filename)}>{t('documents.filename_use_suggestion', locale)}</Button>
              </div>
            )}
          </section>

          <aside className="space-y-3 rounded-lg border border-hii-200 bg-hii-50/40 p-4" aria-label={t('documents.classification_suggestions', locale)}>
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-hii-700" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t('documents.classification_suggestions', locale)}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{t('documents.classification_evidence_scope', locale)}</p>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Tag className="size-3.5" />{t('documents.field_type', locale)}</p>
              {suggestions.categories.length ? (
                <ul className="mt-2 space-y-2">
                  {suggestions.categories.map((candidate) => (
                    <li key={candidate.value} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{t(DOCUMENT_TYPE_LABEL_KEYS[candidate.value], locale)}</p>
                        <p className="text-xs text-slate-500">{renderCandidateReason(candidate.explanation)} · {confidenceLabel(candidate.confidence, locale)}</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => applyCategorySuggestion(candidate.value)} aria-label={`${t('documents.classification_use_suggestion', locale)}: ${t(DOCUMENT_TYPE_LABEL_KEYS[candidate.value], locale)}`}>
                        {confidenceLabel(candidate.confidence, locale)}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-xs text-slate-500">{t('documents.classification_no_match', locale)}</p>}
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><MapPin className="size-3.5" />{t('documents.field_project', locale)}</p>
              {suggestions.projects.length ? (
                <ul className="mt-2 space-y-2">
                  {suggestions.projects.map((candidate) => (
                    <li key={candidate.value.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{candidate.value.code ? `${candidate.value.code} — ` : ''}{candidate.value.name}</p>
                        <p className="text-xs text-slate-500">{renderCandidateReason(candidate.explanation)} · {confidenceLabel(candidate.confidence, locale)}</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => applyProjectSuggestion(candidate.value.id)} aria-label={`${t('documents.classification_use_suggestion', locale)}: ${candidate.value.name}`}>
                        {confidenceLabel(candidate.confidence, locale)}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-xs text-slate-500">{t('documents.classification_no_project_match', locale)}</p>}
            </div>
          </aside>

          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{error}</p>}
          <p className="text-xs text-slate-500 lg:col-span-2">{t('documents.classification_not_applied', locale)}</p>
        </div>
      ) : null}
    </Modal>
  );
}

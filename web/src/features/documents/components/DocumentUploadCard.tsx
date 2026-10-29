'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, MapPin, Tag, Upload } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient, ApiError, type ExactDuplicateMatch } from '../../../lib/api-client';
import { Button, Modal } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_MIME_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL_KEYS,
  MAX_UPLOAD_BYTES,
} from '../documents.constants';
import { suggestDescriptiveFilename, suggestDocumentClassification } from '../documents.classification';

export interface UploadProject {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
}

interface DocumentUploadCardProps {
  open: boolean;
  projects: UploadProject[];
  projectsLoading: boolean;
  projectsError?: string | null;
  projectId: string;
  onClose: () => void;
  onProjectChange: (projectId: string) => void;
  onOpenDocument: (documentId: string) => void;
  onUploaded: () => void;
}

/**
 * HIIEKO - document upload panel.
 *
 * The file is sent to `POST /api/documents` (NestJS) as multipart/form-data.
 * The destination project is always explicit - it is never assigned
 * implicitly - and the progress bar reflects the real XHR upload progress.
 */
export function DocumentUploadCard({
  open,
  projects,
  projectsLoading,
  projectsError,
  projectId,
  onClose,
  onProjectChange,
  onOpenDocument,
  onUploaded,
}: DocumentUploadCardProps) {
  const { locale } = useLocale();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [documentType, setDocumentType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<ExactDuplicateMatch[]>([]);

  const suggestions = useMemo(() => suggestDocumentClassification({
    fileName: file?.name,
    title,
    code,
    mimeType: file?.type,
    projects,
  }), [file, title, code, projects]);
  const filenameSuggestion = useMemo(() => {
    const project = projects.find((candidate) => candidate.id === projectId);
    return suggestDescriptiveFilename({
      sourceName: file?.name,
      title,
      code,
      projectCode: project?.code,
      documentType,
      mimeType: file?.type,
    });
  }, [file, title, code, projectId, documentType, projects]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const closeDialog = () => {
    if (!uploading) onClose();
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setCode('');
    setDocumentType('');
    setDuplicateMatches([]);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (allowDuplicate = false) => {
    setError(null);

    if (!projectId) {
      setError(t('documents.project_required', locale));
      return;
    }
    if (!documentType) {
      setError(t('documents.classification_choose', locale));
      return;
    }
    if (!file) {
      setError(t('documents.file_required', locale));
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError(t('documents.invalid_type', locale));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('documents.file_too_large', locale));
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const response = await apiClient.uploadDocument(file, {
        projectId,
        documentType,
        title: title.trim() || undefined,
        code: code.trim() || undefined,
        allowDuplicate,
        onProgress: (percent) => setProgress(percent),
      });
      if (response.data?.duplicate) {
        setDuplicateMatches(response.data.matches);
        return;
      }
      toast.success(t('documents.toast_success', locale));
      reset();
      onUploaded();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.toast_error', locale);
      setError(message);
      toast.error(t('documents.toast_error', locale), message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      size="lg"
      title={t('documents.upload_title', locale)}
      showClose={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={closeDialog} disabled={uploading}>
            {t('general.cancel', locale)}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={uploading || !file || !projectId || !documentType || duplicateMatches.length > 0}
            loading={uploading}
            icon={<Upload className="w-4 h-4" />}
          >
            {uploading ? t('documents.uploading', locale) : t('documents.submit', locale)}
          </Button>
        </div>
      }
    >
      <div data-testid="documents-upload" className="space-y-4">
        <p className="text-sm text-slate-600">{t('documents.upload_hint', locale)}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="documente-upload-project"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('documents.field_project', locale)}
            </label>
            <select
              id="documente-upload-project"
              className="hii-select"
              value={projectId}
              onChange={(e) => {
                setDuplicateMatches([]);
                onProjectChange(e.target.value);
              }}
              disabled={uploading || projects.length === 0}
              required
            >
              <option value="">{t('documents.select_project', locale)}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code ? `${project.code} — ` : ''}
                  {project.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {projectsError || (projects.length === 0 && !projectsLoading
                ? t('documents.projects_empty', locale)
                : t('documents.field_project_hint', locale))}
            </p>
          </div>

          <div>
            <label
              htmlFor="documente-upload-type"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('documents.field_type', locale)}
            </label>
            <select
              id="documente-upload-type"
              className="hii-select"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              disabled={uploading}
              required
            >
              <option value="">{t('documents.classification_choose', locale)}</option>
              {DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(DOCUMENT_TYPE_LABEL_KEYS[value], locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="documente-upload-file"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('documents.field_file', locale)}
            </label>
            <input
              id="documente-upload-file"
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => {
                setDuplicateMatches([]);
                setFile(e.target.files?.[0] ?? null);
              }}
              disabled={uploading}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              required
            />
          </div>

          <div>
            <label
              htmlFor="documente-upload-title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('documents.field_title', locale)}
            </label>
            <input
              id="documente-upload-title"
              className="hii-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name ?? ''}
              disabled={uploading}
              maxLength={180}
            />
          </div>

          <div>
            <label
              htmlFor="documente-upload-code"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t('documents.field_code', locale)}
            </label>
            <input
              id="documente-upload-code"
              className="hii-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={uploading}
              maxLength={64}
            />
          </div>
        </div>

        {file && (
          <section className="rounded-lg border border-hii-200 bg-hii-50/50 p-3" aria-label={t('documents.classification_suggestions', locale)}>
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-hii-700" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{t('documents.classification_suggestions', locale)}</h3>
                <p className="mt-0.5 text-xs text-slate-600">{t('documents.classification_upload_scope', locale)}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Tag className="size-3.5" />{t('documents.field_type', locale)}</p>
                {suggestions.categories.length ? (
                  <ul className="mt-2 space-y-2">
                    {suggestions.categories.map((candidate) => {
                      const [reasonKey, evidence] = candidate.explanation.split('|', 2);
                      return (
                        <li key={candidate.value} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{t(DOCUMENT_TYPE_LABEL_KEYS[candidate.value], locale)}</p>
                            <p className="text-xs text-slate-500">{t(reasonKey, locale)}{evidence ? `: “${evidence}”` : ''} · {t(candidate.confidence === 'high' ? 'documents.classification_confidence_high' : 'documents.classification_confidence_medium', locale)}</p>
                          </div>
                          <Button type="button" size="sm" variant="secondary" aria-label={`${t('documents.classification_use_suggestion', locale)}: ${t(DOCUMENT_TYPE_LABEL_KEYS[candidate.value], locale)}`} onClick={() => setDocumentType(candidate.value)}>{t('documents.classification_use_suggestion', locale)}</Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mt-2 text-xs text-slate-500">{t('documents.classification_no_match', locale)}</p>}
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><MapPin className="size-3.5" />{t('documents.field_project', locale)}</p>
                {suggestions.projects.length ? (
                  <ul className="mt-2 space-y-2">
                    {suggestions.projects.map((candidate) => {
                      const [reasonKey, evidence] = candidate.explanation.split('|', 2);
                      return (
                        <li key={candidate.value.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{candidate.value.code ? `${candidate.value.code} — ` : ''}{candidate.value.name}</p>
                            <p className="text-xs text-slate-500">{t(reasonKey, locale)}{evidence ? `: “${evidence}”` : ''} · {t(candidate.confidence === 'high' ? 'documents.classification_confidence_high' : 'documents.classification_confidence_medium', locale)}</p>
                          </div>
                          <Button type="button" size="sm" variant="secondary" aria-label={`${t('documents.classification_use_suggestion', locale)}: ${candidate.value.name}`} onClick={() => onProjectChange(candidate.value.id)}>{t('documents.classification_use_suggestion', locale)}</Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mt-2 text-xs text-slate-500">{t('documents.classification_no_project_match', locale)}</p>}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('documents.classification_not_applied', locale)}</p>
          </section>
        )}

        {file && filenameSuggestion && filenameSuggestion.filename !== (title.trim() || file.name) && (
          <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label={t('documents.filename_suggestion_title', locale)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">{t('documents.filename_suggestion_title', locale)}</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-900">{filenameSuggestion.filename}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500">{t(filenameSuggestion.explanation, locale)} {t('documents.filename_metadata_only', locale)}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => setTitle(filenameSuggestion.filename)}>
                {t('documents.filename_use_suggestion', locale)}
              </Button>
            </div>
          </section>
        )}

        {duplicateMatches.length > 0 && (
          <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3" role="alert" aria-label={t('documents.duplicate_warning_title', locale)}>
            <div>
              <h3 className="text-sm font-semibold text-amber-950">{t('documents.duplicate_warning_title', locale)}</h3>
              <p className="mt-1 text-xs leading-5 text-amber-900">{t('documents.duplicate_exact_scope', locale)}</p>
            </div>
            <ul className="divide-y divide-amber-200 rounded-md border border-amber-200 bg-white">
              {duplicateMatches.map((match) => (
                <li key={`${match.documentId}-${match.matchingVersion}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{match.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{match.projectCode ? `${match.projectCode} — ` : ''}{match.projectName} · v{match.matchingVersion} · {t(DOCUMENT_TYPE_LABEL_KEYS[match.documentType as keyof typeof DOCUMENT_TYPE_LABEL_KEYS] ?? 'documents.type_other', locale)}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => {
                    const documentId = match.documentId;
                    reset();
                    onClose();
                    onOpenDocument(documentId);
                  }}>{t('documents.duplicate_open_existing', locale)}</Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button type="button" variant="primary" size="sm" disabled={uploading} loading={uploading} onClick={() => void handleSubmit(true)}>{t('documents.duplicate_upload_separately', locale)}</Button>
            </div>
          </section>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger-foreground"
          >
            {error}
          </p>
        )}

        {uploading && progress !== null && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-hii-600 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-label={t('documents.uploading', locale)}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t('documents.uploading_progress', locale).replace('{percent}', String(progress))}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

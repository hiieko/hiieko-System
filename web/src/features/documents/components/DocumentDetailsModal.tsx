'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, History } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient, ApiError, type DocumentDetail } from '../../../lib/api-client';
import { Button, Modal } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_MIME_TYPES,
  DOCUMENT_TYPE_LABEL_KEYS,
  MAX_UPLOAD_BYTES,
  formatBytes,
  formatDateTime,
  formatVersionFilename,
} from '../documents.constants';

interface DocumentDetailsModalProps {
  documentId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  folderName?: string | null;
  canManageFolders: boolean;
  onRequestMoveToFolder: (document: DocumentDetail) => void;
}

/**
 * HIIEKO - document details.
 *
 * The panel is fed by `GET /api/documents/:id`, which returns the real
 * metadata and the full version history. Nothing is derived from a local
 * cache, and no field is shown that the server did not return.
 */
export function DocumentDetailsModal({
  documentId,
  open,
  onClose,
  onChanged,
  folderName,
  canManageFolders,
  onRequestMoveToFolder,
}: DocumentDetailsModalProps) {
  const { locale } = useLocale();
  const toast = useToast();
  const versionInputRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [duplicateVersion, setDuplicateVersion] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getDocument(documentId);
      setDetail(response.data ?? null);
    } catch (err: unknown) {
      setDetail(null);
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.details_error', locale),
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, locale]);

  useEffect(() => {
    if (open && documentId) {
      setVersionFile(null);
      setDuplicateVersion(null);
      setProgress(null);
      void load();
    }
  }, [open, documentId, load]);

  const download = async () => {
    if (!detail) return;
    try {
      const blob = await apiClient.downloadDocument(detail.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = detail.title;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(
        t('documents.download_error', locale),
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.download_error', locale),
      );
    }
  };

  const downloadVersion = async (version: DocumentDetail['versions'][number]) => {
    if (!detail) return;
    setDownloadingVersion(version.id);
    try {
      const blob = await apiClient.downloadDocumentVersion(detail.id, version.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = formatVersionFilename(detail.title, version.version);
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(
        t('documents.download_error', locale),
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.download_error', locale),
      );
    } finally {
      setDownloadingVersion(null);
    }
  };

  const uploadVersion = async (allowDuplicate = false) => {
    if (!detail || !versionFile) return;
    if (!ACCEPTED_MIME_TYPES.includes(versionFile.type)) {
      toast.error(t('documents.invalid_type', locale));
      return;
    }
    if (versionFile.size > MAX_UPLOAD_BYTES) {
      toast.error(t('documents.file_too_large', locale));
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const response = await apiClient.uploadDocumentVersion(detail.id, versionFile, {
        allowDuplicate,
        onProgress: (percent) => setProgress(percent),
      });
      if (response.data && 'duplicate' in response.data && response.data.duplicate === true) {
        setDuplicateVersion(response.data.matches[0]?.matchingVersion ?? null);
        return;
      }
      toast.success(t('documents.version_uploaded', locale));
      setVersionFile(null);
      setDuplicateVersion(null);
      if (versionInputRef.current) versionInputRef.current.value = '';
      await load();
      onChanged();
    } catch (err: unknown) {
      toast.error(
        t('documents.version_upload_error', locale),
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.version_upload_error', locale),
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const typeLabel = detail
    ? t(DOCUMENT_TYPE_LABEL_KEYS[detail.document_type as keyof typeof DOCUMENT_TYPE_LABEL_KEYS] ?? 'documents.type_other', locale)
    : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('documents.detail_title', locale)}
      footer={
        detail ? (
          detail.is_archived ? (
            <p className="text-xs text-slate-500">{t('documents.archived_period', locale)}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">{t('documents.new_version_hint', locale)}</p>
                <div className="flex items-center gap-2">
                  <input
                    ref={versionInputRef}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    onChange={(e) => {
                      setVersionFile(e.target.files?.[0] ?? null);
                      setDuplicateVersion(null);
                    }}
                    disabled={uploading}
                    aria-label={t('documents.action_new_version', locale)}
                    className="text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FileUp className="w-4 h-4" />}
                    onClick={() => void uploadVersion()}
                    disabled={uploading || !versionFile || duplicateVersion !== null}
                    loading={uploading}
                  >
                    {t('documents.action_new_version', locale)}
                  </Button>
                </div>
              </div>
              {duplicateVersion !== null && (
                <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-amber-950">{t('documents.duplicate_version_title', locale)} · v{duplicateVersion}. {t('documents.duplicate_version_hint', locale)}</p>
                  <Button type="button" variant="secondary" size="sm" disabled={uploading} loading={uploading} onClick={() => void uploadVersion(true)} className="shrink-0">
                    {t('documents.duplicate_add_version', locale)}
                  </Button>
                </div>
              )}
            </div>
          )
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-3 py-4">
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
          <div className="h-24 w-full rounded bg-slate-100" />
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-danger-foreground">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()} className="mt-3">
            {t('general.retry', locale)}
          </Button>
        </div>
      ) : detail ? (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 break-words">
              {detail.title}
            </h3>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_type', locale)}</dt>
                <dd className="text-slate-800">{typeLabel}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_project', locale)}</dt>
                <dd className="text-slate-800 break-words">
                  {detail.project_name
                    ? `${detail.project_code ? `${detail.project_code} — ` : ''}${detail.project_name}`
                    : t('documents.no_project', locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.folder_location', locale)}</dt>
                <dd className="text-slate-800 break-words">{detail.folder_id ? folderName || detail.folder_name || '—' : t('documents.folder_unfiled_location', locale)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_code', locale)}</dt>
                <dd className="text-slate-800 font-mono">{detail.code || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_version', locale)}</dt>
                <dd className="text-slate-800">v{detail.current_version}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_size', locale)}</dt>
                <dd className="text-slate-800">{formatBytes(detail.file_size)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_uploader', locale)}</dt>
                <dd className="text-slate-800 break-words">
                  {detail.uploaded_by_name || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_created', locale)}</dt>
                <dd className="text-slate-800">{formatDateTime(detail.created_at, locale)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-slate-500">{t('documents.detail_updated', locale)}</dt>
                <dd className="text-slate-800">{formatDateTime(detail.updated_at, locale)}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              {t('documents.detail_versions', locale)}
            </h4>
            <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {(detail.versions ?? []).map((version) => (
                <li
                  key={version.id ?? version.version}
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-700">
                      v{version.version}
                      {version.version === detail.current_version && (
                        <span className="ml-2 text-success-foreground font-medium">
                          · {t('documents.version_current', locale)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-slate-500">
                      {formatBytes(version.file_size)} · {formatDateTime(version.created_at, locale)}
                      {version.uploaded_by_name ? ` · ${version.uploaded_by_name}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadVersion(version)}
                    disabled={downloadingVersion === version.id}
                    aria-label={t('documents.download_version', locale).replace('{version}', String(version.version))}
                    title={t('documents.download_version', locale).replace('{version}', String(version.version))}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-hii-50 hover:text-hii-700 focus:outline-none focus:ring-2 focus:ring-hii-500 disabled:opacity-50"
                  >
                    {downloadingVersion === version.id ? <span className="size-3 animate-spin rounded-full border-2 border-slate-300 border-t-hii-600" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end">
            {!detail.is_archived && canManageFolders && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRequestMoveToFolder(detail)}
                className="mr-auto"
              >{t('documents.folder_move_document', locale)}</Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => void download()}
            >
              {t('documents.action_download', locale)}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

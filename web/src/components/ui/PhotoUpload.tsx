'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X, ImageOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import type { PhotoAttachment } from '../../lib/api-client';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

export type PhotoTargetType =
  | 'task'
  | 'daily_report'
  | 'issue'
  | 'inspection'
  | 'project';

export interface PhotoUploadProps {
  /** Which entity the photos belong to. */
  targetType: PhotoTargetType;
  targetId: string;
  /** Project the target belongs to — required for scoping + access checks. */
  projectId: string;
  /** Hide the add/remove controls (read-only display). */
  readOnly?: boolean;
  /** Fired after every successful add/remove with the current list. */
  onChange?: (attachments: PhotoAttachment[]) => void;
  className?: string;
}

const I18N = {
  ro: {
    title: 'Fotografii',
    add: 'Adaugă fotografie',
    uploading: 'Se încarcă…',
    empty: 'Nicio fotografie încă.',
    loadError: 'Fotografiile nu au putut fi încărcate.',
    uploadError: 'Fotografia nu a putut fi încărcată.',
    removeError: 'Fotografia nu a putut fi ștearsă.',
    remove: 'Șterge fotografia',
    removeTitle: 'Șterge fotografia?',
    removeMessage: 'Fotografia va fi eliminată. Acțiunea nu poate fi anulată.',
    removeConfirm: 'Șterge',
    removeCancel: 'Anulează',
    view: 'Vezi fotografia',
    close: 'Închide',
  },
  en: {
    title: 'Photos',
    add: 'Add photo',
    uploading: 'Uploading…',
    empty: 'No photos yet.',
    loadError: 'Photos could not be loaded.',
    uploadError: 'The photo could not be uploaded.',
    removeError: 'The photo could not be removed.',
    remove: 'Remove photo',
    removeTitle: 'Remove photo?',
    removeMessage: 'The photo will be removed. This cannot be undone.',
    removeConfirm: 'Remove',
    removeCancel: 'Cancel',
    view: 'View photo',
    close: 'Close',
  },
} as const;

/** The blob route is `/api/upload/:documentId`; recover the document id. */
function documentIdFromUrl(url: string): string {
  return url.split('/').filter(Boolean).pop() || '';
}

export function PhotoUpload({
  targetType,
  targetId,
  projectId,
  readOnly = false,
  onChange,
  className,
}: PhotoUploadProps) {
  const { locale } = useLocale();
  const l = I18N[locale === 'ro' ? 'ro' : 'en'];
  const toast = useToast();

  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<PhotoAttachment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PhotoAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const urlMapRef = useRef<Map<string, string>>(new Map());
  const cancelledRef = useRef(false);

  /** Revoke every object URL we created (once, on unmount). */
  useEffect(() => {
    const map = urlMapRef.current;
    return () => {
      cancelledRef.current = true;
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  const load = useCallback(async () => {
    if (!targetId || !projectId) {
      setAttachments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listAttachments({
        targetType,
        targetId,
        projectId,
      });
      const list = (response.data || []) as PhotoAttachment[];
      if (cancelledRef.current) return;
      setAttachments(list);
      onChange?.(list);

      // Fetch each blob with auth (an <img src> cannot carry the bearer token).
      const map = urlMapRef.current;
      const keep = new Set(list.map((a) => a.id));
      map.forEach((url, id) => {
        if (!keep.has(id)) {
          URL.revokeObjectURL(url);
          map.delete(id);
        }
      });

      await Promise.all(
        list.map(async (a) => {
          if (map.has(a.id)) return;
          const documentId = documentIdFromUrl(a.url);
          if (!documentId) return;
          try {
            const blob = await apiClient.downloadDocument(documentId);
            if (cancelledRef.current) return;
            map.set(a.id, URL.createObjectURL(blob));
          } catch {
            // A single unreadable blob must not break the whole grid.
          }
        }),
      );
      if (!cancelledRef.current) {
        setObjectUrls(Object.fromEntries(map.entries()));
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : l.loadError);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [targetType, targetId, projectId, onChange, l.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const uploaded = await apiClient.uploadPhoto(file, projectId);
        const documentId = uploaded.data?.documentId;
        if (!documentId) throw new Error(l.uploadError);
        await apiClient.createAttachment({
          targetType,
          targetId,
          fileId: documentId,
          projectId,
        });
        await load();
        toast.success(l.title, l.add);
      } catch (err) {
        const message = err instanceof Error ? err.message : l.uploadError;
        setError(message);
        toast.error(l.uploadError, message);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [projectId, targetType, targetId, load, toast, l.title, l.add, l.uploadError],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAttachment(pendingDelete.id, projectId);
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.error(l.removeError, err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, projectId, load, toast, l.removeError]);

  const showEmpty = !loading && !error && attachments.length === 0;

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-content">
          {l.title}
          {attachments.length > 0 && (
            <span className="ml-1.5 text-content-muted">({attachments.length})</span>
          )}
        </span>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
              aria-label={l.add}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              disabled={uploading || !targetId || !projectId}
              onClick={() => inputRef.current?.click()}
              icon={!uploading ? <ImagePlus className="w-4 h-4" /> : undefined}
            >
              {uploading ? l.uploading : l.add}
            </Button>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-content-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{l.uploading}</span>
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-danger-foreground">{error}</p>
      )}

      {showEmpty && <p className="text-sm text-content-muted">{l.empty}</p>}

      {!loading && attachments.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attachments.map((a) => {
            const src = objectUrls[a.id];
            return (
              <li key={a.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setActivePhoto(a)}
                  aria-label={l.view}
                  className="block aspect-square w-full overflow-hidden rounded-lg border border-chrome-line bg-surface-muted"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={a.file_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-content-muted">
                      <ImageOff className="w-5 h-5" />
                    </span>
                  )}
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(a);
                    }}
                    aria-label={l.remove}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white opacity-90 transition-opacity hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Full-size lightbox */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.file_name}
          onClick={() => setActivePhoto(null)}
        >
          <button
            type="button"
            onClick={() => setActivePhoto(null)}
            aria-label={l.close}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-5 h-5" />
          </button>
          {objectUrls[activePhoto.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrls[activePhoto.id]}
              alt={activePhoto.file_name}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-white/70">{l.loadError}</span>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setPendingDelete(null)}
        title={l.removeTitle}
        message={l.removeMessage}
        confirmLabel={l.removeConfirm}
        cancelLabel={l.removeCancel}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

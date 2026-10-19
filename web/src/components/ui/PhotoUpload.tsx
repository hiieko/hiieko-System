'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, Trash2, X, ImageOff } from 'lucide-react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import type { PhotoAttachment } from '../../lib/api-client';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  const toast = useToast();

  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<PhotoAttachment | null>(null);
  const [viewSrc, setViewSrc] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pendingDelete, setPendingDelete] = useState<PhotoAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlMapRef = useRef<Map<string, string>>(new Map());
  const cancelledRef = useRef(false);
  const lightboxRef = useRef<HTMLDivElement>(null);

  /** Revoke every object URL we created (once, on unmount). */
  useEffect(() => {
    const map = urlMapRef.current;
    return () => {
      cancelledRef.current = true;
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  // Trap focus inside the lightbox; focuses the close button on open and
  // restores focus to the thumbnail that opened it on close.
  useFocusTrap(lightboxRef, !!activePhoto);

  const closeLightbox = useCallback(() => setActivePhoto(null), []);

  // Close on Escape (capture-phase, same as Modal.tsx)
  const handleLightboxKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      }
    },
    [closeLightbox],
  );

  useEffect(() => {
    if (!activePhoto) return;
    document.addEventListener('keydown', handleLightboxKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleLightboxKeyDown, { capture: true });
    };
  }, [activePhoto, handleLightboxKeyDown]);

  // Lock scrolling in every scrollable ancestor (and the body) while the
  // full-screen viewer is open, restoring the previous values on close.
  useEffect(() => {
    if (!activePhoto) return;
    const locked: HTMLElement[] = [];
    const previous: (string | null)[] = [];
    let node: HTMLElement | null = rootRef.current;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        locked.push(node);
        previous.push(node.style.overflowY);
        node.style.overflowY = 'hidden';
      }
      node = node.parentElement;
    }
    locked.push(document.body);
    previous.push(document.body.style.overflowY);
    document.body.style.overflowY = 'hidden';
    return () => {
      locked.forEach((el, i) => {
        el.style.overflowY = previous[i] ?? '';
      });
    };
  }, [activePhoto]);

  // Resolve the full-size source for the selected photo: reuse the cached
  // object URL when available, otherwise fetch the blob through the existing
  // authenticated document route. Resets loading/error state on open, reopen
  // or photo switch so nothing stale survives between views.
  useEffect(() => {
    if (!activePhoto) {
      setViewSrc(null);
      setViewState('loading');
      return;
    }
    let disposed = false;
    setViewState('loading');
    (async () => {
      try {
        let src = urlMapRef.current.get(activePhoto.id);
        if (!src) {
          const documentId = documentIdFromUrl(activePhoto.url);
          if (!documentId) throw new Error('missing document id');
          const blob = await apiClient.downloadDocument(documentId);
          if (disposed) return;
          src = URL.createObjectURL(blob);
          urlMapRef.current.set(activePhoto.id, src);
          setObjectUrls(Object.fromEntries(urlMapRef.current.entries()));
        }
        if (!disposed) setViewSrc(src);
      } catch {
        if (!disposed) {
          setViewSrc(null);
          setViewState('error');
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [activePhoto]);

  // Retry after a failed view load: drop the cached (possibly unreadable)
  // object URL and fetch a fresh blob through the same authenticated route.
  const retryPhotoView = useCallback(async () => {
    if (!activePhoto) return;
    setViewState('loading');
    try {
      const stale = urlMapRef.current.get(activePhoto.id);
      if (stale) {
        URL.revokeObjectURL(stale);
        urlMapRef.current.delete(activePhoto.id);
      }
      const documentId = documentIdFromUrl(activePhoto.url);
      if (!documentId) throw new Error('missing document id');
      const blob = await apiClient.downloadDocument(documentId);
      const src = URL.createObjectURL(blob);
      urlMapRef.current.set(activePhoto.id, src);
      setObjectUrls(Object.fromEntries(urlMapRef.current.entries()));
      setViewSrc(src);
    } catch {
      setViewSrc(null);
      setViewState('error');
    }
  }, [activePhoto]);

  const load = useCallback(async () => {
    cancelledRef.current = false;
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
        setError(err instanceof Error ? err.message : t('photo_upload.load_error', locale));
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [targetType, targetId, projectId, onChange, locale]);

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
        if (!documentId) throw new Error(t('photo_upload.upload_error', locale));
        await apiClient.createAttachment({
          targetType,
          targetId,
          fileId: documentId,
          projectId,
        });
        await load();
        toast.success(t('photo_upload.title', locale), t('photo_upload.add', locale));
      } catch (err) {
        const message = err instanceof Error ? err.message : t('photo_upload.upload_error', locale);
        setError(message);
        toast.error(t('photo_upload.upload_error', locale), message);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [projectId, targetType, targetId, load, toast, locale],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAttachment(pendingDelete.id, projectId);
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.error(t('photo_upload.remove_error', locale), err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, projectId, load, toast, locale]);

  const showEmpty = !loading && !error && attachments.length === 0;

  return (
    <div ref={rootRef} className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-content">
          {t('photo_upload.title', locale)}
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
              aria-label={t('photo_upload.add', locale)}
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
              {uploading ? t('photo_upload.uploading', locale) : t('photo_upload.add', locale)}
            </Button>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-content-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('general.loading', locale)}</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-danger-foreground">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {t('general.retry', locale)}
          </Button>
        </div>
      )}

      {showEmpty && <p className="text-sm text-content-muted">{t('photo_upload.empty', locale)}</p>}

      {!loading && attachments.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
          {attachments.map((a) => {
            const src = objectUrls[a.id];
            return (
              <li key={a.id} className="group relative">
                <button
                  type="button"
                  onClick={(e) => {
                    // Ensure the thumbnail holds focus so the focus trap can
                    // restore focus to it when the lightbox closes.
                    e.currentTarget.focus();
                    setActivePhoto(a);
                  }}
                  aria-label={t('photo_upload.view', locale)}
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
                    aria-label={t('photo_upload.remove', locale)}
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

      {/* Full-size lightbox. Portalled to document.body so it is always
          viewport-fixed — an ancestor with backdrop-filter/transform (e.g. a
          sticky blurred page header) would otherwise become its containing
          block and stretch the viewer over the whole page instead of the
          viewport, hiding the photo behind the dark backdrop. */}
      {activePhoto &&
        createPortal(
          <div
            ref={lightboxRef}
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={activePhoto.file_name}
            tabIndex={-1}
            onClick={closeLightbox}
          >
            <button
              type="button"
              onClick={closeLightbox}
              aria-label={t('photo_upload.close', locale)}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white sm:right-4 sm:top-4"
            >
              <X className="w-5 h-5" />
            </button>
            {viewSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewSrc}
                alt={activePhoto.file_name}
                className={clsx(
                  'max-h-full max-w-full object-contain transition-opacity duration-150',
                  viewState === 'ready' ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setViewState('ready')}
                onError={() => {
                  setViewSrc(null);
                  setViewState('error');
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {viewState === 'loading' && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-3 text-white/80">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                  <span className="text-sm">{t('photo_upload.loading', locale)}</span>
                </div>
              </div>
            )}
            {viewState === 'error' && (
              <div
                className="absolute inset-0 grid place-items-center px-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <ImageOff className="h-8 w-8 text-white/60" aria-hidden="true" />
                  <p className="text-sm text-white/80">{t('photo_upload.load_error', locale)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void retryPhotoView()}
                  >
                    {t('general.retry', locale)}
                  </Button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}

      <ConfirmDialog
        open={!!pendingDelete}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setPendingDelete(null)}
        title={t('photo_upload.remove_title', locale)}
        message={t('photo_upload.remove_message', locale)}
        confirmLabel={t('photo_upload.remove_confirm', locale)}
        cancelLabel={t('photo_upload.remove_cancel', locale)}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

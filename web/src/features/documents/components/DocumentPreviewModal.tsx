'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient, ApiError, type DocumentListItem } from '../../../lib/api-client';
import { Modal } from '../../../components/ui';
import { isImage, isPreviewable, isXml } from '../documents.constants';

interface DocumentPreviewModalProps {
  document: DocumentListItem | null;
  open: boolean;
  inline?: boolean;
  onClose: () => void;
}

/**
 * HIIEKO - document preview.
 *
 * The preview is rendered from the authorized binary route
 * (`GET /api/upload/:documentId`) through a temporary object URL, so no
 * storage path and no public URL ever reaches the browser.
 */
export function DocumentPreviewModal({
  document,
  open,
  inline = false,
  onClose,
}: DocumentPreviewModalProps) {
  const { locale } = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  useEffect(() => {
    if (!open || !document) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setText(null);
    revoke();
    setUrl(null);

    const load = async () => {
      try {
        const blob = await apiClient.downloadDocument(document.id);
        if (cancelled) return;
        if (isXml(document.mime_type)) {
          const content = await blob.text();
          if (cancelled) return;
          setText(content.slice(0, 200_000));
          setLoading(false);
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        urlRef.current = objectUrl;
        setUrl(objectUrl);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setLoading(false);
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : t('documents.preview_error', locale),
        );
      }
    };

    void load();

    return () => {
      cancelled = true;
      revoke();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, document?.id]);

  useEffect(() => {
    if (!open) {
      revoke();
      setUrl(null);
      setText(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mimeType = document?.mime_type ?? null;

  const preview = (
    <>
      {error ? (
        <div className={inline ? 'py-5 text-center text-xs text-danger-foreground' : 'py-8 text-center text-sm text-danger-foreground'}>{error}</div>
      ) : loading ? (
        <div className={inline ? 'py-8 text-center text-xs text-slate-500' : 'py-10 text-center text-sm text-slate-500'}>
          {t('documents.preview_loading', locale)}
        </div>
      ) : !document || !isPreviewable(mimeType) ? (
        <div className={inline ? 'py-6 text-center text-xs text-slate-500' : 'py-8 text-center text-sm text-slate-500'}>
          {t('documents.preview_unavailable', locale)}
        </div>
      ) : isImage(mimeType) ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url ?? undefined}
            alt={document.title}
            className={`${inline ? 'max-h-56' : 'max-h-[70vh]'} max-w-full rounded-lg border border-slate-200`}
          />
        </div>
      ) : isXml(mimeType) ? (
        <pre className={`${inline ? 'max-h-56' : 'max-h-[70vh]'} overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700`}>
          {text ?? ''}
        </pre>
      ) : (
        <iframe
          src={url ?? undefined}
          title={document.title}
          className={`${inline ? 'h-64' : 'h-[70vh]'} w-full rounded-lg border border-slate-200`}
        />
      )}
    </>
  );

  if (inline) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label={t('documents.preview_title', locale)}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <p className="truncate text-xs font-semibold text-slate-700">{t('documents.preview_title', locale)}</p>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hii-500" aria-label={t('documents.action_close', locale)}><X className="size-4" aria-hidden="true" /></button>
        </div>
        <div className="p-2">{preview}</div>
      </section>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`${t('documents.preview_title', locale)}${document ? ` — ${document.title}` : ''}`}>
      {preview}
    </Modal>
  );
}

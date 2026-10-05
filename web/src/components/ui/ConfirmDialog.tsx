'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { t, useLocale } from '@solar/shared';

export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const { locale } = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;
  const resolvedConfirmLabel = confirmLabel ?? t('general.confirm', locale);
  const resolvedCancelLabel = cancelLabel ?? t('general.cancel', locale);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [open, onCancel, loading]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={resolvedCancelLabel}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => { if (!loading) onCancel(); }}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className={clsx(
          'relative z-10 mx-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface text-content shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200 focus:outline-none',
        )}
      >
        <div className="px-5 pb-5 pt-6 text-center sm:px-6 sm:pb-6">
          <div className={clsx(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-critical-soft text-critical-foreground' : 'bg-warning-soft text-warning-foreground',
          )}>
            <Icon size={21} aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-base font-semibold text-content">{title}</h2>
          <p id={messageId} className="mt-2 text-sm leading-relaxed text-content-secondary">{message}</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border-light px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-11 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hii-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-32',
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-500'
                : 'bg-amber-700 hover:bg-amber-800 focus-visible:outline-amber-600',
            )}
          >
            {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

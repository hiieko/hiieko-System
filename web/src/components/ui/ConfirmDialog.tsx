'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  const resolvedConfirmLabel = confirmLabel ?? 'Confirm';
  const resolvedCancelLabel = cancelLabel ?? 'Anuleaza';

  useFocusTrap(dialogRef, open);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [open, onCancel]);

  // Close on backdrop click
  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onCancel]);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const isDanger = variant === 'danger';
  const Icon = isDanger ? Trash2 : AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className={clsx(
          'relative z-10 w-full max-w-sm mx-4',
          'rounded-xl border border-slate-200',
          'bg-white shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          'focus:outline-none',
        )}
      >
        {/* Body */}
        <div className="px-6 pt-6 pb-4">
          {/* Icon */}
          <div
            className={clsx(
              'mx-auto flex h-11 w-11 items-center justify-center rounded-full mb-4',
              isDanger
                ? 'bg-danger-soft text-danger'
                : 'bg-warning-soft text-warning',
            )}
          >
            <Icon size={20} />
          </div>

          {/* Title */}
          <h2 id={titleId} className="text-base font-semibold text-slate-900 text-center">{title}</h2>

          {/* Message */}
          <p
            id={messageId}
            className="mt-2 text-sm text-slate-600 text-center leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={clsx(
              'flex-1 rounded-lg px-4 py-2.5',
              'text-sm font-medium transition-all',
              'bg-white text-slate-700',
              'border border-slate-300',
              'hover:bg-slate-50 active:bg-slate-100',
              'focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {resolvedCancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
              'text-sm font-medium transition-all',
              'text-white',
              isDanger
                ? 'bg-danger hover:bg-danger active:bg-danger-foreground'
                : 'bg-warning hover:bg-warning active:bg-amber-800',
              'shadow-sm hover:shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              isDanger
                ? 'focus:ring-red-500'
                : 'focus:ring-amber-500',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

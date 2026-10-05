'use client';

import React, { useEffect, useCallback, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { t, useLocale } from '@solar/shared';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  showClose?: boolean;
  className?: string;
  closeOnBackdrop?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { locale } = useLocale();

  useFocusTrap(dialogRef, open);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => { if (closeOnBackdrop) onClose(); }}
        aria-hidden="true"
      />
      {/* Modal panel */}
      <div
        ref={dialogRef}
        className={clsx(
          'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-content shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          sizeStyles[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? t('a11y.dialog', locale) : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border-light px-5 py-4 sm:px-6">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-content">{title}</h2>
            )}
            {showClose && (
              <button
                onClick={onClose}
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-alt hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hii-500"
                aria-label={t('general.close', locale)}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

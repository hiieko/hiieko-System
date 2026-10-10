'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
  fullPage?: boolean;
}

export function ErrorState({
  title = 'A apărut o eroare',
  message = 'Ceva nu a funcționat corect. Încercați din nou.',
  error,
  onRetry,
  className,
  fullPage = false,
}: ErrorStateProps) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        fullPage ? 'min-h-[60vh] px-6' : 'py-12 px-6',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-danger" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-2">{message}</p>
      {errorMessage && (
        <p className="text-xs text-slate-400 max-w-sm mb-4 font-mono bg-slate-50 px-3 py-1.5 rounded">
          {errorMessage}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={onRetry}>
          Încearcă din nou
        </Button>
      )}
    </div>
  );
}

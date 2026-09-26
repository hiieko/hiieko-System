'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLocale, t } from '@solar/shared';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {t('general.error', locale)}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {error.message || t('general.something_wrong', locale)}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('general.retry', locale)}
        </button>
      </div>
    </div>
  );
}

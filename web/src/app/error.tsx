'use client';

import React from 'react';
import { useLocale, t } from '@solar/shared';
import { ErrorState } from '../components/ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  return (
    <ErrorState
      fullPage
      title={t('general.error', locale)}
      message={t('general.something_wrong', locale)}
      error={error.message}
      onRetry={reset}
    />
  );
}
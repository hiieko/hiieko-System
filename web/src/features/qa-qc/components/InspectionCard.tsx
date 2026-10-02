'use client';

import React from 'react';
import { t, type Locale } from '@solar/shared';
import { ClipboardCheck, Ruler, FileWarning, User, Calendar } from 'lucide-react';
import type { Inspection } from '../types';

interface InspectionCardProps {
  inspection: Inspection;
  locale: Locale;
}

/** Mirrors the backend create behaviour: inspections are always recorded as COMPLETED. */
function statusBadge(inspection: Inspection, locale: Locale) {
  if (inspection.status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
        {t('qa.status_completed', locale)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
      {t('qa.status_pending', locale)}
    </span>
  );
}

export function InspectionCard({ inspection, locale }: InspectionCardProps) {
  const measurements = inspection.measurements ?? [];
  const ncrs = inspection.ncrs ?? [];
  const inspectedAt = new Date(inspection.inspected_at);
  const inspectedAtLabel = isNaN(inspectedAt.getTime())
    ? '—'
    : inspectedAt.toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  const failedCount = measurements.filter((m) => !m.passed).length;

  return (
    <article
      className="bg-surface border border-chrome-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
      aria-label={inspection.inspector_name}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-content truncate">
              <User className="h-4 w-4 text-content-muted shrink-0" aria-hidden="true" />
              {inspection.inspector_name}
            </span>
            {statusBadge(inspection, locale)}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-content-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t('qa.inspected_at', locale)}: {inspectedAtLabel}
            </span>
          </p>
          <p className="mt-1 text-xs text-content-muted">
            {inspection.template ? inspection.template.name : t('qa.template_none', locale)}
          </p>
        </div>
      </div>

      {measurements.length > 0 && (
        <div className="mt-3 border-t border-chrome-line pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-content-secondary mb-2">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            {`${measurements.length} ${t('qa.measurements_count', locale)}`}
            {failedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                {failedCount}
              </span>
            )}
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {measurements.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-muted text-xs"
              >
                <span className="text-content-secondary truncate">{m.parameter}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="font-semibold text-content">
                    {m.value} {m.unit}
                  </span>
                  <span
                    aria-label={m.passed ? 'passed' : 'failed'}
                    className={`h-2 w-2 rounded-full ${m.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ncrs.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-content-muted border-t border-chrome-line pt-3">
          <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
          {`${ncrs.length} ${t('qa.ncrs_count', locale)}`}
        </p>
      )}
    </article>
  );
}
'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { Badge, Card, Skeleton } from '@/components/ui';

import { formatDateMedium, todayCompanyIso } from '../summary';
import { deriveActiveBlockers } from '../readinessReads';
import type { ReadinessSnapshot, ReadResult } from '../readinessReads';

interface SiteReadinessCardProps {
  snapshot: ReadinessSnapshot;
  loading: boolean;
  /** YYYY-MM-DD local date the table is showing (for the honesty note). */
  selectedDate: string;
}

interface ReadinessRow {
  key: string;
  label: string;
  value: string | null;
  valueHint: string | null;
  badge: string | null;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  error: string | null;
}

function rowFrom<T>(
  key: string,
  label: string,
  result: ReadResult<T>,
  build: (data: T) => { value: string; hint?: string | null; badge?: string | null; badgeVariant?: ReadinessRow['badgeVariant'] },
): ReadinessRow {
  if (result.error) {
    return { key, label, value: null, valueHint: null, badge: null, badgeVariant: 'neutral', error: result.error };
  }
  if (!result.data) {
    return { key, label, value: null, valueHint: null, badge: null, badgeVariant: 'neutral', error: null };
  }
  const built = build(result.data);
  return {
    key,
    label,
    value: built.value,
    valueHint: built.hint ?? null,
    badge: built.badge ?? null,
    badgeVariant: built.badgeVariant ?? 'neutral',
    error: null,
  };
}

/**
 * "Site Readiness" rail card — can the selected day's plan be executed?
 *
 * Three rows, each backed by an existing endpoint (see readinessReads.ts):
 * attendance, stock, active blockers. Rows never show a fabricated verdict:
 * a failed read renders "Unavailable", an empty read renders its own empty
 * wording, and no percentage/score is computed (the backend has no such field).
 *
 * The attendance and stock reads are live figures (the attendance summary
 * endpoint only knows "today"), so when the table is showing another date the
 * card says so explicitly instead of implying per-date data.
 */
export function SiteReadinessCard({ snapshot, loading, selectedDate }: SiteReadinessCardProps) {
  const { locale } = useLocale();

  const attendance = rowFrom(
    'attendance',
    t('nav.pontaj', locale),
    snapshot.attendance,
    (summary) =>
      summary.totalWorkersToday === 0
        ? {
            value: t('planning.readiness_attendance_empty', locale),
            badge: t('planning.readiness_none', locale),
            badgeVariant: 'warning' as const,
          }
        : {
            value: t('planning.readiness_attendance_value', locale)
              .replace('{active}', String(summary.activeNow))
              .replace('{total}', String(summary.totalWorkersToday)),
          },
  );

  const materials = rowFrom(
    'materials',
    t('nav.stocuri', locale),
    snapshot.materials,
    (data) => {
      const lowCount = data.lowStock.length;
      if (data.tracked === 0) {
        return {
          value: t('planning.readiness_materials_empty', locale),
          badge: t('planning.readiness_none', locale),
          badgeVariant: 'neutral' as const,
        };
      }
      return {
        value: t('planning.readiness_materials_value', locale).replace(
          '{tracked}',
          String(data.tracked),
        ),
        hint: t('planning.readiness_low_stock_hint', locale),
        badge:
          lowCount > 0
            ? t('planning.readiness_low', locale).replace('{count}', String(lowCount))
            : null,
        badgeVariant: lowCount > 0 ? ('danger' as const) : ('neutral' as const),
      };
    },
  );

  const blockerCount = snapshot.issues.data ? deriveActiveBlockers(snapshot.issues.data).length : 0;
  const blockers = rowFrom(
    'blockers',
    t('nav.issues', locale),
    snapshot.issues,
    () =>
      blockerCount === 0
        ? {
            value: t('planning.readiness_blockers_empty', locale),
            badge: t('planning.readiness_clear', locale),
            badgeVariant: 'success' as const,
          }
        : {
            value: t('planning.readiness_blockers_value', locale).replace(
              '{count}',
              String(blockerCount),
            ),
            badge: t('planning.readiness_blockers_value', locale).replace(
              '{count}',
              String(blockerCount),
            ),
            badgeVariant: 'danger' as const,
          },
  );

  const rows = [attendance, materials, blockers];
  const showsOtherDate = selectedDate !== todayCompanyIso();

  return (
    <Card padding={false} className="p-4">
      <h2 className="text-sm font-bold text-slate-900">{t('planning.readiness_title', locale)}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{t('planning.readiness_subtitle', locale)}</p>

      {showsOtherDate && (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
          {t('planning.readiness_live_note', locale).replace(
            '{date}',
            formatDateMedium(todayCompanyIso(), locale),
          )}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            aria-label={
              row.error
                ? `${row.label}: ${t('planning.readiness_unavailable', locale)}`
                : `${row.label}: ${row.value ?? t('planning.readiness_unavailable', locale)}`
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {row.label}
              </p>
              {row.badge && (
                <Badge variant={row.badgeVariant} size="sm">
                  {row.badge}
                </Badge>
              )}
            </div>

            {loading ? (
              <Skeleton className="mt-1.5 h-4 w-32" />
            ) : row.error ? (
              <p className="mt-0.5 text-xs text-slate-500" title={row.error}>
                {t('planning.readiness_unavailable', locale)}
              </p>
            ) : (
              <p className="mt-0.5 break-words text-sm font-medium text-slate-800" title={row.valueHint ?? undefined}>
                {row.value ?? t('planning.readiness_unavailable', locale)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
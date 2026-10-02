'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { AlertTriangle, CheckCircle2, UserX } from 'lucide-react';

import { Badge, Card, Skeleton } from '@/components/ui';
import type { AttentionItem } from '../dayDerivations';

interface AttentionRequiredCardProps {
  /** Capped real items (blocked plan tasks, active blockers, unassigned tasks). */
  items: AttentionItem[];
  /** True number of items — may exceed `items.length`. */
  total: number;
  loading: boolean;
}

/**
 * "Attention Required" rail card.
 *
 * Every item is a real row from the day's plans or from the project's issues:
 * a plan task whose Task.status is BLOCKED, a plan task with zero assignees
 * (only when the assignment list is actually known), or an active blocker
 * issue. There is no blocked-reason text and no suggested action because the
 * backend stores neither.
 */
export function AttentionRequiredCard({ items, total, loading }: AttentionRequiredCardProps) {
  const { locale } = useLocale();
  const hidden = Math.max(0, total - items.length);

  return (
    <Card padding={false} className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-content">{t('planning.attention_title', locale)}</h2>
        {total > 0 && (
          <Badge variant="danger" size="sm">
            {total}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" variant="rectangular" />
          <Skeleton className="h-12 w-full" variant="rectangular" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-content-muted">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          {t('planning.attention_empty', locale)}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-chrome-line bg-surface px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  {item.kind === 'UNASSIGNED_TASK' ? (
                    <UserX className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${item.badgeVariant === 'danger' ? 'text-red-600' : 'text-amber-600'}`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-content">{item.title}</p>
                    {item.detail && (
                      <p className="mt-0.5 break-words text-xs text-content-muted">{item.detail}</p>
                    )}
                  </div>
                  {item.badge && (
                    <span className="flex-shrink-0">
                      <Badge variant={item.badgeVariant} size="sm">
                        {item.badge}
                      </Badge>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-2 text-xs text-content-muted">
              {t('planning.attention_more', locale).replace('{count}', String(hidden))}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
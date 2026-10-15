'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import { Button } from './Button';

interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * HIIEKO — shared list pagination bar.
 *
 * Layout: right-aligned controls on desktop, full-width stacked bar on mobile.
 * Copy: "Showing X–Y of Z  |  ‹ Prev  page / total  Next ›". Prev/Next are
 * disabled at the edges. Renders nothing when there are no rows.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const { locale } = useLocale();

  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const summary = t('pagination.summary', locale)
    .replace('{from}', String(from))
    .replace('{to}', String(to))
    .replace('{total}', String(total));

  return (
    <nav
      aria-label={t('pagination.label', locale)}
      className={clsx(
        'flex flex-col gap-3 mt-6 pt-4 border-t border-slate-200',
        'sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-content-muted tabular-nums">{summary}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 sm:flex-none"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          icon={<ChevronLeft className="w-4 h-4" />}
          aria-label={t('pagination.prev', locale)}
        >
          {t('pagination.prev', locale)}
        </Button>
        <span className="px-2 text-xs font-medium text-content-secondary tabular-nums whitespace-nowrap">
          {current} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 sm:flex-none"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          icon={<ChevronRight className="w-4 h-4" />}
          iconPosition="right"
          aria-label={t('pagination.next', locale)}
        >
          {t('pagination.next', locale)}
        </Button>
      </div>
    </nav>
  );
}

export default Pagination;

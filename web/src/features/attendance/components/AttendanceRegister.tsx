'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  CircleCheck,
  Clock,
  MapPin,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Badge, Button, EmptyState, ErrorState, Pagination, Skeleton } from '../../../components/ui';
import type { AttendanceRecord } from '../types';
import {
  DEFAULT_ATTENDANCE_SORT,
  formatDateLabel,
  formatHours,
  formatTime,
  getGpsState,
  getRecordedHours,
  getUserInitials,
  getUserName,
  getUserRole,
  groupRecordsByDate,
  isOpenSession,
  roleLabel,
  sessionLabel,
  sortAttendanceRecords,
  type AttendanceSort,
  type AttendanceSortKey,
} from '../utils';

interface Props {
  records: AttendanceRecord[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  canCorrect: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onSelect: (record: AttendanceRecord) => void;
  onCorrect: (record: AttendanceRecord) => void;
  onClearFilters: () => void;
}

const SORT_OPTIONS: Array<{ key: AttendanceSortKey; labelKey: string }> = [
  { key: 'checkIn', labelKey: 'pontaj.col_checkin' },
  { key: 'checkOut', labelKey: 'pontaj.col_checkout' },
  { key: 'worker', labelKey: 'pontaj.col_worker_short' },
  { key: 'site', labelKey: 'pontaj.col_site' },
  { key: 'regular', labelKey: 'pontaj.col_regular_short' },
  { key: 'overtime', labelKey: 'pontaj.col_overtime_short' },
  { key: 'status', labelKey: 'pontaj.col_status' },
];

export function AttendanceRegister({
  records,
  page,
  pageSize,
  total,
  loading,
  error,
  hasFilters,
  canCorrect,
  onRetry,
  onPageChange,
  onSelect,
  onCorrect,
  onClearFilters,
}: Props) {
  const { locale } = useLocale();
  const [sort, setSort] = useState<AttendanceSort>(DEFAULT_ATTENDANCE_SORT);
  const groups = useMemo(
    () =>
      groupRecordsByDate(records).map((group) => ({
        ...group,
        records: sortAttendanceRecords(group.records, sort, locale),
      })),
    [locale, records, sort],
  );
  const columnCount = canCorrect ? 9 : 8;

  const handleSort = (key: AttendanceSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : {
            key,
            direction: key === 'worker' || key === 'site' ? 'asc' : 'desc',
          },
    );
  };

  const toggleDirection = () => {
    setSort((current) => ({
      ...current,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{t('pontaj.register_title', locale)}</h2>
          <p className="text-xs text-slate-500">{t('pontaj.register_subtitle', locale)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-500">
          {t('pontaj.record_count', locale).replace('{count}', String(total))}
        </span>
      </div>

      {error ? (
        <div className="p-4">
          <ErrorState title={t('pontaj.error_load', locale)} error={error} onRetry={onRetry} />
        </div>
      ) : loading ? (
        <div className="space-y-3 p-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="py-3">
          <EmptyState
            variant="compact"
            icon={<Clock className="h-4 w-4" />}
            title={hasFilters ? t('pontaj.empty_filtered_title', locale) : t('pontaj.empty_title', locale)}
            description={hasFilters ? t('pontaj.empty_filtered_hint', locale) : t('pontaj.empty_hint', locale)}
            action={hasFilters ? { label: t('pontaj.filter_clear', locale), onClick: onClearFilters } : undefined}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 lg:hidden">
            <label
              htmlFor="attendance-sort"
              className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {t('pontaj.sort_label', locale)}
            </label>
            <select
              id="attendance-sort"
              value={sort.key}
              onChange={(event) =>
                setSort((current) => ({
                  ...current,
                  key: event.target.value as AttendanceSortKey,
                }))
              }
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-hii-500 focus:outline-none focus:ring-2 focus:ring-hii-500/30"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {t(option.labelKey, locale)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleDirection}
              aria-label={
                sort.direction === 'asc'
                  ? t('pontaj.sort_descending', locale)
                  : t('pontaj.sort_ascending', locale)
              }
              title={
                sort.direction === 'asc'
                  ? t('pontaj.sort_descending', locale)
                  : t('pontaj.sort_ascending', locale)
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hii-500/30"
            >
              {sort.direction === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <SortableHeader
                    label={t('pontaj.col_worker_short', locale)}
                    sortKey="worker"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('pontaj.col_site', locale)}
                    sortKey="site"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('pontaj.col_checkin', locale)}
                    sortKey="checkIn"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('pontaj.col_checkout', locale)}
                    sortKey="checkOut"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <th className="px-2.5 py-3">{t('pontaj.col_gps', locale)}</th>
                  <SortableHeader
                    label={t('pontaj.col_regular_short', locale)}
                    sortKey="regular"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label={t('pontaj.col_overtime_short', locale)}
                    sortKey="overtime"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label={t('pontaj.col_status', locale)}
                    sortKey="status"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  {canCorrect && (
                    <th className="px-2.5 py-3 text-right">{t('pontaj.col_actions', locale)}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <React.Fragment key={group.dateKey}>
                    <tr className="bg-slate-50/60">
                      <td colSpan={columnCount} className="px-3 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {group.dateKey === 'unknown'
                            ? t('pontaj.not_available', locale)
                            : formatDateLabel(group.dateKey, locale)}
                        </span>
                      </td>
                    </tr>
                    {group.records.map((record) => {
                      const name = getUserName(record, locale);
                      const role = roleLabel(getUserRole(record), locale);
                      const recorded = getRecordedHours(record);
                      return (
                        <tr
                          key={record.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`${t('pontaj.detail_title', locale)}: ${name}`}
                          onClick={() => onSelect(record)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelect(record);
                            }
                          }}
                          className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          <td className="px-2.5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                {getUserInitials(name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">{name}</p>
                                {role && <p className="truncate text-xs capitalize text-slate-400">{role}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[180px] truncate px-2.5 py-3 text-xs text-slate-600">
                            {record.project?.name || t('pontaj.unknown_site', locale)}
                          </td>
                          <td className="px-2.5 py-3 font-mono text-xs font-semibold text-slate-800">
                            {formatTime(record.check_in_time, locale)}
                          </td>
                          <td className="px-2.5 py-3 font-mono text-xs font-semibold text-slate-800">
                            {formatTime(record.check_out_time, locale)}
                          </td>
                          <td className="px-2.5 py-3">
                            <GpsBadge record={record} compact />
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-800">
                            {recorded.regularHours === null
                              ? t('pontaj.not_available', locale)
                              : formatHours(recorded.regularHours, locale)}
                          </td>
                          <td className="px-2.5 py-3 text-right">
                            {recorded.overtimeHours !== null && recorded.overtimeHours > 0 ? (
                              <Badge variant="warning" size="sm">
                                +{formatHours(recorded.overtimeHours, locale)}
                              </Badge>
                            ) : (
                              <span className="font-mono text-xs text-slate-400">
                                {recorded.overtimeHours === null ? t('pontaj.not_available', locale) : '0'}
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-3 text-right">
                            <SessionBadge record={record} />
                          </td>
                          {canCorrect && (
                            <td className="px-2.5 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-hii-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onCorrect(record);
                                }}
                                aria-label={t('pontaj.correct', locale)}
                                title={t('pontaj.correct', locale)}
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {groups.map((group) => (
              <div key={group.dateKey}>
                <div className="bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.dateKey === 'unknown'
                    ? t('pontaj.not_available', locale)
                    : formatDateLabel(group.dateKey, locale)}
                </div>
                {group.records.map((record) => {
                  const name = getUserName(record, locale);
                  const recorded = getRecordedHours(record);
                  return (
                    <div
                      key={record.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t('pontaj.detail_title', locale)}: ${name}`}
                      onClick={() => onSelect(record)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(record);
                        }
                      }}
                      className="cursor-pointer px-4 py-3.5 transition-colors focus:bg-slate-50 focus:outline-none active:bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {getUserInitials(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {record.project?.name || t('pontaj.unknown_site', locale)}
                          </p>
                        </div>
                        <SessionBadge record={record} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <MobileStat label={t('pontaj.detail_checkin', locale)} value={formatTime(record.check_in_time, locale)} />
                        <MobileStat label={t('pontaj.detail_checkout', locale)} value={formatTime(record.check_out_time, locale)} />
                        <MobileStat
                          label={t('pontaj.col_regular_short', locale)}
                          value={
                            recorded.regularHours === null
                              ? t('pontaj.not_available', locale)
                              : `${formatHours(recorded.regularHours, locale)}h`
                          }
                        />
                        <MobileStat
                          label={t('pontaj.col_overtime_short', locale)}
                          value={
                            recorded.overtimeHours === null
                              ? t('pontaj.not_available', locale)
                              : recorded.overtimeHours > 0
                                ? `+${formatHours(recorded.overtimeHours, locale)}h`
                                : '0h'
                          }
                          warning={Boolean(recorded.overtimeHours && recorded.overtimeHours > 0)}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <GpsBadge record={record} />
                        {canCorrect && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCorrect(record);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-hii-700 hover:bg-hii-50"
                          >
                            <PencilLine className="h-3 w-3" />
                            {t('pontaj.correct', locale)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="px-4 pb-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
          </div>
        </>
      )}
    </section>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: AttendanceSortKey;
  sort: AttendanceSort;
  onSort: (key: AttendanceSortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-2.5 py-3 ${align === 'right' ? 'text-right' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded-sm font-semibold uppercase tracking-wide transition-colors hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-hii-500 ${
          active ? 'text-slate-700' : 'text-slate-500'
        }`}
      >
        {label}
        <Icon
          className={`h-3 w-3 ${active ? 'text-hii-600' : 'text-slate-300'}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function SessionBadge({ record }: { record: AttendanceRecord }) {
  const { locale } = useLocale();
  const open = isOpenSession(record);

  return (
    <Badge variant={open ? 'success' : 'neutral'} size="sm">
      {open ? (
        <Clock className="h-3 w-3" aria-hidden="true" />
      ) : (
        <CircleCheck className="h-3 w-3" aria-hidden="true" />
      )}
      {sessionLabel(record, locale)}
    </Badge>
  );
}

function GpsBadge({ record, compact = false }: { record: AttendanceRecord; compact?: boolean }) {
  const { locale } = useLocale();
  const gps = getGpsState(record);
  const label =
    gps.state === 'inside'
      ? t('pontaj.gps_inside', locale)
      : gps.state === 'outside'
        ? t('pontaj.gps_outside', locale)
        : t('pontaj.gps_unknown', locale);
  const distance =
    gps.distance === null
      ? null
      : t('pontaj.distance_m', locale).replace('{distance}', String(Math.round(gps.distance)));

  return (
    <Badge
      variant={gps.state === 'inside' ? 'success' : gps.state === 'outside' ? 'warning' : 'neutral'}
      size="sm"
      title={label}
    >
      {gps.state === 'inside' ? (
        <ShieldCheck className="h-3 w-3" />
      ) : gps.state === 'outside' ? (
        <ShieldAlert className="h-3 w-3" />
      ) : (
        <MapPin className="h-3 w-3" />
      )}
      {compact ? (
        <span className="font-mono tabular-nums">{distance ?? t('pontaj.not_available', locale)}</span>
      ) : (
        <span>
          {label}
          {distance ? ` - ${distance}` : ''}
        </span>
      )}
    </Badge>
  );
}

function MobileStat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-[11px] font-semibold tabular-nums ${warning ? 'text-warning-foreground' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}

export default AttendanceRegister;

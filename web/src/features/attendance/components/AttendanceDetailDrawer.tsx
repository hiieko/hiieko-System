'use client';

import React from 'react';
import {
  CircleCheck,
  Clock,
  MapPin,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Badge, Button, Drawer } from '../../../components/ui';
import type { AttendanceRecord } from '../types';
import {
  formatDateTime,
  formatHours,
  getGpsState,
  getRecordedHours,
  getUserInitials,
  getUserName,
  getUserRole,
  recordDateKey,
  roleLabel,
  sessionLabel,
  statusLabel,
} from '../utils';

interface Props {
  record: AttendanceRecord | null;
  canCorrect: boolean;
  onClose: () => void;
  onCorrect: (record: AttendanceRecord) => void;
}

export function AttendanceDetailDrawer({ record, canCorrect, onClose, onCorrect }: Props) {
  const { locale } = useLocale();
  if (!record) return null;

  const name = getUserName(record, locale);
  const gps = getGpsState(record);
  const recorded = getRecordedHours(record);

  return (
    <Drawer
      open={!!record}
      onClose={onClose}
      title={t('pontaj.detail_title', locale)}
      side="right"
      size="md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hii-50 text-sm font-bold text-hii-700">
            {getUserInitials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs capitalize text-slate-500">
              {roleLabel(getUserRole(record), locale)}
            </p>
          </div>
          <Badge
            variant={record.check_out_time ? 'neutral' : 'success'}
            size="sm"
            className="ml-auto shrink-0"
          >
            {record.check_out_time ? (
              <CircleCheck className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Clock className="h-3 w-3" aria-hidden="true" />
            )}
            {sessionLabel(record, locale)}
          </Badge>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('pontaj.col_site', locale)}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {record.project?.name || t('pontaj.unknown_site', locale)}
          </p>
          {record.project?.code && (
            <p className="mt-0.5 font-mono text-xs text-slate-500">{record.project.code}</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Detail label={t('pontaj.detail_checkin', locale)} value={formatDateTime(record.check_in_time, locale)} mono />
          <Detail label={t('pontaj.detail_checkout', locale)} value={formatDateTime(record.check_out_time, locale)} mono />
          <Detail
            label={t('pontaj.detail_hours', locale)}
            value={
              recorded.regularHours === null
                ? t('pontaj.not_available', locale)
                : `${formatHours(recorded.regularHours, locale)} h`
            }
            mono
          />
          <Detail
            label={t('pontaj.col_overtime', locale)}
            value={
              recorded.overtimeHours === null
                ? t('pontaj.not_available', locale)
                : recorded.overtimeHours > 0
                  ? `+${formatHours(recorded.overtimeHours, locale)} h`
                  : '0 h'
            }
            mono
          />
          <Detail label={t('pontaj.detail_session', locale)} value={recordDateKey(record) || '—'} mono />
          <Detail label={t('pontaj.detail_status', locale)} value={statusLabel(record.status, locale)} />
        </dl>

        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('pontaj.detail_gps', locale)}
            </p>
            <Badge
              variant={gps.state === 'inside' ? 'success' : gps.state === 'outside' ? 'warning' : 'neutral'}
              size="sm"
            >
              {gps.state === 'inside' ? (
                <ShieldCheck className="h-3 w-3" />
              ) : gps.state === 'outside' ? (
                <ShieldAlert className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {gps.state === 'inside'
                ? t('pontaj.gps_inside', locale)
                : gps.state === 'outside'
                  ? t('pontaj.gps_outside', locale)
                  : t('pontaj.gps_unknown', locale)}
            </Badge>
          </div>
          <p className="mt-2 font-mono text-sm text-slate-800">
            {gps.distance === null
              ? t('pontaj.not_available', locale)
              : t('pontaj.distance_m', locale).replace('{distance}', String(Math.round(gps.distance)))}
          </p>
        </div>

        {record.notes && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('pontaj.detail_notes', locale)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{record.notes}</p>
          </div>
        )}

        {canCorrect && (
          <div className="border-t border-slate-100 pt-4">
            <Button
              variant="primary"
              fullWidth
              icon={<PencilLine className="h-4 w-4" />}
              onClick={() => onCorrect(record)}
            >
              {t('pontaj.detail_edit', locale)}
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm font-medium text-slate-800 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

export default AttendanceDetailDrawer;

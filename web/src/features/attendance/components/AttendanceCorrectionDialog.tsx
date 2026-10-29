'use client';

import React, { useEffect, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import type { AttendanceRecord, AttendanceStatus, CorrectAttendanceDto } from './types';
import { Modal, Button, Input } from '../../../components/ui';

interface Props {
  record: AttendanceRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (dto: CorrectAttendanceDto) => Promise<void>;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; labelKey: string }> = [
  { value: 'PRESENT', labelKey: 'pontaj.status_present' },
  { value: 'ABSENT', labelKey: 'pontaj.status_absent' },
  { value: 'REST', labelKey: 'pontaj.status_rest' },
  { value: 'MEDICAL_LEAVE', labelKey: 'pontaj.status_medical' },
  { value: 'UNPAID_LEAVE', labelKey: 'pontaj.status_unpaid' },
];

function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AttendanceCorrectionDialog({ record, saving, onClose, onSave }: Props) {
  const { locale } = useLocale();
  const [reason, setReason] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');

  useEffect(() => {
    if (!record) return;
    setReason('');
    setCheckInTime(toLocalInput(record.check_in_time));
    setCheckOutTime(toLocalInput(record.check_out_time));
    setNotes(record.notes || '');
    setStatus(
      STATUS_OPTIONS.some((option) => option.value === record.status)
        ? (record.status as AttendanceStatus)
        : 'PRESENT',
    );
  }, [record]);

  if (!record) return null;

  const submit = async () => {
    if (!reason.trim()) return;
    await onSave({
      reason: reason.trim(),
      checkInTime: checkInTime ? new Date(checkInTime).toISOString() : undefined,
      checkOutTime: checkOutTime ? new Date(checkOutTime).toISOString() : null,
      notes: notes.trim() || null,
      status,
    });
  };

  return (
    <Modal
      open={!!record}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={t('pontaj.correction_title', locale)}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('pontaj.correction_cancel', locale)}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            disabled={saving || !reason.trim()}
            loading={saving}
          >
            {saving ? t('pontaj.correction_saving', locale) : t('pontaj.correction_save', locale)}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-slate-500">
        {record.user?.profile?.full_name || record.user?.email || record.id}
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('pontaj.correction_checkin', locale)}
          type="datetime-local"
          value={checkInTime}
          onChange={(event) => setCheckInTime(event.target.value)}
        />
        <Input
          label={t('pontaj.correction_checkout', locale)}
          type="datetime-local"
          value={checkOutTime}
          onChange={(event) => setCheckOutTime(event.target.value)}
        />
      </div>

      <label className="hii-label" htmlFor="attendance-correction-status">
        {t('pontaj.correction_status', locale)}
      </label>
      <select
        id="attendance-correction-status"
        value={status}
        onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
        className="hii-select mb-4"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey, locale)}
          </option>
        ))}
      </select>

      <label className="hii-label" htmlFor="attendance-correction-notes">
        {t('pontaj.correction_notes', locale)}
      </label>
      <textarea
        id="attendance-correction-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
      />

      <label className="hii-label" htmlFor="attendance-correction-reason">
        {t('pontaj.correction_reason', locale)}
      </label>
      <textarea
        id="attendance-correction-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
        placeholder={t('pontaj.correction_reason_placeholder', locale)}
      />
    </Modal>
  );
}

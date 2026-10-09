'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@solar/shared';
import type { AttendanceRecord, AttendanceStatus, CorrectAttendanceDto } from './types';
import { Modal, Button, Input } from '../../../components/ui';

interface Props {
  record: AttendanceRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (dto: CorrectAttendanceDto) => Promise<void>;
}

function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    setStatus((record.status as AttendanceStatus) || 'PRESENT');
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

  const en = locale === 'en';

  return (
    <Modal
      open={!!record}
      onClose={() => { if (!saving) onClose(); }}
      title={en ? 'Correct attendance' : 'Corectează pontajul'}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {en ? 'Cancel' : 'Anulează'}
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={saving || !reason.trim()} loading={saving}>
            {saving ? (en ? 'Saving…' : 'Se salvează…') : (en ? 'Save correction' : 'Salvează corecția')}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-slate-500 mb-4">{record.user?.profile?.full_name || record.user?.email || record.id}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Input
          label={en ? 'Check-in' : 'Sosire'}
          type="datetime-local"
          value={checkInTime}
          onChange={(e) => setCheckInTime(e.target.value)}
        />
        <Input
          label={en ? 'Check-out' : 'Plecare'}
          type="datetime-local"
          value={checkOutTime}
          onChange={(e) => setCheckOutTime(e.target.value)}
        />
      </div>

      <label className="hii-label">{en ? 'Status' : 'Stare'}</label>
      <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} className="hii-select mb-4">
        <option value="PRESENT">{en ? 'Present' : 'Prezent'}</option>
        <option value="ABSENT">{en ? 'Absent' : 'Absent'}</option>
        <option value="LATE">{en ? 'Late' : 'Întârziere'}</option>
        <option value="LEFT_EARLY">{en ? 'Left early' : 'Plecare devreme'}</option>
      </select>

      <label className="hii-label">{en ? 'Notes' : 'Observații'}</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal mb-4" />

      <label className="hii-label">{en ? 'Correction reason (required)' : 'Motivul corecției (obligatoriu)'}</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
        placeholder={en ? 'Why is this attendance record being corrected?' : 'De ce trebuie corectat acest pontaj?'} />
    </Modal>
  );
}
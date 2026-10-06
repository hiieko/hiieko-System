'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useLocale } from '@solar/shared';
import type { AttendanceRecord, AttendanceStatus, CorrectAttendanceDto } from './types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{en ? 'Correct attendance' : 'Corectează pontajul'}</h2>
            <p className="text-xs text-slate-500 mt-1">{record.user?.profile?.full_name || record.user?.email || record.id}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 rounded-lg hover:bg-slate-100" aria-label={en ? 'Close' : 'Închide'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-slate-700">
              {en ? 'Check-in' : 'Sosire'}
              <input type="datetime-local" value={checkInTime} onChange={e => setCheckInTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {en ? 'Check-out' : 'Plecare'}
              <input type="datetime-local" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            {en ? 'Status' : 'Stare'}
            <select value={status} onChange={e => setStatus(e.target.value as AttendanceStatus)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal">
              <option value="PRESENT">{en ? 'Present' : 'Prezent'}</option>
              <option value="ABSENT">{en ? 'Absent' : 'Absent'}</option>
              <option value="LATE">{en ? 'Late' : 'Întârziere'}</option>
              <option value="LEFT_EARLY">{en ? 'Left early' : 'Plecare devreme'}</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {en ? 'Notes' : 'Observații'}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {en ? 'Correction reason (required)' : 'Motivul corecției (obligatoriu)'}
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
              placeholder={en ? 'Why is this attendance record being corrected?' : 'De ce trebuie corectat acest pontaj?'} />
          </label>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
            {en ? 'Cancel' : 'Anulează'}
          </button>
          <button type="button" onClick={submit} disabled={saving || !reason.trim()}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? (en ? 'Saving…' : 'Se salvează…') : (en ? 'Save correction' : 'Salvează corecția')}
          </button>
        </div>
      </div>
    </div>
  );
}

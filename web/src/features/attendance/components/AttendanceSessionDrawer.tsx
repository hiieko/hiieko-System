'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Clock3, MapPin, X } from 'lucide-react';
import type { AttendanceRecord } from '../types';

interface AttendanceSessionDrawerProps {
  record: AttendanceRecord | null;
  onClose: () => void;
}

interface PrototypeCorrection {
  reason: string;
  beforeCheckIn: string;
  afterCheckIn: string;
  beforeCheckOut: string;
  afterCheckOut: string;
  createdAt: string;
}

function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatValue(value: string) {
  return value ? new Date(value).toLocaleString('ro-RO') : '—';
}

export function AttendanceSessionDrawer({ record, onClose }: AttendanceSessionDrawerProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [corrections, setCorrections] = useState<PrototypeCorrection[]>([]);
  const [success, setSuccess] = useState(false);

  const initialCheckIn = useMemo(() => toLocalInput(record?.check_in_time), [record?.check_in_time]);
  const initialCheckOut = useMemo(() => toLocalInput(record?.check_out_time), [record?.check_out_time]);

  if (!record) return null;

  const workerName = record.user?.profile?.full_name || record.user?.email || 'Utilizator';
  const nextCheckIn = checkIn || initialCheckIn;
  const nextCheckOut = checkOut || initialCheckOut;
  const hasChanges = nextCheckIn !== initialCheckIn || nextCheckOut !== initialCheckOut;
  const canSubmit = Boolean(reason.trim() && hasChanges);

  const savePrototypeCorrection = () => {
    if (!canSubmit) return;
    setCorrections((items) => [{
      reason: reason.trim(),
      beforeCheckIn: initialCheckIn,
      afterCheckIn: checkIn || initialCheckIn,
      beforeCheckOut: initialCheckOut,
      afterCheckOut: checkOut,
      createdAt: new Date().toISOString(),
    }, ...items]);
    setSuccess(true);
    setReason('');
    setCheckIn('');
    setCheckOut('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="attendance-session-title" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-hii-700">Pontaj · {record.date?.slice(0, 10) || 'Sesiune'}</p>
            <h2 id="attendance-session-title" className="mt-1 text-lg font-bold text-slate-900">{workerName}</h2>
            <p className="mt-1 text-sm text-slate-500">{record.project?.name || 'Proiect'}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Închide detaliile sesiunii"><X className="size-5" /></button>
        </header>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Clock3 className="size-4" /> Sosire</div>
              <p className="mt-2 text-sm font-bold text-slate-900">{formatValue(String(record.check_in_time))}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Clock3 className="size-4" /> Plecare</div>
              <p className="mt-2 text-sm font-bold text-slate-900">{formatValue(record.check_out_time ? String(record.check_out_time) : '')}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Detalii înregistrare</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">Ore normale</dt><dd className="mt-1 font-semibold text-slate-900">{record.regular_hours ?? 0} h</dd></div>
              <div><dt className="text-xs text-slate-500">Ore suplimentare</dt><dd className="mt-1 font-semibold text-slate-900">{((record.overtime_minutes ?? 0) / 60).toFixed(1)} h</dd></div>
              <div className="col-span-2"><dt className="text-xs text-slate-500">Verificare GPS la sosire</dt><dd className="mt-1 flex items-center gap-1.5 font-medium text-slate-800"><MapPin className="size-4 text-slate-400" />{record.check_in_distance_m ?? '—'} m {record.is_within_geofence === false ? '· în afara perimetrului' : ''}</dd></div>
            </dl>
          </div>

          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Solicitare de corectare</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Prototip local: datele de mai jos nu sunt trimise sau salvate pe server. Backend-ul nu expune un flux de corectare a pontajului.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Sosire corectată
                <input type="datetime-local" value={nextCheckIn} onChange={(event) => { setCheckIn(event.target.value); setSuccess(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Plecare corectată
                <input type="datetime-local" value={nextCheckOut} onChange={(event) => { setCheckOut(event.target.value); setSuccess(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" />
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-700">Motivul corectării
              <textarea value={reason} onChange={(event) => { setReason(event.target.value); setSuccess(false); }} rows={3} placeholder="Descrie motivul solicitării" className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            </label>
            {hasChanges && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">Valori înainte / după</p>
                <p className="mt-2 text-slate-600">Sosire: {formatValue(initialCheckIn)} <span className="font-semibold text-slate-900">→ {formatValue(nextCheckIn)}</span></p>
                <p className="mt-1 text-slate-600">Plecare: {formatValue(initialCheckOut)} <span className="font-semibold text-slate-900">→ {formatValue(nextCheckOut)}</span></p>
              </div>
            )}
            <button type="button" onClick={savePrototypeCorrection} disabled={!canSubmit} className="mt-4 min-h-11 w-full rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white hover:bg-hii-800 disabled:cursor-not-allowed disabled:opacity-50">Pregătește solicitarea (prototip)</button>
            {success && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Solicitarea a fost pregătită local pentru demonstrație; nimic nu a fost trimis.</p>}
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Istoric corectări · prototip local</h3>
            {corrections.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nu există solicitări în această sesiune de prototipare.</p> : <ol className="mt-3 flex flex-col gap-3">{corrections.map((item, index) => <li key={`${item.createdAt}-${index}`} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold text-slate-800">{new Date(item.createdAt).toLocaleString('ro-RO')}</p><p className="mt-1 text-slate-600">Motiv: {item.reason}</p><p className="mt-1 text-slate-600">Sosire: {formatValue(item.beforeCheckIn)} → {formatValue(item.afterCheckIn)}</p><p className="text-slate-600">Plecare: {formatValue(item.beforeCheckOut)} → {formatValue(item.afterCheckOut)}</p></li>)}</ol>}
          </section>
        </div>
      </section>
    </div>
  );
}

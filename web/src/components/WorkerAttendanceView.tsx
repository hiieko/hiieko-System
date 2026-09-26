'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Loader2, RefreshCw, CheckCheck, LogOut, MapPin } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useGeoLocation } from '../hooks/useGeoLocation';

export function WorkerAttendanceView() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { geoStatus, requestLocation } = useGeoLocation();
  const { locale } = useLocale();
  const [attendance, setAttendance] = useState<any>(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true); setAttError(null);
    try {
      const response = await apiClient.getMyAttendanceLogs();
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayRecs = data.filter((r: any) => (r.date || '').split('T')[0] === today);
        setAttendance(todayRecs.length > 0 ? todayRecs[0] : data[0]);
      } else if (data && typeof data === 'object') setAttendance(data);
      else setAttendance(null);
    } catch (err: any) { setAttError(err.message || 'Eroare'); }
    finally { setAttLoading(false); }
  }, []);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const getLocationOrWarn = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const loc = await requestLocation();
    if (!loc) {
      const errMsg = geoStatus.state === 'denied' ? 'Activeaza accesul la locatie in setarile browser-ului.' :
                     geoStatus.state === 'timeout' ? 'Cererea de locatie a expirat. Incearca din nou.' :
                     geoStatus.state === 'unavailable' ? 'Locația nu este disponibila. Verifica semnalul GPS.' :
                     'Nu s-a putut obtine locatia. Verifica setarile GPS.';
      setActionResult(errMsg); setTimeout(() => setActionResult(null), 4000);
      return null;
    }
    return loc;
  };

  const handleCheckIn = async () => {
    if (!selectedProject) {
      setActionResult('Selecteaza un proiect mai intai.'); setTimeout(() => setActionResult(null), 3000); return;
    }
    setActionLoading(true); setActionResult(null);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkInAttendance({ projectId: selectedProject.id, latitude: loc.latitude, longitude: loc.longitude });
      setActionResult('Pontaj de intrare inregistrat!'); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || 'Eroare'); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true); setActionResult(null);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkOutAttendance({ projectId: selectedProject?.id || '', latitude: loc.latitude, longitude: loc.longitude });
      setActionResult('Pontaj de iesire inregistrat!'); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || 'Eroare'); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const isCheckedIn = attendance && !attendance.check_out_time;
  const checkInTime = attendance?.check_in_time
    ? new Date(attendance.check_in_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;
  const checkOutTime = attendance?.check_out_time
    ? new Date(attendance.check_out_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('worker.attendance_title', locale)}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('worker.attendance_subtitle', locale)}</p>
      </div>
      {actionResult && (
        <div className={'p-3 rounded-lg text-sm font-medium ' + (actionResult.includes('Eroare') || actionResult.includes('Selecteaza') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700')}>{actionResult}</div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {attLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : attError ? (
          <div className="p-8 text-center text-sm text-red-500">{attError}</div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Sosire</div>
                <div className={'text-lg font-bold mt-1 ' + (checkInTime ? 'text-emerald-700' : 'text-slate-400')}>{checkInTime || '-'}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Plecare</div>
                <div className={'text-lg font-bold mt-1 ' + (checkOutTime ? 'text-slate-700' : 'text-slate-400')}>{checkOutTime || '-'}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Ore lucrate</div>
                <div className="text-lg font-bold mt-1 text-slate-800">{attendance?.regular_hours || 0}h</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Ore suplim.</div>
                <div className={'text-lg font-bold mt-1 ' + ((attendance?.overtime_minutes || 0) > 0 ? 'text-amber-700' : 'text-slate-400')}>
                  {(attendance?.overtime_minutes || 0) > 0 ? (attendance.overtime_minutes / 60).toFixed(1) + 'h' : '0h'}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {!isCheckedIn ? (
                <button onClick={handleCheckIn} disabled={actionLoading || !selectedProject}
                  className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-5 h-5" />}
                  {t('worker.clock_in', locale)}
                </button>
              ) : (
                <button onClick={handleCheckOut} disabled={actionLoading}
                  className="flex-1 py-3 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  {t('worker.clock_out', locale)}
                </button>
              )}
              <button onClick={loadAttendance} disabled={attLoading}
                className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl disabled:opacity-50 transition-colors">
                <RefreshCw className={'w-4 h-4 ' + (attLoading ? 'animate-spin' : '')} />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="text-xs text-slate-400 text-center">
        {t('worker.attendance_gps_note', locale)}
      </div>
    </div>
  );
}





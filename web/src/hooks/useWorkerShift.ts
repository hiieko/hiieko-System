'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useToast } from '../components/ui/Toast';
import { useGeoLocation } from '../hooks/useGeoLocation';
import type { GeoStatus } from '../hooks/useGeoLocation';
import { useLocale } from '@solar/shared';
import { t } from '@solar/shared';
import * as attendanceApi from '../features/attendance/api';
import type { AttendanceRecord } from '../features/attendance/types';

export type ShiftStatus = 'loading' | 'noProject' | 'idle' | 'active' | 'result';

export interface UseWorkerShiftResult {
  shiftStatus: ShiftStatus;
  record: AttendanceRecord | null;
  lastResult: AttendanceRecord | null;
  actionLoading: boolean;
  elapsedSeconds: number;
  loadShift: () => Promise<void>;
  handleCheckIn: () => Promise<void>;
  handleCheckOut: () => Promise<void>;
  resetForNewShift: () => void;
  formatTime: (v: string | Date | null | undefined) => string;
  formatDuration: (secs: number) => string;
  /**
   * Live geolocation state of the shift's own `useGeoLocation()` instance —
   * the same one the check-in/check-out calls use. The attendance card renders
   * a GPS row from it (permission/accuracy only), never a derived "signal"
   * quality adjective.
   */
  geoStatus: GeoStatus;
}

export function useWorkerShift(): UseWorkerShiftResult {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { geoStatus, requestLocation } = useGeoLocation();
  const { locale } = useLocale();
  const { success, error: showError } = useToast();

  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('loading');
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [lastResult, setLastResult] = useState<AttendanceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Live elapsed timer for an active shift
  useEffect(() => {
    if (shiftStatus !== 'active' || !record?.check_in_time) return;
    const update = () => {
      const ms = new Date().getTime() - new Date(record.check_in_time).getTime();
      setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [shiftStatus, record]);

  const loadShift = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await attendanceApi.getMyLogs(today);
      const logs = (res.data || []) as AttendanceRecord[];
      const todayRecords = logs.filter(
        (r) => (r.date || '').split('T')[0] === today
      );
      const active = todayRecords.find((r) => !r.check_out_time);
      if (active) {
        setRecord(active);
        setLastResult(null);
        setShiftStatus('active');
      } else if (todayRecords.length > 0) {
        const completed = todayRecords[todayRecords.length - 1];
        setRecord(completed);
        setLastResult(completed);
        setShiftStatus('result');
      } else {
        setRecord(null);
        setLastResult(null);
        setShiftStatus('idle');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('worker.error_generic', locale);
      showError(msg);
      setRecord(null);
      setLastResult(null);
      setShiftStatus('idle');
    }
  }, [today, selectedProject, locale, showError]);

  useEffect(() => {
    if (!selectedProject) { setShiftStatus('noProject'); return; }
    setShiftStatus('loading');
    loadShift();
  }, [selectedProject, loadShift]);
  const getLocationOrWarn = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const loc = await requestLocation();
    if (!loc) {
      const errMsg =
        geoStatus.state === 'denied' ? t('worker.gps_denied', locale) :
        geoStatus.state === 'timeout' ? t('worker.gps_timeout', locale) :
        geoStatus.state === 'unavailable' ? t('worker.gps_unavailable', locale) :
        t('worker.gps_error', locale);
      showError(errMsg);
      return null;
    }
    return loc;
  };

  const handleCheckIn = async () => {
    if (!selectedProject) { showError(t('worker.select_project_first', locale)); return; }
    setActionLoading(true);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      const res = await attendanceApi.checkIn({
        projectId: selectedProject.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setRecord(res.data as AttendanceRecord);
      setLastResult(null);
      setShiftStatus('active');
      success(t('worker.checkin_success', locale));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('worker.error_generic', locale);
      showError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!record) return;
    setActionLoading(true);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      const res = await attendanceApi.checkOut({
        attendanceRecordId: record.id,
        projectId: selectedProject?.id || undefined,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      const updated = res.data as AttendanceRecord;
      setRecord(updated);
      setLastResult(updated);
      setShiftStatus('result');
      success(t('worker.checkout_success', locale));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('worker.error_generic', locale);
      showError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const resetForNewShift = () => { setRecord(null); setLastResult(null); setShiftStatus('idle'); };

  const formatTime = (v: string | Date | null | undefined) => {
    if (!v) return '-';
    return new Date(v).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  };

  return {
    shiftStatus,
    record,
    lastResult,
    actionLoading,
    elapsedSeconds,
    loadShift,
    handleCheckIn,
    handleCheckOut,
    resetForNewShift,
    formatTime,
    formatDuration,
    geoStatus,
  };
}


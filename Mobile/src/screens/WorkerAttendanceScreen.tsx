import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  ScrollView 
} from 'react-native';
import { 
  calculateAttendanceWorkTime, 
  isWithinProjectGeofence,
  locationFailureTranslationKey,
  t,
  Project,
  TimeLog 
} from '@solar/shared';
import { 
  getActiveTimeLog, 
  setActiveTimeLog, 
} from '../services/storage';
import { enqueueOperation, generateIdempotencyKey } from '../services/syncQueue';
import { apiClient } from '../services/apiClient';
import { getCurrentDeviceLocation } from '../services/location';
import { PageIntro } from '../components/PageIntro';

interface Props {
  user: { id: string; full_name: string; role: string };
  projects: Project[];
  isOffline: boolean;
  locale?: 'ro' | 'en';
}

export function WorkerAttendanceScreen({ user, projects, isOffline, locale = 'ro' }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project>(projects[0]);
  const [activeLog, setActiveLogState] = useState<TimeLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentGpsDist, setCurrentGpsDist] = useState<number | null>(null);
  const [gpsErrorTranslationKey, setGpsErrorTranslationKey] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    async function loadActiveStateAndLocation() {
      const log = await getActiveTimeLog();
      setActiveLogState(log);
      await refreshGps();
    }
    loadActiveStateAndLocation();
    // refreshGps is stable for a given projects/selectedProject; re-run when the
    // selected site changes so the geofence badge reflects the new site centre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  /**
   * Acquires a fresh device fix and updates the geofence badge. On failure the
   * distance is cleared (never fabricated) and a translated error key is set.
   */
  const refreshGps = async () => {
    setGpsLoading(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (!loc.ok) {
        setCurrentGpsDist(null);
        setGpsErrorTranslationKey(locationFailureTranslationKey(loc.reason));
        return;
      }
      setGpsErrorTranslationKey(null);
      const check = isWithinProjectGeofence(
        loc.latitude,
        loc.longitude,
        selectedProject.latitude,
        selectedProject.longitude,
        selectedProject.geofence_radius_meters
      );
      setCurrentGpsDist(check.distanceMeters);
    } finally {
      setGpsLoading(false);
    }
  };

  const isWithinGeofence = currentGpsDist !== null && currentGpsDist <= selectedProject.geofence_radius_meters;

  const handleCheckIn = async () => {
    if (loading) return; // Prevent double tap

    setLoading(true);
    try {
      // A valid device fix is a hard precondition. If GPS cannot be acquired
      // we do NOT submit a check-in and we never substitute a site-centre
      // coordinate - the worker stays un-pontat until they retry with GPS.
      const loc = await getCurrentDeviceLocation();
      if (!loc.ok) {
        setCurrentGpsDist(null);
        setGpsErrorTranslationKey(locationFailureTranslationKey(loc.reason));
        Alert.alert(
          t('worker.gps_error_title', locale),
          t(locationFailureTranslationKey(loc.reason), locale),
          [
            { text: t('general.cancel', locale), style: 'cancel' },
            { text: t('worker.gps_retry', locale), onPress: () => { void handleCheckIn(); } },
          ]
        );
        return;
      }

      const workerLat = loc.latitude;
      const workerLng = loc.longitude;

      const geofence = isWithinProjectGeofence(
        workerLat,
        workerLng,
        selectedProject.latitude,
        selectedProject.longitude,
        selectedProject.geofence_radius_meters
      );

      setCurrentGpsDist(geofence.distanceMeters);
      setGpsErrorTranslationKey(null);

      if (!geofence.isWithin) {
        Alert.alert(
          t('attendance.outside_title', locale),
          t('attendance.outside_body', locale)
            .replace('{distance}', String(geofence.distanceMeters))
            .replace('{radius}', String(selectedProject.geofence_radius_meters))
        );
        return;
      }

      const now = new Date().toISOString();
      const newLog: TimeLog = {
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: user.id,
        project_id: selectedProject.id,
        date: now.split('T')[0],
        check_in: now,
        check_in_lat: workerLat,
        check_in_lng: workerLng,
        check_in_distance_meters: geofence.distanceMeters,
        status: 'present',
        normal_hours_worked: 0,
        overtime_minutes: 0,
        rest_minutes: 60,
        is_offline_created: isOffline,
        created_at: now,
        updated_at: now,
      };

      await setActiveTimeLog(newLog);
      setActiveLogState(newLog);

      // Prepare payload for API/queue
      const checkInPayload = {
        projectId: selectedProject.id,
        latitude: workerLat,
        longitude: workerLng,
        notes: `Check-in la ${selectedProject.name}`,
      };
      const idemKey = generateIdempotencyKey('attendance', 'check_in');

      if (isOffline) {
        // Enqueue for later sync (SQLite-based queue)
        await enqueueOperation('attendance', 'check_in', checkInPayload, idemKey);
        Alert.alert(t('attendance.offline_saved_title', locale), t('attendance.checkin_offline_body', locale));
      } else {
        // Submit directly to API
        await apiClient.checkIn(checkInPayload);
        Alert.alert(t('worker.checkin_success', locale), t('attendance.checkin_success_body', locale).replace('{site}', selectedProject.name));
      }
    } catch (e: any) {
      Alert.alert(t('worker.error_generic', locale), e.message || t('attendance.checkin_error_body', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (loading || !activeLog) return; // Prevent double tap

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const calc = calculateAttendanceWorkTime(activeLog.check_in, now);

      // Same hard precondition as check-in: a real device fix is required.
      // We never fabricate coordinates for a check-out either.
      const loc = await getCurrentDeviceLocation();
      if (!loc.ok) {
        setGpsErrorTranslationKey(locationFailureTranslationKey(loc.reason));
        Alert.alert(
          t('worker.gps_error_title', locale),
          t(locationFailureTranslationKey(loc.reason), locale),
          [
            { text: t('general.cancel', locale), style: 'cancel' },
            { text: t('worker.gps_retry', locale), onPress: () => { void handleCheckOut(); } },
          ]
        );
        return;
      }

      const workerLat = loc.latitude;
      const workerLng = loc.longitude;

      // Prepare payload for API/queue
      // Note: check-out needs an attendanceId from the server.
      // For simplicity, we use the activeLog.id (local or server ID depending on check-in method)
      const checkOutPayload = {
        attendanceId: activeLog.id,
        latitude: workerLat,
        longitude: workerLng,
        notes: `Check-out dupa ${calc.normalHoursWorked}h lucrate`,
      };
      const idemKey = generateIdempotencyKey('attendance', 'check_out');

      await setActiveTimeLog(null);
      setActiveLogState(null);

      if (isOffline) {
        // Enqueue for later sync (SQLite-based queue)
        await enqueueOperation('attendance', 'check_out', checkOutPayload, idemKey);
        Alert.alert(
          t('attendance.offline_saved_title', locale),
          t('attendance.checkout_offline_body', locale)
            .replace('{hours}', String(calc.normalHoursWorked))
            .replace('{overtime}', calc.overtimeHoursDisplay)
        );
      } else {
        // Submit directly to API
        const { attendanceId, ...data } = checkOutPayload;
        await apiClient.checkOut(attendanceId, data);
        Alert.alert(
          t('worker.checkout_success', locale),
          t('attendance.checkout_success_body', locale)
            .replace('{hours}', String(calc.normalHoursWorked))
            .replace('{overtime}', calc.overtimeHoursDisplay)
        );
      }
    } catch (e: any) {
      console.error('Check-out error:', e);
      Alert.alert(t('worker.error_generic', locale), e.message || t('attendance.checkout_error_body', locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageIntro sectionId="attendance" locale={locale} role="worker" />
      {/* Worker Header Card */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.full_name.substring(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userRole}>{t('attendance.worker_role_label', locale)}</Text>
        </View>
      </View>

      {/* Project Selector Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>{t('attendance.selected_site', locale)}</Text>
        <View style={styles.siteBox}>
          <Text style={styles.siteName}>{selectedProject.name}</Text>
          <Text style={styles.siteCode}>{t('attendance.site_code', locale)}: {selectedProject.code} • {selectedProject.address}</Text>
        </View>

        {/* GPS Geofence Badge */}
        <View style={[styles.gpsBadge, isWithinGeofence ? styles.gpsValid : styles.gpsInvalid]}>
          <Text style={styles.gpsText}>
            {gpsLoading
              ? t('attendance.gps_checking', locale)
              : currentGpsDist === null
              ? t('attendance.gps_no_fix', locale)
              : isWithinGeofence
              ? t('attendance.gps_within', locale)
                  .replace('{distance}', String(currentGpsDist))
                  .replace('{radius}', String(selectedProject.geofence_radius_meters))
              : t('attendance.gps_outside', locale)
                  .replace('{distance}', String(currentGpsDist))
                  .replace('{radius}', String(selectedProject.geofence_radius_meters))}
          </Text>
        </View>

        {gpsErrorTranslationKey && (
          <View style={styles.gpsErrorBox}>
            <Text style={styles.gpsWarningText}>
              {t(gpsErrorTranslationKey, locale)}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={refreshGps}
              disabled={gpsLoading}
              accessibilityRole="button"
              accessibilityLabel={t('worker.gps_retry', locale)}
            >
              <Text style={styles.retryButtonText}>
                {gpsLoading ? t('attendance.gps_checking', locale) : t('worker.gps_retry', locale)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Touch Targets */}
      <View style={styles.actionSection}>
        {loading ? (
          <ActivityIndicator size="large" color="#f59e0b" style={{ padding: 40 }} />
        ) : !activeLog ? (
          <TouchableOpacity 
            style={[styles.bigButton, styles.checkInButton]} 
            onPress={handleCheckIn}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.bigButtonText}>{t('worker.clock_in', locale)}</Text>
            <Text style={styles.buttonSubtext}>{t('attendance.check_in_hint', locale)}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeContainer}>
            <View style={styles.activeBanner}>
              <Text style={styles.activeTitle}>{t('attendance.present_title', locale)}</Text>
              <Text style={styles.activeTime}>
                {t('attendance.check_in_recorded', locale)}: {new Date(activeLog.check_in).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.bigButton, styles.checkOutButton]} 
              onPress={handleCheckOut}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.bigButtonText}>{t('worker.clock_out', locale)}</Text>
              <Text style={styles.buttonSubtext}>{t('attendance.check_out_hint', locale)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Schedule Notes */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{t('attendance.schedule_title', locale)}</Text>
        <Text style={styles.infoText}>{t('attendance.schedule_base', locale)}</Text>
        <Text style={styles.infoText}>{t('attendance.schedule_overtime', locale)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0f172a',
    flexGrow: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 13,
    color: '#94a3b8',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  siteBox: {
    marginBottom: 12,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  siteCode: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  gpsBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  gpsValid: {
    backgroundColor: '#064e3b',
  },
  gpsInvalid: {
    backgroundColor: '#7f1d1d',
  },
  gpsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  gpsWarningText: {
    color: '#f87171',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  gpsErrorBox: {
    marginTop: 8,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  actionSection: {
    marginVertical: 10,
  },
  bigButton: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  checkInButton: {
    backgroundColor: '#10b981',
  },
  checkOutButton: {
    backgroundColor: '#f59e0b',
  },
  bigButtonText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1,
  },
  buttonSubtext: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.9,
  },
  activeContainer: {
    gap: 16,
  },
  activeBanner: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  activeTime: {
    fontSize: 13,
    color: '#e2e8f0',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
});

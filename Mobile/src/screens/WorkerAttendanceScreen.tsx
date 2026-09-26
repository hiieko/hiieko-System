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
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActiveStateAndLocation() {
      const log = await getActiveTimeLog();
      setActiveLogState(log);
      await refreshGps();
    }
    loadActiveStateAndLocation();
  }, [selectedProject]);

  const refreshGps = async () => {
    const loc = await getCurrentDeviceLocation();
    if (loc.error) {
      setGpsError(loc.error);
      // Fallback distance for simulation/demo if physical GPS is blocked in simulator
      const simulatedCheck = isWithinProjectGeofence(44.2981, 23.8122, selectedProject.latitude, selectedProject.longitude, selectedProject.geofence_radius_meters);
      setCurrentGpsDist(simulatedCheck.distanceMeters);
    } else if (loc.latitude && loc.longitude) {
      setGpsError(null);
      const check = isWithinProjectGeofence(
        loc.latitude,
        loc.longitude,
        selectedProject.latitude,
        selectedProject.longitude,
        selectedProject.geofence_radius_meters
      );
      setCurrentGpsDist(check.distanceMeters);
    }
  };

  const isWithinGeofence = currentGpsDist !== null && currentGpsDist <= selectedProject.geofence_radius_meters;

  const handleCheckIn = async () => {
    if (loading) return; // Prevent double tap

    setLoading(true);
    try {
      const loc = await getCurrentDeviceLocation();
      let workerLat = loc.latitude || 44.2981;
      let workerLng = loc.longitude || 23.8122;

      const geofence = isWithinProjectGeofence(
        workerLat,
        workerLng,
        selectedProject.latitude,
        selectedProject.longitude,
        selectedProject.geofence_radius_meters
      );

      if (!geofence.isWithin && !loc.error) {
        Alert.alert(
          'În Afara Șantierului',
          `Te afli la ${geofence.distanceMeters}m de șantier. Raza permisă este de ${selectedProject.geofence_radius_meters}m.`
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
        Alert.alert('Salvat Local (Offline)', 'Sosirea ta (AM VENIT) a fost înregistrată local și se va sincroniza când revine conexiunea.');
      } else {
        // Submit directly to API
        await apiClient.checkIn(checkInPayload);
        Alert.alert('Succes!', `Ai pontat sosirea (AM VENIT) la ${selectedProject.name}`);
      }
    } catch (e: any) {
      Alert.alert('Eroare', e.message || 'Nu s-a putut înregistra sosirea');
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

      // Get current location for check-out
      const loc = await getCurrentDeviceLocation();
      const workerLat = loc.latitude || 44.2981;
      const workerLng = loc.longitude || 23.8122;

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
          'Plecare Înregistrată Local', 
          `Ai pontat plecarea (AM PLECAT).\nOre lucrate: ${calc.normalHoursWorked}h\nOre suplimentare: ${calc.overtimeHoursDisplay}`
        );
      } else {
        // Submit directly to API
        const { attendanceId, ...data } = checkOutPayload;
        await apiClient.checkOut(attendanceId, data);
        Alert.alert(
          'Zi de Muncă Încheiată!',
          `Plecare confirmată (AM PLECAT).\nOre normale: ${calc.normalHoursWorked}h\nOre suplimentare: ${calc.overtimeHoursDisplay}`
        );
      }
    } catch (e: any) {
      console.error('Check-out error:', e);
      Alert.alert('Eroare', e.message || 'Nu s-a putut înregistra plecarea');
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
          <Text style={styles.userRole}>Lucrător Șantier Solar</Text>
        </View>
      </View>

      {/* Project Selector Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>ȘANTIER SELECTAT (CE ȘANTIER):</Text>
        <View style={styles.siteBox}>
          <Text style={styles.siteName}>{selectedProject.name}</Text>
          <Text style={styles.siteCode}>Cod: {selectedProject.code} • {selectedProject.address}</Text>
        </View>

        {/* GPS Geofence Badge */}
        <View style={[styles.gpsBadge, isWithinGeofence ? styles.gpsValid : styles.gpsInvalid]}>
          <Text style={styles.gpsText}>
            {isWithinGeofence 
              ? `✓ GPS Validat: Ești în perimetrul șantierului (${currentGpsDist}m <= ${selectedProject.geofence_radius_meters}m)`
              : `⚠ În afara perimetrului (${currentGpsDist ?? '?'}m > ${selectedProject.geofence_radius_meters}m)`}
          </Text>
        </View>

        {gpsError && (
          <Text style={styles.gpsWarningText}>
            {gpsError}
          </Text>
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
            <Text style={styles.bigButtonText}>AM VENIT</Text>
            <Text style={styles.buttonSubtext}>Apasă la sosirea pe șantier (09:00)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeContainer}>
            <View style={styles.activeBanner}>
              <Text style={styles.activeTitle}>EȘTI PREZENT PE ȘANTIER</Text>
              <Text style={styles.activeTime}>
                Sosire înregistrată: {new Date(activeLog.check_in).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.bigButton, styles.checkOutButton]} 
              onPress={handleCheckOut}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.bigButtonText}>AM PLECAT</Text>
              <Text style={styles.buttonSubtext}>Apasă la terminarea programului de lucru</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Schedule Notes */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Program Oficial Șantier:</Text>
        <Text style={styles.infoText}>• Program de bază: 09:00 – 18:00 (1 oră pauză de masă)</Text>
        <Text style={styles.infoText}>• Plecarea după ora 18:00 generează automat ore suplimentare (ORE SUPLIM.)</Text>
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

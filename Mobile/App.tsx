import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions
} from 'react-native';
import { WorkerAttendanceScreen } from './src/screens/WorkerAttendanceScreen';
import { TeamLeaderDailyReportScreen } from './src/screens/TeamLeaderDailyReportScreen';
import { DeliveryIntakeScreen } from './src/screens/DeliveryIntakeScreen';
import { WorkerExpenseScreen } from './src/screens/WorkerExpenseScreen';
import { NotificationCenter } from './src/screens/NotificationCenterScreen';
import { OfflineBanner } from './src/components/OfflineBanner';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LocaleProvider, useLocale } from './src/components/LocaleProvider';
import { getOfflineQueue } from './src/services/storage';
import { Site, Material, UserProfile } from '@solar/shared';

const DEMO_SITES: Site[] = [
  {
    id: 's1',
    name: 'Parc Solar Craiova Sud',
    code: 'PV-CR-01',
    address: 'DJ552B, Craiova, Dolj',
    latitude: 44.2981,
    longitude: 23.8122,
    geofence_radius_meters: 350,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 's2',
    name: 'Parc Solar Brașov Est',
    code: 'PV-BV-02',
    address: 'DN11, Hărman, Brașov',
    latitude: 45.7125,
    longitude: 25.6841,
    geofence_radius_meters: 400,
    is_active: true,
    created_at: '',
    updated_at: '',
  }
];

const DEMO_MATERIALS: Material[] = [
  {
    id: 'm1',
    code: 'PAN-550W',
    name: 'Panou Fotovoltaic Monocristalin 550W',
    unit: 'buc',
    barcode: '', is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'm2',
    code: 'CAB-SOL-6',
    name: 'Cablu Solar Negru 6mm²',
    unit: 'm',
    barcode: '', is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'm4',
    code: 'GARD-150M',
    name: 'Gard Împrejmuire Șantier 150m',
    unit: 'buc',
    barcode: '', is_active: true,
    created_at: '',
    updated_at: '',
  }
];

const DEMO_WORKERS = [
  { id: 'u2', full_name: 'Vasile Ionescu (Șef Echipă)', role: 'team_leader' },
  { id: 'u3', full_name: 'Costel Popa', role: 'worker' },
  { id: 'u4', full_name: 'Gicu Georgescu', role: 'worker' },
];

export default function App() {
  return (
    <LocaleProvider>
      <AppShell />
    </LocaleProvider>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'report' | 'delivery' | 'expense' | 'notifications' | 'settings'>('attendance');
  const [isOffline, setIsOffline] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(DEMO_WORKERS[0]); // Default: Team Leader
  const { width } = useWindowDimensions();
  const { locale } = useLocale();

  useEffect(() => {
    async function checkQueue() {
      const q = await getOfflineQueue();
      setPendingQueueCount(q.length);
    }
    checkQueue();
    const interval = setInterval(checkQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  const isTablet = width >= 768;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Solar Site App</Text>
          <Text style={styles.headerSubtitle}>
            Utilizator: <Text style={styles.highlightText}>{currentUser.full_name}</Text>
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.offlineToggle, isOffline ? styles.offlineActive : styles.onlineActive]}
          onPress={() => setIsOffline(!isOffline)}
        >
          <Text style={styles.offlineToggleText}>
            {isOffline ? 'MOD: OFFLINE' : 'MOD: ONLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} pendingCount={pendingQueueCount} />

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'attendance' && styles.tabItemActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
            Pontaj (AM VENIT)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'report' && styles.tabItemActive]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
            Raport Zilnic
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'delivery' && styles.tabItemActive]}
          onPress={() => setActiveTab('delivery')}
        >
          <Text style={[styles.tabText, activeTab === 'delivery' && styles.tabTextActive]}>
            Recepție Avize
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'expense' && styles.tabItemActive]}
          onPress={() => setActiveTab('expense')}
        >
          <Text style={[styles.tabText, activeTab === 'expense' && styles.tabTextActive]}>
            Cheltuieli
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'notifications' && styles.tabItemActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Notificari
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="tab-settings"
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            Setari
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Screen */}
      <View style={[styles.contentContainer, isTablet && styles.tabletContainer]}>
        {activeTab === 'attendance' && (
          <WorkerAttendanceScreen
            user={currentUser}
            sites={DEMO_SITES}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'report' && (
          <TeamLeaderDailyReportScreen
            leader={currentUser}
            site={DEMO_SITES[0]}
            teamWorkers={DEMO_WORKERS}
            materialsCatalog={DEMO_MATERIALS}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'delivery' && (
          <DeliveryIntakeScreen
            user={currentUser}
            site={DEMO_SITES[0]}
            materialsCatalog={DEMO_MATERIALS}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'expense' && (
          <WorkerExpenseScreen
            user={currentUser}
            sites={DEMO_SITES}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationCenter locale={locale} />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  highlightText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  offlineToggle: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  onlineActive: {
    backgroundColor: '#064e3b',
  },
  offlineActive: {
    backgroundColor: '#b45309',
  },
  offlineToggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
  tabletContainer: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
});

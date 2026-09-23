import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WorkerAttendanceScreen } from './src/screens/WorkerAttendanceScreen';
import { TeamLeaderDailyReportScreen } from './src/screens/TeamLeaderDailyReportScreen';
import { DeliveryIntakeScreen } from './src/screens/DeliveryIntakeScreen';
import { WorkerExpenseScreen } from './src/screens/WorkerExpenseScreen';
import { NotificationCenter } from './src/screens/NotificationCenterScreen';
import { OfflineBanner } from './src/components/OfflineBanner';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LocaleProvider, useLocale } from './src/components/LocaleProvider';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { getOfflineQueue } from './src/services/storage';
import { getProjects, getMaterials, Project, Material as LocalMaterial } from './src/services/localData';
import { syncAllOperations } from './src/services/syncQueue';
import { Site } from '@solar/shared';

// Convert LocalMaterial (from localData) to match what screens expect
function mapToScreenMaterial(localMat: LocalMaterial): any {
  return {
    id: localMat.id,
    code: localMat.code,
    name: localMat.name,
    unit: localMat.unit as any,
    barcode: '',
    is_active: localMat.is_active,
    created_at: localMat.synced_at || '',
    updated_at: localMat.synced_at || '',
  };
}

// Convert Project (from localData) to Site interface for screens
function mapToSite(project: Project): Site {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    address: project.address || '',
    latitude: project.latitude || 0,
    longitude: project.longitude || 0,
    geofence_radius_meters: project.geofence_radius_meters || 100,
    is_active: project.is_active,
    created_at: project.synced_at || '',
    updated_at: project.synced_at || '',
  };
}

// ============================================================================
// FALLBACK DATA (for when nothing is loaded yet)
// ============================================================================

const FALLBACK_SITES: Site[] = [
  {
    id: 'fallback-1',
    name: 'Se încarcă date...',
    code: 'LOADING',
    address: '',
    latitude: 0,
    longitude: 0,
    geofence_radius_meters: 100,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
];

const FALLBACK_MATERIALS: any[] = [];

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </LocaleProvider>
  );
}

// Loading Screen Component
function LoadingScreen() {
  return (
    <View style={loadingStyles.container}>
      <View style={loadingStyles.logo}>
        <Text style={loadingStyles.logoText}>H</Text>
      </View>
      <ActivityIndicator size="large" color="#f59e0b" />
      <Text style={loadingStyles.text}>Se încarcă HIIEKO...</Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0f172a',
  },
  text: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
  },
});

// App Root - handles auth state routing
function AppRoot() {
  const { authState } = useAuth();

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  if (authState === 'unauthenticated') {
    return <LoginScreenWrapper />;
  }

  return <AppShell />;
}

// Login Screen Wrapper
function LoginScreenWrapper() {
  const { refreshAuth } = useAuth();

  const handleLogin = async (user: { id: string; full_name: string; role: string }) => {
    // LoginScreen already called auth.login() internally
    // Just refresh auth state to update the context
    await refreshAuth();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LoginScreen onLogin={handleLogin} />
    </SafeAreaView>
  );
}

function AppShell() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Auth context
  const { currentUser } = useAuth();
  const { locale } = useLocale();

  // UI state
  const [activeTab, setActiveTab] = useState<'attendance' | 'report' | 'delivery' | 'expense' | 'notifications' | 'settings'>('attendance');
  const [isOffline, setIsOffline] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  
  // Data state (loaded from SQLite cache)
  const [sites, setSites] = useState<Site[]>(FALLBACK_SITES);
  const [materials, setMaterials] = useState<any[]>(FALLBACK_MATERIALS);

  // Get team workers from current user
  const teamWorkers = currentUser ? [
    { id: currentUser.id, full_name: currentUser.full_name, role: currentUser.role },
  ] : [];

  // ==========================================================================
  // EFFECT: NetInfo connectivity listener
  // ==========================================================================
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      const nowOffline = state.isConnected === false;
      setIsOffline(nowOffline);
      
      // When coming online, trigger auto-sync
      if (wasOffline && !nowOffline) {
        console.log('📶 Back online - triggering auto-sync...');
        syncAllOperations().then(result => {
          console.log(`🔄 Auto-sync: ${result.synced} synced, ${result.failed} failed`);
        }).catch(err => {
          console.error('❌ Auto-sync failed:', err);
        });
      }
    });

    return unsubscribe;
  }, [isOffline]);

  // ==========================================================================
  // EFFECT: Load data from SQLite cache
  // ==========================================================================
  useEffect(() => {
    loadCachedData();
  }, [currentUser]);

  // ==========================================================================
  // EFFECT: Update pending queue count
  // ==========================================================================
  useEffect(() => {
    const updateQueueCount = async () => {
      const q = await getOfflineQueue();
      setPendingQueueCount(q.length);
    };
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // ==========================================================================
  // Load cached data from SQLite
  // ==========================================================================
  async function loadCachedData() {
    try {
      // Load projects from SQLite
      const cachedProjects = await getProjects();
      if (cachedProjects.length > 0) {
        setSites(cachedProjects.map(mapToSite));
        console.log(`✅ Loaded ${cachedProjects.length} sites from cache`);
      }

      // Load materials from SQLite
      const cachedMaterials = await getMaterials();
      if (cachedMaterials.length > 0) {
        setMaterials(cachedMaterials.map(mapToScreenMaterial));
        console.log(`✅ Loaded ${cachedMaterials.length} materials from cache`);
      }
    } catch (error) {
        console.error('❌ Failed to load cached data:', error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Solar Site App</Text>
          <Text style={styles.headerSubtitle}>
            Utilizator: <Text style={styles.highlightText}>{currentUser?.full_name || 'Necunoscut'}</Text>
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
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'worker' }}
            sites={sites}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'report' && (
          <TeamLeaderDailyReportScreen
            leader={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'team_leader' }}
            site={sites[0] || FALLBACK_SITES[0]}
            teamWorkers={teamWorkers}
            materialsCatalog={materials}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'delivery' && (
          <DeliveryIntakeScreen
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'worker' }}
            site={sites[0] || FALLBACK_SITES[0]}
            materialsCatalog={materials}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'expense' && (
          <WorkerExpenseScreen
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator' }}
            sites={sites}
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

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
import { getProjects, getMaterials, saveProjects, saveMaterials, Project as LocalProject, Material as LocalMaterial } from './src/services/localData';
import { syncAllOperations } from './src/services/syncQueue';
import { apiClient } from './src/services/apiClient';
import { Project } from '@solar/shared';

// Convert LocalMaterial (from localData) to match what screens expect
function mapToScreenProject(localProj: LocalProject): Project {
  return {
    id: localProj.id,
    organization_id: '',
    name: localProj.name,
    code: localProj.code,
    address: localProj.address || '',
    latitude: localProj.latitude || 0,
    longitude: localProj.longitude || 0,
    geofence_radius_meters: localProj.geofence_radius_meters || 100,
    is_active: localProj.is_active,
    status: 'active',
    created_at: localProj.synced_at || new Date().toISOString(),
    updated_at: localProj.synced_at || new Date().toISOString(),
  };
}

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

// ============================================================================
// FALLBACK DATA (for when nothing is loaded yet)
// ============================================================================

/** No fallback data. Screens gate on projects.length > 0. */

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);

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

        // 1. Sync offline queue first (time-sensitive)
        syncAllOperations().then(result => {
          console.log(`🔄 Offline queue sync: ${result.synced} synced, ${result.failed} failed`);
        }).catch(err => {
          console.error('❌ Offline queue sync failed:', err);
        });

        // 2. Sync master data (projects, materials) in background
        // This ensures stale cache is refreshed when connectivity is restored
        syncMasterDataFromAPI();
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
  // Sync master data from API (projects, materials)
  // ==========================================================================
  async function syncMasterDataFromAPI() {
    if (isOffline) {
      console.log('📴 Offline - skipping master data sync');
      return;
    }

    try {
      console.log('🔄 Syncing master data from API...');

      // Sync projects
      const projectsResponse = await apiClient.getProjects();
      if (projectsResponse.data) {
        const apiProjects = projectsResponse.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          address: p.address,
          latitude: p.latitude ? Number(p.latitude) : undefined,
          longitude: p.longitude ? Number(p.longitude) : undefined,
          geofence_radius_meters: p.geofence_radius_meters || undefined,
          is_active: p.is_active !== false,
        }));

        await saveProjects(apiProjects);
        setProjects(apiProjects.map(mapToScreenProject));
        console.log(`✅ Synced ${apiProjects.length} projects from API`);
      }

      // Sync materials
      try {
        const materialsResponse = await apiClient.getMaterials();
        if (materialsResponse.data) {
          const apiMaterials = materialsResponse.data.map((m: any) => ({
            id: m.id,
            code: m.code,
            name: m.name,
            unit: m.unit || 'buc',
            is_active: m.is_active !== false,
          }));

          await saveMaterials(apiMaterials);
          setMaterials(apiMaterials.map(mapToScreenMaterial));
          console.log(`✅ Synced ${apiMaterials.length} materials from API`);
        }
      } catch (matErr) {
        // Materials API may not exist yet - non-critical
        console.log('⚠️ Materials sync skipped (API may not be available)');
      }
    } catch (error) {
      console.error('❌ Failed to sync master data:', error);
      // Don't fail - fall back to cached data
    }
  }

  // ==========================================================================
  // Load cached data from SQLite + sync fresh from API when online
  // ==========================================================================
  async function loadCachedData() {
    try {
      // First, load from cache for quick UI display
      const cachedProjects = await getProjects();
      if (cachedProjects.length > 0) {
        setProjects(cachedProjects.map(mapToScreenProject));
        console.log(`✅ Loaded ${cachedProjects.length} projects from cache`);
      }
      setProjectsLoading(false);

      const cachedMaterials = await getMaterials();
      if (cachedMaterials.length > 0) {
        setMaterials(cachedMaterials.map(mapToScreenMaterial));
        console.log(`✅ Loaded ${cachedMaterials.length} materials from cache`);
      }

      // Then, sync fresh data from API in background (when online)
      // This ensures:
      // 1. UI loads fast from cache
      // 2. Fresh data is fetched and saved for next load
      // 3. Stale project IDs are refreshed (prevents NotFoundException on check-in)
      if (!isOffline) {
        await syncMasterDataFromAPI();
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
        {activeTab === 'attendance' && projects.length > 0 && (
          <WorkerAttendanceScreen
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'worker' }}
            projects={projects}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'report' && projects.length > 0 && (
          <TeamLeaderDailyReportScreen
            leader={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'team_leader' }}
            project={projects[0]}
            teamWorkers={teamWorkers}
            materialsCatalog={materials}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'delivery' && projects.length > 0 && (
          <DeliveryIntakeScreen
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator', role: 'worker' }}
            site={projects[0]}
            materialsCatalog={materials}
            isOffline={isOffline}
            locale={locale}
          />
        )}
        {activeTab === 'expense' && projects.length > 0 && (
          <WorkerExpenseScreen
            user={currentUser || teamWorkers[0] || { id: 'temp', full_name: 'Utilizator' }}
            projects={projects}
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

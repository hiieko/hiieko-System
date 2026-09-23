import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { apiClient } from '../services/apiClient';
import { PageIntro } from '../components/PageIntro';

/**
 * Notification inbox - PostgreSQL / NestJS path.
 *
 * Source of truth: GET /api/notifications. The backend scopes the inbox to the
 * authenticated user (JWT subject), so no client-side user filtering is needed
 * and no Supabase client is involved.
 */
interface NotifItem {
  id: string;
  title_ro: string;
  title_en?: string | null;
  message_ro: string;
  message_en?: string | null;
  is_read: boolean;
  priority?: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface Props { locale?: 'ro' | 'en'; }

export function NotificationCenter({ locale = 'ro' }: Props) {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.getNotifications();
      if (res.error) throw new Error(res.error);
      setNotifs((res.data as NotifItem[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la incarcare');
      setNotifs([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const onRefresh = () => { loadNotifs(); };
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const markRead = async (id: string) => {
    // Optimistic update; the backend enforces ownership (notification.user_id).
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await apiClient.markNotificationRead(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la marcare');
      loadNotifs();
    }
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await apiClient.markAllNotificationsRead();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la marcare');
      loadNotifs();
    }
  };

  return (
    <View style={s.container}>
      <PageIntro sectionId="notifications" locale={locale} role="manager" />
      <View style={s.header}>
        <Text style={s.title}>{locale === 'ro' ? 'Notificari' : 'Notifications'}</Text>
        <View style={s.headerRight}>
          {unreadCount > 0 && <Text style={s.badge}>{unreadCount}</Text>}
          <TouchableOpacity onPress={markAllRead}><Text style={s.markAll}>{locale === 'ro' ? 'Citit tot' : 'Read all'}</Text></TouchableOpacity>
        </View>
      </View>
      {error && <Text style={s.errorText}>{error}</Text>}
      {loading ? (
        <View style={s.loadingContainer}><ActivityIndicator size="large" color="#f59e0b" /><Text style={s.loadingText}>Se incarca...</Text></View>
      ) : notifs.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyText}>{locale === 'ro' ? 'Fara notificari.' : 'No notifications.'}</Text></View>
      ) : (
        <FlatList
          data={notifs} keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.item, !item.is_read && s.itemUnread]} onPress={() => markRead(item.id)}>
              <View style={[s.dot, item.is_read && s.dotRead]} />
              <View style={s.itemContent}>
                <Text style={s.itemTitle}>{(locale === 'ro' ? item.title_ro : item.title_en) || item.title_ro}</Text>
                <Text style={s.itemBody}>{(locale === 'ro' ? item.message_ro : item.message_en) || item.message_ro}</Text>
                <Text style={s.itemTime}>{new Date(item.created_at).toLocaleString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  badge: { backgroundColor: '#ef4444', color: '#ffffff', fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  markAll: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#94a3b8', fontSize: 13 },
  errorText: { color: '#ef4444', margin: 16, textAlign: 'center' },
  item: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'flex-start' },
  itemUnread: { backgroundColor: '#1e293b' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginTop: 6, marginRight: 12 },
  dotRead: { backgroundColor: '#334155' },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  itemBody: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 18 },
  itemTime: { fontSize: 11, color: '#64748b', marginTop: 6 },
});
'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { normalizeEnvelope } from '../../lib/normalize-envelope';

interface NotifItem {
  id: string;
  title_ro: string;
  title_en?: string | null;
  message_ro: string;
  message_en?: string | null;
  is_read: boolean;
  priority: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface PaginatedNotifs {
  data: NotifItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function NotificariPage() {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { locale } = useLocale();

  const loadNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawResponse = await apiClient.getNotifications({ page: 1, pageSize: 50 });
      // The apiClient wraps in { data, error }. The inner data is the paginated envelope:
      // { data: NotifItem[], total, page, pageSize }
      const normalized = normalizeEnvelope<PaginatedNotifs>(rawResponse);
      if (normalized.error) {
        setError(normalized.error);
        setNotifs([]);
      } else if (normalized.data) {
        // normalized.data is the PaginatedNotifs object; access .data for the array
        const paginated = normalized.data as unknown as PaginatedNotifs;
        setNotifs(Array.isArray(paginated.data) ? paginated.data : []);
        setTotal(paginated.total || 0);
      } else {
        setNotifs([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la incarcarea notificarilor.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const filtered = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const markRead = async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const pBadge = (p: string) => {
    if (p === 'high') return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">URGENT</span>;
    return null;
  };

  const tabs = [{ k: 'all', l: 'Toate' }, { k: 'unread', l: 'Necitite' }];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageTutorial sectionId="notifications" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificari</h1>
          <p className="text-sm text-slate-500 mt-1">Centrul de notificari pentru evenimentele din sistem.</p>
        </div>
        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-xs font-bold">
              <Bell className="w-3.5 h-3.5 mr-1.5" />{unreadCount} necitite
            </span>
          )}
          <button onClick={() => loadNotifs()}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Reimprospateaza
          </button>
          <button onClick={markAllRead}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm">
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />Marcheaza tot citit
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setFilter(t.k as 'all' | 'unread')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === t.k ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca notificarile...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-600">Fara notificari</h3>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(n => (
              <div key={n.id}
                className={`p-4 flex items-start space-x-4 hover:bg-slate-50/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-amber-50/30' : ''}`}
                onClick={() => markRead(n.id)}>
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-slate-200' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-slate-900">{locale === 'ro' ? n.title_ro : (n.title_en || n.title_ro)}</h4>
                    {pBadge(n.priority)}
                    {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{locale === 'ro' ? n.message_ro : (n.message_en || n.message_ro)}</p>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {new Date(n.created_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

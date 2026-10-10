'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { normalizeEnvelope } from '../../lib/normalize-envelope';
import { PageHeader, Button, Card, Badge, Tabs, ErrorState, Skeleton, EmptyState, useToast } from '../../components/ui';

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

export default function NotificariPage() {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { locale } = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();

  const loadNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawResponse = await apiClient.getNotifications({ page: 1, pageSize: 50 });
      // normalizeEnvelope already flattens the paginated inner envelope
      // ({ data, total, page, pageSize }), so `normalized.data` is the array itself.
      const normalized = normalizeEnvelope<NotifItem[]>(rawResponse);
      if (normalized.error) {
        setError(normalized.error);
        setNotifs([]);
      } else {
        setNotifs(Array.isArray(normalized.data) ? normalized.data : []);
        setTotal(normalized.total || 0);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : t('notifications.load_error', locale));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const filtered = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(new Date());
  const yesterdayStart = todayStart - 86400000;
  const groups: { key: string; label: string; items: NotifItem[] }[] = [];
  filtered.forEach(n => {
    const ts = startOfDay(new Date(n.created_at));
    let key: string;
    let label: string;
    if (ts === todayStart) {
      key = 'today';
      label = locale === 'ro' ? 'Astăzi' : 'Today';
    } else if (ts === yesterdayStart) {
      key = 'yesterday';
      label = locale === 'ro' ? 'Ieri' : 'Yesterday';
    } else {
      key = String(ts);
      label = new Date(n.created_at).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, label, items: [n] });
  });

  const markRead = async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      toastError(
        t('notifications.load_error', locale),
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : undefined,
      );
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      toastSuccess(locale === 'ro' ? 'Notificări marcate ca citite' : 'All notifications marked as read');
    } catch (err) {
      toastError(
        t('notifications.load_error', locale),
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : undefined
      );
    }
  };

  const pBadge = (p: string) => {
    if (p === 'high') return <Badge variant="danger" size="sm">{t('notifications.urgent', locale)}</Badge>;
    return null;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageTutorial sectionId="notifications" />
      <PageHeader
        title={t('notifications.title', locale)}
        subtitle={t('notifications.system_subtitle', locale)}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {unreadCount > 0 && (
              <Badge variant="danger" size="md" className="gap-1.5">
                <Bell className="w-3.5 h-3.5" />{unreadCount} {t('notifications.unread', locale).toLowerCase()}
              </Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadNotifs()}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              {t('notifications.refresh', locale)}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllRead}
              className="w-full sm:w-auto"
              icon={<CheckCheck className="w-3.5 h-3.5" />}
            >
              {t('notifications.mark_all_read', locale)}
            </Button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { key: 'all', label: t('notifications.all', locale) },
          { key: 'unread', label: t('notifications.unread', locale) },
        ]}
        activeTab={filter}
        onTabChange={(k) => setFilter(k as 'all' | 'unread')}
        className="w-full sm:w-fit"
      />

      {error ? (
        <ErrorState title={t('notifications.load_error', locale)} error={error} onRetry={loadNotifs} />
      ) : loading ? (
        <Skeleton className="h-20" count={4} />
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          {filter === 'unread' && notifs.length > 0 ? (
            <EmptyState
              icon={<Bell />}
              title="No matching results"
              description="No unread notifications right now."
              action={{ label: 'Show all', onClick: () => setFilter('all') }}
            />
          ) : (
            <EmptyState
              icon={<Bell />}
              title="You're all caught up"
              description="New notifications will appear here."
            />
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.key} className="space-y-3">
              <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                {group.label}
              </div>
              <div className="space-y-3">
                {group.items.map(n => (
                  <div key={n.id} onClick={() => markRead(n.id)} className="cursor-pointer">
                    <Card
                      padding={false}
                      className={`p-4 sm:p-5 flex items-start space-x-4 hover:bg-slate-50/50 border-l-4 ${!n.is_read ? 'bg-warning-soft/30 border-l-warning' : 'border-l-transparent'}`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-slate-200' : 'bg-warning'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-slate-900">{locale === 'ro' ? n.title_ro : (n.title_en || n.title_ro)}</h4>
                          {pBadge(n.priority)}
                          {!n.is_read && <span className="w-1.5 h-1.5 bg-info rounded-full shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{locale === 'ro' ? n.message_ro : (n.message_en || n.message_ro)}</p>
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          {new Date(n.created_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

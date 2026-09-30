'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { t, useLocale } from '@solar/shared';

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

export interface WorkerNotificationsProps {
  notifications: NotifItem[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMarkRead?: (id: string) => void;
  maxItems?: number;
}

export function WorkerNotifications({
  notifications,
  loading,
  error,
  onRetry,
  onMarkRead,
  maxItems = 5,
}: WorkerNotificationsProps) {
  const { locale } = useLocale();

  const displayedNotifications = (notifications || []).slice(0, maxItems);
  const hasMore = (notifications || []).length > maxItems;

  const getTitle = (notif: NotifItem) => {
    if (locale === 'en' && notif.title_en) {
      return notif.title_en;
    }
    return notif.title_ro;
  };

  const getMessage = (notif: NotifItem) => {
    if (locale === 'en' && notif.message_en) {
      return notif.message_en;
    }
    return notif.message_ro;
  };

  const getPriorityClass = (priority: string) => {
    if (priority === 'high' || priority === 'critical') {
      return 'bg-red-100 text-red-700';
    }
    if (priority === 'medium') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-slate-100 text-slate-600';
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return t('worker.notifications.time_days', locale).replace('{count}', String(diffDays));
      }
      if (diffHours > 0) {
        return t('worker.notifications.time_hours', locale).replace('{count}', String(diffHours));
      }
      if (diffMins > 0) {
        return t('worker.notifications.time_minutes', locale).replace('{count}', String(diffMins));
      }
      return t('worker.notifications.time_now', locale);
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('nav.notificari', locale)}</h2>
              {notifications && notifications.length > 0 && (
                <p className="text-xs text-slate-400">
                  {t('worker.notifications.unread_count', locale).replace(
                    '{count}',
                    String(notifications.length),
                  )}
                </p>
              )}
            </div>
          </div>
          <button onClick={onRetry} disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            title={t('general.refresh', locale)}>
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-12 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              <button onClick={onRetry}
                className="mt-1 text-amber-700 underline-offset-2 hover:underline text-xs">
                {t('general.retry', locale)}
              </button>
            </div>
          </div>
        )}
        {!loading && !error && displayedNotifications.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            {t('worker.notifications.none', locale)}
          </p>
        )}

        {!loading && !error && displayedNotifications.length > 0 && (
          <div className="space-y-2">
            {displayedNotifications.map((notif) => (
              <div key={notif.id}
                onClick={() => onMarkRead && !notif.is_read ? onMarkRead(notif.id) : undefined}
                className={`bg-slate-50 rounded-lg px-3 py-3 border border-slate-100 cursor-pointer transition-colors ${
                  !notif.is_read ? 'border-l-4 border-l-hii-600 bg-hii-50' : ''
                }`}>
                <div className="flex items-start justify-between mb-0.5">
                  <p className="text-sm font-medium text-slate-900 flex-1 min-w-0 pr-2">
                    {getTitle(notif)}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {notif.priority !== 'low' && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityClass(notif.priority)}`}>
                        {t('notifications.urgent', locale)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {getMessage(notif)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <Link href="/notificari"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-hii-700 underline-offset-2 hover:underline min-h-[44px]">
            {t('worker.view_all', locale)}
            {hasMore && (
              <span className="text-xs text-slate-400">
                ({t('worker.notifications.total', locale).replace(
                  '{count}',
                  String((notifications || []).length),
                )})
              </span>
            )}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}


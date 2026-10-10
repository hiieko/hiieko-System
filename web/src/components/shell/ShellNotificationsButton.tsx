'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';

export type ShellNotificationsVariant = 'header' | 'compact';

interface ShellNotificationsButtonProps {
  variant?: ShellNotificationsVariant;
}

/**
 * Reads the real unread count from `GET /api/notifications?unreadOnly=true&pageSize=1`.
 * The endpoint answers `{ data, total, page, pageSize }`; a bare array (older
 * shape) is handled too. Anything else — including a failed request — yields
 * `null`, and a `null` count renders no badge at all: an absent badge is
 * honest, an invented one is not.
 */
function readUnreadTotal(payload: unknown): number | null {
  if (Array.isArray(payload)) return payload.length;
  if (payload && typeof payload === 'object') {
    const total = (payload as { total?: unknown }).total;
    if (typeof total === 'number' && Number.isFinite(total)) return total;
  }
  return null;
}

/**
 * Session-scoped memo of the unread count. The shell renders one button per
 * breakpoint variant (the >= lg header and the < lg compact bar) and both mount
 * in the same pass, so without this the page would issue the same request twice.
 * A `null` (failed or unreadable) result is memoised as well: the badge stays
 * absent instead of retrying on every mount.
 */
let unreadCache: { value: number | null } | null = null;
let unreadInFlight: Promise<number | null> | null = null;

function fetchUnreadTotal(): Promise<number | null> {
  if (unreadCache) return Promise.resolve(unreadCache.value);
  if (unreadInFlight) return unreadInFlight;
  unreadInFlight = (async () => {
    let value: number | null = null;
    try {
      const res = await apiClient.getNotifications({ unreadOnly: true, pageSize: 1 });
      value = readUnreadTotal(res.data);
    } catch {
      value = null;
    }
    unreadCache = { value };
    unreadInFlight = null;
    return value;
  })();
  return unreadInFlight;
}

/** Shell notification entry point — the badge is the shell's only notification signal. */
export function ShellNotificationsButton({
  variant = 'header',
}: ShellNotificationsButtonProps) {
  const { locale } = useLocale();
  const [unread, setUnread] = useState<number | null>(null);

  const load = useCallback(async () => {
    setUnread(await fetchUnreadTotal());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasUnread = typeof unread === 'number' && unread > 0;
  const label = hasUnread
    ? t('shell.unread_notifications', locale).replace('{count}', String(unread))
    : t('nav.notificari', locale);

  const surfaceClass =
    variant === 'compact'
      ? 'text-chrome-text hover:bg-chrome-hover'
      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100';
  const dotRingClass = variant === 'compact' ? 'ring-chrome' : 'ring-white';

  return (
    <Link
      href="/notificari"
      aria-label={label}
      title={label}
      className={`relative p-2 rounded-full transition-colors ${surfaceClass}`}
    >
      <Bell className="w-5 h-5" aria-hidden="true" />
      {hasUnread && (
        <span
          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-soft0 ring-2 ${dotRingClass}`}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
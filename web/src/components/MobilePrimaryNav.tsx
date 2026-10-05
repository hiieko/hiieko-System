'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { NAV_GROUPS } from '../config/navigation';
import { useAuth } from '../contexts/AuthContext';

/**
 * v0 design port (Step 1 — Shell & Navigation).
 *
 * A fixed bottom primary navigation for compact viewports (< lg), mirroring the
 * v0 `MobilePrimaryNav` pattern: the first few canonical NAV_GROUPS items that
 * the signed-in role may see, rendered as icon+label tabs with an active state.
 *
 * NAVIGATION ITEMS AND VISIBILITY COME ONLY FROM THE PRODUCTION CONFIG SYSTEM
 * (`config/navigation.ts` + `ROUTE_ROLES`) — the href set below is a viewport
 * heuristic, never a permission. Role visibility is re-checked per item exactly
 * like the Sidebar, so this bar can never reveal an item the role cannot use.
 * All labels go through the shared RO/EN translation system.
 */
const PRIMARY_HREFS_BY_ROLE: Record<string, string[]> = {
  worker: ['/', '/tasks', '/pontaj', '/notificari', '/profil'],
  technician: ['/', '/planning', '/tasks', '/issues', '/pontaj'],
  team_leader: ['/', '/planning', '/tasks', '/issues', '/pontaj'],
  foreman: ['/', '/planning', '/tasks', '/issues', '/rapoarte'],
  site_manager: ['/', '/planning', '/tasks', '/issues', '/stocuri'],
  pm: ['/', '/projects', '/planning', '/issues', '/rapoarte'],
  manager: ['/', '/projects', '/issues', '/rapoarte', '/control-tower'],
  admin: ['/', '/utilizatori', '/projects', '/teams', '/control-tower'],
  procurement: ['/', '/avize', '/furnizori', '/depozite', '/stocuri'],
  finance: ['/', '/cheltuieli', '/aprobare', '/projects', '/rapoarte'],
  qa_qc: ['/', '/qa', '/issues', '/rapoarte', '/control-tower'],
  viewer: ['/', '/control-tower', '/projects', '/rapoarte', '/notificari'],
  site_logistics: ['/', '/avize', '/stocuri', '/projects', '/issues'],
  maintenance_director: ['/', '/control-tower', '/projects', '/issues', '/rapoarte'],
  technical_director: ['/', '/control-tower', '/projects', '/qa', '/rapoarte'],
};

export function MobilePrimaryNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { locale } = useLocale();
  const role = user?.role?.toLowerCase();

  const navItems = NAV_GROUPS.flatMap((group) => group.items);
  const primaryHrefs = PRIMARY_HREFS_BY_ROLE[role || ''] ?? ['/', '/notificari', '/profil'];
  const items = primaryHrefs.flatMap((href) => {
    const item = navItems.find((candidate) => candidate.href === href);
    if (!item) return [];
    // Same visibility rule as the Sidebar: an item without roles (or an empty
    // list) is visible to every authenticated role.
    if (item.roles?.length && (!role || !item.roles.includes(role))) return [];
    return [item];
  });

  if (items.length === 0) return null;

  return (
    <nav
      className="mobile-primary-nav fixed inset-x-0 bottom-0 z-sidebar border-t border-chrome-line bg-chrome-elevated/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.25)] backdrop-blur lg:hidden"
      aria-label={t('a11y.primary_navigation', locale)}
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          // `/` stays exact-match (Control Tower owns /control-tower in the sidebar).
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const title = t(item.i18nKey, locale) || item.label;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                onClick={() => undefined}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? 'text-accent' : 'text-chrome-muted hover:text-white'
                }`}
              >
                <span
                  className={`flex h-7 w-9 items-center justify-center rounded-lg ${
                    active ? 'bg-accent/15' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="max-w-full truncate">{title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default MobilePrimaryNav;

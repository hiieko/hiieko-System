'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import { getRoleLabel, t, useLocale } from '@solar/shared';
import { useAuth } from '../contexts/AuthContext';
import { NAV_GROUPS, type NavItem, type NavGroup } from '../config/navigation';
import { ShellBrand } from './shell';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

/**
 * The dark navigation rail (>= lg) and the navigation drawer (< lg).
 *
 * Both render the canonical `NAV_GROUPS` / `ROUTE_ROLES` contract unchanged —
 * this component only changes how the chrome looks (navy `#111827` chrome, the
 * HIIEKO accent as the single active/emphasis colour) and puts the real signed-in
 * user at the bottom of the rail instead of the previous hardcoded build string.
 *
 * The drawer also hosts the mobile user block (profile, language, sign-out):
 * below `lg` the header is the compact brand bar and cannot carry them.
 */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'worker';
  const { locale } = useLocale();

  const userName = user?.fullName || user?.email || t('header.visitator', locale);

  // `/` is only exact-matched: the canonical Control Tower route now owns its
  // own navigation entry (`/control-tower`), so `/` must not claim it as active.
  const isActive = useCallback(
    (href: string) =>
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  // Item roles come from the canonical `ROUTE_ROLES` map (config/navigation.ts).
  // No roles (or an empty list) means "every authenticated role".
  const canSee = useCallback(
    (item: NavItem | NavGroup): boolean => {
      const roles = item.roles;
      return !roles || roles.length === 0 || roles.includes(userRole);
    },
    [userRole],
  );

  const renderNavItem = useCallback(
    (item: NavItem) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onMobileClose}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            active
              ? 'bg-accent text-accent-ink font-semibold shadow-sm'
              : 'text-chrome-text font-medium hover:bg-chrome-hover hover:text-white'
          }`}
        >
          <Icon
            className={`w-5 h-5 shrink-0 ${active ? 'text-accent-ink' : 'text-chrome-muted'}`}
            aria-hidden="true"
          />
          <span>{t(item.i18nKey, locale) || item.label}</span>
        </Link>
      );
    },
    [isActive, onMobileClose, locale],
  );

  const renderNavGroup = useCallback(
    (group: NavGroup) => {
      if (!canSee(group)) return null;
      const visible = group.items.filter(canSee);
      if (visible.length === 0) return null;
      return (
        <div key={group.titleKey}>
          <div className="text-[11px] font-semibold text-chrome-muted uppercase tracking-wider px-3 mb-2">
            {t(group.titleKey, locale) || group.title}
          </div>
          <div className="space-y-1">{visible.map(renderNavItem)}</div>
        </div>
      );
    },
    [canSee, renderNavItem, locale],
  );

  /** Real signed-in identity (avatar initials, name, role) — no static build label. */
  const userBlock = (
    <Link
      href="/profil"
      onClick={onMobileClose}
      aria-label={t('nav.profil', locale)}
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-chrome-hover transition-colors"
    >
      <span className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-xs shrink-0">
        {userName.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-chrome-text truncate">{userName}</span>
        <span className="block text-[11px] text-chrome-muted truncate">
          {getRoleLabel(user?.role, locale)}
        </span>
      </span>
    </Link>
  );

  const navContent = <nav className="p-4 space-y-6">{NAV_GROUPS.map(renderNavGroup)}</nav>;

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:flex w-[var(--hii-sidebar-width)] hii-shell-chrome flex-col shrink-0 border-r border-chrome-line z-sidebar">
        <div className="px-5 py-5 border-b border-chrome-line">
          <ShellBrand size="rail" />
        </div>
        <div className="flex-1 overflow-y-auto hii-scrollbar-thin">{navContent}</div>
        <div className="p-3 border-t border-chrome-line">{userBlock}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen !== undefined && (
        <>
          {/* Backdrop */}
          {mobileOpen && (
            <div
              className="fixed inset-0 z-backdrop bg-slate-950/60 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />
          )}
          {/* Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-drawer w-72 hii-shell-chrome flex flex-col shadow-2xl transform transition-transform duration-250 ease-in-out lg:hidden ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            aria-label={t('sidebar.close', locale)}
          >
            <div className="px-4 py-4 border-b border-chrome-line flex items-center justify-between gap-2">
              <ShellBrand size="compact" onNavigate={onMobileClose} />
              <button
                type="button"
                onClick={onMobileClose}
                className="p-2 text-chrome-muted hover:text-white rounded-lg hover:bg-chrome-hover shrink-0"
                aria-label={t('sidebar.close', locale)}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto hii-scrollbar-thin">{navContent}</div>
            <div className="p-3 border-t border-chrome-line space-y-2">
              {userBlock}
              <div className="px-2">
                <LanguageSwitcher />
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-chrome-text hover:bg-chrome-hover transition-colors"
              >
                <LogOut className="w-4 h-4 text-chrome-muted" aria-hidden="true" />
                {t('header.logout', locale)}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
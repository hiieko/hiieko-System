'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NAV_GROUPS, type NavItem, type NavGroup } from '../config/navigation';
import { t, useLocale } from '@solar/shared';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'worker';
  const { locale } = useLocale();

  const isActive = useCallback(
    (href: string) =>
      href === '/'
        ? pathname === '/' || pathname === '/control-tower'
        : pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  const canSee = useCallback(
    (item: NavItem | NavGroup): boolean => {
      const roles = 'items' in item ? item.roles : item.roles;
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
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            active
              ? 'bg-hii-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Icon
            className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}
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
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            {t(group.titleKey, locale) || group.title}
          </div>
          <div className="space-y-1">{visible.map(renderNavItem)}</div>
        </div>
      );
    },
    [canSee, renderNavItem, locale],
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3" onClick={onMobileClose}>
          <div className="w-8 h-8 bg-hii-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-extrabold text-sm">H</span>
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">HIIEKO</h1>
            <p className="text-[10px] text-hii-400 font-medium tracking-wider uppercase">Romania SRL</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto hii-scrollbar-thin">
        {NAV_GROUPS.map(renderNavGroup)}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-hii-400" aria-hidden="true" />
          <span>HIIEKO v1.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[var(--hii-sidebar-width)] bg-[var(--hii-sidebar-bg)] text-white flex-col shrink-0 border-r border-slate-800 z-sidebar">
        {sidebarContent}
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
            className={`fixed inset-y-0 left-0 z-drawer w-72 bg-[var(--hii-sidebar-bg)] text-white flex flex-col shadow-2xl transform transition-transform duration-250 ease-in-out lg:hidden ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            aria-label={t('sidebar.close', locale) || 'Navigare'}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3" onClick={onMobileClose}>
                <div className="w-8 h-8 bg-hii-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-extrabold text-sm">H</span>
                </div>
                <div>
                  <h1 className="font-bold text-base tracking-tight text-white leading-tight">HIIEKO</h1>
                  <p className="text-[10px] text-hii-400 font-medium tracking-wider uppercase">Romania SRL</p>
                </div>
              </Link>
              <button
                onClick={onMobileClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                aria-label={t('sidebar.close', locale) || 'Închide meniul'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto hii-scrollbar-thin">
              <nav className="p-4 space-y-6">{NAV_GROUPS.map(renderNavGroup)}</nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, LogOut, MapPin, Menu, User, ChevronDown } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui/Button';
import { DropdownMenu, type DropdownMenuItem } from './ui/DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { t, useLocale } from '@solar/shared';
import { NAV_GROUPS } from '../config/navigation';
import { GlobalQuickSearch } from './GlobalQuickSearch';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, loading, signOut } = useAuth();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    loading: projectsLoading,
  } = useProject();
  const { locale } = useLocale();
  const pathname = usePathname();
  const activeNavItem = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => item.href !== '/')
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const activeTitle = activeNavItem ? t(activeNavItem.i18nKey, locale) || activeNavItem.label : '';

  const currentUser = loading
    ? t('general.loading', locale)
    : user?.fullName || user?.email || 'Vizitator';

  const userMenuItems: DropdownMenuItem[] = [
    {
      key: 'profile',
      label: t('header.profile', locale) || 'Profilul meu',
      onClick: () => window.location.assign('/profil'),
      icon: <User className="w-4 h-4" />,
    },
    {
      key: 'logout',
      label: t('header.logout', locale) || 'Deconectare',
      onClick: () => void signOut(),
      icon: <LogOut className="w-4 h-4" />,
      variant: 'danger',
    },
  ];

  return (
    <header className="h-[var(--hii-header-height)] shrink-0 bg-white border-b border-slate-200 px-2.5 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-header shadow-sm">
      {/* Left section: on phones the project selector gets the remaining width,
          so it can never slide underneath the language/notification controls. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden shrink-0"
          aria-label={t('header.menu', locale) || 'Deschide meniul'}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <nav
          className="hidden min-w-0 items-center gap-2 text-sm sm:flex"
          aria-label={locale === 'en' ? 'Breadcrumb' : 'Navigare'}
        >
          {pathname !== '/' && <span className="text-slate-300" aria-hidden="true">/</span>}
          <span className="max-w-36 truncate font-semibold text-slate-700">
            {pathname === '/' ? (locale === 'en' ? 'Operations' : 'Operațiuni') : activeTitle}
          </span>
        </nav>

        <div className="min-w-0 max-w-[calc(100vw-14rem)] sm:max-w-none flex-1 sm:flex-none flex items-center gap-1.5 sm:gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <MapPin className="w-4 h-4 text-hii-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex flex-col">
            <span className="hidden sm:block text-[10px] text-slate-400 font-medium leading-tight">
              {selectedProject
                ? t('header.current_project', locale) || 'Proiect curent'
                : t('header.all_projects', locale) || 'Toate proiectele'}
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)
              }
              className="block w-full max-w-full bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs sm:-mt-0.5 p-0 truncate"
              disabled={projectsLoading}
              aria-label={t('header.select_project', locale) || 'Selectează proiect'}
            >
              <option value="all">{t('header.all_sites', locale)}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right section: search is intentionally removed from the phone header;
          the selector, language, bell and avatar retain usable touch targets. */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2.5">
        <div className="hidden sm:block">
          <GlobalQuickSearch />
        </div>
        <LanguageSwitcher />

        <Link
          href="/notificari"
          aria-label={t('nav.notificari', locale) || 'Notificări'}
          className="flex h-10 w-10 items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative shrink-0"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="hidden sm:block h-6 w-px bg-slate-200" aria-hidden="true" />

        <DropdownMenu
          trigger={
            <div className="flex h-10 w-10 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-2 cursor-pointer hover:bg-slate-50 rounded-lg sm:px-2 sm:py-1.5 transition-colors shrink-0">
              <div className="w-8 h-8 rounded-full bg-hii-600 text-white flex items-center justify-center font-bold text-xs">
                {loading ? '..' : currentUser.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {currentUser}
                </div>
                <div className="text-[11px] text-hii-600 font-medium capitalize">
                  {loading ? '' : (user?.role || '').toLowerCase()}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" aria-hidden="true" />
            </div>
          }
          items={userMenuItems}
          align="right"
          aria-label={t('header.user_menu', locale) || 'Meniul utilizator'}
        />
      </div>
    </header>
  );
}

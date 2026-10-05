'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, LogOut, MapPin, Menu, User, Settings, ChevronDown } from 'lucide-react';
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

  const currentProjectLabel = selectedProject
    ? `${selectedProject.name} (${selectedProject.code})`
    : t('header.all_sites', locale);

  const userMenuItems: DropdownMenuItem[] = [
    {
      key: 'profile',
      label: t('header.profile', locale) || 'Profilul meu',
      onClick: () => window.location.assign('/profil'),
      icon: <User className="w-4 h-4" />,
    },
    {
      key: 'settings',
      label: t('header.settings', locale) || 'Setări',
      onClick: () => {},
      icon: <Settings className="w-4 h-4" />,
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
    <header className="h-[var(--hii-header-height)] bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-header shadow-sm">
      {/* Left section */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
          aria-label={t('header.menu', locale) || 'Deschide meniul'}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <nav className="hidden min-w-0 items-center gap-2 text-sm sm:flex" aria-label={locale === 'en' ? 'Breadcrumb' : 'Navigare'}>
          {pathname !== '/' && <span className="text-slate-300" aria-hidden="true">/</span>}
          <span className="max-w-36 truncate font-semibold text-slate-700">{pathname === '/' ? (locale === 'en' ? 'Operations' : 'Operațiuni') : activeTitle}</span>
        </nav>

        {/* Project selector */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <MapPin className="w-4 h-4 text-hii-500 shrink-0" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-medium leading-tight">
              {selectedProject
                ? t('header.current_project', locale) || 'Proiect curent'
                : t('header.all_projects', locale) || 'Toate proiectele'}
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)
              }
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs -mt-0.5 p-0"
              disabled={projectsLoading}
              aria-label={t('header.select_project', locale) || 'Selectează proiect'}
            >
              <option value="all">
                {t('header.all_sites', locale)}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <GlobalQuickSearch />
        <LanguageSwitcher />

        <Link
          href="/notificari"
          aria-label={t('nav.notificari', locale) || 'Notificări'}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

        {/* User dropdown menu */}
        <DropdownMenu
          trigger={
            <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
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



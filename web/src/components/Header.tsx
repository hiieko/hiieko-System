'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, CircleHelp, LogOut, MapPin, Menu, User, Settings, ChevronDown } from 'lucide-react';
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
  const [helpOpen, setHelpOpen] = useState(false);
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
          className="min-h-11 min-w-11 lg:hidden"
          aria-label={t('header.menu', locale) || 'Deschide meniul'}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <nav className="hidden min-w-0 items-center gap-2 text-sm sm:flex" aria-label={locale === 'en' ? 'Breadcrumb' : 'Navigare'}>
          {pathname !== '/' && <span className="text-slate-300" aria-hidden="true">/</span>}
          <span className="max-w-36 truncate font-semibold text-slate-700">{pathname === '/' ? (locale === 'en' ? 'Operations' : 'Operațiuni') : activeTitle}</span>
        </nav>

        {/* Project selector */}
        <div className="flex min-w-0 max-w-[min(52vw,20rem)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm sm:px-3">
          <MapPin className="w-4 h-4 text-hii-500 shrink-0" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[10px] font-medium leading-tight text-slate-400">
              {selectedProject
                ? t('header.current_project', locale) || 'Proiect curent'
                : t('header.all_projects', locale) || 'Toate proiectele'}
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)
              }
              className="max-w-full bg-transparent p-0 text-xs font-semibold -mt-0.5 text-slate-800 focus:outline-none cursor-pointer"
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
      <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
        <GlobalQuickSearch />

        <div className="relative">
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            aria-haspopup="menu"
            className="hidden sm:inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <CircleHelp className="h-4 w-4" />
            Ajutor
          </button>
          {helpOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="px-3 py-2">
                <div className="text-xs font-bold text-slate-900">Ajutor și suport</div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500">Navigare rapidă și raportarea problemelor din contextul curent.</div>
              </div>
              <Link href="/notificari" onClick={() => setHelpOpen(false)} className="flex items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Vezi notificările</Link>
              <Link href="/issues" onClick={() => setHelpOpen(false)} className="flex items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Raportează o problemă</Link>
            </div>
          )}
        </div>

        <div className="hidden sm:block"><LanguageSwitcher /></div>

        <Link
          href="/notificari"
          aria-label={t('nav.notificari', locale) || 'Notificări'}
          className="relative hidden rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:inline-flex"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />

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



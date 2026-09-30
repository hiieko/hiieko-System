'use client';

import React from 'react';
import { LogOut, Menu, User, Settings, ChevronDown } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DropdownMenu, type DropdownMenuItem } from './ui/DropdownMenu';
import { ProjectContextChip, ShellBrand, ShellNotificationsButton } from './shell';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, t, useLocale } from '@solar/shared';

interface HeaderProps {
  onMenuClick?: () => void;
}

/**
 * Shell header, split by breakpoint exactly like the approved frames:
 *
 *  >= lg — a white 72px bar on top of the dark rail. The brand lives in the
 *          rail, so the bar carries the project context, notifications and the
 *          user menu.
 *  <  lg — a navy (`--hii-chrome`) 56px bar with the brand, the notifications
 *          entry point and the drawer trigger, followed by the `#374151`
 *          project band. The user menu and the language switcher move into the
 *          navigation drawer (see `Sidebar`), which is where the mobile user
 *          block lives.
 */
export function Header({ onMenuClick }: HeaderProps) {
  const { user, loading, signOut } = useAuth();
  const { locale } = useLocale();

  const currentUser = loading
    ? t('general.loading', locale)
    : user?.fullName || user?.email || t('header.visitator', locale);
  const currentRole = loading ? '' : getRoleLabel(user?.role, locale);

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
    <header className="sticky top-0 z-header">
      {/* < lg — dark compact chrome: brand bar + project band */}
      <div className="lg:hidden hii-shell-chrome border-b border-chrome-line">
        <div className="h-14 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onMenuClick}
              aria-label={t('header.menu', locale)}
              className="p-2 rounded-lg text-chrome-text hover:bg-chrome-hover shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <ShellBrand size="compact" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ShellNotificationsButton variant="compact" />
          </div>
        </div>
        <ProjectContextChip variant="band" />
      </div>

      {/* >= lg — white header on top of the rail (the brand lives in the rail) */}
      <div className="hidden lg:flex h-[var(--hii-header-height)] bg-white border-b border-slate-200 px-6 items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <ProjectContextChip variant="header" />
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ShellNotificationsButton variant="header" />
          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

          {/* User dropdown menu */}
          <DropdownMenu
            trigger={
              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
                <div className="w-8 h-8 rounded-full bg-chrome text-chrome-text flex items-center justify-center font-bold text-xs">
                  {loading ? '..' : currentUser.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {currentUser}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {currentRole}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" aria-hidden="true" />
              </div>
            }
            items={userMenuItems}
            align="right"
            aria-label={t('header.user_menu', locale)}
          />
        </div>
      </div>
    </header>
  );
}



"use client";

import React from 'react';
import Link from 'next/link';
import { Bell, LogOut, MapPin, Menu, ChevronDown } from 'lucide-react';

import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { t, useLocale } from '@solar/shared';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, loading, signOut } = useAuth();
  const { projects, selectedProjectId, setSelectedProjectId, selectedProject, loading: projectsLoading } = useProject();
  const localeContext = useLocale();
  const locale = localeContext.locale;
  const currentUser = loading ? 'Se încarcă...' : user?.fullName || user?.email || t('header.visitator', locale);
  const currentProjectLabel = selectedProject
    ? `${selectedProject.name} (${selectedProject.code})`
    : t('header.all_sites', locale);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          aria-label="Deschide meniul"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project selector */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <MapPin className="w-4 h-4 text-hii-500 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-medium leading-tight">
              {selectedProject ? 'Proiect curent' : 'Toate proiectele'}
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs -mt-0.5 p-0"
              disabled={projectsLoading}
            >
              <option value="all">{t('header.all_sites', locale)}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <Link
          href="/notificari"
          aria-label="Notificari"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="h-6 w-px bg-slate-200"></div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-hii-500 text-white flex items-center justify-center font-bold text-xs">
            {loading ? '..' : currentUser.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold text-slate-800 leading-tight">{currentUser}</div>
            <div className="text-[11px] text-hii-600 font-medium capitalize">{loading ? '' : (user?.role || '').toLowerCase()}</div>
          </div>
        </div>
        {user && (
          <button type="button" onClick={() => void signOut()} aria-label="Deconectare"
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}


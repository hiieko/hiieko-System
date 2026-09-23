"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '../lib/api-client';
import { Bell, LogIn, LogOut, MapPin } from 'lucide-react';

import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { t, useLocale, Site } from '@solar/shared';

export function Header({
  selectedSiteId,
  onSelectSite
}: {
  selectedSiteId?: string;
  onSelectSite?: (siteId: string) => void;
}) {
  const { user, loading, signOut } = useAuth();
  const localeContext = useLocale();
  const locale = localeContext.locale;
  const currentUser = loading ? 'Se încarcă...' : user?.fullName || user?.email || t('header.visitator', locale);

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    // Fetch real projects/sites from API
    const fetchSites = async () => {
      try {
        const response = await apiClient.getProjects();
        // Map backend projects to Site interface (partial for dropdown display)
        const mappedSites = (response.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          address: p.address || '',
          latitude: p.latitude || 0,
          longitude: p.longitude || 0,
        } as Partial<Site> as Site));
        setSites(mappedSites);
      } catch (error) {
        console.error('Failed to fetch sites:', error);
        // Fallback to empty array (will show "No sites" message)
        setSites([]);
      } finally {
        setSitesLoading(false);
      }
    };
    fetchSites();
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <MapPin className="w-4 h-4 text-amber-600" />
          <span className="text-slate-500 font-medium">{t('header.active_site', locale)}</span>
          <select
            value={selectedSiteId || 'all'}
            onChange={(e) => onSelectSite && onSelectSite(e.target.value)}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="all">{t('header.all_sites', locale)}</option>
            {sites.map((s: { id: string; name: string; code: string }) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <LanguageSwitcher />
        <Link
          type="button"
          href="/notificari"
          aria-label="Notificări"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="h-8 w-[1px] bg-slate-200"></div>

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm">
            {loading ? '...' : currentUser.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-800">{currentUser}</div>
            <div className="text-xs text-amber-600 font-medium uppercase tracking-wider">{loading ? ' ' : user?.role || t('header.visitator', locale)}</div>
          </div>
        </div>
        {user ? (
          <button type="button" onClick={() => void signOut()} aria-label="Deconectare"
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <Link href="/login" aria-label="Autentificare"
            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
            <LogIn className="w-5 h-5" />
          </Link>
        )}
      </div>
    </header>
  );
}
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Command, Search } from 'lucide-react';
import { NAV_GROUPS } from '../config/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useLocale, t } from '@solar/shared';
import { Modal } from './ui/Modal';

export function GlobalQuickSearch() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const destinations = useMemo(() => {
    const role = user?.role?.toLowerCase();
    return NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => !item.roles?.length || (!!role && item.roles.includes(role)))
      .map((item) => ({ ...item, title: t(item.i18nKey, locale) || item.label }));
  }, [locale, user?.role]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return destinations
      .filter((item) => !normalizedQuery || item.title.toLocaleLowerCase(locale).includes(normalizedQuery))
      .slice(0, 7);
  }, [destinations, locale, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={locale === 'en' ? 'Search pages' : 'Caută pagini'}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800 focus-visible:outline-offset-2"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline">{locale === 'en' ? 'Quick search' : 'Căutare rapidă'}</span>
        <span className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-flex">
          <Command className="mr-0.5 h-3 w-3" aria-hidden="true" /> K
        </span>
      </button>

      <Modal
        open={open}
        onClose={close}
        title={locale === 'en' ? 'Search the workspace' : 'Caută în aplicație'}
        size="lg"
        className="overflow-hidden"
      >
        <div className="-mx-6 -my-4">
          <label className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">{locale === 'en' ? 'Search pages' : 'Caută pagini'}</span>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={locale === 'en' ? 'Search projects, planning, reports…' : 'Caută proiecte, planificare, rapoarte…'}
              className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
            />
            <span className="shrink-0 text-[11px] text-slate-400">ESC</span>
          </label>
          <div className="max-h-[min(55vh,420px)] overflow-y-auto p-2" role="listbox" aria-label={locale === 'en' ? 'Pages' : 'Pagini'}>
            {results.length ? results.map((item) => {
              const Icon = item.icon;
              const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  role="option"
                  aria-selected={active}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{item.title}</span>
                  {active ? <span className="text-xs text-hii-700">{locale === 'en' ? 'Current' : 'Curent'}</span> : <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden="true" />}
                </Link>
              );
            }) : (
              <p className="px-3 py-8 text-center text-sm text-slate-500" role="status">
                {locale === 'en' ? 'No matching pages.' : 'Nu există pagini potrivite.'}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            <span>{locale === 'en' ? 'Navigation only — access follows your role.' : 'Navigare în pagini — accesul respectă rolul tău.'}</span>
            <span>{results.length} / {destinations.length}</span>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default GlobalQuickSearch;

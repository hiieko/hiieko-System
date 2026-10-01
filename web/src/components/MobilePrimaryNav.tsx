'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '../config/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useLocale, t } from '@solar/shared';

const PRIMARY_HREFS = ['/', '/planning', '/tasks', '/issues', '/pontaj'];

export function MobilePrimaryNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { locale } = useLocale();
  const role = user?.role?.toLowerCase();
  const items = PRIMARY_HREFS.map((href) => NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === href))
    .filter((item) => item && (!item.roles?.length || (!!role && item.roles.includes(role))));

  if (!items.length) return null;

  return (
    <nav className="mobile-primary-nav fixed inset-x-0 bottom-0 z-sidebar border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden" aria-label={locale === 'en' ? 'Primary navigation' : 'Navigare principală'}>
      <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-1">
        {items.map((item) => {
          if (!item) return null;
          const Icon = item.icon;
          const active = item.href === '/' ? pathname === '/' || pathname === '/control-tower' : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const title = t(item.i18nKey, locale) || item.label;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors ${active ? 'text-hii-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <span className={`flex h-7 w-9 items-center justify-center rounded-lg ${active ? 'bg-emerald-50' : ''}`}>
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

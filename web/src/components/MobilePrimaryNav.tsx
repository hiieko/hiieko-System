'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale, t } from '@solar/shared';
import {
  MOBILE_NAV_BY_ROLE,
  MOBILE_NAV_DEFAULT,
  MOBILE_MORE_TAB,
  canRoleAccess,
  getMobileDestination,
  type NavItem,
} from '../config/navigation';
import { MoreSheet } from './MoreSheet';

type MobileTab = { kind: 'more' } | { kind: 'link'; href: string; item: NavItem };

/**
 * Role-aware mobile bottom nav (D6). The 4–5 primary destinations come from
 * `MOBILE_NAV_BY_ROLE`; every href is additionally gated by `canRoleAccess`
 * (route-roles.ts) so a role never gets a tab it cannot open. The final
 * "More" tab opens `MoreSheet`.
 */
export function MobilePrimaryNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { locale } = useLocale();
  const role = user?.role?.toLowerCase();
  const [moreOpen, setMoreOpen] = useState(false);

  const hrefs = (role && MOBILE_NAV_BY_ROLE[role]) || MOBILE_NAV_DEFAULT;

  const tabs = hrefs.flatMap<MobileTab>((href) => {
    if (href === MOBILE_MORE_TAB) return [{ kind: 'more' }];
    const item = getMobileDestination(href);
    if (!item || !canRoleAccess(href, role)) return [];
    return [{ kind: 'link', href, item }];
  });

  if (!tabs.length) return null;

  return (
    <>
      <nav className="mobile-primary-nav fixed inset-x-0 bottom-0 z-sidebar border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden" aria-label={locale === 'en' ? 'Primary navigation' : 'Navigare principală'}>
        <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-1">
          {tabs.map((tab) => {
            if (tab.kind === 'more') {
              const label = locale === 'en' ? 'More' : 'Mai multe';
              return (
                <li key={MOBILE_MORE_TAB} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors ${moreOpen ? 'text-hii-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <span className={`flex h-7 w-9 items-center justify-center rounded-lg ${moreOpen ? 'bg-success-soft' : ''}`}>
                      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="max-w-full truncate">{label}</span>
                  </button>
                </li>
              );
            }

            const { href, item } = tab;
            const Icon = item.icon;
            const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
            const title = t(item.i18nKey, locale) || item.label;
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors ${active ? 'text-hii-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                >
                  <span className={`flex h-7 w-9 items-center justify-center rounded-lg ${active ? 'bg-success-soft' : ''}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate">{title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

export default MobilePrimaryNav;

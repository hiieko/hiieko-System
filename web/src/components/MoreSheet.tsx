'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useLocale, t } from '@solar/shared';
import { useAuth } from '../contexts/AuthContext';
import { Drawer } from './ui/Drawer';
import {
  MORE_SHEET_GROUPS,
  canRoleAccess,
  getMobileDestination,
  type NavItem,
} from '../config/navigation';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "More" mobile sheet (D6). Reuses the shared bottom `Drawer` — no parallel
 * bottom-sheet system. Destinations are grouped by category and filtered per
 * role via `canRoleAccess`, so no 403 destination is ever shown.
 */
export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const { user } = useAuth();
  const { locale } = useLocale();
  const pathname = usePathname();
  const role = user?.role?.toLowerCase();

  const groups = MORE_SHEET_GROUPS.map((group) => ({
    ...group,
    items: group.hrefs
      .map((href) => getMobileDestination(href))
      .filter((item): item is NavItem => Boolean(item))
      .filter((item) => canRoleAccess(item.href, role)),
  })).filter((group) => group.items.length > 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="bottom"
      size="lg"
      swipeToClose
      title={locale === 'en' ? 'More' : 'Mai multe'}
    >
      <div className="space-y-5 pb-2">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {group.title[locale]}
            </h3>
            <ul className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const label = t(item.i18nKey, locale) || item.label;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors ${
                        active ? 'bg-emerald-50 text-hii-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="flex-1 truncate">{label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Drawer>
  );
}

export default MoreSheet;

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, X, LogOut, Languages } from 'lucide-react';
import { clsx } from 'clsx';
import { getRoleLabel, t, useLocale, type Locale } from '@solar/shared';
import { useAuth } from '../contexts/AuthContext';
import { NAV_GROUPS, canRoleAccess, type NavItem, type NavGroup } from '../config/navigation';
import { ShellBrand } from './shell';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hii-sidebar-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hii-sidebar-bg)]';

/**
 * Expandable group heading. Renders a compact group label and a chevron
 * that toggles the group's nested rows. This is the real header used by
 * `renderNavContent` (not a detached helper).
 */
const NavGroupHeader = ({
  groupKey,
  label,
  expanded,
  onToggle,
}: {
  groupKey: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={expanded}
    aria-controls={`nav-group-${groupKey}`}
    className={clsx(
      'group flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5',
      'text-[11px] font-semibold tracking-wide text-[var(--hii-sidebar-text-muted)]',
      'transition-colors duration-150 hover:text-[var(--hii-sidebar-text)]',
      FOCUS_RING,
    )}
  >
    <span className="truncate">{label}</span>
    <ChevronDown
      className={clsx(
        'h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out',
        expanded ? 'rotate-180' : '',
      )}
      aria-hidden="true"
    />
  </button>
);

interface NavItemRowProps {
  item: NavItem;
  isActive: (href: string) => boolean;
  getLabel: (item: NavItem) => string;
  onNavigate?: () => void;
  compact: boolean;
  unreadCount: number | null;
  depth?: number;
}

/**
 * A single navigation row. Handles leaf links, optional nested children (with
 * a vertical guide), active styling, collapsed icon-only rendering and the
 * notification badge.
 */
const NavItemRow = ({
  item,
  isActive,
  getLabel,
  onNavigate,
  compact,
  unreadCount,
  depth = 0,
}: NavItemRowProps) => {
  const Icon = item.icon;
  const label = getLabel(item);
  const active = isActive(item.href);
  const hasChildren = Boolean(item.children?.length);
  const descendantActive = Boolean(item.children?.some((child) => isActive(child.href)));
  const notificationCount =
    item.href === '/notificari' || item.i18nKey === 'nav.notificari' ? unreadCount : null;

  const [childrenOpen, setChildrenOpen] = useState(descendantActive);

  useEffect(() => {
    if (descendantActive) setChildrenOpen(true);
  }, [descendantActive]);

  if (compact) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        title={label}
        className={clsx(
          'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150',
          active
            ? 'bg-[var(--hii-sidebar-active-bg)] text-[var(--hii-sidebar-active)]'
            : 'text-[var(--hii-sidebar-text-muted)] hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
          FOCUS_RING,
        )}
      >
        <Icon
          className={clsx('h-[18px] w-[18px] shrink-0', active ? 'text-[var(--hii-sidebar-active)]' : 'text-[var(--hii-sidebar-text-muted)]')}
          aria-hidden="true"
        />
        {notificationCount !== null && notificationCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--hii-brand)] px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </Link>
    );
  }

  const rowTextClass = depth > 0 ? 'text-[12px]' : 'text-[13px]';

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setChildrenOpen((current) => !current)}
          aria-expanded={childrenOpen}
          className={clsx(
            'flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors duration-150',
            rowTextClass,
            active || descendantActive
              ? 'text-[var(--hii-sidebar-active)] hover:bg-[var(--hii-sidebar-hover)]'
              : 'text-[var(--hii-sidebar-text)] hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
            FOCUS_RING,
          )}
        >
          <Icon
            className={clsx(
              'h-[17px] w-[17px] shrink-0',
              active || descendantActive ? 'text-[var(--hii-sidebar-active)]' : 'text-[var(--hii-sidebar-text-muted)]',
            )}
            aria-hidden="true"
          />
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown
            className={clsx(
              'h-3.5 w-3.5 shrink-0 text-[var(--hii-sidebar-text-muted)] transition-transform duration-200 ease-out',
              childrenOpen ? 'rotate-180' : '',
            )}
            aria-hidden="true"
          />
        </button>
        {childrenOpen && (
          <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-[var(--hii-sidebar-divider)] pl-3">
            {item.children!.map((child) => (
              <NavItemRow
                key={child.href}
                item={child}
                isActive={isActive}
                getLabel={getLabel}
                onNavigate={onNavigate}
                compact={false}
                unreadCount={unreadCount}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors duration-150',
        rowTextClass,
        active
          ? 'bg-[var(--hii-sidebar-active-bg)] text-[var(--hii-sidebar-active-text)]'
          : 'text-[var(--hii-sidebar-text)] hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
        FOCUS_RING,
      )}
    >
      <Icon
        className={clsx('h-[17px] w-[17px] shrink-0', active ? 'text-[var(--hii-sidebar-active)]' : 'text-[var(--hii-sidebar-text-muted)]')}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
      {notificationCount !== null && notificationCount > 0 && (
        <span
          className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--hii-brand)] px-1.5 text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {notificationCount > 99 ? '99+' : notificationCount}
        </span>
      )}
    </Link>
  );
};

const LOCALE_OPTIONS: Array<{ value: Locale; label: string; short: string }> = [
  { value: 'ro', label: 'Română', short: 'RO' },
  { value: 'en', label: 'English', short: 'EN' },
];

/**
 * Sidebar language selector. Drives the same `LocaleContext` as the header
 * switcher via `useLocale` / `setLocale` — no second i18n implementation.
 */
const SidebarLanguageMenu = () => {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const label = t('language', locale);
  const current = LOCALE_OPTIONS.find((option) => option.value === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.short}`}
        title={`${label}: ${current.short}`}
        data-testid="sidebar-language-trigger"
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--hii-sidebar-text)] transition-colors hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
          FOCUS_RING,
        )}
      >
        <Languages className="h-[17px] w-[17px] shrink-0 text-[var(--hii-sidebar-text-muted)]" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{current.label}</span>
        <span className="text-[10px] font-semibold tracking-wider text-[var(--hii-sidebar-text-muted)]">
          {current.short}
        </span>
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 shrink-0 text-[var(--hii-sidebar-text-muted)] transition-transform duration-200 ease-out',
            open ? 'rotate-180' : '',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-lg border border-[var(--hii-sidebar-divider)] bg-[var(--hii-sidebar-surface)] p-1 shadow-xl"
        >
          {LOCALE_OPTIONS.map((option) => {
            const active = option.value === locale;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(option.value);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[12px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--hii-sidebar-active-bg)] text-[var(--hii-sidebar-active)]'
                    : 'text-[var(--hii-sidebar-text)] hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
                )}
              >
                <span>{option.label}</span>
                <span className="text-[10px] font-semibold tracking-wider text-[var(--hii-sidebar-text-muted)]">
                  {option.short}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Collapsed-rail language control: centered icon, tooltip, cycles RO/EN. */
const CompactLanguageButton = () => {
  const { locale, setLocale } = useLocale();
  const next = locale === 'ro' ? 'en' : 'ro';
  const label = `${t('language', locale)}: ${locale.toUpperCase()}`;

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`${label} → ${next.toUpperCase()}`}
      title={`${label} → ${next.toUpperCase()}`}
      data-testid="sidebar-language-compact"
      className={clsx(
        'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[var(--hii-sidebar-text-muted)] transition-colors hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
        FOCUS_RING,
      )}
    >
      <Languages className="h-[18px] w-[18px]" aria-hidden="true" />
      <span
        className="absolute right-0.5 top-0.5 text-[8px] font-bold uppercase leading-none text-[var(--hii-sidebar-active)]"
        aria-hidden="true"
      >
        {locale.toUpperCase()}
      </span>
    </button>
  );
};

export function Sidebar({
  mobileOpen,
  onMobileClose,
  collapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { locale } = useLocale();

  const railCollapsed = collapsed;
  const userName = user?.fullName || user?.email || t('header.visitator', locale);
  const userRole = getRoleLabel(user?.role, locale);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerOpen = mobileOpen === true;
  const [unreadCount] = useState<number | null>(null);

  useFocusTrap(drawerRef, drawerOpen);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMobileClose?.();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [drawerOpen, onMobileClose]);

  // `/` is only exact-matched: the canonical Control Tower route now owns its
  // own navigation entry (`/control-tower`), so `/` must not claim it as active.
  const isActive = useCallback(
    (href: string) =>
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  // Access is delegated to the canonical `ROUTE_ROLES` contract via
  // `canRoleAccess` (config/navigation.ts) — the same check the mobile nav uses.
  // A group is rendered only when at least one of its items is visible.
  const canSee = useCallback((href: string): boolean => canRoleAccess(href, user?.role), [user?.role]);

  const getLabel = useCallback(
    (item: NavItem) => t(item.i18nKey, locale) || item.label,
    [locale],
  );

  const visibleGroups = NAV_GROUPS.map((group) => ({
    group,
    items: group.items.filter(
      (item) => canSee(item.href) || item.children?.some((child) => canSee(child.href)),
    ),
  })).filter(({ items }) => items.length > 0);

  // Per-group expansion, seeded from the navigation contract.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.titleKey, group.defaultExpanded ?? false])),
  );

  const toggleGroup = useCallback((group: NavGroup) => {
    setExpandedGroups((current) => ({
      ...current,
      [group.titleKey]: !(current[group.titleKey] ?? group.defaultExpanded ?? false),
    }));
  }, []);

  // Active-route auto-expansion: whenever the route changes, open any group
  // that contains the active destination without collapsing the others.
  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };
      let changed = false;
      NAV_GROUPS.forEach((group) => {
        const hasActive = group.items.some(
          (item) => isActive(item.href) || item.children?.some((child) => isActive(child.href)),
        );
        if (hasActive && !next[group.titleKey]) {
          next[group.titleKey] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [pathname, isActive]);

  const renderNavContent = (compact: boolean) => (
    <nav
      aria-label={t('sidebar.navigation', locale)}
      className={compact ? 'relative flex flex-col gap-1 p-2' : 'relative space-y-2 p-3'}
    >
      {visibleGroups.map(({ group, items }, index) => {
        if (compact) {
          return (
            <div
              key={group.titleKey}
              className={clsx(
                'flex flex-col gap-1',
                index > 0 && 'border-t border-[var(--hii-sidebar-divider)] pt-1.5',
              )}
            >
              {items.map((item) => (
                <NavItemRow
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  getLabel={getLabel}
                  onNavigate={onMobileClose}
                  compact
                  unreadCount={unreadCount}
                />
              ))}
            </div>
          );
        }

        const expanded = expandedGroups[group.titleKey] ?? group.defaultExpanded ?? false;
        const expandable = group.expandable !== false;

        return (
          <div key={group.titleKey}>
            {expandable ? (
              <NavGroupHeader
                groupKey={group.titleKey}
                label={t(group.titleKey, locale) || group.title}
                expanded={expanded}
                onToggle={() => toggleGroup(group)}
              />
            ) : (
              <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--hii-sidebar-text-muted)]">
                {t(group.titleKey, locale) || group.title}
              </div>
            )}
            {(expanded || !expandable) && (
              <div id={`nav-group-${group.titleKey}`} className="mt-1 space-y-0.5">
                {items.map((item) => (
                  <NavItemRow
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    getLabel={getLabel}
                    onNavigate={onMobileClose}
                    compact={false}
                    unreadCount={unreadCount}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  /** Real signed-in identity (avatar initials, name, role) — no static build label. */
  const renderUserBlock = (compact: boolean) => (
    <Link
      href="/profil"
      onClick={onMobileClose}
      aria-label={compact ? `${userName} · ${userRole}` : t('nav.profil', locale)}
      title={compact ? `${userName} · ${userRole}` : undefined}
      className={
        compact
          ? clsx(
              'mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hii-sidebar-hover)]',
              FOCUS_RING,
            )
          : clsx(
              'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--hii-sidebar-hover)]',
              FOCUS_RING,
            )
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hii-brand)] text-xs font-bold text-white">
        {userName.slice(0, 2).toUpperCase()}
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[var(--hii-sidebar-text)]">{userName}</span>
          <span className="block truncate text-[11px] text-[var(--hii-sidebar-text-muted)]">{userRole}</span>
        </span>
      )}
    </Link>
  );

  /** Shared logout row — the same `signOut` from AuthContext as the header. */
  const renderLogout = (compact: boolean) => {
    const label = t('header.logout', locale);
    return (
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        data-testid="sidebar-logout"
        className={
          compact
            ? clsx(
                'mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[var(--hii-sidebar-text-muted)] transition-colors hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
                FOCUS_RING,
              )
            : clsx(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--hii-sidebar-text)] transition-colors hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
                FOCUS_RING,
              )
        }
      >
        <LogOut
          className={compact ? 'h-[18px] w-[18px]' : 'h-4 w-4 text-[var(--hii-sidebar-text-muted)]'}
          aria-hidden="true"
        />
        {!compact && <span>{label}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <aside
        id="app-sidebar"
        className="hidden h-full w-[var(--hii-sidebar-width)] shrink-0 flex-col border-r border-[var(--hii-sidebar-divider)] bg-[var(--hii-sidebar-bg)] text-[var(--hii-sidebar-text)] transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[var(--hii-sidebar-focus)] [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[var(--hii-sidebar-bg)]"
      >
        <div className="flex-1 overflow-y-auto hii-scrollbar-thin">{renderNavContent(railCollapsed)}</div>
        <div className={`border-t border-[var(--hii-sidebar-divider)] ${railCollapsed ? 'p-2' : 'p-3'}`}>
          <div
            className={clsx(
              'space-y-0.5 border-t border-[var(--hii-sidebar-divider)]',
              railCollapsed ? 'mt-1 pt-1.5' : 'mt-2 pt-2',
            )}
          >
            {railCollapsed ? <CompactLanguageButton /> : <SidebarLanguageMenu />}
            {renderLogout(railCollapsed)}
          </div>
          <div
            className={clsx(
              'border-t border-[var(--hii-sidebar-divider)]',
              railCollapsed ? 'mt-1 pt-1.5' : 'mt-2 pt-2',
            )}
          >
            {renderUserBlock(railCollapsed)}
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen !== undefined && (
        <>
          {/* Backdrop */}
          {mobileOpen && (
            <div
              className="fixed inset-0 z-backdrop bg-slate-950/60 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />
          )}
          {/* Drawer */}
          <aside
            ref={drawerRef}
            role={drawerOpen ? 'dialog' : undefined}
            aria-modal={drawerOpen ? true : undefined}
            aria-hidden={!drawerOpen}
            inert={(!drawerOpen ? '' : undefined) as unknown as boolean}
            className={`fixed inset-y-0 left-0 z-drawer flex w-[min(20rem,calc(100vw-2rem))] flex-col bg-[var(--hii-sidebar-bg)] text-[var(--hii-sidebar-text)] shadow-2xl transition-transform duration-250 ease-in-out lg:hidden [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[var(--hii-sidebar-focus)] [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[var(--hii-sidebar-bg)] ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            aria-label={t('sidebar.navigation', locale)}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--hii-sidebar-divider)] px-4 py-3">
              <ShellBrand size="compact" onNavigate={onMobileClose} />
              <button
                type="button"
                onClick={onMobileClose}
                className={clsx(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg p-2 text-[var(--hii-sidebar-text-muted)] hover:bg-[var(--hii-sidebar-hover)] hover:text-white',
                  FOCUS_RING,
                )}
                aria-label={t('sidebar.close', locale)}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto hii-scrollbar-thin">{renderNavContent(false)}</div>
            <div className="border-t border-[var(--hii-sidebar-divider)] p-3">
              <div className="space-y-0.5">
                <SidebarLanguageMenu />
                {renderLogout(false)}
              </div>
              <div className="mt-2 border-t border-[var(--hii-sidebar-divider)] pt-2">{renderUserBlock(false)}</div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

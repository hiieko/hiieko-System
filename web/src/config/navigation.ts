/**
 * Single source of truth for sidebar navigation groups, items, icons, roles, and i18n keys.
 *
 * Consumed by Sidebar, Breadcrumbs, and any future command-palette / global search.
 *
 * i18n keys reference `nav.*` paths in `@solar/shared` (DEC-004).
 * Role filtering is unchanged from the original Sidebar implementation.
 */
import {
  LayoutDashboard, Clock, FileText, Truck, Boxes, MapPin, Euro,
  ClipboardCheck, Bell, Users, ShieldCheck, User, Gauge, Warehouse,
  SunMedium, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { ROUTE_ROLES } from './route-roles';

export interface NavItem {
  href: string;
  i18nKey: string;
  label: string; // RO fallback when i18n key not found
  icon: LucideIcon;
  roles?: string[];
}

export interface NavGroup {
  titleKey: string;
  title: string; // RO fallback
  items: NavItem[];
  roles?: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'nav.operations',
    title: 'Operațiuni',
    items: [
      { href: '/', i18nKey: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard },
      {
        href: '/solar-configurator', i18nKey: 'nav.solar_configurator', label: 'Configurator Solar',
        icon: SunMedium,
        roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'technician'],
      },
      {
        href: '/tasks', i18nKey: 'nav.tasks', label: 'Task-uri', icon: ClipboardCheck,
        roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker'],
      },
      {
        href: '/planning', i18nKey: 'nav.planning', label: 'Plan Zilnic', icon: FileText,
        roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker'],
      },
      {
        href: '/issues', i18nKey: 'nav.issues', label: 'Probleme & Blocaje', icon: AlertTriangle,
        roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker'],
      },
      { href: '/qa', i18nKey: 'nav.qa_qc', label: 'QA/QC · Inspecții', icon: ShieldCheck, roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'qa_qc'] },
      { href: '/pontaj', i18nKey: 'nav.pontaj', label: 'Pontaj & Ore', icon: Clock },
      { href: '/rapoarte', i18nKey: 'nav.rapoarte', label: 'Rapoarte Zilnice', icon: FileText },
      { href: '/avize', i18nKey: 'nav.avize', label: 'Procurement / Avize', icon: Truck },
      { href: '/stocuri', i18nKey: 'nav.stocuri', label: 'Materiale & Stoc', icon: Boxes },
      { href: '/cheltuieli', i18nKey: 'nav.cheltuieli', label: 'Cheltuieli', icon: Euro },
    ],
  },
  {
    titleKey: 'nav.management',
    title: 'Management',
    roles: ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader'],
    items: [
      { href: '/projects', i18nKey: 'nav.projects', label: 'Proiecte', icon: MapPin },
      { href: '/teams', i18nKey: 'nav.teams', label: 'Echipe', icon: Users },
      { href: '/workforce', i18nKey: 'nav.workforce', label: 'Forță de Muncă', icon: User },
      { href: '/santiere', i18nKey: 'nav.santiere', label: 'Șantiere (GIS)', icon: MapPin },
      { href: '/aprobare', i18nKey: 'nav.aprobare', label: 'Aprobări', icon: ClipboardCheck },
    ],
  },
  {
    titleKey: 'nav.admin',
    title: 'Administrare',
    roles: ['admin'],
    items: [
      { href: '/utilizatori', i18nKey: 'nav.utilizatori', label: 'Utilizatori', icon: Users },
    ],
  },
  {
    titleKey: 'nav.personal',
    title: 'Personal',
    items: [
      { href: '/notificari', i18nKey: 'nav.notificari', label: 'Notificări', icon: Bell },
      { href: '/profil', i18nKey: 'nav.profil', label: 'Profil', icon: User },
    ],
  },
];

/**
 * Mobile-only destinations (D6 — Mobile Nav Discoverability).
 *
 * These back the role-aware bottom nav and the "More" sheet. They deliberately
 * live outside `NAV_GROUPS` so routes that are reachable from the mobile nav
 * (but are not desktop-sidebar entries today, e.g. `/furnizori`, `/depozite`,
 * `/documente`) do not leak into the desktop `Sidebar`.
 */
export const MOBILE_DESTINATIONS: Record<string, NavItem> = {
  '/': { href: '/', i18nKey: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard },
  '/control-tower': { href: '/control-tower', i18nKey: 'nav.control_tower', label: 'Turn de Control', icon: Gauge },
  '/planning': { href: '/planning', i18nKey: 'nav.planning', label: 'Plan Zilnic', icon: FileText },
  '/tasks': { href: '/tasks', i18nKey: 'nav.tasks', label: 'Task-uri', icon: ClipboardCheck },
  '/pontaj': { href: '/pontaj', i18nKey: 'nav.pontaj', label: 'Pontaj & Ore', icon: Clock },
  '/issues': { href: '/issues', i18nKey: 'nav.issues', label: 'Probleme & Blocaje', icon: AlertTriangle },
  '/rapoarte': { href: '/rapoarte', i18nKey: 'nav.rapoarte', label: 'Rapoarte Zilnice', icon: FileText },
  '/aprobare': { href: '/aprobare', i18nKey: 'nav.aprobare', label: 'Aprobări', icon: ClipboardCheck },
  '/projects': { href: '/projects', i18nKey: 'nav.projects', label: 'Proiecte', icon: MapPin },
  '/qa': { href: '/qa', i18nKey: 'nav.qa_qc', label: 'QA/QC · Inspecții', icon: ShieldCheck },
  '/cheltuieli': { href: '/cheltuieli', i18nKey: 'nav.cheltuieli', label: 'Cheltuieli', icon: Euro },
  '/utilizatori': { href: '/utilizatori', i18nKey: 'nav.utilizatori', label: 'Utilizatori', icon: Users },
  '/stocuri': { href: '/stocuri', i18nKey: 'nav.stocuri', label: 'Materiale & Stoc', icon: Boxes },
  '/documente': { href: '/documente', i18nKey: 'nav.documente', label: 'Documente', icon: FileText },
  '/teams': { href: '/teams', i18nKey: 'nav.teams', label: 'Echipe', icon: Users },
  '/workforce': { href: '/workforce', i18nKey: 'nav.workforce', label: 'Forță de Muncă', icon: User },
  '/furnizori': { href: '/furnizori', i18nKey: 'nav.furnizori', label: 'Furnizori', icon: Truck },
  '/depozite': { href: '/depozite', i18nKey: 'nav.depozite', label: 'Depozite', icon: Warehouse },
  '/notificari': { href: '/notificari', i18nKey: 'nav.notificari', label: 'Notificări', icon: Bell },
  '/profil': { href: '/profil', i18nKey: 'nav.profil', label: 'Profil', icon: User },
};

/** Sentinel for the "More" tab in `MOBILE_NAV_BY_ROLE`. */
export const MOBILE_MORE_TAB = 'more';

/**
 * The 5 (or 4) highest-value destinations per role (D6). Each href is still
 * gated by `canRoleAccess` so a role never sees a tab it cannot open.
 */
export const MOBILE_NAV_BY_ROLE: Record<string, string[]> = {
  worker: ['/', '/planning', '/tasks', '/pontaj', '/issues'],
  team_leader: ['/', '/planning', '/tasks', '/pontaj', '/issues'],
  foreman: ['/', '/planning', '/tasks', '/pontaj', '/issues'],
  technician: ['/', '/planning', '/tasks', '/pontaj', '/issues'],
  site_manager: ['/', '/control-tower', '/rapoarte', '/aprobare', MOBILE_MORE_TAB],
  pm: ['/', '/control-tower', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  manager: ['/', '/control-tower', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  owner: ['/', '/control-tower', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  qa_qc: ['/', '/qa', '/tasks', '/issues', MOBILE_MORE_TAB],
  finance: ['/', '/aprobare', '/cheltuieli', '/rapoarte', MOBILE_MORE_TAB],
  admin: ['/', '/utilizatori', '/projects', '/control-tower', MOBILE_MORE_TAB],
  viewer: ['/', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  // Roles not enumerated in the D6 spec fall back to their closest home set.
  procurement: ['/', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  site_logistics: ['/', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  maintenance_director: ['/', '/control-tower', '/projects', '/rapoarte', MOBILE_MORE_TAB],
  technical_director: ['/', '/control-tower', '/projects', '/rapoarte', MOBILE_MORE_TAB],
};

/** Fallback set for any authenticated role not present in `MOBILE_NAV_BY_ROLE`. */
export const MOBILE_NAV_DEFAULT: string[] = ['/', '/projects', '/rapoarte', MOBILE_MORE_TAB];

export interface MoreGroup {
  key: string;
  title: Record<'ro' | 'en', string>;
  hrefs: string[];
}

/**
 * "More" sheet categories (D6). Rows are filtered per role via
 * `canRoleAccess`, so a group with no accessible row is skipped entirely.
 * `Photos` and `Settings` are intentionally omitted — no such routes exist.
 */
export const MORE_SHEET_GROUPS: MoreGroup[] = [
  {
    key: 'work',
    title: { ro: 'Muncă', en: 'Work' },
    hrefs: ['/planning', '/tasks', '/rapoarte', '/pontaj'],
  },
  {
    key: 'field',
    title: { ro: 'Teren', en: 'Field' },
    hrefs: ['/stocuri', '/documente'],
  },
  {
    key: 'manage',
    title: { ro: 'Administrare', en: 'Manage' },
    hrefs: ['/projects', '/teams', '/workforce', '/furnizori', '/depozite'],
  },
  {
    key: 'quality',
    title: { ro: 'Calitate', en: 'Quality' },
    hrefs: ['/qa', '/issues', '/aprobare'],
  },
  {
    key: 'account',
    title: { ro: 'Cont', en: 'Account' },
    hrefs: ['/notificari', '/profil'],
  },
];

/**
 * Single access check shared by the mobile bottom nav and the More sheet.
 * Mirrors `RoleGuard`: `null` = every authenticated role; `admin`/`owner`
 * are never denied. Unknown hrefs are treated as inaccessible.
 */
export function canRoleAccess(href: string, role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  if (normalized === 'admin' || normalized === 'owner') return true;
  const roles = (ROUTE_ROLES as Record<string, string[] | null>)[href];
  if (roles === undefined) return false;
  if (roles === null) return true;
  return roles.includes(normalized);
}

/** Resolve a mobile destination by href. */
export function getMobileDestination(href: string): NavItem | undefined {
  return MOBILE_DESTINATIONS[href];
}

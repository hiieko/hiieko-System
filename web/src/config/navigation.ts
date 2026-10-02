/**
 * Single source of truth for sidebar navigation groups, items, icons, roles, and i18n keys.
 *
 * Consumed by Sidebar, Breadcrumbs, and any future command-palette / global search.
 *
 * i18n keys reference `nav.*` paths in `@solar/shared` (DEC-004).
 *
 * Roles are no longer declared here: every item reads its role list from the
 * canonical `ROUTE_ROLES` map (UX-R1A C2, `config/route-roles.ts`) so the
 * sidebar and `RoleGuard` cannot drift apart. A group carries no roles of its
 * own — it is rendered when at least one of its items is visible.
 */
import {
  LayoutDashboard, Clock, FileText, Truck, Boxes, MapPin, Euro,
  ClipboardCheck, Bell, Users, Store, BarChart3, ShieldCheck, User,
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
      // `/` has no role restriction (ROUTE_ROLES['/'] is null): every
      // authenticated role has a home surface behind it.
      { href: '/', i18nKey: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ROUTE_ROLES['/'] ?? undefined },
      { href: '/solar-configurator', i18nKey: 'nav.solar_configurator', label: 'Configurator Solar', icon: SunMedium, roles: ROUTE_ROLES['/solar-configurator'] },
      { href: '/tasks', i18nKey: 'nav.tasks', label: 'Task-uri', icon: ClipboardCheck, roles: ROUTE_ROLES['/tasks'] },
      { href: '/planning', i18nKey: 'nav.planning', label: 'Plan Zilnic', icon: FileText, roles: ROUTE_ROLES['/planning'] },
      { href: '/issues', i18nKey: 'nav.issues', label: 'Probleme & Blocaje', icon: AlertTriangle, roles: ROUTE_ROLES['/issues'] },
      { href: '/pontaj', i18nKey: 'nav.pontaj', label: 'Pontaj & Ore', icon: Clock, roles: ROUTE_ROLES['/pontaj'] },
      { href: '/rapoarte', i18nKey: 'nav.rapoarte', label: 'Rapoarte Zilnice', icon: FileText, roles: ROUTE_ROLES['/rapoarte'] },
      { href: '/avize', i18nKey: 'nav.avize', label: 'Livrări & Avize', icon: Truck, roles: ROUTE_ROLES['/avize'] },
      { href: '/stocuri', i18nKey: 'nav.stocuri', label: 'Materiale & Stoc', icon: Boxes, roles: ROUTE_ROLES['/stocuri'] },
      { href: '/cheltuieli', i18nKey: 'nav.cheltuieli', label: 'Cheltuieli', icon: Euro, roles: ROUTE_ROLES['/cheltuieli'] },
    ],
  },
  {
    titleKey: 'nav.management',
    title: 'Management',
    items: [
      { href: '/projects', i18nKey: 'nav.projects', label: 'Proiecte', icon: MapPin, roles: ROUTE_ROLES['/projects'] },
      { href: '/teams', i18nKey: 'nav.teams', label: 'Echipe', icon: Users, roles: ROUTE_ROLES['/teams'] },
      { href: '/furnizori', i18nKey: 'nav.furnizori', label: 'Furnizori', icon: Store, roles: ROUTE_ROLES['/furnizori'] },
      { href: '/workforce', i18nKey: 'nav.workforce', label: 'Forță de Muncă', icon: User, roles: ROUTE_ROLES['/workforce'] },
      { href: '/santiere', i18nKey: 'nav.santiere', label: 'Șantiere (GIS)', icon: MapPin, roles: ROUTE_ROLES['/santiere'] },
      { href: '/qa', i18nKey: 'nav.qa_qc', label: 'QA / QC', icon: ShieldCheck, roles: ROUTE_ROLES['/qa'] },
      { href: '/aprobare', i18nKey: 'nav.aprobare', label: 'Aprobări', icon: ClipboardCheck, roles: ROUTE_ROLES['/aprobare'] },
      // `/statistici` is no longer a destination (it redirects to the canonical Control Tower
      // route), so this slot points at `/control-tower` and carries its own `nav.control_tower`
      // key — the legacy `nav.statistici` label would name a route that no longer exists.
      { href: '/control-tower', i18nKey: 'nav.control_tower', label: 'Turn de Control', icon: BarChart3, roles: ROUTE_ROLES['/control-tower'] },
    ],
  },
  {
    titleKey: 'nav.admin',
    title: 'Administrare',
    items: [
      { href: '/utilizatori', i18nKey: 'nav.utilizatori', label: 'Utilizatori', icon: Users, roles: ROUTE_ROLES['/utilizatori'] },
    ],
  },
  {
    titleKey: 'nav.personal',
    title: 'Personal',
    items: [
      { href: '/notificari', i18nKey: 'nav.notificari', label: 'Notificări', icon: Bell, roles: ROUTE_ROLES['/notificari'] ?? undefined },
      { href: '/profil', i18nKey: 'nav.profil', label: 'Profil', icon: User, roles: ROUTE_ROLES['/profil'] ?? undefined },
    ],
  },
];

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
  ClipboardCheck, Bell, Users, BarChart3, ShieldCheck, User,
  SunMedium, AlertTriangle, type LucideIcon,
} from 'lucide-react';

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
      { href: '/statistici', i18nKey: 'nav.statistici', label: 'Statistici', icon: BarChart3 },
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

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Clock, 
  FileText, 
  Truck, 
  Boxes, 
  MapPin, 
  SunMedium, 
  ShieldCheck,
  ClipboardCheck,
  Bell,
  Euro,
  Users,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';

const NAV_ITEMS = [
  { href: '/', label: 'Turn de Control', icon: LayoutDashboard },
  { href: '/pontaj', label: 'Pontaj & Ore Suplim.', icon: Clock },
  { href: '/rapoarte', label: 'Rapoarte Zilnice', icon: FileText },
  { href: '/avize', label: 'Avize & Receptie', icon: Truck },
  { href: '/stocuri', label: 'Stocuri & Materiale', icon: Boxes },
  { href: '/santiere', label: 'Șantiere & Echipe', icon: MapPin },
  { href: '/cheltuieli', label: 'Cheltuieli', icon: Euro },
  { href: '/aprobare', label: 'Aprobare Cheltuieli', icon: ClipboardCheck },
  { href: '/utilizatori', label: 'Utilizatori', icon: Users },
  { href: '/statistici', label: 'Statistici', icon: LayoutDashboard },
  { href: '/notificari', label: 'Notificari', icon: Bell },
  { href: '/profil', label: 'Profil', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const navKeys: Record<string, string> = {
    '/': 'nav.dashboard',
    '/pontaj': 'nav.attendance',
    '/rapoarte': 'nav.reports',
    '/avize': 'nav.deliveries',
    '/stocuri': 'nav.stock',
    '/santiere': 'nav.sites',
    '/cheltuieli': 'nav.expenses',
    '/aprobare': 'nav.approvals',
    '/utilizatori': 'nav.users',
    '/statistici': 'nav.statistics',
    '/notificari': 'nav.notifications',
    '/profil': 'nav.profile',
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="bg-amber-500 p-2 rounded-lg text-slate-950">
          <SunMedium className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white">Solar Manager</h1>
          <p className="text-xs text-amber-400 font-medium">Multi-Site Operations</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Operațiuni Șantier
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{t(navKeys[item.href] || item.label, locale)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>RLS & Audit Activ</span>
        </div>
      </div>
    </aside>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, FileText, Truck, Boxes, MapPin, Euro, ClipboardCheck, Bell, Users, BarChart3, ShieldCheck, X, User, SunMedium } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: string[]; }
interface NavGroup { title: string; items: NavItem[]; roles?: string[]; }

const NAV_GROUPS: NavGroup[] = [
  { title: 'Operațiuni', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/solar-configurator', label: 'Configurator Solar', icon: SunMedium },
    { href: '/pontaj', label: 'Pontaj & Ore', icon: Clock },
    { href: '/rapoarte', label: 'Rapoarte Zilnice', icon: FileText },
    { href: '/avize', label: 'Procurement / Avize', icon: Truck },
    { href: '/stocuri', label: 'Materiale & Stoc', icon: Boxes },
    { href: '/cheltuieli', label: 'Cheltuieli', icon: Euro },
  ]},
  { title: 'Management', roles: ['admin', 'owner', 'manager', 'pm'], items: [
    { href: '/projects', label: 'Proiecte', icon: MapPin },
    { href: '/teams', label: 'Echipe', icon: Users },
    { href: '/workforce', label: 'Forță de Muncă', icon: User },
    { href: '/santiere', label: 'Șantiere (GIS)', icon: MapPin },
    { href: '/aprobare', label: 'Aprobări', icon: ClipboardCheck },
    { href: '/statistici', label: 'Statistici', icon: BarChart3 },
  ]},
  { title: 'Administrare', roles: ['admin'], items: [
    { href: '/utilizatori', label: 'Utilizatori', icon: Users },
  ]},
  { title: 'Personal', items: [
    { href: '/notificari', label: 'Notificări', icon: Bell },
    { href: '/profil', label: 'Profil', icon: User },
  ]},
];

interface SidebarProps { mobileOpen?: boolean; onMobileClose?: () => void; }

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'worker';
  const isActive = (h: string) => h === '/' ? (pathname === '/' || pathname === '/control-tower') : (pathname === h || pathname.startsWith(h + '/'));
  const canSee = (item: NavItem | NavGroup): boolean => { const r = 'items' in item ? item.roles : item.roles; return !r || r.length === 0 || r.includes(userRole); };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href} onClick={onMobileClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-hii-500 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3" onClick={onMobileClose}>
          <div className="w-8 h-8 bg-hii-500 rounded-lg flex items-center justify-center shrink-0"><span className="text-white font-extrabold text-sm">H</span></div>
          <div><h1 className="font-bold text-base tracking-tight text-white leading-tight">HIIEKO</h1><p className="text-[10px] text-hii-400 font-medium tracking-wider uppercase">Romania SRL</p></div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          if (!canSee(group)) return null;
          const vi = group.items.filter(canSee);
          if (vi.length === 0) return null;
          return (<div key={group.title}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">{group.title}</div>
            <div className="space-y-1">{vi.map(renderItem)}</div>
          </div>);
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-hii-400" /><span>HIIEKO v1.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shrink-0 border-r border-slate-800">{sidebarContent}</aside>
      {mobileOpen !== undefined && (
        <>
          {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />}
          <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col shadow-2xl transform transition-transform duration-200 ease-in-out lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3" onClick={onMobileClose}>
                <div className="w-8 h-8 bg-hii-500 rounded-lg flex items-center justify-center"><span className="text-white font-extrabold text-sm">H</span></div>
                <div><h1 className="font-bold text-base tracking-tight text-white leading-tight">HIIEKO</h1><p className="text-[10px] text-hii-400 font-medium tracking-wider uppercase">Romania SRL</p></div>
              </Link>
              <button onClick={onMobileClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" aria-label="Inchide meniul"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="p-4 space-y-6">
                {NAV_GROUPS.map((group) => {
                  if (!canSee(group)) return null;
                  const vi = group.items.filter(canSee);
                  if (vi.length === 0) return null;
                  return (<div key={group.title}>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">{group.title}</div>
                    <div className="space-y-1">{vi.map(renderItem)}</div>
                  </div>);
                })}
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
}





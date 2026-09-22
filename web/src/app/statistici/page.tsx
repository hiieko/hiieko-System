'use client';
import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { Users, MapPin, Euro, FileText, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { t } from '@solar/shared';

interface Stats { employees: number; active_sites: number; expenses_month: number; pending_expenses: number; reports: number; }
const empty: Stats = { employees:0, active_sites:0, expenses_month:0, pending_expenses:0, reports:0 };

export default function StatisticiPage() {
  const [stats, setStats] = useState<Stats>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }
      const [p, s, e, r] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('expenses').select('id,amount,status').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      ]);
      setStats({
        employees: p.count || 0, active_sites: s.count || 0,
        expenses_month: e.data?.reduce((sum: number, x: any) => sum + (Number(x.amount) || 0), 0) || 0,
        pending_expenses: e.data?.filter((x: any) => x.status === 'submitted').length || 0,
        reports: r.count || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: t('stats.employees'), value: String(stats.employees), icon: Users, color: 'text-emerald-600 bg-emerald-50' },
    { label: t('stats.active_sites'), value: String(stats.active_sites), icon: MapPin, color: 'text-amber-600 bg-amber-50' },
    { label: t('stats.expenses'), value: stats.expenses_month.toFixed(0) + ' RON', icon: Euro, color: 'text-blue-600 bg-blue-50' },
    { label: t('stats.pending_exp'), value: String(stats.pending_expenses), icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
    { label: t('stats.reports'), value: String(stats.reports), icon: FileText, color: 'text-purple-600 bg-purple-50' },
    { label: t('stats.total_cost'), value: stats.expenses_month.toFixed(0) + ' RON', icon: TrendingUp, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageTutorial sectionId="statistics" />
      <div><h1 className="text-2xl font-bold text-slate-900">{t('stats.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">Panou de control operational pentru management.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">{c.label}</span>
                <div className={`p-2 rounded-lg ${c.color}`}><Icon className="w-5 h-5" /></div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">{loading ? '...' : c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

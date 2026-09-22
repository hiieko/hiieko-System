'use client';
import { PageTutorial } from '../../components/PageTutorial';
import React from 'react';
import { t } from '@solar/shared';

export default function ProfilPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageTutorial sectionId="profile" />
      <div><h1 className="text-2xl font-bold text-slate-900">{t('profile.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">Gestionarea informatiilor personale si a preferintelor.</p></div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl">U</div>
          <div><div className="text-lg font-bold text-slate-900">Utilizator</div><div className="text-sm text-slate-500">Profil utilizator</div></div>
        </div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('profile.name')}</label>
          <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('auth.email')}</label>
          <input type="email" disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('application.phone')}</label>
          <input type="tel" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('profile.language')}</label>
          <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="ro">Romana</option><option value="en">English</option>
          </select></div>
        <button className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg transition-colors">{t('profile.save')}</button>
      </div>
    </div>
  );
}

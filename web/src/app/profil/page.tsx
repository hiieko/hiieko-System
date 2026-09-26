'use client';
import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import { Loader2 } from 'lucide-react';

export default function ProfilPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const response = await apiClient.getMe();
        const me = response.data as any;
        setFullName(me?.fullName || me?.profile?.full_name || '');
        setEmail(me?.email || '');
        setPhone(me?.profile?.phone || me?.phone || '');
      } catch {
        // Fall back to context user
        if (user) {
          setFullName(user.fullName || '');
          setEmail(user.email || '');
        }
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageTutorial sectionId="profile" />
      <div><h1 className="text-2xl font-bold text-slate-900">Profil</h1>
        <p className="text-sm text-slate-500 mt-1">Informațiile personale și preferințele.</p></div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl">
            {(fullName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{fullName || 'Utilizator'}</div>
            <div className="text-sm text-slate-500">{email || 'Profil utilizator'}</div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nume complet</label>
          <input type="text" value={fullName} readOnly
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} readOnly
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
          <input type="tel" value={phone} readOnly
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Limbă</label>
          <select defaultValue={locale}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="ro">Română</option>
            <option value="en">English</option>
          </select>
        </div>
        <p className="text-xs text-slate-400 italic">
          Editarea profilului nu este disponibilă în această versiune.
        </p>
      </div>
    </div>
  );
}

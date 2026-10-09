'use client';
import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfilPage() {
  const { user } = useAuth();
  const { locale, setLocale } = useLocale();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      await apiClient.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      // Also update locale preference
      if (selectedLocale !== locale && setLocale) {
        setLocale(selectedLocale as 'ro' | 'en');
        try {
          await apiClient.updateProfile({ language: selectedLocale });
        } catch { /* locale update is best-effort */ }
      }
      setSaveMsg('Profil actualizat cu succes!');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Eroare la salvarea profilului.');
    } finally {
      setSaving(false);
    }
  };

  const handleLocaleChange = (newLocale: 'ro' | 'en') => {
    setSelectedLocale(newLocale);
    if (setLocale) {
      setLocale(newLocale);
    }
  };

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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl">
            {(fullName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900">{fullName || 'Utilizator'}</div>
            <div className="text-sm text-slate-500 break-words">{email || 'Profil utilizator'}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nume complet</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} readOnly
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Limbă</label>
          <select value={selectedLocale} onChange={e => handleLocaleChange(e.target.value as 'ro' | 'en')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none">
            <option value="ro">Română</option>
            <option value="en">English</option>
          </select>
        </div>
        </div>

        {saveMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />{saveMsg}
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-400 italic text-center sm:text-left">
            Emailul nu poate fi modificat.
          </p>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 w-full sm:w-auto">
            <Save className="w-4 h-4 mr-1.5" />{saving ? 'Se salvează...' : 'Salvează profil'}
          </button>
        </div>
      </div>
    </div>
  );
}

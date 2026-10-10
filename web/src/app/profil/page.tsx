'use client';
import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHeader, Button, Card, Input, Skeleton, ErrorState } from '../../components/ui';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.getMe();
      const me = response.data as any;
      setFullName(me?.fullName || me?.profile?.full_name || '');
      setEmail(me?.email || '');
      setPhone(me?.profile?.phone || me?.phone || '');
    } catch (err: any) {
      setLoadError(err?.message || 'Nu s-a putut încărca profilul.');
      // Fall back to context user so the form still works when the API is unreachable.
      if (user) {
        setFullName(user.fullName || '');
        setEmail(user.email || '');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!user && loadError) {
    return (
      <ErrorState
        fullPage
        title={locale === 'en' ? 'Could not load profile' : 'Profilul nu a putut fi încărcat'}
        message={locale === 'en' ? 'Check your connection and try again.' : 'Verifică conexiunea și încearcă din nou.'}
        error={loadError}
        onRetry={loadProfile}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageTutorial sectionId="profile" />
      <PageHeader
        title="Profil"
        subtitle="Informațiile personale și preferințele."
      />
      <Card padding={false} className="p-4 sm:p-6 space-y-4">
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
          <Input
            label="Nume complet"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            readOnly
            className="bg-slate-50"
          />
          <Input
            label="Telefon"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          <div>
            <label htmlFor="profil-language" className="hii-label">Limbă</label>
            <select
              id="profil-language"
              value={selectedLocale}
              onChange={e => handleLocaleChange(e.target.value as 'ro' | 'en')}
              className="hii-select"
            >
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
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {saving ? 'Se salvează...' : 'Salvează profil'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

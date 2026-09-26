'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale, t } from '@solar/shared';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.login({ email, password });
      await refreshUser();
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('auth.login_error', locale));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-hii-500 rounded-2xl shadow-lg mb-5">
            <span className="text-white font-extrabold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HIIEKO</h1>
          <p className="text-sm text-slate-500 mt-1">{t('application.subtitle', locale)}</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.email', locale)}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="hii-input pl-10"
                placeholder={t('auth.email_placeholder', locale)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.password', locale)}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="hii-input pl-10"
                placeholder={t('auth.password_placeholder', locale)} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="hii-btn-primary w-full py-3">
            {loading ? t('auth.logging_in', locale) : t('auth.login_button', locale)}
          </button>

          <p className="text-center text-sm text-slate-500">
            {t('auth.no_account', locale)}{' '}
            <Link href="/signup" className="font-semibold text-hii-600 hover:text-hii-700">
              {t('auth.request_access', locale)}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

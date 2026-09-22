'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SunMedium, Mail, Lock, AlertCircle } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
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
        setError('A apărut o eroare la autentificare.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <PageTutorial sectionId="login" />
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl text-slate-950 mb-4">
            <SunMedium className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Solar Site Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Autentificare in platforma</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="nume@companie.ro" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Parola</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Parola ta" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-colors">
            {loading ? 'Se autentifica...' : 'CONECTARE'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Nu ai cont?{' '}
            <Link href="/signup" className="font-semibold text-amber-600 hover:text-amber-700">
              Solicita acces
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SunMedium, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t } from '@solar/shared';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', requestedRole:'worker', password:'', acceptTerms:false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.acceptTerms) { setError('Accepta conditiile.'); return; }
    setLoading(true);
    try {
      await apiClient.register({
        email: form.email,
        password: form.password,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
        role: form.requestedRole,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Eroare la inregistrare.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Cont creat cu succes!</h2>
        <p className="text-sm text-slate-500 mb-6">Contul tău a fost creat. Poți să te autentifici acum.</p>
        <Link href="/login" className="inline-block px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm rounded-lg">
          Mergi la autentificare
        </Link>
      </div>
    </div>
  );

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none';
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500 rounded-2xl text-slate-950 mb-3"><SunMedium className="w-8 h-8" /></div>
          <h1 className="text-xl font-bold text-slate-900">{t('application.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('application.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('application.first_name')}</label>
              <input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className={inp} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('application.last_name')}</label>
              <input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className={inp} /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('auth.email')}</label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('application.phone')}</label>
            <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inp} placeholder="+40 7xx" /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('application.requested_role')}</label>
            <select value={form.requestedRole} onChange={e => setForm({...form, requestedRole: e.target.value})} className={inp}>
              <option value="worker">{t('role.worker')}</option>
              <option value="team_leader">{t('role.team_leader')}</option>
              <option value="manager">{t('role.manager')}</option>
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{t('auth.password')}</label>
            <input type="password" required minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className={inp} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.acceptTerms} onChange={e => setForm({...form, acceptTerms: e.target.checked})} className="w-4 h-4 text-amber-500 rounded" />
            <span className="text-xs text-slate-600">{t('application.accept_terms')}</span>
          </label>
          <button type="submit" disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-lg">{loading ? '...' : t('application.submit')}</button>
          <p className="text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-amber-600">{t('auth.has_account')}</Link></p>
        </form>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '@solar/shared';

const ROLE_PREVIEW_STORAGE_KEY = 'hiieko_role_preview';

const ROLES = [
  {
    role: 'admin',
    title: 'Administrator',
    description: 'Full system access',
  },
  {
    role: 'owner',
    title: 'Owner',
    description: 'Organization-wide access',
  },
  {
    role: 'pm',
    title: 'Project Manager',
    description: 'Project planning and oversight',
  },
  {
    role: 'site_manager',
    title: 'Site Manager',
    description: 'Site operations and execution',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { locale } = useLocale();

  const enterAsRole = async (role: string) => {
    sessionStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, role);
    await refreshUser();
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-hii-500 rounded-2xl shadow-lg mb-5">
            <span className="text-white font-extrabold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HIIEKO</h1>
          <p className="text-sm text-slate-500 mt-1">{locale === 'ro' ? 'Previzualizare roluri' : 'Role preview'}</p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 space-y-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Temporary preview mode
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {locale === 'ro'
                ? 'Autentificarea este dezactivată temporar pentru verificarea UI.'
                : 'Login is temporarily disabled for UI review.'}
            </p>
          </div>

          {ROLES.map(({ role, title, description }) => (
            <button
              key={role}
              type="button"
              onClick={() => enterAsRole(role)}
              className="w-full text-left rounded-lg border border-slate-200 px-4 py-4 hover:border-hii-400 hover:bg-slate-50 transition-colors"
            >
              <span className="block font-semibold text-slate-900">{title}</span>
              <span className="block text-sm text-slate-500 mt-1">{description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

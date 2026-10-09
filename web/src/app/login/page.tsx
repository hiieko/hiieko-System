'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input, ToastProvider, useToast } from '../../components/ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_FLASH_KEY = 'hiieko_signup_flash';

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:flex-col lg:justify-between bg-hii-500 px-12 py-12 text-white">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <span className="text-xl font-extrabold">H</span>
        </div>
        <span className="text-xl font-bold tracking-tight">HIIEKO</span>
      </div>
      <div>
        <h2 className="text-2xl font-bold leading-snug">
          Construction management, in one system.
        </h2>
        <p className="mt-3 text-sm text-white/80">
          Projects, teams, attendance, materials and reports — from office to site.
        </p>
      </div>
      <p className="text-xs text-white/60">hiieko.app</p>
    </div>
  );
}

function LoginForm() {
  const toast = useToast();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(SIGNUP_FLASH_KEY) === 'created') {
      window.sessionStorage.removeItem(SIGNUP_FLASH_KEY);
      toast.success('Account created.', 'You can sign in now.');
    }
  }, [toast]);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_RE.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await apiClient.login({ email: email.trim(), password });
      await refreshUser();
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        toast.error('Wrong email or password');
        setPassword('');
      } else if (err instanceof ApiError && err.statusCode === 429) {
        toast.error('Too many attempts. Wait a minute.');
      } else {
        toast.error('No connection. Check your internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center lg:hidden">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-hii-500 shadow-lg">
          <span className="text-white text-xl font-extrabold">H</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your email and password to access your workspace.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            id="login-email"
            type="email"
            label="Email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={loading}
          />

          <div>
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={loading}
              suffix={
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="rounded-md p-2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  toast.info("Password reset isn't connected yet", 'It arrives in a later phase.')
                }
                className="text-sm font-medium text-hii-600 transition-colors hover:text-hii-700"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-hii-600 transition-colors hover:text-hii-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
        <BrandPanel />
        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-12">
          <LoginForm />
        </div>
      </div>
    </ToastProvider>
  );
}
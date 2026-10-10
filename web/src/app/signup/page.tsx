'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input, ToastProvider, useToast } from '../../components/ui';
import { apiClient, ApiError } from '../../lib/api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_FLASH_KEY = 'hiieko_signup_flash';
const SIGNUP_EMAIL_KEY = 'hiieko_signup_email';

const ROLES = [
  { value: 'worker', label: 'Worker' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'site_manager', label: 'Site Manager' },
  { value: 'admin', label: 'Admin' },
] as const;

type PasswordStrength = 'weak' | 'fair' | 'strong';

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (score >= 4) return 'strong';
  if (score >= 2) return 'fair';
  return 'weak';
}

const STRENGTH_STYLES: Record<PasswordStrength, string> = {
  weak: 'text-critical',
  fair: 'text-warning',
  strong: 'text-success',
};

const selectClass =
  'w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:border-hii-500 focus:ring-hii-500/30 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

type SignupErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
};

function SignupForm() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    requestedRole: 'worker',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<SignupErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): SignupErrors => {
    const next: SignupErrors = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_RE.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      next.password = 'Password is required.';
    } else if (form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    if (!form.confirmPassword) {
      next.confirmPassword = 'Confirm your password.';
    } else if (form.confirmPassword !== form.password) {
      next.confirmPassword = 'Passwords do not match.';
    }
    if (!form.acceptTerms) next.terms = 'Accept the terms to continue.';
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await apiClient.register({
        email: form.email.trim(),
        password: form.password,
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        phone: form.phone.trim() || undefined,
        role: form.requestedRole,
      });
      window.sessionStorage.setItem(SIGNUP_FLASH_KEY, 'created');
      window.sessionStorage.setItem(SIGNUP_EMAIL_KEY, form.email.trim());
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setErrors((prev) => ({ ...prev, email: 'This email is already registered.' }));
      } else if (err instanceof ApiError) {
        toast.error('Could not create your account.', err.message);
      } else {
        toast.error('No connection. Check your internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(form.password);

  return (
    <div className="w-full">
      <div className="mb-6 text-center lg:hidden">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-hii-500 shadow-lg">
          <span className="text-white text-xl font-extrabold">H</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in the form to request an account.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="signup-first-name"
              type="text"
              label="First name"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              error={errors.firstName}
              disabled={loading}
            />
            <Input
              id="signup-last-name"
              type="text"
              label="Last name"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              error={errors.lastName}
              disabled={loading}
            />
          </div>

          <Input
            id="signup-email"
            type="email"
            label="Email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            disabled={loading}
          />

          <Input
            id="signup-phone"
            type="tel"
            label="Phone (optional)"
            autoComplete="tel"
            hint="Used for site notifications."
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            disabled={loading}
          />

          <div>
            <label htmlFor="signup-role" className="block text-sm font-medium text-slate-700 mb-1.5">
              Requested role
            </label>
            <select
              id="signup-role"
              className={selectClass}
              value={form.requestedRole}
              onChange={(e) => setField('requestedRole', e.target.value)}
              disabled={loading}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
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
            <div className="mt-1.5 flex items-center justify-between">
              <p className={`text-xs font-medium ${strength ? STRENGTH_STYLES[strength] : 'text-slate-400'}`}>
                {strength === 'weak' && 'Weak password'}
                {strength === 'fair' && 'Fair password'}
                {strength === 'strong' && 'Strong password'}
                {!strength && 'Password strength'}
              </p>
            </div>
          </div>

          <div>
            <Input
              id="signup-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              label="Confirm password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setField('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              disabled={loading}
              suffix={
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="rounded-md p-2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />
          </div>

          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => {
                  setField('acceptTerms', e.target.checked);
                  if (e.target.checked) {
                    setErrors((prev) => ({ ...prev, terms: undefined }));
                  }
                }}
                className="mt-0.5 w-4 h-4 text-hii-600 accent-hii-600 rounded"
              />
              <span className="text-sm text-slate-600">
                I agree to the terms of service and acknowledge the privacy policy.
              </span>
            </label>
            {errors.terms && (
              <p role="alert" className="mt-1.5 text-xs text-critical">
                {errors.terms}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-hii-600 transition-colors hover:text-hii-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
        <BrandPanel />
        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-12">
          <SignupForm />
        </div>
      </div>
    </ToastProvider>
  );
}

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
'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button, Input, ToastProvider, useToast } from '../../../components/ui';
import { apiClient, ApiError } from '../../../lib/api-client';

const PASSWORD_RESET_FLASH_KEY = 'hiieko_password_reset_flash';

function ResetPasswordForm() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-critical">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invalid reset link</h1>
        <p className="mt-2 text-sm text-slate-600">
          This link is missing its reset token. Request a new one to continue.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-hii-600 transition-colors hover:text-hii-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  const validate = () => {
    const next: { password?: string; confirm?: string } = {};
    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (!confirm) {
      next.confirm = 'Confirm your password.';
    } else if (password !== confirm) {
      next.confirm = 'Passwords do not match.';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setSubmitError(undefined);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await apiClient.resetPassword(token, password);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PASSWORD_RESET_FLASH_KEY, 'done');
      }
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 400) {
        setSubmitError('This link has expired. Request a new one.');
      } else if (err instanceof ApiError && err.statusCode === 429) {
        toast.error('Too many attempts. Try again later.');
      } else {
        toast.error('No connection. Check your internet.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pick a strong password you haven&apos;t used before — 8 characters minimum.
      </p>

      {submitError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <span>{submitError}</span>
          <Link href="/forgot-password" className="ml-auto shrink-0 font-semibold text-hii-600 hover:text-hii-700">
            Request a new one
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          id="reset-password"
          type="password"
          label="New password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={loading}
        />
        <Input
          id="reset-confirm"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          disabled={loading}
        />

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Reset password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <Suspense fallback={<div className="text-center text-sm text-slate-500">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </ToastProvider>
  );
}
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button, Input, ToastProvider, useToast } from '../../components/ui';
import { apiClient, ApiError } from '../../lib/api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Email is required.');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await apiClient.forgotPassword(value);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 429) {
        toast.error('Too many requests. Try again later.');
      } else {
        toast.error('No connection. Check your internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          If an account exists for <span className="font-semibold text-slate-800">{email}</span>,
          we sent a link to reset your password. It stays valid for 30 minutes.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-hii-600 transition-colors hover:text-hii-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot password?</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a secure reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          id="forgot-email"
          type="email"
          label="Email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          disabled={loading}
        />

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-hii-600 transition-colors hover:text-hii-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </ToastProvider>
  );
}
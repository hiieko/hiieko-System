'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Skeleton, ToastProvider, useToast } from '../../components/ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth, SIGNED_OUT_FLASH_KEY } from '../../contexts/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_FLASH_KEY = 'hiieko_signup_flash';
const SIGNUP_EMAIL_KEY = 'hiieko_signup_email';
const PASSWORD_RESET_FLASH_KEY = 'hiieko_password_reset_flash';

/**
 * Demo credential quick-fill.
 *
 * Gated behind NEXT_PUBLIC_DEMO_MODE — when it is not exactly 'true' the section never
 * mounts. The passwords live only here (never fetched from the API, never logged) and are
 * keyed by email. The seed uses three passwords: the standard demo password for
 * office/role accounts, a team-leader password, and a worker password. An account returned
 * by the endpoint that is missing from this map is skipped, so we never render a button
 * that cannot log in.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_ACCOUNTS_ENDPOINT = '/api/demo/accounts';

const DEMO_PASSWORD_BY_EMAIL: Record<string, string> = {
  'dev@hiieko.local': 'DevPassword123!',
  'owner@hiieko.local': 'DevPassword123!',
  'manager@hiieko.local': 'DevPassword123!',
  'pm@hiieko.local': 'DevPassword123!',
  'site.manager@hiieko.local': 'DevPassword123!',
  'foreman@hiieko.local': 'DevPassword123!',
  'qa@hiieko.local': 'DevPassword123!',
  'finance@hiieko.local': 'DevPassword123!',
  'procurement@hiieko.local': 'DevPassword123!',
  'viewer@hiieko.local': 'DevPassword123!',
  'ion.munteanu@hiieko.local': 'TeamLeader123!',
  'costin.dumitrescu@hiieko.local': 'Worker123!',
};

const DEMO_LABEL_BY_EMAIL: Record<string, string> = {
  'dev@hiieko.local': 'Admin',
  'owner@hiieko.local': 'Owner',
  'manager@hiieko.local': 'Manager',
  'pm@hiieko.local': 'Project Manager',
  'site.manager@hiieko.local': 'Site Manager',
  'foreman@hiieko.local': 'Foreman',
  'qa@hiieko.local': 'QA/QC',
  'finance@hiieko.local': 'Finance',
  'procurement@hiieko.local': 'Procurement',
  'viewer@hiieko.local': 'Viewer',
  'ion.munteanu@hiieko.local': 'Team Leader',
  'costin.dumitrescu@hiieko.local': 'Worker',
};

interface DemoAccountResponse {
  role: string;
  label: string;
  email: string;
  hasData: boolean;
}

interface DemoAccountEntry {
  email: string;
  label: string;
  password: string;
}

/** Copies text to the clipboard, falling back to the legacy execCommand path. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API unavailable/denied — fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
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

function DemoAccounts({
  onFill,
}: {
  onFill: (email: string, password: string) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<DemoAccountEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await apiClient.get<DemoAccountResponse[]>(DEMO_ACCOUNTS_ENDPOINT);
        if (cancelled) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        const visible = rows
          .filter((row) => row?.hasData !== false)
          .map((row) => {
            const email = (row.email || '').toLowerCase();
            const password = DEMO_PASSWORD_BY_EMAIL[email];
            const label = DEMO_LABEL_BY_EMAIL[email];
            if (!password || !label) return null;
            return { email, label, password };
          })
          .filter((entry): entry is DemoAccountEntry => entry !== null);
        setAccounts(visible);
      } catch {
        // Silent fallback: the login form keeps working without the demo section.
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && accounts.length === 0) {
    return null;
  }

  const copyOne = async (entry: DemoAccountEntry) => {
    const ok = await copyToClipboard(`${entry.email} / ${entry.password}`);
    if (ok) toast.success(`Copied ${entry.label} credentials`);
    else toast.error('Could not copy');
  };

  const copyAll = async () => {
    const text = accounts
      .map((entry) => `${entry.label} — ${entry.email} / ${entry.password}`)
      .join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success('Copied all demo credentials');
    else toast.error('Could not copy');
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Demo accounts
      </p>

      {loading ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={30} />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {accounts.map((entry) => (
            <div key={entry.email} className="flex items-stretch gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-w-0 flex-1 justify-start"
                onClick={() => onFill(entry.email, entry.password)}
              >
                <span className="truncate">{entry.label}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-[30px] w-[30px]"
                aria-label={`Copy ${entry.label} credentials`}
                title="Copy email / password"
                onClick={() => copyOne(entry)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth
          className="mt-2"
          icon={<Copy className="h-3.5 w-3.5" />}
          onClick={copyAll}
        >
          Copy all
        </Button>
      )}
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
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SIGNED_OUT_FLASH_KEY) === '1') {
      window.sessionStorage.removeItem(SIGNED_OUT_FLASH_KEY);
      toast.success('Signed out');
    }
    if (window.sessionStorage.getItem(SIGNUP_FLASH_KEY) === 'created') {
      window.sessionStorage.removeItem(SIGNUP_FLASH_KEY);
      const signupEmail = window.sessionStorage.getItem(SIGNUP_EMAIL_KEY);
      if (signupEmail) {
        setEmail(signupEmail);
        window.sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
      }
      toast.success('Account created. Sign in to continue.');
    }
  if (window.sessionStorage.getItem(PASSWORD_RESET_FLASH_KEY) === 'done') {
      window.sessionStorage.removeItem(PASSWORD_RESET_FLASH_KEY);
      toast.success('Password reset. Sign in.');
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
      const from =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('from')
          : null;
      router.push(from && from.startsWith('/') && !from.startsWith('//') ? from : '/');
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

  const fillDemoCredentials = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrors({});
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center lg:hidden">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-hii-500 shadow-lg">
          <span className="text-white text-xl font-extrabold">H</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
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
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />
            <div className="mt-1.5 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-hii-600 transition-colors hover:text-hii-700"
              >
                Forgot password?
              </Link>
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

        {DEMO_MODE && <DemoAccounts onFill={fillDemoCredentials} />}
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
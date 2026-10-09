'use client';

import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Button } from './Button';

interface PageHeaderProps {
  eyebrow?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  icon,
  title,
  subtitle,
  backHref,
  onBack,
  onRefresh,
  refreshing = false,
  actions,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className={clsx('flex items-center justify-between mb-6', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {(backHref || onBack) && (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            aria-label="Înapoi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">{eyebrow}</p>
          )}
          <div className="flex items-center gap-2">
            {icon && <span className="shrink-0">{icon}</span>}
            <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Reîmprospătează"
          />
        )}
        {actions}
      </div>
    </div>
  );
}

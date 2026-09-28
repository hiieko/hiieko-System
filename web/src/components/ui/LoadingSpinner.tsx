'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
  fullPage?: boolean;
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function LoadingSpinner({
  size = 'md',
  label,
  className,
  fullPage = false,
}: LoadingSpinnerProps) {
  const content = (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3',
        fullPage && 'min-h-[60vh]',
        className,
      )}
    >
      <Loader2 className={clsx('animate-spin text-hii-500', sizeStyles[size])} />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );

  if (fullPage) {
    return content;
  }

  return content;
}

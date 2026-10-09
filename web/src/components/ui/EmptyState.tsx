'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode | EmptyStateAction;
  variant?: 'default' | 'compact';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const compact = variant === 'compact';
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className,
      )}
    >
      {icon ? (
        <div
          className={clsx(
            'rounded-full bg-surface-muted flex items-center justify-center text-content-muted',
            compact ? 'w-8 h-8 mb-2' : 'w-14 h-14 mb-4',
          )}
        >
          {icon}
        </div>
      ) : (
        <div
          className={clsx(
            'rounded-full bg-surface-muted flex items-center justify-center',
            compact ? 'w-8 h-8 mb-2' : 'w-14 h-14 mb-4',
          )}
        >
          <svg
            className={clsx('text-content-muted', compact ? 'w-4 h-4' : 'w-7 h-7')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className={clsx('font-semibold text-content-secondary', compact ? 'text-sm mb-0.5' : 'text-base mb-1')}>
        {title}
      </h3>
      {description && (
        <p className={clsx('text-content-muted max-w-sm', compact ? 'text-xs mb-2' : 'text-sm mb-4')}>
          {description}
        </p>
      )}
      {action && (
        <div>
          {typeof action === 'object' && 'label' in action && 'onClick' in action ? (
            <button
              onClick={(action as EmptyStateAction).onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent-ink bg-accent rounded-lg hover:bg-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {(action as EmptyStateAction).label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

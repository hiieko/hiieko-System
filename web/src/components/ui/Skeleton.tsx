'use client';

import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClass = 'animate-pulse bg-surface-muted rounded';

  const variantClass = variant === 'circular' ? 'rounded-full' : variant === 'rectangular' ? 'rounded-lg' : 'rounded';

  const style: React.CSSProperties = {
    width: width ?? (variant === 'circular' ? 40 : '100%'),
    height: height ?? (variant === 'text' ? 16 : variant === 'circular' ? 40 : 80),
  };

  if (count > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={clsx(baseClass, variantClass, className)}
            style={style}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(baseClass, variantClass, className)}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a table row */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4" width={i === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface BreadcrumbItem {
  href?: string;
  label: string;
  icon?: LucideIcon;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={clsx('flex items-center gap-1.5 text-sm', className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const Icon = item.icon;
        const content = (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{item.label}</span>
          </>
        );

        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors"
              >
                {content}
              </Link>
            ) : (
              <span
                className={clsx(
                  'inline-flex items-center gap-1',
                  isLast ? 'text-slate-900 font-semibold' : 'text-slate-500',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {content}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { clsx } from 'clsx';

interface DropdownMenuItem {
  key: string;
  label: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
  onClose?: () => void;
}

export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  className,
  onClose,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const ref = useClickOutside<HTMLDivElement>(close);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey, { capture: true });
    return () => document.removeEventListener('keydown', handleKey, { capture: true });
  }, [open, close]);

  return (
    <div ref={ref} className={clsx('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open && (
        <div
          className={clsx(
            'absolute z-drawer mt-1 w-56 rounded-lg bg-white shadow-elevated border border-slate-200 py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  close();
                }
              }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                item.variant === 'danger'
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-slate-700 hover:bg-slate-50',
                item.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { DropdownMenuItem, DropdownMenuProps };

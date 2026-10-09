'use client';

import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, suffix, className, id, disabled, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="w-full">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            className={clsx(
              'w-full h-11 px-3 bg-white border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-colors',
              'focus:outline-none focus:ring-2',
              suffix && 'pr-11',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                : 'border-slate-300 focus:border-hii-500 focus:ring-hii-500/30',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              className,
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">{suffix}</div>
          )}
        </div>
        {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export { Input };
export type { InputProps };

'use client';

import React, { useState } from 'react';
import { t } from '@solar/shared';

interface FieldHelpProps {
  /** Short label translation key (e.g. 'help.supplier'). */
  labelKey: string;
  /** Help text key. Defaults to `<labelKey>.text`. */
  textKey?: string;
  locale?: 'ro' | 'en';
  muted?: boolean;
}

/**
 * Simple field-level help/tooltip (HIIEKO spec §13). Renders a label plus an
 * accessible "?" button that toggles an inline explanation in RO/EN.
 */
export function FieldHelp({ labelKey, textKey, locale = 'ro', muted }: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const text = t(textKey ?? `${labelKey}.text`, locale);
  return (
    <span className={`inline-flex items-center gap-1 ${muted ? 'text-slate-500' : 'text-slate-600'}`}>
      <span className="text-xs font-medium">{t(labelKey, locale)}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={labelKey}
        aria-expanded={open}
        className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold leading-none hover:bg-hii-100 focus:outline-none focus:ring-2 focus:ring-hii-500"
      >
        ?
      </button>
      {open && (
        <span className="relative mb-0 -mt-6 block w-64">
          <span className="bg-slate-800 text-slate-100 text-xs rounded-lg px-3 py-2 leading-relaxed shadow-md">
            {text}
          </span>
        </span>
      )}
    </span>
  );
}
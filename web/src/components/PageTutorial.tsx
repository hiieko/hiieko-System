'use client';

import React, { useState } from 'react';
import {
  TUTORIALS,
  TutorialSectionId,
  t,
  getRoleLabel,
  UserRole,
} from '@solar/shared';

interface PageTutorialProps {
  sectionId: TutorialSectionId;
  locale?: 'ro' | 'en';
  /** When provided only role notes for this role are shown. */
  role?: UserRole;
}

/**
 * Reusable Web page introduction (HIIEKO spec §9-§11, §12 reusable system).
 * Progressive disclosure: concise summary visible by default; expandable
 * "How it works" answering What/Why/Do/Who + Important rules. All copy comes
 * from shared translation keys in RO+EN — nothing is hardcoded here.
 */
export function PageTutorial({ sectionId, locale = 'ro', role }: PageTutorialProps) {
  const [expanded, setExpanded] = useState(false);
  const content = TUTORIALS[sectionId];
  if (!content) return null;

  const visibleRoles = role
    ? content.roles.filter((r) => r.role === role)
    : content.roles;

  return (
    <section
      className="bg-slate-900 text-white rounded-xl border border-slate-700 shadow-sm p-4 mb-6"
      aria-label={t(content.titleKey, locale)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-amber-400 font-bold text-sm uppercase tracking-wide">
          {t(content.titleKey, locale)}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-sky-400 text-xs font-semibold hover:text-sky-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          {expanded ? `${t('general.close', locale)} ▴` : `${t('howItWorks', locale)} ▾`}
        </button>
      </div>
      <p className="text-slate-300 text-sm mt-1">{t(content.shortKey, locale)}</p>

      {expanded && (
        <div className="mt-3 border-t border-slate-700 pt-3 space-y-3 text-sm">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
              {t('tutorial.whatFor', locale)}
            </p>
            <p className="text-slate-200 mt-0.5">{t(content.purposeKey, locale)}</p>
          </div>

          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
              {t('tutorial.whatToDo', locale)}
            </p>
            <ol className="mt-0.5 list-decimal space-y-1 text-slate-200">
              {content.steps.map((key) => (
                <li key={key}>{t(key, locale)}</li>
              ))}
            </ol>
          </div>

          {visibleRoles.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                {t('role.who', locale)}
              </p>
              {visibleRoles.map((r) => (
                <p key={r.noteKey} className="text-slate-200 mt-0.5">
                  • {getRoleLabel(r.role, locale)}: {t(r.noteKey, locale)}
                </p>
              ))}
            </div>
          )}

          {content.importantKey ? (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
              <p className="text-amber-200 text-xs font-semibold">⚠ {t(content.importantKey, locale)}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
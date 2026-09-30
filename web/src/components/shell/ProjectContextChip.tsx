'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';

export type ProjectChipVariant = 'header' | 'band';

interface ProjectContextChipProps {
  /**
   * `header` sits on the white >=lg header, `band` on the `#374151` strip that
   * replaces it below `lg` (dark chrome → light text).
   */
  variant?: ProjectChipVariant;
}

/**
 * The single project-context control of the shell.
 *
 * It drives `ProjectContext.setSelectedProjectId` exactly like the header block
 * it replaces (`'all'` maps back to the empty "all sites" selection), so every
 * page keeps reading the same context.
 */
export function ProjectContextChip({ variant = 'header' }: ProjectContextChipProps) {
  const { locale } = useLocale();
  const { projects, selectedProjectId, setSelectedProjectId, selectedProject, loading } =
    useProject();

  const label = selectedProject
    ? t('header.current_project', locale)
    : t('header.all_projects', locale);

  const selectClass =
    variant === 'band'
      ? 'bg-transparent font-semibold text-chrome-text text-sm min-w-0 flex-1 cursor-pointer focus:outline-none disabled:cursor-not-allowed'
      : 'bg-transparent font-semibold text-slate-800 text-xs -mt-0.5 p-0 cursor-pointer focus:outline-none disabled:cursor-not-allowed';

  const select = (
    <select
      value={selectedProjectId || 'all'}
      onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)}
      disabled={loading}
      aria-label={t('header.select_project', locale)}
      className={selectClass}
    >
      <option value="all">{t('header.all_sites', locale)}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.code})
        </option>
      ))}
    </select>
  );

  if (variant === 'band') {
    return (
      <div className="hii-shell-band h-11 px-4 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-chrome-muted shrink-0">
          {label}
        </span>
        {select}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm max-w-[18rem]">
      <MapPin className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-slate-400 font-medium leading-tight">{label}</span>
        {select}
      </div>
    </div>
  );
}
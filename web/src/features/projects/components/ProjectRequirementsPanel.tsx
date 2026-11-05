'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Button } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import {
  adoptLatestProjectCatalog,
  assessProjectRequirement,
  getProjectCatalogAdoptions,
  getProjectRequirementHistory,
  getProjectRequirements,
  initializeProjectFolders,
  type ProjectRequirementCatalogAdoptionItem,
  type ProjectRequirementHistoryItem,
  type ProjectRequirementsResponse,
  type RequirementProjectType,
} from '../requirements-api';

const PROJECT_TYPES: RequirementProjectType[] = [
  'RESIDENTIAL_SOLAR',
  'COMMERCIAL_SOLAR',
  'INDUSTRIAL_SOLAR',
  'OTHER_CUSTOM',
];

interface ProjectRequirementsPanelProps {
  projectId: string;
  projectType: RequirementProjectType | null;
  onProjectUpdated: () => void;
}

export function ProjectRequirementsPanel({
  projectId,
  projectType,
  onProjectUpdated,
}: ProjectRequirementsPanelProps) {
  const { locale } = useLocale();
  const [data, setData] = useState<ProjectRequirementsResponse | null>(null);
  const [history, setHistory] = useState<ProjectRequirementHistoryItem[]>([]);
  const [adoptions, setAdoptions] = useState<ProjectRequirementCatalogAdoptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initializingFolders, setInitializingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'APPLICABLE' | 'NOT_APPLICABLE' | ''>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [adoptionType, setAdoptionType] = useState<RequirementProjectType | ''>(projectType ?? '');
  const [adoptionReason, setAdoptionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requirementsResponse, historyResponse, adoptionsResponse] = await Promise.all([
        getProjectRequirements(projectId),
        getProjectRequirementHistory(projectId),
        getProjectCatalogAdoptions(projectId),
      ]);
      if (requirementsResponse.error || !requirementsResponse.data) {
        throw new Error(requirementsResponse.error || t('projects.requirements.load_error', locale));
      }
      setData(requirementsResponse.data);
      setHistory(historyResponse.data ?? []);
      setAdoptions(adoptionsResponse.data ?? []);
      setAdoptionType(requirementsResponse.data.projectType ?? '');
    } catch (err: unknown) {
      setError(err instanceof ApiError || err instanceof Error
        ? err.message
        : t('projects.requirements.load_error', locale));
    } finally {
      setLoading(false);
    }
  }, [locale, projectId]);

  useEffect(() => { void load(); }, [load]);

  const saveAssessment = async (requirementId: string | null, key: string) => {
    if (!requirementId) return;
    const state = decisions[key];
    const note = notes[key]?.trim();
    if (!state || !note) {
      setError(t('projects.requirements.assessment_required', locale));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await assessProjectRequirement(projectId, requirementId, { state, note });
      setMessage(t('projects.requirements.assessment_saved', locale));
      setDecisions((previous) => ({ ...previous, [key]: '' }));
      setNotes((previous) => ({ ...previous, [key]: '' }));
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError || err instanceof Error
        ? err.message
        : t('projects.requirements.assessment_error', locale));
    } finally {
      setBusy(false);
    }
  };

  const adoptLatestCatalog = async () => {
    const reason = adoptionReason.trim();
    if (!adoptionType || !reason) {
      setError(t('projects.requirements.adoption_required', locale));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await adoptLatestProjectCatalog(projectId, { projectType: adoptionType, reason });
      setAdoptionReason('');
      setMessage(t('projects.requirements.adoption_saved', locale));
      await load();
      onProjectUpdated();
    } catch (err: unknown) {
      setError(err instanceof ApiError || err instanceof Error
        ? err.message
        : t('projects.requirements.adoption_error', locale));
    } finally {
      setBusy(false);
    }
  };

  const initializeFolders = async () => {
    setInitializingFolders(true);
    setError(null);
    setMessage(null);
    try {
      const response = await initializeProjectFolders(projectId);
      if (response.error || !response.data) {
        throw new Error(response.error || t('projects.requirements.folder_init_error', locale));
      }
      setMessage(response.data.foldersCreated > 0
        ? t('projects.requirements.folder_init_success', locale)
        : t('projects.requirements.folder_init_unchanged', locale));
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError || err instanceof Error
        ? err.message
        : t('projects.requirements.folder_init_error', locale));
    } finally {
      setInitializingFolders(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2 sm:p-6" data-testid="project-requirements-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            {t('projects.requirements.title', locale)}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{t('projects.requirements.subtitle', locale)}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading || busy}>
          <RefreshCw className={`mr-1.5 size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('general.refresh', locale)}
        </Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-critical-soft bg-critical-soft px-3 py-2 text-sm text-critical-foreground">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-success-soft bg-success-soft px-3 py-2 text-sm text-success-foreground"><Check className="mr-1.5 inline size-4" aria-hidden="true" />{message}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500" role="status">{t('projects.requirements.loading', locale)}</p>
      ) : data ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>{t('projects.requirements.project_type', locale)}: <strong>{data.projectType ? t(`projects.requirements.type.${data.projectType}`, locale) : t('projects.requirements.untyped', locale)}</strong></span>
            <span>{t('projects.requirements.catalog_version', locale)}: <strong>{data.catalogVersion ? `${data.catalogVersion.displayName} · v${data.catalogVersion.version}` : '—'}</strong></span>
          </div>

          {!data.initialized && (
            <p className="mt-3 flex gap-2 rounded-lg border border-warning-soft bg-warning-soft/40 px-3 py-2 text-sm text-slate-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              {t('projects.requirements.not_initialized', locale)}
            </p>
          )}

          {data.canInitializeFolders && data.projectType && (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={initializingFolders || busy}
                onClick={() => void initializeFolders()}
              >
                {initializingFolders
                  ? t('projects.requirements.folder_init_loading', locale)
                  : t('projects.requirements.folder_init_action', locale)}
              </Button>
            </div>
          )}

          {data.requirements.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {data.requirements.map((requirement) => (
                <article key={requirement.definitionId} className="space-y-3 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{requirement.description}</h4>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{requirement.requirementKey}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {t(`projects.requirements.state.${requirement.state}`, locale)}
                    </span>
                  </div>

                  {data.canAssess && requirement.id && (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-end">
                      <label className="text-xs font-medium text-slate-600">
                        {t('projects.requirements.decision', locale)}
                        <select
                          aria-label={`${t('projects.requirements.decision', locale)}: ${requirement.requirementKey}`}
                          className="hii-select mt-1 w-full"
                          value={decisions[requirement.requirementKey] ?? ''}
                          onChange={(event) => setDecisions((previous) => ({
                            ...previous,
                            [requirement.requirementKey]: event.target.value as 'APPLICABLE' | 'NOT_APPLICABLE' | '',
                          }))}
                          disabled={busy}
                        >
                          <option value="">{t('projects.requirements.choose_decision', locale)}</option>
                          <option value="APPLICABLE">{t('projects.requirements.state.APPLICABLE', locale)}</option>
                          <option value="NOT_APPLICABLE">{t('projects.requirements.state.NOT_APPLICABLE', locale)}</option>
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        {t('projects.requirements.assessment_note', locale)}
                        <input
                          aria-label={`${t('projects.requirements.assessment_note', locale)}: ${requirement.requirementKey}`}
                          className="hii-input mt-1 w-full"
                          value={notes[requirement.requirementKey] ?? ''}
                          onChange={(event) => setNotes((previous) => ({ ...previous, [requirement.requirementKey]: event.target.value }))}
                          maxLength={1000}
                          disabled={busy}
                        />
                      </label>
                      <Button type="button" variant="secondary" size="sm" disabled={busy || !requirement.id} onClick={() => void saveAssessment(requirement.id, requirement.requirementKey)}>
                        {t('projects.requirements.save_decision', locale)}
                      </Button>
                    </div>
                  )}

                  {requirement.assessments.length > 0 && (
                    <details className="rounded-md bg-slate-50 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                        {t('projects.requirements.assessment_history', locale)} · {requirement.assessments.length}
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {requirement.assessments.map((assessment) => (
                          <li key={assessment.id} className="text-xs text-slate-600">
                            <span className="font-medium">{t(`projects.requirements.state.${assessment.previous_state ?? 'NOT_ASSESSED'}`, locale)} → {t(`projects.requirements.state.${assessment.new_state}`, locale)}</span>
                            <span className="ml-2">{assessment.assessor?.profile?.full_name ?? assessment.assessor?.email ?? assessment.assessed_by}</span>
                            <span className="ml-2 text-slate-400">{new Date(assessment.created_at).toLocaleString(locale)}</span>
                            {assessment.note && <p className="mt-1">{assessment.note}</p>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </div>
          ) : data.initialized ? (
            <p className="mt-4 text-sm text-slate-500">{t('projects.requirements.empty', locale)}</p>
          ) : null}

          {data.canAdopt && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-900">{t('projects.requirements.adopt_title', locale)}</h4>
              <p className="mt-1 text-xs text-slate-500">{t('projects.requirements.adopt_hint', locale)}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  {t('projects.requirements.project_type', locale)}
                  <select
                    aria-label={t('projects.requirements.project_type', locale)}
                    className="hii-select mt-1 w-full"
                    value={adoptionType}
                    onChange={(event) => setAdoptionType(event.target.value as RequirementProjectType | '')}
                    disabled={busy}
                  >
                    <option value="">{t('projects.requirements.choose_project_type', locale)}</option>
                    {PROJECT_TYPES.map((type) => <option key={type} value={type}>{t(`projects.requirements.type.${type}`, locale)}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  {t('projects.requirements.adoption_reason', locale)}
                  <textarea
                    aria-label={t('projects.requirements.adoption_reason', locale)}
                    className="hii-input mt-1 min-h-20 w-full"
                    value={adoptionReason}
                    onChange={(event) => setAdoptionReason(event.target.value)}
                    maxLength={1000}
                    disabled={busy}
                  />
                </label>
              </div>
              <Button type="button" variant="primary" className="mt-3" disabled={busy} onClick={() => void adoptLatestCatalog()}>
                {t('projects.requirements.adopt_action', locale)}
              </Button>
            </div>
          )}

          {adoptions.length > 0 && (
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                {t('projects.requirements.adoption_history', locale)} · {adoptions.length}
              </summary>
              <ul className="mt-3 space-y-3">
                {adoptions.map((adoption) => (
                  <li key={adoption.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold">
                      {adoption.from_catalog_version?.display_name ?? '—'} → {adoption.to_catalog_version.display_name}
                      <span className="ml-2 font-normal text-slate-500">
                        {adoption.previous_project_type ? t(`projects.requirements.type.${adoption.previous_project_type}`, locale) : '—'}
                        {' → '}{t(`projects.requirements.type.${adoption.new_project_type}`, locale)}
                      </span>
                    </p>
                    <p className="mt-1">{adoption.reason}</p>
                    <p className="mt-1 text-slate-500">
                      {adoption.reviewer?.profile?.full_name ?? adoption.reviewer?.email ?? adoption.reviewed_by}
                      {' · '}{new Date(adoption.created_at).toLocaleString(locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {history.length > 0 && (
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                {t('projects.requirements.all_history', locale)} · {history.length}
              </summary>
              <ul className="mt-3 space-y-3">
                {history.map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold">{item.definition.description}</p>
                    <p className="mt-0.5 text-slate-500">
                      {item.definition.requirement_key} · {item.definition.catalog_version.display_name}
                      {' · '}{t(`projects.requirements.state.${item.state}`, locale)}
                    </p>
                    {item.assessments.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                        {item.assessments.map((assessment) => (
                          <li key={assessment.id}>
                            <span className="font-medium">
                              {t(`projects.requirements.state.${assessment.previous_state ?? 'NOT_ASSESSED'}`, locale)} → {t(`projects.requirements.state.${assessment.new_state}`, locale)}
                            </span>
                            <span className="ml-2 text-slate-500">
                              {assessment.assessor?.profile?.full_name ?? assessment.assessor?.email ?? assessment.assessed_by}
                              {' · '}{new Date(assessment.created_at).toLocaleString(locale)}
                            </span>
                            {assessment.note && <p className="mt-0.5">{assessment.note}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : null}
    </section>
  );
}

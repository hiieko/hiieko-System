'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { t, useLocale } from '@solar/shared';

// Existing UI primitives
import { Modal, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

// API adapters
import { apiClient } from '@/lib/api-client';
import { createDailyPlan } from '../api';

// Components
import { TaskSelector } from './TaskSelector';

// Types
import type { SelectedPlanTask, CreatePlanDto } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  selectedDate: string;
  onPlanCreated?: (newPlanId: string) => void;
}

// ── Team ref type ──────────────────────────────────────────────────────────

interface TeamRef {
  id: string;
  name: string;
  code?: string;
}

// ── Main CreatePlanModal Component ────────────────────────────────────────

export function CreatePlanModal({
  open,
  onClose,
  projectId,
  selectedDate,
  onPlanCreated,
}: CreatePlanModalProps) {
  const { locale } = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();

  // Form state
  const [planDate, setPlanDate] = useState(selectedDate);
  const [teamId, setTeamId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<SelectedPlanTask[]>([]);

  // Teams loading
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when modal opens with fresh props
  useEffect(() => {
    if (open) {
      setPlanDate(selectedDate);
      setTeamId('');
      setNotes('');
      setSelectedTasks([]);
      setValidationError(null);
    }
  }, [open, selectedDate]);

  // Load teams when project changes and modal is open
  const loadTeams = useCallback(async () => {
    if (!projectId || !open) return;
    setLoadingTeams(true);
    try {
      const res = await apiClient.getTeams(projectId);
      setTeams((res.data || []) as TeamRef[]);
    } catch (err) {
      console.error('Failed to load teams for create plan:', err);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, [projectId, open]);

  useEffect(() => {
    if (open && projectId) {
      loadTeams();
    }
  }, [open, projectId, loadTeams]);


  const validate = useCallback((): string | null => {
    // Required: projectId
    if (!projectId) {
      return t('planning.no_project_selected', locale);
    }

    // Required: valid date
    if (!planDate) {
      return t('planning.err_date_required', locale);
    }

    // Required: at least one task selected
    if (selectedTasks.length === 0) {
      return t('planning.err_tasks_required', locale);
    }

    // All selected tasks must have valid quantity (>= 1)
    const invalidQty = selectedTasks.find((st) => st.targetQuantity < 1);
    if (invalidQty) {
      return t('planning.err_quantity_invalid', locale) + `: [${invalidQty.taskCode}]`;
    }

    return null;
  }, [projectId, planDate, selectedTasks, locale]);

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const validationErr = validate();
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }

    setValidationError(null);
    setSubmitting(true);

    // Build exact DTO as expected by backend
    const dto: CreatePlanDto = {
      projectId,
      planDate,
      tasks: selectedTasks.map((st) => ({
        taskId: st.taskId,
        targetQuantity: st.targetQuantity,
      })),
    };

    // Optional fields only if set
    if (teamId) {
      dto.teamId = teamId;
    }
    if (notes?.trim()) {
      dto.notes = notes.trim();
    }

    try {
      const res = await createDailyPlan(dto);

      if (res.error) {
        const msg = res.error || t('planning.create_error', locale);
        setValidationError(msg);
        toastError(t('planning.create_error', locale), msg);
      } else if (res.data) {
        toastSuccess(t('planning.plan_created', locale));
        const newPlanId = res.data.id;
        onClose();
        if (newPlanId && onPlanCreated) {
          onPlanCreated(newPlanId);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('planning.create_error', locale);
      setValidationError(msg);
      toastError(t('planning.create_error', locale), msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    projectId,
    planDate,
    teamId,
    notes,
    selectedTasks,
    locale,
    toastSuccess,
    toastError,
    onClose,
    onPlanCreated,
  ]);

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t('planning.create_modal_title', locale)}
      size="full"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {validationError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger-foreground"
          >
            {validationError}
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-content-secondary">
            {t('planning.field_date', locale)}
          </span>
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            disabled={submitting}
            className="rounded-lg border border-chrome-line px-3 py-2 text-sm text-content focus:border-accent focus:outline-none disabled:bg-surface-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-content-secondary">
            {t('planning.field_team', locale)}
          </span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={submitting || loadingTeams}
            className="rounded-lg border border-chrome-line px-3 py-2 text-sm text-content focus:border-accent focus:outline-none disabled:bg-surface-muted"
          >
            <option value="">
              {loadingTeams
                ? t('planning.loading_teams', locale)
                : t('planning.no_team_option', locale)}
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.code ? `${team.code} — ${team.name}` : team.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-content-secondary">
            {t('planning.field_tasks', locale)}
          </span>
          <TaskSelector
            projectId={projectId}
            selectedTasks={selectedTasks}
            onSelectionChange={setSelectedTasks}
            disabled={submitting}
          />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-content-secondary">
            {t('planning.field_notes', locale)}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder={t('planning.field_notes_placeholder', locale)}
            className="rounded-lg border border-chrome-line px-3 py-2 text-sm text-content focus:border-accent focus:outline-none disabled:bg-surface-muted"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {t('planning.cancel', locale)}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !projectId} loading={submitting}>
            {submitting ? t('planning.submit_creating', locale) : t('planning.create', locale)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


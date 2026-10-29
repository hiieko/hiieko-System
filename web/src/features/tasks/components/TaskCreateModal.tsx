'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import {
  Plus,
  FolderTree,
  MapPin,
  Calendar,
  FileText,
  Layers3,
  Package,
  Users,
  Hash,
} from 'lucide-react';

import { Modal, Button, Skeleton } from '@/components/ui';
import { Task, CreateTaskDto } from '../types';
import { ProjectStage, ProjectZone } from '../../projects/types';
import { createTask } from '../api';
import { getProjectStages, getProject } from '../../projects/api';

interface TaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  onCreated: (task: Task) => void;
}

// Form state interface
interface TaskCreateForm {
  title: string;
  description: string;
  workPackageId: string;
  zoneId: string;
  plannedStart: string;
  plannedEnd: string;
  plannedQuantity: string;
  unitOfMeasure: string;
}

const initialForm: TaskCreateForm = {
  title: '',
  description: '',
  workPackageId: '',
  zoneId: '',
  plannedStart: '',
  plannedEnd: '',
  plannedQuantity: '',
  unitOfMeasure: '',
};

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-chrome-line bg-white">
      <div className="flex items-start gap-2 border-b border-chrome-line/70 px-4 py-3">
        <span className="mt-0.5 text-hii-600" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-content">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-content-muted">{description}</p>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function TaskCreateModal({
  open,
  onClose,
  projectId,
  onCreated,
}: TaskCreateModalProps) {
  const { locale } = useLocale();
  const tr = useCallback((key: string) => t(key, locale), [locale]);

  // Form state
  const [form, setForm] = useState<TaskCreateForm>(initialForm);

  // Loading states
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creating, setCreating] = useState(false);

  // Data options
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [zones, setZones] = useState<ProjectZone[]>([]);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset form on open
  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError(null);
      setFieldErrors({});
      setStages([]);
      setZones([]);

      // Load options if projectId is available
      if (projectId) {
        loadProjectOptions(projectId);
      }
    }
  }, [open, projectId]);

  // Load stages (with work packages) and zones
  const loadProjectOptions = useCallback(async (pid: string) => {
    setLoadingOptions(true);
    setError(null);

    try {
      // Load stages with work packages
      const [stagesRes, projectRes] = await Promise.all([
        getProjectStages(pid),
        getProject(pid),
      ]);

      if (stagesRes.data && !stagesRes.error) {
        setStages(stagesRes.data);
      }

      if (projectRes.data?.zones && !projectRes.error) {
        setZones(projectRes.data.zones);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('task.err_generic')
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [tr]);

  // Update form field
  const updateField = (field: keyof TaskCreateForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const fieldsToClear = field === 'plannedStart' || field === 'plannedEnd'
      ? ['plannedStart', 'plannedEnd']
      : [field];
    if (fieldsToClear.some((candidate) => fieldErrors[candidate])) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        fieldsToClear.forEach((candidate) => delete next[candidate]);
        return next;
      });
    }
  };

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = tr('task.err_required');
    }

    // Validate planned quantity is a valid number if provided
    if (form.plannedQuantity) {
      const qty = parseFloat(form.plannedQuantity);
      if (isNaN(qty) || qty < 0) {
        errors.plannedQuantity = tr('planning.err_quantity_invalid');
      }
    }

    if (form.plannedStart && form.plannedEnd && form.plannedEnd < form.plannedStart) {
      errors.plannedEnd = tr('task.err_date_order');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      setError(tr('task.select_project_first'));
      return;
    }

    if (!validate()) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const dto: CreateTaskDto = {
        projectId,
        title: form.title.trim(),
        ...(form.description && { description: form.description }),
        ...(form.workPackageId && { workPackageId: form.workPackageId }),
        ...(form.zoneId && { zoneId: form.zoneId }),
        ...(form.plannedStart && { plannedStart: form.plannedStart }),
        ...(form.plannedEnd && { plannedEnd: form.plannedEnd }),
        ...(form.plannedQuantity && { plannedQuantity: parseFloat(form.plannedQuantity) }),
        ...(form.unitOfMeasure && { unitOfMeasure: form.unitOfMeasure }),
      };

      const res = await createTask(dto);

      if (res.data && !res.error) {
        onCreated(res.data);
        onClose();
      } else {
        setError(res.error || tr('task.err_generic'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('task.err_generic')
      );
    } finally {
      setCreating(false);
    }
  };

  // Flatten work packages from all stages
  const allWorkPackages = stages.flatMap((stage) =>
    (stage.work_packages || []).map((wp: any) => ({
      ...wp,
      stageName: stage.name,
    }))
  );

  // No project selected
if (!projectId) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={tr('task.create_title')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {tr('task.cancel')}
            </Button>
          </div>
        }
      >
        <div className="py-8 text-center text-slate-500">
          {tr('task.select_project_first')}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('task.create_title')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={creating}
          >
            {tr('task.cancel')}
          </Button>
          <Button
            type="submit"
            form="task-create-form"
            loading={creating}
            disabled={loadingOptions}
            icon={<Plus className="w-4 h-4" />}
          >
            {tr('task.create')}
          </Button>
        </div>
      }
    >
      <form
        id="task-create-form"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={loadingOptions || creating}
        className="space-y-4"
      >
        {/* Error message */}
        {error && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/20 rounded-lg text-sm text-danger-foreground">
            {error}
          </div>
        )}

        {/* Loading options */}
        {loadingOptions && (
          <div role="status" aria-label={tr('general.loading')} className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {/* Form fields */}
        {!loadingOptions && (
          <div className="space-y-3">
            <FormSection
              title={tr('task.section_basic')}
              icon={<FileText className="h-4 w-4" />}
            >
              <div className="space-y-3">
                <div>
                  <label htmlFor="task-title" className="hii-label">
                    {tr('task.field_title')}{' '}
                    <span aria-hidden="true" className="text-danger">
                      *
                    </span>
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className={clsx(
                      'hii-input',
                      fieldErrors.title && '!border-danger/30 !bg-danger-soft',
                    )}
                    placeholder={tr('task.field_title')}
                    required
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={fieldErrors.title ? 'task-title-error' : undefined}
                  />
                  {fieldErrors.title && (
                    <p id="task-title-error" role="alert" className="mt-1 text-xs text-danger">
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-hii-100 bg-hii-50 px-3 py-2 text-xs leading-5 text-content-secondary">
                  <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hii-600" aria-hidden="true" />
                  <span>{tr('task.code_auto')}</span>
                </div>

                <div>
                  <label htmlFor="task-description" className="hii-label">
                    {tr('task.field_description')}
                  </label>
                  <textarea
                    id="task-description"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={2}
                    className="hii-input min-h-20 resize-none py-2"
                    placeholder={tr('task.field_description')}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title={tr('task.section_location')}
              icon={<Layers3 className="h-4 w-4" />}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-work-package" className="hii-label">
                    {tr('task.field_work_package')}
                  </label>
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <select
                      id="task-work-package"
                      value={form.workPackageId}
                      onChange={(e) => updateField('workPackageId', e.target.value)}
                      className="hii-select flex-1"
                    >
                      <option value="">{tr('task.none_option')}</option>
                      {allWorkPackages.map((wp: any) => (
                        <option key={wp.id} value={wp.id}>
                          {wp.stageName} — {wp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="task-zone" className="hii-label">
                    {tr('task.field_zone')}
                  </label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <select
                      id="task-zone"
                      value={form.zoneId}
                      onChange={(e) => updateField('zoneId', e.target.value)}
                      className="hii-select flex-1"
                    >
                      <option value="">{tr('task.none_option')}</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              title={tr('task.section_schedule')}
              icon={<Calendar className="h-4 w-4" />}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-planned-start" className="hii-label">
                    {tr('task.planned_start')}
                  </label>
                  <input
                    id="task-planned-start"
                    type="date"
                    value={form.plannedStart}
                    max={form.plannedEnd || undefined}
                    onChange={(e) => updateField('plannedStart', e.target.value)}
                    className="hii-input"
                  />
                </div>
                <div>
                  <label htmlFor="task-planned-end" className="hii-label">
                    {tr('task.planned_end')}
                  </label>
                  <input
                    id="task-planned-end"
                    type="date"
                    value={form.plannedEnd}
                    min={form.plannedStart || undefined}
                    onChange={(e) => updateField('plannedEnd', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.plannedEnd)}
                    aria-describedby={
                      fieldErrors.plannedEnd ? 'task-planned-end-error' : undefined
                    }
                    className={clsx(
                      'hii-input',
                      fieldErrors.plannedEnd && '!border-danger/30 !bg-danger-soft',
                    )}
                  />
                  {fieldErrors.plannedEnd && (
                    <p id="task-planned-end-error" role="alert" className="mt-1 text-xs text-danger">
                      {fieldErrors.plannedEnd}
                    </p>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection
              title={tr('task.section_quantity')}
              icon={<Package className="h-4 w-4" />}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-planned-quantity" className="hii-label">
                    {tr('task.field_planned_qty')}
                  </label>
                  <input
                    id="task-planned-quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={form.plannedQuantity}
                    onChange={(e) => updateField('plannedQuantity', e.target.value)}
                    className={clsx(
                      'hii-input',
                      fieldErrors.plannedQuantity && '!border-danger/30 !bg-danger-soft',
                    )}
                    placeholder="0"
                    aria-invalid={Boolean(fieldErrors.plannedQuantity)}
                    aria-describedby={
                      fieldErrors.plannedQuantity
                        ? 'task-planned-quantity-error'
                        : undefined
                    }
                  />
                  {fieldErrors.plannedQuantity && (
                    <p
                      id="task-planned-quantity-error"
                      role="alert"
                      className="mt-1 text-xs text-danger"
                    >
                      {fieldErrors.plannedQuantity}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="task-unit-of-measure" className="hii-label">
                    {tr('task.field_uom')}
                  </label>
                  <input
                    id="task-unit-of-measure"
                    type="text"
                    value={form.unitOfMeasure}
                    onChange={(e) => updateField('unitOfMeasure', e.target.value)}
                    className="hii-input"
                    placeholder="buc, mp, ore, kg..."
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title={tr('task.section_assignment')}
              icon={<Users className="h-4 w-4" />}
            >
              <p className="text-xs leading-5 text-content-secondary">
                {tr('task.assignment_after_create')}
              </p>
            </FormSection>
          </div>
        )}
      </form>
    </Modal>
  );
}


'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { t } from '@solar/shared';
import { Plus, FolderTree, MapPin, Calendar, Hash } from 'lucide-react';

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
  code: string;
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
  code: '',
  description: '',
  workPackageId: '',
  zoneId: '',
  plannedStart: '',
  plannedEnd: '',
  plannedQuantity: '',
  unitOfMeasure: '',
};

export function TaskCreateModal({
  open,
  onClose,
  projectId,
  onCreated,
}: TaskCreateModalProps) {
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
        err instanceof Error ? err.message : t('task.err_generic')
      );
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  // Update form field
  const updateField = (field: keyof TaskCreateForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user types
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = t('task.err_required');
    }
    if (!form.code.trim()) {
      errors.code = t('task.err_required');
    }

    // Validate planned quantity is a valid number if provided
    if (form.plannedQuantity) {
      const qty = parseFloat(form.plannedQuantity);
      if (isNaN(qty) || qty < 0) {
        errors.plannedQuantity = 'Cantitate invalidă';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      setError(t('task.select_project_first'));
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
        code: form.code.trim(),
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
        setError(res.error || t('task.err_generic'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('task.err_generic')
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
        title={t('task.create_title')}
        size="md"
      >
        <div className="py-8 text-center text-slate-500">
          {t('task.select_project_first')}
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('task.cancel')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('task.create_title')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading options */}
        {loadingOptions && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {/* Form fields */}
        {!loadingOptions && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('task.field_title')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 text-sm border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500',
                  fieldErrors.title && 'border-red-300 bg-red-50'
                )}
                placeholder={t('task.field_title')}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.title}</p>
              )}
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('task.field_code')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value)}
                  className={clsx(
                    'flex-1 px-3 py-2 text-sm font-mono border rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500',
                    fieldErrors.code && 'border-red-300 bg-red-50'
                  )}
                  placeholder="TASK-001"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {t('task.field_code_hint')}
              </p>
              {fieldErrors.code && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.code}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('task.field_description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 resize-none"
                placeholder={t('task.field_description')}
              />
            </div>

            {/* Work Package and Zone - row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Work Package */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('task.field_work_package')}
                </label>
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={form.workPackageId}
                    onChange={(e) => updateField('workPackageId', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 bg-white"
                  >
                    <option value="">{t('task.none_option')}</option>
                    {allWorkPackages.map((wp: any) => (
                      <option key={wp.id} value={wp.id}>
                        {wp.stageName} — {wp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('task.field_zone')}
                </label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={form.zoneId}
                    onChange={(e) => updateField('zoneId', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 bg-white"
                  >
                    <option value="">{t('task.none_option')}</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Planned Quantity and UoM - row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Planned Quantity */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('task.field_planned_qty')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.plannedQuantity}
                  onChange={(e) => updateField('plannedQuantity', e.target.value)}
                  className={clsx(
                    'w-full px-3 py-2 text-sm border rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500',
                    fieldErrors.plannedQuantity && 'border-red-300 bg-red-50'
                  )}
                  placeholder="0"
                />
                {fieldErrors.plannedQuantity && (
                  <p className="mt-1 text-xs text-red-500">
                    {fieldErrors.plannedQuantity}
                  </p>
                )}
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('task.field_uom')}
                </label>
                <input
                  type="text"
                  value={form.unitOfMeasure}
                  onChange={(e) => updateField('unitOfMeasure', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500"
                  placeholder="buc, mp, ore, kg..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={creating}
          >
            {t('task.cancel')}
          </Button>
          <Button
            type="submit"
            loading={creating}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('task.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


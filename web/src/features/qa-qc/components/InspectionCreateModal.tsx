'use client';

import React, { useEffect, useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { apiClient, ApiError } from '../../../lib/api-client';
import type { CreateInspectionDto, Inspection } from '../types';

interface MeasurementDraft {
  parameter: string;
  value: string;
  unit: string;
  passed: boolean;
}

interface InspectionCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Supplied by the page from project context — no project selector here. */
  projectId: string;
  locale: Locale;
  /** Called with the created inspection after a successful POST /api/qa-qc/inspections. */
  onCreated: (inspection: Inspection) => void;
}

const EMPTY_MEASUREMENT: MeasurementDraft = { parameter: '', value: '', unit: '', passed: true };

/** Exactly the real CreateInspectionDto fields: inspectorName* (projectId from context),
 *  measurements optional rows { parameter, value, unit, passed }.
 *  Status ('COMPLETED') and inspected_at are server-assigned and never client-supplied.
 *  Entered values are preserved across failed submits. */
export function InspectionCreateModal({ open, onClose, projectId, locale, onCreated }: InspectionCreateModalProps) {
  const toast = useToast();
  const [inspectorName, setInspectorName] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const fieldClass =
    'w-full px-3 py-2.5 border border-chrome-line rounded-lg text-sm text-content bg-surface focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-60';

  // Fresh form each time the modal opens.
  useEffect(() => {
    if (open) {
      setInspectorName('');
      setMeasurements([]);
      setValidationError(null);
      setApiError(null);
    }
  }, [open]);

  const updateMeasurement = (index: number, patch: Partial<MeasurementDraft>) => {
    setMeasurements((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setValidationError(t('qa.form_error_no_project', locale));
      return;
    }
    const trimmedInspector = inspectorName.trim();
    if (!trimmedInspector) {
      setValidationError(t('qa.form_error_required', locale));
      return;
    }
    // Only fully-filled measurement rows are submitted; partial rows are dropped.
    const dtoMeasurements = measurements
      .filter((m) => m.parameter.trim() && m.value.trim() && m.unit.trim())
      .map((m) => ({
        parameter: m.parameter.trim(),
        value: Number(m.value),
        unit: m.unit.trim(),
        passed: m.passed,
      }))
      .filter((m) => !isNaN(m.value));

    const payload: CreateInspectionDto = {
      projectId,
      inspectorName: trimmedInspector,
      ...(dtoMeasurements.length > 0 ? { measurements: dtoMeasurements } : {}),
    };

    setSubmitting(true);
    setValidationError(null);
    setApiError(null);
    try {
      const response = await apiClient.createInspection(payload);
      toast.success(t('qa.toast_success', locale), t('qa.toast_success_message', locale));
      setInspectorName('');
      setMeasurements([]);
      onClose();
      if (response.data) onCreated(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('qa.toast_error', locale);
      setApiError(message);
      toast.error(t('qa.toast_error', locale), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('qa.create_title', locale)} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {validationError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {validationError}
          </p>
        )}
        {apiError && <ErrorState title={t('qa.toast_error', locale)} message={apiError} className="py-4" />}

        <div>
          <label htmlFor="inspection-create-inspector" className="block text-xs font-semibold text-content-secondary mb-1">
            {t('qa.field_inspector', locale)} *
          </label>
          <input
            id="inspection-create-inspector"
            type="text"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            placeholder={t('qa.field_inspector_placeholder', locale)}
            aria-required="true"
            disabled={submitting}
            className={fieldClass}
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-content-secondary mb-1">
            {t('qa.field_measurements', locale)}
          </span>
          <p className="text-xs text-content-muted mb-2">{t('qa.measurement_hint', locale)}</p>
          {measurements.length > 0 && (
            <div className="space-y-2">
              {measurements.map((m, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`measurement-parameter-${index}`} className="sr-only">
                      {t('qa.field_parameter', locale)}
                    </label>
                    <input
                      id={`measurement-parameter-${index}`}
                      type="text"
                      value={m.parameter}
                      onChange={(e) => updateMeasurement(index, { parameter: e.target.value })}
                      placeholder={t('qa.field_parameter', locale)}
                      disabled={submitting}
                      className={fieldClass}
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor={`measurement-value-${index}`} className="sr-only">
                      {t('qa.field_value', locale)}
                    </label>
                    <input
                      id={`measurement-value-${index}`}
                      type="number"
                      step="any"
                      value={m.value}
                      onChange={(e) => updateMeasurement(index, { value: e.target.value })}
                      placeholder={t('qa.field_value', locale)}
                      disabled={submitting}
                      className={fieldClass}
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor={`measurement-unit-${index}`} className="sr-only">
                      {t('qa.field_unit', locale)}
                    </label>
                    <input
                      id={`measurement-unit-${index}`}
                      type="text"
                      value={m.unit}
                      onChange={(e) => updateMeasurement(index, { unit: e.target.value })}
                      placeholder={t('qa.field_unit', locale)}
                      disabled={submitting}
                      className={fieldClass}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-content-secondary pb-2.5">
                    <input
                      type="checkbox"
                      checked={m.passed}
                      onChange={(e) => updateMeasurement(index, { passed: e.target.checked })}
                      disabled={submitting}
                      className="h-4 w-4 rounded border-chrome-line"
                    />
                    {t('qa.field_passed', locale)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setMeasurements((prev) => prev.filter((_, i) => i !== index))}
                    disabled={submitting}
                    aria-label={t('qa.remove_measurement', locale)}
                    className="p-2 rounded-lg text-content-muted hover:bg-surface-muted hover:text-content-secondary focus:outline-none focus:ring-2 focus:ring-hii-500"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMeasurements((prev) => [...prev, { ...EMPTY_MEASUREMENT }])}
            disabled={submitting}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-hii-600 hover:text-hii-700 focus:outline-none focus:ring-2 focus:ring-hii-500 rounded px-1 py-0.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('qa.add_measurement', locale)}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {t('general.cancel', locale)}
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? t('qa.submit_creating', locale) : t('qa.submit', locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


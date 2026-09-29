'use client';

import React, { useEffect, useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { createIssue } from '../api';
import { ISSUE_SEVERITY_LABEL_KEYS, ISSUE_SEVERITY_VALUES } from '../constants';
import type { Issue, IssueSeverity } from '../types';

interface IssueCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Supplied by the page from project context — no project selector here. */
  projectId: string;
  locale: Locale;
  /** Called with the created issue after a successful POST /api/issues (backend forces status=OPEN). */
  onCreated: (issue: Issue) => void;
}

/** Exactly the real CreateIssueDto fields: title*, description*, severity (default MEDIUM).
 *  No status/reporter/assignee/task/due-date fields exist on the backend and none are offered.
 *  Entered values are preserved across failed submits. */
export function IssueCreateModal({ open, onClose, projectId, locale, onCreated }: IssueCreateModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const fieldClass =
    'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-60';

  // Fresh form each time the modal opens.
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setSeverity('MEDIUM');
      setValidationError(null);
      setApiError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setValidationError(t('issues.form_error_required', locale));
      return;
    }
    setSubmitting(true);
    setValidationError(null);
    setApiError(null);
    try {
      const response = await createIssue({
        projectId,
        title: trimmedTitle,
        description: trimmedDescription,
        severity,
      });
      toast.success(t('issues.toast_success', locale), t('issues.toast_success_message', locale));
      setTitle('');
      setDescription('');
      setSeverity('MEDIUM');
      onClose();
      if (response.data) onCreated(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('issues.toast_error', locale);
      setApiError(message);
      toast.error(t('issues.toast_error', locale), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('issues.create_title', locale)} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {validationError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {validationError}
          </p>
        )}
        {apiError && <ErrorState title={t('issues.toast_error', locale)} message={apiError} className="py-4" />}

        <div>
          <label htmlFor="issue-create-title" className="block text-xs font-semibold text-slate-700 mb-1">
            {t('issues.field_title', locale)} *
          </label>
          <input
            id="issue-create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('issues.field_title_placeholder', locale)}
            aria-required="true"
            disabled={submitting}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="issue-create-description" className="block text-xs font-semibold text-slate-700 mb-1">
            {t('issues.field_description', locale)} *
          </label>
          <textarea
            id="issue-create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('issues.field_description_placeholder', locale)}
            rows={4}
            aria-required="true"
            disabled={submitting}
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="issue-create-severity" className="block text-xs font-semibold text-slate-700 mb-1">
            {t('issues.field_severity', locale)}
          </label>
          <select
            id="issue-create-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
            disabled={submitting}
            className={`${fieldClass} bg-white`}
          >
            {ISSUE_SEVERITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(ISSUE_SEVERITY_LABEL_KEYS[value], locale)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {t('general.cancel', locale)}
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? t('issues.submit_creating', locale) : t('issues.submit', locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { apiClient, ApiError } from '../../../lib/api-client';
import type { CreateWarehouseDto, Warehouse } from '../types';

interface WarehouseCreateModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onCreated: (warehouse: Warehouse) => void;
}

const fieldClass =
  'w-full px-3 py-2.5 border border-chrome-line rounded-lg text-sm text-content bg-surface focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-60';

export function WarehouseCreateModal({ open, onClose, locale, onCreated }: WarehouseCreateModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(''); setCode(''); setAddress('');
    setValidationError(null); setApiError(null);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) {
      setValidationError(t('depozite.form_error_required', locale));
      return;
    }
    setValidationError(null); setApiError(null); setSubmitting(true);
    const payload: CreateWarehouseDto = {
      name: trimmedName,
      code: trimmedCode,
      ...(address.trim() ? { address: address.trim() } : {}),
    };
    try {
      const response = await apiClient.createWarehouse(payload);
      toast.success(t('depozite.toast_success', locale), t('depozite.toast_success_message', locale));
      setName(''); setCode(''); setAddress('');
      onClose();
      if (response.data) onCreated(response.data as Warehouse);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('depozite.toast_error', locale);
      setApiError(message);
      toast.error(t('depozite.toast_error', locale), message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('depozite.create_title', locale)} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {validationError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-danger-soft border border-danger/20 text-sm text-danger-foreground">{validationError}</p>
        )}
        {apiError && <ErrorState title={t('depozite.toast_error', locale)} message={apiError} className="py-3" />}

        <div>
          <label htmlFor="warehouse-create-name" className="block text-xs font-semibold text-content-secondary mb-1">{t('depozite.field_name', locale)} *</label>
          <input id="warehouse-create-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('depozite.field_name_placeholder', locale)} aria-required="true" disabled={submitting} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="warehouse-create-code" className="block text-xs font-semibold text-content-secondary mb-1">{t('depozite.field_code', locale)} *</label>
          <input id="warehouse-create-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('depozite.field_code_placeholder', locale)} aria-required="true" disabled={submitting} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="warehouse-create-address" className="block text-xs font-semibold text-content-secondary mb-1">{t('depozite.field_address', locale)}</label>
          <input id="warehouse-create-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={submitting} className={fieldClass} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('general.cancel', locale)}</Button>
          <Button type="submit" variant="primary" loading={submitting}>{submitting ? t('depozite.submit_creating', locale) : t('depozite.submit', locale)}</Button>
        </div>
      </form>
    </Modal>
  );
}

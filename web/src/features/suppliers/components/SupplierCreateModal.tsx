'use client';

import React, { useEffect, useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { apiClient, ApiError } from '../../../lib/api-client';
import type { CreateSupplierDto, Supplier } from '../types';

interface SupplierCreateModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onCreated: (supplier: Supplier) => void;
}

const fieldClass =
  'w-full px-3 py-2.5 border border-chrome-line rounded-lg text-sm text-content bg-surface focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-60';

export function SupplierCreateModal({ open, onClose, locale, onCreated }: SupplierCreateModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [cui, setCui] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(''); setCui(''); setAddress(''); setContactPerson(''); setContactEmail(''); setContactPhone('');
    setValidationError(null); setApiError(null);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setValidationError(t('suppliers.form_error_required', locale)); return; }
    setValidationError(null); setApiError(null); setSubmitting(true);
    const payload: CreateSupplierDto = {
      name: trimmedName,
      ...(cui.trim() ? { cui: cui.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(contactPerson.trim() ? { contactPerson: contactPerson.trim() } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
    };
    try {
      const response = await apiClient.createSupplier(payload);
      toast.success(t('suppliers.toast_success', locale), t('suppliers.toast_success_message', locale));
      setName(''); setCui(''); setAddress(''); setContactPerson(''); setContactEmail(''); setContactPhone('');
      onClose();
      if (response.data) onCreated(response.data as Supplier);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('suppliers.toast_error', locale);
      setApiError(message);
      toast.error(t('suppliers.toast_error', locale), message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('suppliers.create_title', locale)} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {validationError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-danger-soft border border-danger/20 text-sm text-danger-foreground">{validationError}</p>
        )}
        {apiError && <ErrorState title={t('suppliers.toast_error', locale)} message={apiError} className="py-3" />}

        <div>
          <label htmlFor="supplier-create-name" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_name', locale)} *</label>
          <input id="supplier-create-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('suppliers.field_name_placeholder', locale)} aria-required="true" disabled={submitting} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="supplier-create-cui" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_cui', locale)}</label>
          <input id="supplier-create-cui" type="text" value={cui} onChange={(e) => setCui(e.target.value)} disabled={submitting} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="supplier-create-address" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_address', locale)}</label>
          <input id="supplier-create-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={submitting} className={fieldClass} />
        </div>

        <div>
          <label htmlFor="supplier-create-contact-person" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_contact_person', locale)}</label>
          <input id="supplier-create-contact-person" type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} disabled={submitting} className={fieldClass} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="supplier-create-contact-email" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_contact_email', locale)}</label>
            <input id="supplier-create-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={submitting} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="supplier-create-contact-phone" className="block text-xs font-semibold text-content-secondary mb-1">{t('suppliers.field_contact_phone', locale)}</label>
            <input id="supplier-create-contact-phone" type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={submitting} className={fieldClass} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('general.cancel', locale)}</Button>
          <Button type="submit" variant="primary" loading={submitting}>{submitting ? t('suppliers.submit_creating', locale) : t('suppliers.submit', locale)}</Button>
        </div>
      </form>
    </Modal>
  );
}

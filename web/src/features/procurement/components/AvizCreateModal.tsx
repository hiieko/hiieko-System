'use client';

import React, { useEffect, useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { apiClient, ApiError } from '../../../lib/api-client';
import type { Aviz, CreateAvizDto, MaterialRef, SupplierRef } from '../types';

interface ItemDraft {
  materialId: string;
  quantity: string;
}

interface AvizCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Supplied by the page from project context — no project selector here. */
  projectId: string;
  locale: Locale;
  /** Called with the created aviz after a successful POST /api/procurement/avize. */
  onCreated: (aviz: Aviz) => void;
}

const EMPTY_ITEM: ItemDraft = { materialId: '', quantity: '' };

/** Exactly the real CreateAvizDto fields: avizNumber*, deliveryDate*, items{materialId*, quantity*}
 *  (+ optional supplierId/driver/plate/notes). No currency/amount/unit/PO fields exist on the
 *  backend and none are sent. Stock posting is server-side (atomic transaction); duplicate
 *  avizNumber for the same project → 409, surfaced as a translated error. Entered values are
 *  preserved across failed submits. */
export function AvizCreateModal({ open, onClose, projectId, locale, onCreated }: AvizCreateModalProps) {
  const toast = useToast();
  const [avizNumber, setAvizNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [materials, setMaterials] = useState<MaterialRef[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const fieldClass =
    'w-full px-3 py-2.5 border border-chrome-line rounded-lg text-sm text-content bg-surface focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-60';

  // Fresh form + lookup data each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setAvizNumber('');
    setDeliveryDate('');
    setSupplierId('');
    setDriverName('');
    setVehiclePlate('');
    setNotes('');
    setItems([]);
    setValidationError(null);
    setApiError(null);
    let cancelled = false;
    (async () => {
      try {
        const [matRes, supRes] = await Promise.all([
          apiClient.getMaterials(),
          apiClient.getSuppliers().catch(() => ({ data: [] as SupplierRef[] })),
        ]);
        if (cancelled) return;
        setMaterials(((matRes.data || []) as MaterialRef[]).filter((m) => m.is_active !== false));
        setSuppliers((supRes.data || []) as SupplierRef[]);
      } catch {
        if (!cancelled) setMaterials([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setValidationError(t('avize.form_error_no_project', locale));
      return;
    }
    const trimmedNumber = avizNumber.trim();
    // Only fully-filled item rows are submitted; partial rows are dropped.
    const dtoItems = items
      .filter((it) => it.materialId && it.quantity.trim())
      .map((it) => ({ materialId: it.materialId, quantity: Number(it.quantity) }))
      .filter((it) => !isNaN(it.quantity) && it.quantity > 0);

    if (!trimmedNumber || !deliveryDate || dtoItems.length === 0) {
      setValidationError(t('avize.form_error_required', locale));
      return;
    }

    const payload: CreateAvizDto = {
      projectId,
      avizNumber: trimmedNumber,
      deliveryDate,
      items: dtoItems,
      ...(supplierId ? { supplierId } : {}),
      ...(driverName.trim() ? { driverName: driverName.trim() } : {}),
      ...(vehiclePlate.trim() ? { vehiclePlate: vehiclePlate.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    setSubmitting(true);
    setValidationError(null);
    setApiError(null);
    try {
      const response = await apiClient.createAviz(payload);
      toast.success(t('avize.toast_success', locale), t('avize.toast_success_message', locale));
      setAvizNumber('');
      setDeliveryDate('');
      setSupplierId('');
      setDriverName('');
      setVehiclePlate('');
      setNotes('');
      setItems([]);
      onClose();
      if (response.data) onCreated(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('avize.toast_error', locale);
      setApiError(message);
      toast.error(t('avize.toast_error', locale), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('avize.create_title', locale)} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {validationError && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-danger-soft border border-danger/20 text-sm text-danger-foreground">
            {validationError}
          </p>
        )}
        {apiError && <ErrorState title={t('avize.toast_error', locale)} message={apiError} className="py-4" />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="aviz-create-number" className="block text-xs font-semibold text-content-secondary mb-1">
              {t('avize.field_aviz_number', locale)} *
            </label>
            <input
              id="aviz-create-number"
              type="text"
              value={avizNumber}
              onChange={(e) => setAvizNumber(e.target.value)}
              placeholder={t('avize.field_aviz_number_placeholder', locale)}
              aria-required="true"
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="aviz-create-date" className="block text-xs font-semibold text-content-secondary mb-1">
              {t('avize.field_delivery_date', locale)} *
            </label>
            <input
              id="aviz-create-date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              aria-required="true"
              disabled={submitting}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="aviz-create-supplier" className="block text-xs font-semibold text-content-secondary mb-1">
              {t('avize.field_supplier', locale)}
            </label>
            <select
              id="aviz-create-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={submitting}
              className={fieldClass}
            >
              <option value="">
                {suppliers.length === 0 ? t('avize.field_supplier_none', locale) : '—'}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="aviz-create-driver" className="block text-xs font-semibold text-content-secondary mb-1">
                {t('avize.field_driver', locale)}
              </label>
              <input
                id="aviz-create-driver"
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                disabled={submitting}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="aviz-create-vehicle" className="block text-xs font-semibold text-content-secondary mb-1">
                {t('avize.field_vehicle', locale)}
              </label>
              <input
                id="aviz-create-vehicle"
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                disabled={submitting}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="aviz-create-notes" className="block text-xs font-semibold text-content-secondary mb-1">
            {t('avize.field_notes', locale)}
          </label>
          <textarea
            id="aviz-create-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={submitting}
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-content-secondary mb-1">
              {t('avize.field_items', locale)} *
            </span>
            <p className="text-xs text-content-muted mb-2">{t('avize.items_hint', locale)}</p>
            {materials.length === 0 && (
              <p className="text-xs text-content-muted px-3 py-2 rounded-lg bg-surface-muted border border-chrome-line">
                {t('avize.materials_unavailable', locale)}
              </p>
            )}
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((it, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label htmlFor={`aviz-item-material-${index}`} className="sr-only">
                        {t('avize.field_material', locale)}
                      </label>
                      <select
                        id={`aviz-item-material-${index}`}
                        value={it.materialId}
                        onChange={(e) => updateItem(index, { materialId: e.target.value })}
                        disabled={submitting}
                        aria-required="true"
                        className={fieldClass}
                      >
                        <option value="">{t('avize.field_material', locale)}</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {`${m.code} — ${m.name} (${m.unit})`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label htmlFor={`aviz-item-quantity-${index}`} className="sr-only">
                        {t('avize.field_quantity', locale)}
                      </label>
                      <input
                        id={`aviz-item-quantity-${index}`}
                        type="number"
                        step="any"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        placeholder={t('avize.field_quantity', locale)}
                        disabled={submitting}
                        aria-required="true"
                        className={fieldClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      disabled={submitting}
                      aria-label={t('avize.remove_item', locale)}
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
              onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
              disabled={submitting || materials.length === 0}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-hii-600 hover:text-hii-700 focus:outline-none focus:ring-2 focus:ring-hii-500 rounded px-1 py-0.5 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('avize.add_item', locale)}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              {t('general.cancel', locale)}
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {submitting ? t('avize.submit_creating', locale) : t('avize.submit', locale)}
            </Button>
          </div>
        </form>
      </Modal>
  );
}
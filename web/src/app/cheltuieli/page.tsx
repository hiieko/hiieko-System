'use client';
import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { FieldHelp } from '../../components/FieldHelp';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Receipt, Plus, Search, Upload, RefreshCw, SlidersHorizontal, Check } from 'lucide-react';
import { t, Expense, OcrResult, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { Button, Card, Badge, Modal, ErrorState, Skeleton, EmptyState, PageHeader, useToast, Drawer, Pagination } from '../../components/ui';
import { formatDecimal, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, EXPENSE_STATUS_LABELS, enumLabel } from '../../lib/formatters';
import { todayCompanyIso } from '../../lib/company-time';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const EXPENSE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  REIMBURSED: 'success',
  CANCELLED: 'neutral',
};
// Rows awaiting a decision — the only states the approve action applies to.
const PENDING_EXPENSE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const isPendingExpense = (status?: string | null) =>
  !!status && PENDING_EXPENSE_STATUSES.includes(status.toUpperCase());
// Roles allowed by the backend to approve/reject expenses (POST /api/expenses/:id/approve).
const EXPENSE_APPROVER_ROLES = ['admin', 'owner', 'manager', 'pm', 'finance'];
/** Normalizes an OCR date to the `YYYY-MM-DD` an <input type="date"> requires. */
const toIsoDateInput = (value?: string): string | null => {
  if (!value) return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
function CheltuieliPageInner() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [scanError, setScanError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'ok' | 'not_configured' | 'unavailable' | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const { selectedProjectId } = useProject();
  // Expense form fields
  const [formCategory, setFormCategory] = useState('FUEL');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('RON');
  const [formPaymentMethod, setFormPaymentMethod] = useState('COMPANY_CARD');
  const [formExpenseDate, setFormExpenseDate] = useState(todayCompanyIso());
  const [formDescription, setFormDescription] = useState('');
  const [formMerchantName, setFormMerchantName] = useState('');
  const { user } = useAuth();
  const { locale } = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();
  const canApprove = EXPENSE_APPROVER_ROLES.includes((user?.role || '').toLowerCase());
  /**
   * Maps backend OcrExtractionResult (camelCase) to shared OcrResult (snake_case)
   */
  const mapOcrResult = (backendResult: any): OcrResult => {
    if (!backendResult) return {};
    return {
      document_type: backendResult.documentType,
      merchant_name: backendResult.merchantName,
      merchant_cui: backendResult.merchantCui,
      invoice_series: backendResult.invoiceSeries,
      document_number: backendResult.documentNumber,
      document_date: backendResult.documentDate,
      due_date: backendResult.dueDate,
      currency: backendResult.currency,
      subtotal: backendResult.subtotal,
      vat: backendResult.vat,
      total: backendResult.total,
      payment_method: backendResult.paymentMethod,
      raw_text: backendResult.rawText,
      provider: backendResult.provider,
      confidence: backendResult.confidence,
      fields: backendResult.fields,
      review_required: backendResult.reviewRequired,
      validation_errors: backendResult.validationErrors,
      document_hash: backendResult.documentHash,
      recognition: backendResult.recognition,
    };
  };
  // Auto-fill ONLY the fields OCR actually returns: amount (total), date (documentDate)
  // and merchant (merchantName). Category and description are left for the user to choose —
  // the OCR result carries neither, and we never invent data.
  useEffect(() => {
    if (!ocrResult) return;
    const total = ocrResult.total;
    if (typeof total === 'number' && !Number.isNaN(total)) {
      setFormAmount(String(total));
    }
    const isoDate = toIsoDateInput(ocrResult.document_date);
    if (isoDate) {
      setFormExpenseDate(isoDate);
    }
    if (ocrResult.merchant_name) {
      setFormMerchantName(ocrResult.merchant_name);
    }
  }, [ocrResult]);
  // Gate the OCR upload on the provider health (GET /api/ocr/health).
  // The endpoint returns { status, provider, model? }; status === 'ok' means the
  // provider is configured and reachable. Any failure (network, 5xx, throw)
  // leaves the gate closed — OCR is treated as unavailable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.get<{ status?: string; provider?: string | null; model?: string }>('/api/ocr/health');
        if (cancelled) return;
        const health = response?.data;
        const status = health?.status;
        setOcrAvailable(status === 'ok');
        setOcrStatus(
          status === 'ok' ? 'ok' : status === 'not_configured' ? 'not_configured' : 'unavailable'
        );
      } catch {
        if (!cancelled) {
          setOcrAvailable(false);
          setOcrStatus('unavailable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const processReceipt = async () => {
    if (!receipt) return;
    if (ocrAvailable !== true) return;
    if (!user) {
      setScanError('Trebuie sa te autentifici înainte de procesarea OCR.');
      return;
    }
    setProcessing(true);
    setScanError('');
    setOcrResult(null);
    try {
      // Use apiClient.processOcrDocument with direct File upload (multipart/form-data)
      // Backend OCR controller supports: JPG, PNG, WEBP, PDF, XML
      const response = await apiClient.processOcrDocument(receipt) as any;
      
      // Backend returns: { job, result } where result is OcrExtractionResult (camelCase)
      // We need to map to OcrResult (snake_case)
      if (response?.result) {
        const mapped = mapOcrResult(response.result);
        setOcrResult(mapped);
      } else if (response?.data?.result) {
        // Some response formats wrap in data
        const mapped = mapOcrResult(response.data.result);
        setOcrResult(mapped);
      } else {
        // Try to extract from any available field
        const resultData = response?.data || response;
        if (resultData?.result || resultData?.ocr) {
          const mapped = mapOcrResult(resultData.result || resultData.ocr);
          setOcrResult(mapped);
        } else {
          throw new Error("OCR-ul nu a gasit date in document.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setScanError(
        error instanceof ApiError ? error.message : message || "OCR-ul a esuat."
      );
    }
    finally {
      setProcessing(false);
    }
  };
  const handleCreateExpense = async () => {
    if (!selectedProjectId) {
      setSubmitError(t('expenses.select_project_first', locale));
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setSubmitError('Introdu o suma valida.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        projectId: selectedProjectId,
        category: formCategory,
        paymentMethod: formPaymentMethod,
        amount: Number(formAmount),
        currency: formCurrency,
        expenseDate: formExpenseDate,
        description: formDescription || undefined,
        merchantName: formMerchantName || undefined,
      };
      const response = await apiClient.createExpense(payload);
      if (response.error) {
        setSubmitError(response.error);
        return;
      }
      // Reset form and reload
      setShowNew(false);
      setReceipt(null);
      setOcrResult(null);
      setFormAmount('');
      setFormDescription('');
      setFormMerchantName('');
      setFormExpenseDate(todayCompanyIso());
      // Reload expenses
      const reloadParams: any = {};
      if (selectedProjectId) reloadParams.projectId = selectedProjectId;
      const reload = await apiClient.getExpenses(Object.keys(reloadParams).length ? reloadParams : undefined);
      if (reload.data) setExpenses(reload.data as Expense[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eroare la trimiterea cheltuielii.';
      setSubmitError(err instanceof ApiError ? err.message : message);
    } finally {
      setSubmitting(false);
    }
  };
  // Approve a pending expense — POST /api/expenses/:id/approve (role-gated by the backend).
  const handleApprove = async (exp: Expense) => {
    if (approvingId) return;
    setApprovingId(exp.id);
    try {
      await apiClient.approveExpense(exp.id, { status: 'APPROVED' });
      toastSuccess(
        t('expenses.toast_approved', locale),
        exp.description || undefined
      );
      await loadData();
    } catch (err) {
      toastError(
        t('expenses.toast_approve_failed', locale),
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : undefined
      );
    } finally {
      setApprovingId(null);
    }
  };
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      const response = await apiClient.getExpenses(Object.keys(params).length ? params : undefined);
      let data = (response.data || []) as Expense[];
      data.sort((a: any, b: any) =>
        new Date(b.created_at || b.createdAt || 0).getTime() -
        new Date(a.created_at || a.createdAt || 0).getTime()
      );
      setExpenses(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la incarcarea cheltuielilor.');
      }
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [filter, search, selectedProjectId, pageSize]);
  const filtered = expenses.filter(e => (filter === 'all' || e.status === filter) && (!search || e.description?.toLowerCase().includes(search.toLowerCase())));
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedExpenses = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (search ? 1 : 0);
  const byStatus = (status: string) => expenses.filter(e => e.status?.toUpperCase() === status).length;
  const summaryCards = [
    { label: t('expenses.kpi_total', locale), value: expenses.length },
    { label: t('expenses.kpi_pending', locale), value: expenses.filter(e => isPendingExpense(e.status)).length },
    { label: t('expenses.kpi_approved', locale), value: byStatus('APPROVED') },
    { label: t('expenses.kpi_reimbursed', locale), value: byStatus('REIMBURSED') },
  ];
  const filterOptions = ['all', 'submitted', 'approved', 'rejected', 'reimbursed'];
  const filterLabel = (s: string) => (s === 'all' ? t('expenses.all', locale) : t('status.' + s, locale));
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="expenses" />
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title={t('expenses.create_title', locale)}
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" onClick={() => setShowNew(false)} variant="secondary">
              {t('general.cancel', locale)}
            </Button>
            <Button type="button" disabled={!formAmount || Number(formAmount) <= 0} loading={submitting} onClick={() => void handleCreateExpense()}
              variant="primary" className="w-full sm:w-auto">
              {submitting ? t('expenses.submitting', locale) : t('expenses.submit_for_approval', locale)}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-500 mb-4">{t('expenses.form_hint', locale)}</p>
        <div className="space-y-4">
          {!user && <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">Trebuie să te autentifici pentru a trimite o cheltuială. <Link href="/login" className="font-semibold underline">Mergi la autentificare</Link></p>}
          {/* --- OCR Upload Section --- */}
          <Card className="p-4 bg-slate-50" padding={false}>
            <p className="text-xs font-semibold text-slate-600 mb-2">{t('expenses.scan_optional', locale)}</p>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-warning-soft bg-warning-soft/50 px-4 text-center hover:bg-warning-soft">
              <Upload className="mb-2 h-6 w-6 text-warning" />
              <span className="text-sm font-semibold text-slate-800">{receipt ? receipt.name : t('expenses.upload_cta', locale)}</span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP sau PDF</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
                onChange={e => setReceipt(e.target.files?.[0] || null)} />
            </label>
            {receipt && ocrAvailable === true && !ocrResult && <p className="text-xs text-success-foreground mt-2">{t('expenses.document_selected', locale)}</p>}
            {receipt && (
              <Button type="button" disabled={processing || ocrAvailable !== true} onClick={() => void processReceipt()} variant="primary" fullWidth className="mt-2">
                {processing ? t('expenses.processing', locale) : t('expenses.process_document', locale)}
              </Button>
            )}
            {ocrStatus === 'not_configured' && <p className="text-xs text-warning-foreground mt-2">{t('expenses.ocr_not_configured', locale)}</p>}
            {ocrStatus === 'unavailable' && <p className="text-xs text-warning-foreground mt-2">{t('expenses.ocr_unavailable', locale)}</p>}
            {scanError && <p className="text-sm text-critical-foreground mt-2">{scanError}</p>}
            {ocrResult && (
              <Card className="p-3 bg-success-soft border-success-soft mt-2" padding={false}>
                <p className="font-semibold text-success-foreground text-xs">{t('expenses.extracted_title', locale)}</p>
                <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                  {([
                    [t('expenses.field_merchant', locale), ocrResult.merchant_name],
                    ['CUI', ocrResult.merchant_cui],
                    [t('expenses.field_doc_number', locale), ocrResult.document_number],
                    [t('expenses.field_date', locale), ocrResult.document_date],
                    [t('expenses.field_subtotal', locale), ocrResult.subtotal],
                    ['TVA', ocrResult.vat],
                    [t('expenses.field_total', locale), ocrResult.total],
                    [t('expenses.field_currency', locale), ocrResult.currency],
                  ] as Array<[string, string | number | undefined]>).map(([label, value]) => value !== undefined && (
                    <div key={label}><dt className="font-medium text-slate-500">{label}</dt><dd className="font-semibold">{String(value)}</dd></div>
                  ))}
                </dl>
              </Card>
            )}
          </Card>
          {/* --- Expense Form Fields --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="expense-category" className="hii-label">{t('expenses.category', locale)}</label>
              <select id="expense-category" value={formCategory} onChange={e => setFormCategory(e.target.value)} className="hii-select">
                {['FUEL','ACCOMMODATION','FOOD','TRANSPORT','PARKING','TOLLS','MATERIALS','TOOLS','EQUIPMENT','OTHER'].map(c => (
                  <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-payment-method" className="hii-label">{t('expenses.field_payment_method', locale)}</label>
              <select id="expense-payment-method" value={formPaymentMethod} onChange={e => setFormPaymentMethod(e.target.value)} className="hii-select">
                <option value="COMPANY_CARD">{t('expenses.payment_company_card', locale)}</option>
                <option value="PERSONAL">{t('expenses.payment_personal', locale)}</option>
                <option value="COMPANY_CASH">{t('expenses.payment_company_cash', locale)}</option>
                <option value="OTHER">{t('expenses.payment_other', locale)}</option>
              </select>
            </div>
            <div>
              <label htmlFor="expense-amount" className="hii-label">{t('expenses.amount', locale)}</label>
              <input id="expense-amount" type="number" step="0.01" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                className="hii-input" placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="expense-currency" className="hii-label">{t('expenses.field_currency', locale)}</label>
              <select id="expense-currency" value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="hii-select">
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label htmlFor="expense-date" className="hii-label">{t('expenses.field_date', locale)}</label>
              <input id="expense-date" type="date" value={formExpenseDate} onChange={e => setFormExpenseDate(e.target.value)} className="hii-input" />
            </div>
            <div>
              <label htmlFor="expense-merchant" className="hii-label">{t('expenses.field_merchant', locale)}</label>
              <input id="expense-merchant" type="text" value={formMerchantName} onChange={e => setFormMerchantName(e.target.value)}
                className="hii-input" placeholder={t('expenses.field_merchant_placeholder', locale)} />
            </div>
          </div>
          <div>
            <label htmlFor="expense-description" className="hii-label">{t('expenses.field_description', locale)}</label>
            <textarea id="expense-description" value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2}
              className="hii-input h-auto py-2 resize-none"
              placeholder={t('expenses.field_description_placeholder', locale)} />
          </div>
          {submitError && <p className="text-sm text-critical-foreground">{submitError}</p>}
        </div>
      </Modal>
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
        <PageHeader
          className="py-3 !mb-0"
          title={t('expenses.title', locale)}
          subtitle={`${t('expenses.all', locale)} - ${expenses.length} inregistrari`}
          actions={
            <div className="flex items-center gap-4">
              <FieldHelp labelKey="help.document" muted />
              <Button onClick={loadData} disabled={loading} variant="secondary" size="icon" aria-label={t('general.refresh', locale)}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => { setScanError(''); setShowNew(true); }} variant="primary" icon={<Plus className="w-4 h-4" />}>
                {t('expenses.new', locale)}
              </Button>
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('general.search', locale)}
              className="hii-input pl-10" />
          </div>
          <Button onClick={() => setFilterOpen(true)} aria-haspopup="dialog" variant="secondary" className="sm:hidden" icon={<SlidersHorizontal className="w-4 h-4" />}>
            {t('expenses.filters', locale)}{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          <div className="hidden sm:flex flex-wrap gap-2">
            {filterOptions.map(s => (
              <Button key={s} onClick={() => setFilter(s)} size="sm" variant={filter === s ? 'primary' : 'secondary'}>
                {filterLabel(s)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} side="bottom" size="lg" swipeToClose title={t('expenses.filters', locale)}>
        <div className="space-y-2">
          {filterOptions.map(s => (
            <Button key={s} onClick={() => { setFilter(s); setFilterOpen(false); }} fullWidth
              variant={filter === s ? 'primary' : 'secondary'} className="justify-between font-semibold"
              icon={filter === s ? <Check className="w-4 h-4 text-success" aria-hidden="true" /> : undefined} iconPosition="right">
              <span>{filterLabel(s)}</span>
            </Button>
          ))}
        </div>
      </Drawer>

      <div className="pt-6 space-y-6">
        <section aria-label={t('expenses.title', locale)} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map(({ label, value }) => (
            <Card key={label} padding={false} className="p-4">
              <p className="text-xs font-medium text-content-muted">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-content">{value}</p>
            </Card>
          ))}
        </section>
        {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12" count={5} />
        </div>
      ) : error ? (
        <ErrorState title="Eroare la încărcarea cheltuielilor" error={error} onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={<Receipt />} title={t('empty.expenses', locale)} />
        </Card>
      ) : (
        <>
        <Card padding={false} className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="hii-table">
              <thead><tr>
                <th>Data</th><th>Categorie</th>
                <th>Descriere</th><th className="text-right">Suma</th>
                <th>Plata</th><th className="text-center">Stare</th>
                {canApprove && <th className="text-center">{t('expenses.actions', locale)}</th>}
              </tr></thead>
              <tbody>
                {pagedExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</td>
                    <td className="text-xs font-medium text-slate-700">{enumLabel(exp.category, EXPENSE_CATEGORY_LABELS, locale)}</td>
                    <td className="text-slate-800 font-medium">{exp.description || '-'}</td>
                    <td className="text-right font-bold text-slate-900">{formatDecimal(exp.amount)} {exp.currency}</td>
                    <td className="text-xs text-slate-500">{enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS, locale)}</td>
                    <td className="text-center"><Badge variant={EXPENSE_STATUS_VARIANT[exp.status?.toUpperCase()] || 'neutral'} size="sm">{enumLabel(exp.status, EXPENSE_STATUS_LABELS, locale)}</Badge></td>
                    {canApprove && (
                      <td className="text-center">
                        {isPendingExpense(exp.status) ? (
                          <Button size="sm" variant="primary" loading={approvingId === exp.id} disabled={!!approvingId} onClick={() => void handleApprove(exp)} icon={<Check className="w-3.5 h-3.5" />}>
                            {t('expenses.approve_button', locale)}
                          </Button>
                        ) : (
                          <span className="text-slate-300" aria-hidden="true">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="md:hidden space-y-3">
          {pagedExpenses.map(exp => (
            <Card key={exp.id} padding={false} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</span>
                <Badge variant={EXPENSE_STATUS_VARIANT[exp.status?.toUpperCase()] || 'neutral'} size="sm">{enumLabel(exp.status, EXPENSE_STATUS_LABELS, locale)}</Badge>
              </div>
              <p className="text-xs font-medium text-slate-700">{enumLabel(exp.category, EXPENSE_CATEGORY_LABELS, locale)}</p>
              <p className="text-sm text-slate-800 font-medium break-words">{exp.description || '-'}</p>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">{enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS, locale)}</span>
                <span className="text-sm font-bold text-slate-900">{formatDecimal(exp.amount)} {exp.currency}</span>
              </div>
              {canApprove && isPendingExpense(exp.status) && (
                <Button size="sm" variant="primary" fullWidth loading={approvingId === exp.id} disabled={!!approvingId} onClick={() => void handleApprove(exp)} icon={<Check className="w-3.5 h-3.5" />}>
                  {t('expenses.approve_expense', locale)}
                </Button>
              )}
            </Card>
          ))}
        </div>
        <Pagination page={safePage} pageSize={pageSize} total={totalFiltered} onPageChange={setPage} />
        </>
      )}
      </div>
    </div>
  );
}
export default function CheltuieliPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/cheltuieli']}>
      <CheltuieliPageInner />
    </RoleGuard>
  );
}

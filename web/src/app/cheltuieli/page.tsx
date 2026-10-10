'use client';
import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { FieldHelp } from '../../components/FieldHelp';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Receipt, Plus, Search, X, Upload, RefreshCw, SlidersHorizontal, Check } from 'lucide-react';
import { t, Expense, OcrResult, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { Button, Card, Badge, Modal, ErrorState, Skeleton, EmptyState, PageHeader } from '../../components/ui';
import { formatDecimal, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, EXPENSE_STATUS_LABELS, enumLabel } from '../../lib/formatters';
import { todayCompanyIso } from '../../lib/company-time';

const EXPENSE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  REIMBURSED: 'success',
  CANCELLED: 'neutral',
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
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
  const processReceipt = async () => {
    if (!receipt) return;
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
    if (!formAmount || Number(formAmount) <= 0) {
      setSubmitError('Introdu o suma valida.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
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
  const filtered = expenses.filter(e => (filter === 'all' || e.status === filter) && (!search || e.description?.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="expenses" />
      <PageHeader
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
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title={locale === 'ro' ? 'Cheltuiala nouă' : 'New Expense'}
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" onClick={() => setShowNew(false)} variant="secondary">
              {locale === 'ro' ? 'Anulează' : 'Cancel'}
            </Button>
            <Button type="button" disabled={!formAmount || Number(formAmount) <= 0} loading={submitting} onClick={() => void handleCreateExpense()}
              variant="primary" className="w-full sm:w-auto">
              {submitting ? (locale === 'ro' ? 'Se trimite...' : 'Submitting...') : (locale === 'ro' ? 'Trimite spre aprobare' : 'Submit for approval')}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-500 mb-4">{locale === 'ro' ? 'Completeaza detaliile și trimite spre aprobare.' : 'Fill in the details and submit for approval.'}</p>
        <div className="space-y-4">
          {!user && <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">Trebuie să te autentifici pentru a trimite o cheltuială. <Link href="/login" className="font-semibold underline">Mergi la autentificare</Link></p>}
          {/* --- OCR Upload Section --- */}
          <Card className="p-4 bg-slate-50" padding={false}>
            <p className="text-xs font-semibold text-slate-600 mb-2">{locale === 'ro' ? 'Scanare document (opțională)' : 'Document scan (optional)'}</p>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-warning-soft bg-warning-soft/50 px-4 text-center hover:bg-warning-soft">
              <Upload className="mb-2 h-6 w-6 text-warning" />
              <span className="text-sm font-semibold text-slate-800">{receipt ? receipt.name : (locale === 'ro' ? 'Încarcă bonul fiscal sau factura' : 'Upload receipt or invoice')}</span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP sau PDF</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
                onChange={e => setReceipt(e.target.files?.[0] || null)} />
            </label>
            {receipt && !ocrResult && <p className="text-xs text-success-foreground mt-2">{locale === 'ro' ? 'Document selectat. Apasă "Procesează documentul" pentru OCR.' : 'Document selected. Press \"Process document\" for OCR.'}</p>}
            {receipt && (
              <Button type="button" disabled={processing} onClick={() => void processReceipt()} variant="primary" fullWidth className="mt-2">
                {processing ? (locale === 'ro' ? 'Se procesează...' : 'Processing...') : (locale === 'ro' ? 'Procesează documentul' : 'Process document')}
              </Button>
            )}
            {scanError && <p className="text-sm text-critical-foreground mt-2">{scanError}</p>}
            {ocrResult && (
              <Card className="p-3 bg-success-soft border-success-soft mt-2" padding={false}>
                <p className="font-semibold text-success-foreground text-xs">{locale === 'ro' ? 'Date extrase — verifică înainte de trimitere' : 'Extracted data — verify before submitting'}</p>
                <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                  {([
                    [locale === 'ro' ? 'Furnizor' : 'Merchant', ocrResult.merchant_name],
                    ['CUI', ocrResult.merchant_cui],
                    [locale === 'ro' ? 'Nr. document' : 'Doc. no.', ocrResult.document_number],
                    [locale === 'ro' ? 'Data' : 'Date', ocrResult.document_date],
                    [locale === 'ro' ? 'Subtotal' : 'Subtotal', ocrResult.subtotal],
                    ['TVA', ocrResult.vat],
                    [locale === 'ro' ? 'Total' : 'Total', ocrResult.total],
                    [locale === 'ro' ? 'Moneda' : 'Currency', ocrResult.currency],
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
              <label className="hii-label">{locale === 'ro' ? 'Categorie' : 'Category'}</label>
              <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="hii-select">
                {['FUEL','ACCOMMODATION','FOOD','TRANSPORT','PARKING','TOLLS','MATERIALS','TOOLS','EQUIPMENT','OTHER'].map(c => (
                  <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="hii-label">{locale === 'ro' ? 'Metoda plata' : 'Payment'}</label>
              <select value={formPaymentMethod} onChange={e => setFormPaymentMethod(e.target.value)} className="hii-select">
                <option value="COMPANY_CARD">{locale === 'ro' ? 'Card companie' : 'Company card'}</option>
                <option value="PERSONAL">{locale === 'ro' ? 'Personal' : 'Personal'}</option>
                <option value="COMPANY_CASH">{locale === 'ro' ? 'Cash avans' : 'Company cash'}</option>
                <option value="OTHER">{locale === 'ro' ? 'Alta' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="hii-label">{locale === 'ro' ? 'Suma' : 'Amount'}</label>
              <input type="number" step="0.01" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                className="hii-input" placeholder="0.00" />
            </div>
            <div>
              <label className="hii-label">{locale === 'ro' ? 'Moneda' : 'Currency'}</label>
              <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="hii-select">
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="hii-label">{locale === 'ro' ? 'Data' : 'Date'}</label>
              <input type="date" value={formExpenseDate} onChange={e => setFormExpenseDate(e.target.value)} className="hii-input" />
            </div>
            <div>
              <label className="hii-label">{locale === 'ro' ? 'Furnizor' : 'Merchant'}</label>
              <input type="text" value={formMerchantName} onChange={e => setFormMerchantName(e.target.value)}
                className="hii-input" placeholder={locale === 'ro' ? 'Nume furnizor' : 'Merchant name'} />
            </div>
          </div>
          <div>
            <label className="hii-label">{locale === 'ro' ? 'Descriere' : 'Description'}</label>
            <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2}
              className="hii-input h-auto py-2 resize-none"
              placeholder={locale === 'ro' ? 'Descrie cheltuiala...' : 'Describe the expense...'} />
          </div>
          {submitError && <p className="text-sm text-critical-foreground">{submitError}</p>}
        </div>
      </Modal>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('general.search', locale)}
            className="hii-input pl-10" />
        </div>
        <Button onClick={() => setFilterOpen(true)} aria-haspopup="dialog" variant="secondary" className="sm:hidden" icon={<SlidersHorizontal className="w-4 h-4" />}>
          {locale === 'ro' ? 'Filtre' : 'Filters'}
        </Button>
        <div className="hidden sm:flex flex-wrap gap-2">
          {['all','submitted','approved','rejected','reimbursed'].map(s => (
            <Button key={s} onClick={() => setFilter(s)} size="sm" variant={filter === s ? 'primary' : 'secondary'}>
              {s === 'all' ? (locale === 'ro' ? 'Toate' : 'All') : t('status.' + s, locale)}
            </Button>
          ))}
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:hidden">
          <div role="dialog" aria-modal="true" aria-label={locale === 'ro' ? 'Filtre' : 'Filters'} className="w-full max-h-[70vh] rounded-t-2xl bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <span className="text-base font-bold text-slate-900">{locale === 'ro' ? 'Filtre' : 'Filters'}</span>
              <Button type="button" onClick={() => setFilterOpen(false)} aria-label="Închide" variant="ghost" size="icon"><X className="w-5 h-5" /></Button>
            </div>
            <div className="space-y-2 p-4">
              {['all','submitted','approved','rejected','reimbursed'].map(s => (
                <Button key={s} onClick={() => { setFilter(s); setFilterOpen(false); }} fullWidth
                  variant={filter === s ? 'primary' : 'secondary'} className="justify-between font-semibold"
                  icon={filter === s ? <Check className="w-4 h-4 text-success" aria-hidden="true" /> : undefined} iconPosition="right">
                  <span>{s === 'all' ? (locale === 'ro' ? 'Toate' : 'All') : t('status.' + s, locale)}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12" count={5} />
        </div>
      ) : error ? (
        <ErrorState title="Eroare la încărcarea cheltuielilor" error={error} onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          <EmptyState icon={<Receipt className="w-7 h-7" />} title={t('empty.expenses', locale)} />
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
              </tr></thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString('ro-RO')}</td>
                    <td className="text-xs font-medium text-slate-700">{enumLabel(exp.category, EXPENSE_CATEGORY_LABELS, locale)}</td>
                    <td className="text-slate-800 font-medium">{exp.description || '-'}</td>
                    <td className="text-right font-bold text-slate-900">{formatDecimal(exp.amount)} {exp.currency}</td>
                    <td className="text-xs text-slate-500">{enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS, locale)}</td>
                    <td className="text-center"><Badge variant={EXPENSE_STATUS_VARIANT[exp.status?.toUpperCase()] || 'neutral'} size="sm">{enumLabel(exp.status, EXPENSE_STATUS_LABELS, locale)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="md:hidden space-y-3">
          {filtered.map(exp => (
            <Card key={exp.id} padding={false} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString('ro-RO')}</span>
                <Badge variant={EXPENSE_STATUS_VARIANT[exp.status?.toUpperCase()] || 'neutral'} size="sm">{enumLabel(exp.status, EXPENSE_STATUS_LABELS, locale)}</Badge>
              </div>
              <p className="text-xs font-medium text-slate-700">{enumLabel(exp.category, EXPENSE_CATEGORY_LABELS, locale)}</p>
              <p className="text-sm text-slate-800 font-medium break-words">{exp.description || '-'}</p>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">{enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS, locale)}</span>
                <span className="text-sm font-bold text-slate-900">{formatDecimal(exp.amount)} {exp.currency}</span>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}
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

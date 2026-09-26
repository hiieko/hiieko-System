'use client';
import { PageTutorial } from '../../components/PageTutorial';
import { FieldHelp } from '../../components/FieldHelp';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Receipt, Plus, Search, X, Upload } from 'lucide-react';
import { t, Expense, OcrResult, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { formatDecimal, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, EXPENSE_STATUS_LABELS, EXPENSE_STATUS_COLORS, enumLabel } from '../../lib/formatters';

// Category labels now use EXPENSE_CATEGORY_LABELS from formatters
// Status colors now use EXPENSE_STATUS_COLORS from formatters

export default function CheltuieliPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [scanError, setScanError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Expense form fields
  const [formCategory, setFormCategory] = useState('FUEL');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('RON');
  const [formPaymentMethod, setFormPaymentMethod] = useState('COMPANY_CARD');
  const [formExpenseDate, setFormExpenseDate] = useState(new Date().toISOString().split('T')[0]);
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
      setScanError('Trebuie să te autentifici înainte de procesarea OCR.');
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
      setSubmitError('Introdu o sumă validă.');
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
      setFormExpenseDate(new Date().toISOString().split('T')[0]);
      // Reload expenses
      const reload = await apiClient.getExpenses();
      if (reload.data) setExpenses(reload.data as Expense[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eroare la trimiterea cheltuielii.';
      setSubmitError(err instanceof ApiError ? err.message : message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getExpenses();
        let data = (response.data || []) as Expense[];
        // Sort by created_at descending
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
    }
    load();
  }, []);

  const filtered = expenses.filter(e => (filter === 'all' || e.status === filter) && (!search || e.description?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="expenses" />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">{t('expenses.title', locale)}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('expenses.all', locale)} - {expenses.length} inregistrari</p></div>
        <div className="flex items-center gap-4">
          <FieldHelp labelKey="help.document" muted />
          <button onClick={() => { setScanError(''); setShowNew(true); }} className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm rounded-lg shadow-sm">
            <Plus className="w-4 h-4 mr-2" />{t('expenses.new', locale)}
          </button>
        </div>
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="new-expense-title" className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div>
                  <h2 id="new-expense-title" className="text-lg font-bold text-slate-900">{locale === 'ro' ? 'Cheltuială Nouă' : 'New Expense'}</h2>
                  <p className="text-xs text-slate-500 mt-1">{locale === 'ro' ? 'Completează detaliile și trimite spre aprobare.' : 'Fill in the details and submit for approval.'}</p>
                </div>
                <button type="button" onClick={() => setShowNew(false)} aria-label="Închide" className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 p-5">
                {!user && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Trebuie să te autentifici pentru a trimite o cheltuială. <Link href="/login" className="font-semibold underline">Mergi la autentificare</Link></p>}
                {/* --- OCR Upload Section --- */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-600 mb-2">{locale === 'ro' ? 'Scanare document (opțională)' : 'Document scan (optional)'}</p>
                  <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 px-4 text-center hover:bg-amber-50">
                    <Upload className="mb-2 h-6 w-6 text-amber-600" />
                    <span className="text-sm font-semibold text-slate-800">{receipt ? receipt.name : (locale === 'ro' ? 'Încarcă bonul fiscal sau factura' : 'Upload receipt or invoice')}</span>
                    <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP sau PDF</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
                      onChange={e => setReceipt(e.target.files?.[0] || null)} />
                  </label>
                  {receipt && !ocrResult && <p className="text-xs text-emerald-700 mt-2">{locale === 'ro' ? 'Document selectat. Apasă „Procesează documentul” pentru OCR.' : 'Document selected. Press "Process document" for OCR.'}</p>}
                  {receipt && (
                    <button type="button" disabled={processing} onClick={() => void processReceipt()} className="mt-2 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                      {processing ? (locale === 'ro' ? 'Se procesează...' : 'Processing...') : (locale === 'ro' ? 'Procesează documentul' : 'Process document')}
                    </button>
                  )}
                  {scanError && <p className="text-sm text-red-700 mt-2">{scanError}</p>}
                  {ocrResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm mt-2">
                      <p className="font-semibold text-emerald-900 text-xs">{locale === 'ro' ? 'Date extrase — verifică înainte de trimitere' : 'Extracted data — verify before submitting'}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                        {([
                          [locale === 'ro' ? 'Furnizor' : 'Merchant', ocrResult.merchant_name],
                          ['CUI', ocrResult.merchant_cui],
                          [locale === 'ro' ? 'Nr. document' : 'Doc. no.', ocrResult.document_number],
                          [locale === 'ro' ? 'Data' : 'Date', ocrResult.document_date],
                          [locale === 'ro' ? 'Subtotal' : 'Subtotal', ocrResult.subtotal],
                          ['TVA', ocrResult.vat],
                          [locale === 'ro' ? 'Total' : 'Total', ocrResult.total],
                          [locale === 'ro' ? 'Monedă' : 'Currency', ocrResult.currency],
                        ] as Array<[string, string | number | undefined]>).map(([label, value]) => value !== undefined && (
                          <div key={label}><dt className="font-medium text-slate-500">{label}</dt><dd className="font-semibold">{String(value)}</dd></div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>

                {/* --- Expense Form Fields --- */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Categorie' : 'Category'}</label>
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      {['FUEL','ACCOMMODATION','FOOD','TRANSPORT','PARKING','TOLLS','MATERIALS','TOOLS','EQUIPMENT','OTHER'].map(c => (
                        <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Metodă plată' : 'Payment'}</label>
                    <select value={formPaymentMethod} onChange={e => setFormPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      <option value="COMPANY_CARD">{locale === 'ro' ? 'Card companie' : 'Company card'}</option>
                      <option value="PERSONAL">{locale === 'ro' ? 'Personal' : 'Personal'}</option>
                      <option value="COMPANY_CASH">{locale === 'ro' ? 'Cash avans' : 'Company cash'}</option>
                      <option value="OTHER">{locale === 'ro' ? 'Alta' : 'Other'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Suma' : 'Amount'}</label>
                    <input type="number" step="0.01" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Monedă' : 'Currency'}</label>
                    <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      <option value="RON">RON</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Data' : 'Date'}</label>
                    <input type="date" value={formExpenseDate} onChange={e => setFormExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Furnizor' : 'Merchant'}</label>
                    <input type="text" value={formMerchantName} onChange={e => setFormMerchantName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder={locale === 'ro' ? 'Nume furnizor' : 'Merchant name'} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{locale === 'ro' ? 'Descriere' : 'Description'}</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                    placeholder={locale === 'ro' ? 'Descrie cheltuiala...' : 'Describe the expense...'} />
                </div>
                {submitError && <p className="text-sm text-red-700">{submitError}</p>}
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{locale === 'ro' ? 'Anulează' : 'Cancel'}</button>
                  <button type="button" disabled={submitting || !formAmount || Number(formAmount) <= 0} onClick={() => void handleCreateExpense()}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? (locale === 'ro' ? 'Se trimite...' : 'Submitting...') : (locale === 'ro' ? 'Trimite spre aprobare' : 'Submit for approval')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('general.search', locale)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        {['all','submitted','approved','rejected','reimbursed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${filter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            {s === 'all' ? (locale === 'ro' ? 'Toate' : 'All') : t('status.' + s, locale)}
          </button>
        ))}
      </div>
      {loading ? <div className="text-center py-12 text-slate-500">{t('general.loading', locale)}</div>
      : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-white">
          <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 max-w-md mx-auto">{t('empty.expenses', locale)}</p>
        </div>
      )
      : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="py-3 px-4">Data</th><th className="py-3 px-4">Categorie</th>
                <th className="py-3 px-4">Descriere</th><th className="py-3 px-4 text-right">Suma</th>
                <th className="py-3 px-4">Plata</th><th className="py-3 px-4 text-center">Stare</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString('ro-RO')}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{enumLabel(exp.category, EXPENSE_CATEGORY_LABELS, locale)}</td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{exp.description || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{formatDecimal(exp.amount)} {exp.currency}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS, locale)}</td>
                    <td className="py-3 px-4 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${EXPENSE_STATUS_COLORS[exp.status?.toUpperCase()] || 'bg-slate-100 text-slate-700'}`}>{enumLabel(exp.status, EXPENSE_STATUS_LABELS, locale)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

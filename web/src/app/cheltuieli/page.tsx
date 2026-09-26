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
            <div role="dialog" aria-modal="true" aria-labelledby="new-expense-title" className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div>
                  <h2 id="new-expense-title" className="text-lg font-bold text-slate-900">Bon fiscal / factură</h2>
                  <p className="text-xs text-slate-500 mt-1">Fotografiază sau selectează documentul pentru OCR.</p>
                </div>
                <button type="button" onClick={() => setShowNew(false)} aria-label="Închide" className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 p-5">
                {!user && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Poți selecta documentul, dar trebuie să te autentifici pentru OCR și salvare. <Link href="/login" className="font-semibold underline">Mergi la autentificare</Link></p>}
                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 px-4 text-center hover:bg-amber-50">
                  <Upload className="mb-2 h-8 w-8 text-amber-600" />
                  <span className="text-sm font-semibold text-slate-800">{receipt ? receipt.name : 'Încarcă bonul fiscal sau factura'}</span>
                  <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP sau PDF · poți folosi camera telefonului</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
                    onChange={e => setReceipt(e.target.files?.[0] || null)} />
                </label>
                {receipt && !ocrResult && <p className="text-xs text-emerald-700">Document selectat. Apasă „Procesează documentul” pentru OCR.</p>}
                {scanError && <p className="text-sm text-red-700">{scanError}</p>}
                {ocrResult && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <p className="font-semibold text-emerald-900">Date extrase — verifică înainte de trimitere</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-700">
                      {([
                        ['Furnizor', ocrResult.merchant_name],
                        ['CUI', ocrResult.merchant_cui],
                        ['Nr. document', ocrResult.document_number],
                        ['Data', ocrResult.document_date],
                        ['Subtotal', ocrResult.subtotal],
                        ['TVA', ocrResult.vat],
                        ['Total', ocrResult.total],
                        ['Monedă', ocrResult.currency],
                      ] as Array<[string, string | number | undefined]>).map(([label, value]) => value !== undefined && (
                        <div key={label}><dt className="font-medium text-slate-500">{label}</dt><dd className="font-semibold">{String(value)}</dd></div>
                      ))}
                    </dl>
                    <p className="mt-3 text-xs text-amber-800">OCR-ul este un asistent. Corectează datele pe documentul original înainte de aprobare.</p>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Anulează</button>
                  <button type="button" disabled={!receipt || processing} onClick={() => void processReceipt()} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{processing ? 'Se procesează...' : 'Procesează documentul'}</button>
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

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { apiClient } from '../../lib/api-client';

interface Measurement { id?: string; parameter: string; value: number | string; unit: string; passed?: boolean; }
interface Inspection { id: string; project_id: string; template?: { name: string; code?: string } | null; inspector_name: string; status: string; inspected_at: string; measurements?: Measurement[]; ncrs?: Array<{ id: string; ncr_number: string; description: string; status: string; created_at: string }>; }
interface MeasurementDraft { parameter: string; value: string; unit: string; }

const mayRecordInspection = (role?: string) => ['admin', 'qa_qc', 'pm', 'site_manager'].includes((role || '').toLowerCase());

export function QualityWorkspace() {
  const { user } = useAuth();
  const { selectedProjectId, selectedProject } = useProject();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openForm, setOpenForm] = useState(false);
  const [inspectorName, setInspectorName] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const loadInspections = useCallback(async (isRefresh = false) => {
    if (!selectedProjectId) {
      setInspections([]);
      setLoading(false);
      setRefreshing(false);
      setError('');
      return;
    }
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await apiClient.getInspections({ projectId: selectedProjectId });
      setInspections((response.data || []) as Inspection[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Inspecțiile nu au putut fi încărcate.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { void loadInspections(); }, [loadInspections]);

  const statuses = useMemo(() => [...new Set(inspections.map((inspection) => inspection.status).filter(Boolean))], [inspections]);
  const filtered = useMemo(() => inspections.filter((inspection) => {
    const term = query.trim().toLocaleLowerCase();
    const matchesSearch = !term || [inspection.inspector_name, inspection.template?.name || '', ...((inspection.measurements || []).map((measurement) => measurement.parameter)), ...((inspection.ncrs || []).map((ncr) => `${ncr.ncr_number} ${ncr.description}`))].some((value) => value.toLocaleLowerCase().includes(term));
    return matchesSearch && (statusFilter === 'ALL' || inspection.status === statusFilter);
  }), [inspections, query, statusFilter]);

  const addMeasurement = () => setMeasurements((items) => [...items, { parameter: '', value: '', unit: '' }]);
  const updateMeasurement = (index: number, field: keyof MeasurementDraft, value: string) => setMeasurements((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const removeMeasurement = (index: number) => setMeasurements((items) => items.filter((_, itemIndex) => itemIndex !== index));

  const submitInspection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validMeasurements = measurements.filter((measurement) => measurement.parameter.trim() || measurement.value || measurement.unit.trim());
    if (validMeasurements.some((measurement) => !measurement.parameter.trim() || !measurement.unit.trim() || !Number.isFinite(Number(measurement.value)))) {
      setFormError('Completează parametrul, valoarea numerică și unitatea pentru fiecare măsurătoare.');
      return;
    }
    if (!selectedProjectId || !inspectorName.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await apiClient.request('/api/qa-qc/inspections', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          inspectorName: inspectorName.trim(),
          ...(validMeasurements.length ? { measurements: validMeasurements.map((measurement) => ({ parameter: measurement.parameter.trim(), value: Number(measurement.value), unit: measurement.unit.trim() })) } : {}),
        }),
      });
      setOpenForm(false);
      setInspectorName('');
      setMeasurements([]);
      setSuccess('Inspecția a fost înregistrată.');
      await loadInspections(true);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Inspecția nu a putut fi înregistrată.');
    } finally {
      setSaving(false);
    }
  };

  const canCreate = mayRecordInspection(user?.role);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-hii-700">Asigurarea calității</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">QA/QC · Inspecții</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Registrul verificărilor de teren, al măsurătorilor înregistrate și al NCR-urilor asociate.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void loadInspections(true)} disabled={refreshing || loading} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-label="Reîncarcă inspecțiile"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /></button>{canCreate && selectedProjectId && <button type="button" onClick={() => { setOpenForm(true); setSuccess(''); setFormError(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white hover:bg-hii-800"><Plus className="size-4" />Înregistrează inspecție</button>}</div>
      </header>

      {!canCreate && <div role="note" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Mod de vizualizare. Înregistrarea inspecțiilor este disponibilă rolurilor ADMIN, QA/QC, PM și SITE_MANAGER.</div>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}
      {error && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => void loadInspections()} className="min-h-10 rounded-md border border-rose-300 px-3 font-semibold">Reîncearcă</button></div>}

      {!selectedProjectId ? <section className="rounded-xl border border-slate-200 bg-white px-5 py-14 text-center"><ClipboardCheck className="mx-auto size-10 text-slate-300" /><h2 className="mt-3 text-sm font-semibold text-slate-800">Selectează un proiect</h2><p className="mt-1 text-sm text-slate-500">Inspecțiile sunt filtrate după proiectul activ.</p></section> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-slate-900">{selectedProject?.name || 'Proiect selectat'}</h2><p className="mt-1 text-xs text-slate-500">{inspections.length} înregistrări · date din API QA/QC</p></div><div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_200px]"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search className="size-4 shrink-0 text-slate-400" /><span className="sr-only">Caută inspecții</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Inspector, măsurătoare, NCR" className="w-full bg-transparent text-sm outline-none" /></label><select aria-label="Filtrează după starea înregistrată" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"><option value="ALL">Toate stările returnate</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>

        {loading ? <div className="flex flex-col gap-3 p-4 sm:p-5" aria-label="Se încarcă inspecțiile">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div> : filtered.length === 0 ? <div className="px-5 py-14 text-center"><ClipboardCheck className="mx-auto size-10 text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-800">{inspections.length ? 'Niciun rezultat' : 'Nu există inspecții'}</h3><p className="mt-1 text-sm text-slate-500">{inspections.length ? 'Ajustează căutarea sau starea selectată.' : 'Nu au fost returnate inspecții pentru acest proiect.'}</p></div> : <div className="flex flex-col divide-y divide-slate-100">{filtered.map((inspection) => <article key={inspection.id} className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{inspection.template?.name || 'Inspecție de teren'}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{inspection.status}</span></div><p className="mt-1.5 text-xs text-slate-500">Inspector · <span className="font-medium text-slate-700">{inspection.inspector_name}</span> · {inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleString('ro-RO') : 'Dată nespecificată'}</p></div><p className="text-xs text-slate-500">{inspection.template?.code || 'Fără șablon asociat'}</p></div>
          {!!inspection.measurements?.length && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inspection.measurements.map((measurement, index) => <div key={measurement.id || `${measurement.parameter}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{measurement.parameter}</p><p className="mt-0.5 text-xs text-slate-500">{measurement.value} {measurement.unit}</p></div>{typeof measurement.passed === 'boolean' && <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${measurement.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{measurement.passed ? 'Conform' : 'Neconform'}</span>}</div>)}</div>}
          {!!inspection.ncrs?.length && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3"><h4 className="text-xs font-semibold text-amber-950">NCR asociate</h4><ul className="mt-2 flex flex-col gap-2">{inspection.ncrs.map((ncr) => <li key={ncr.id} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-start sm:justify-between"><span className="font-semibold text-slate-800">{ncr.ncr_number} · {ncr.description}</span><span className="shrink-0 text-slate-600">{ncr.status}</span></li>)}</ul></div>}
        </article>)}</div>}
      </section>}

      {openForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="inspection-form-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-hii-700">{selectedProject?.code || 'Proiect'}</p><h2 id="inspection-form-title" className="mt-1 text-lg font-bold text-slate-900">Înregistrează inspecție</h2><p className="mt-1 text-xs text-slate-500">Formularul folosește contractul POST existent; statusul este stabilit de backend.</p></div><button type="button" onClick={() => setOpenForm(false)} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100" aria-label="Închide formularul"><X className="size-5" /></button></div>
        <form onSubmit={submitInspection} className="mt-5 flex flex-col gap-4"><label className="text-sm font-medium text-slate-700">Numele inspectorului *<input required value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Măsurători</h3><p className="mt-1 text-xs text-slate-500">Opțional · parametrul, valoarea și unitatea sunt înregistrate exact.</p></div><button type="button" onClick={addMeasurement} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">Adaugă rând</button></div><div className="mt-3 flex flex-col gap-3">{measurements.map((measurement, index) => <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_110px_100px_40px]"><label className="text-xs font-medium text-slate-600">Parametru<input value={measurement.parameter} onChange={(event) => updateMeasurement(index, 'parameter', event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Valoare<input type="number" step="any" value={measurement.value} onChange={(event) => updateMeasurement(index, 'value', event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Unitate<input value={measurement.unit} onChange={(event) => updateMeasurement(index, 'unit', event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label><button type="button" onClick={() => removeMeasurement(index)} className="grid min-h-10 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-rose-700" aria-label="Elimină măsurătoarea"><X className="size-4" /></button></div>)}</div></section>
          {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</p>}<div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpenForm(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Anulează</button><button type="submit" disabled={saving || !inspectorName.trim()} className="min-h-11 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Se înregistrează…' : 'Înregistrează'}</button></div></form>
      </section></div>}
    </main>
  );
}

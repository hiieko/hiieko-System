'use client';

import { useMemo, useState } from 'react';
import { FilePlus2, FileText, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';

type DocumentType = 'BON_FISCAL' | 'FACTURA' | 'AVIZ' | 'CERTIFICAT_CONFORMITATE' | 'PROCES_VERBAL' | 'PLAN_TEHNIC' | 'CONTRACT' | 'RAPORT_TESTARE' | 'OTHER';
interface DocumentRecord { id: string; title: string; documentType: DocumentType; code: string; currentVersion: number; updatedAt: string; projectName: string; fileName: string; }

const typeLabels: Record<DocumentType, string> = {
  BON_FISCAL: 'Bon fiscal', FACTURA: 'Factură', AVIZ: 'Aviz', CERTIFICAT_CONFORMITATE: 'Certificat de conformitate',
  PROCES_VERBAL: 'Proces-verbal', PLAN_TEHNIC: 'Plan tehnic', CONTRACT: 'Contract', RAPORT_TESTARE: 'Raport de testare', OTHER: 'Altele',
};
const documentTypes = Object.keys(typeLabels) as DocumentType[];
const prototypeDocuments: DocumentRecord[] = [
  { id: 'doc-sample-1', title: 'Plan general amplasament', documentType: 'PLAN_TEHNIC', code: 'ENG-PL-001', currentVersion: 3, updatedAt: '2026-09-21', projectName: 'Parc Solar Bihor', fileName: 'plan-amplasament-v3.pdf' },
  { id: 'doc-sample-2', title: 'Certificat conformitate module', documentType: 'CERTIFICAT_CONFORMITATE', code: 'QA-CERT-014', currentVersion: 1, updatedAt: '2026-09-18', projectName: 'Parc Solar Bihor', fileName: 'certificat-module.pdf' },
  { id: 'doc-sample-3', title: 'Proces verbal recepție materiale', documentType: 'PROCES_VERBAL', code: 'LOG-PV-008', currentVersion: 2, updatedAt: '2026-09-16', projectName: 'Parc Solar Vest', fileName: 'pv-receptie-materiale.pdf' },
];

export function DocumentsWorkspace() {
  const { selectedProject } = useProject();
  const [documents, setDocuments] = useState(prototypeDocuments);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'ALL'>('ALL');
  const [openUpload, setOpenUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('PLAN_TECHNIC');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);

  const filtered = useMemo(() => documents.filter((document) => {
    const searchTerm = query.trim().toLocaleLowerCase();
    const matchesSearch = !searchTerm || [document.title, document.code, document.fileName, document.projectName, typeLabels[document.documentType]].some((value) => value.toLocaleLowerCase().includes(searchTerm));
    return matchesSearch && (typeFilter === 'ALL' || typeFilter === document.documentType);
  }), [documents, query, typeFilter]);

  const savePrototypeDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !file) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const nextDocument: DocumentRecord = {
      id: `prototype-${Date.now()}`, title: title.trim(), documentType, code: '', currentVersion: 1,
      updatedAt: new Date().toISOString().slice(0, 10), projectName: selectedProject?.name || 'Fără proiect asociat', fileName: file.name,
    };
    setDocuments((items) => [nextDocument, ...items]);
    setOpenUpload(false);
    setTitle('');
    setFile(null);
    setSuccess('Fișierul a fost adăugat doar în prototipul local. Nu a fost încărcat.');
    setSaving(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDocuments((items) => items.filter((document) => document.id !== deleteTarget.id));
    setDeleteTarget(null);
    setSuccess('Rândul a fost eliminat din lista locală de demonstrație.');
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-hii-700">Controlul documentelor</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Documente</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acces rapid la documentele tehnice și de execuție ale proiectului.</p></div>
        <button type="button" onClick={() => { setOpenUpload(true); setSuccess(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white hover:bg-hii-800"><UploadCloud className="size-4" />Adaugă document</button>
      </header>

      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950"><span className="font-semibold">Prototip frontend.</span> Modelul Document există, însă UI-ul nu are endpoint-uri de listare, metadata upload sau versionare. Înregistrările sunt mostre; fișierele selectate nu părăsesc browserul.</div>
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-900">Registru documente</h2><p className="mt-1 text-xs text-slate-500">Versiunea curentă · tip · proiect · dată modificare</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(200px,1fr)_220px]"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search className="size-4 shrink-0 text-slate-400" /><span className="sr-only">Caută documente</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titlu, cod, nume fișier" className="w-full bg-transparent text-sm outline-none" /></label><label className="sr-only" htmlFor="document-type-filter">Filtrează după tip</label><select id="document-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as DocumentType | 'ALL')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"><option value="ALL">Toate tipurile</option>{documentTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>
        </div>

        {filtered.length === 0 ? <div className="px-5 py-14 text-center"><FileText className="mx-auto size-10 text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-800">{documents.length ? 'Niciun rezultat' : 'Nu există documente în prototip'}</h3><p className="mt-1 text-sm text-slate-500">{documents.length ? 'Ajustează căutarea sau filtrul de tip.' : 'Adaugă un fișier pentru a explora starea de încărcare.'}</p></div> : <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Document</th><th className="px-4 py-3">Tip</th><th className="px-4 py-3">Proiect</th><th className="px-4 py-3">Versiune</th><th className="px-4 py-3">Actualizat</th><th className="px-4 py-3"><span className="sr-only">Acțiuni prototip</span></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((document) => <tr key={document.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="font-semibold text-slate-900">{document.title}</div><div className="mt-1 text-xs text-slate-500">{document.fileName}{document.code ? ` · ${document.code}` : ''}</div></td><td className="px-4 py-4 text-slate-600">{typeLabels[document.documentType]}</td><td className="px-4 py-4 text-slate-600">{document.projectName}</td><td className="px-4 py-4 font-mono text-slate-700">v{document.currentVersion}</td><td className="px-4 py-4 text-slate-600">{document.updatedAt}</td><td className="px-4 py-4 text-right"><button type="button" onClick={() => setDeleteTarget(document)} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Elimină ${document.title} din prototip`}><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div>
          <div className="flex flex-col divide-y divide-slate-100 md:hidden">{filtered.map((document) => <article key={document.id} className="flex items-start gap-3 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900">{document.title}</h3><p className="mt-1 text-xs text-slate-500">{typeLabels[document.documentType]} · v{document.currentVersion}</p><p className="mt-1 truncate text-xs text-slate-500">{document.fileName}</p><p className="mt-2 text-xs text-slate-600">{document.projectName} · {document.updatedAt}</p></div><button type="button" onClick={() => setDeleteTarget(document)} className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Elimină ${document.title} din prototip`}><Trash2 className="size-4" /></button></article>)}</div>
        </>}
      </section>

      {openUpload && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="document-upload-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between"><div><h2 id="document-upload-title" className="text-lg font-bold text-slate-900">Document nou</h2><p className="mt-1 text-xs text-amber-800">Demonstrație locală · fără upload real</p></div><button type="button" onClick={() => setOpenUpload(false)} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100" aria-label="Închide formularul"><X className="size-5" /></button></div><form onSubmit={savePrototypeDocument} className="mt-5 flex flex-col gap-4"><label className="text-sm font-medium text-slate-700">Titlu *<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-medium text-slate-700">Tip document<select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{documentTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-hii-500"><FilePlus2 className="size-6 text-hii-700" /><span className="text-sm font-semibold text-slate-800">{file?.name || 'Selectează un fișier'}</span><span className="text-xs text-slate-500">Doar numele fișierului este folosit local pentru demonstrație.</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} className="sr-only" /></label><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpenUpload(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Anulează</button><button type="submit" disabled={saving || !file || !title.trim()} className="min-h-11 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Se procesează local…' : 'Adaugă în prototip'}</button></div></form></section></div>}
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="document-delete-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 id="document-delete-title" className="text-base font-bold text-slate-900">Eliminare din prototip</h2><p className="mt-2 text-sm leading-6 text-slate-600">Elimini „{deleteTarget.title}” din lista de demonstrație? Nicio înregistrare sau fișier real nu va fi afectat.</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Păstrează</button><button type="button" onClick={confirmDelete} className="min-h-11 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white">Elimină local</button></div></section></div>}
    </main>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Building2, Mail, Phone, Plus, Search, Trash2, UserRound, X } from 'lucide-react';

interface CustomerRecord {
  id: string;
  name: string;
  cui: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

const prototypeCustomers: CustomerRecord[] = [
  { id: 'sample-1', name: 'Energia Verde Development', cui: 'RO 38120451', contactPerson: 'Andrei Popescu', contactEmail: 'andrei.popescu@example.test', contactPhone: '+40 721 000 101' },
  { id: 'sample-2', name: 'Solaris Industrial Group', cui: 'RO 27483910', contactPerson: 'Ioana Radu', contactEmail: 'ioana.radu@example.test', contactPhone: '+40 722 000 204' },
  { id: 'sample-3', name: 'Nordic Renewables', cui: 'RO 40917563', contactPerson: 'Mihai Ionescu', contactEmail: 'mihai.ionescu@example.test', contactPhone: '+40 723 000 309' },
];

const emptyForm = { name: '', cui: '', contactPerson: '', contactEmail: '', contactPhone: '' };

export function CustomersWorkspace() {
  const [customers, setCustomers] = useState(prototypeCustomers);
  const [query, setQuery] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return customers;
    return customers.filter((customer) => [customer.name, customer.cui, customer.contactPerson, customer.contactEmail, customer.contactPhone].some((value) => value.toLocaleLowerCase().includes(term)));
  }, [customers, query]);

  const saveCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setCustomers((items) => [{ ...form, id: `prototype-${Date.now()}`, name: form.name.trim() }, ...items]);
    setForm(emptyForm);
    setOpenForm(false);
    setSuccess('Client adăugat doar în această sesiune de prototipare.');
    setSaving(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setCustomers((items) => items.filter((customer) => customer.id !== deleteTarget.id));
    setSuccess('Rând eliminat din prototipul local; nicio modificare nu a fost trimisă.');
    setDeleteTarget(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hii-700">Portofoliu</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Clienți</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Registrul de clienți și datele de contact asociate proiectelor.</p>
        </div>
        <button type="button" onClick={() => { setOpenForm(true); setSuccess(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white hover:bg-hii-800"><Plus className="size-4" />Adaugă client</button>
      </header>

      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950"><span className="font-semibold">Prototip frontend.</span> API-ul pentru listarea și administrarea clienților nu este expus. Datele de exemplu și acțiunile de mai jos există numai în memoria paginii și nu se salvează pe server.</div>
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-900">Director clienți</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} rezultate · câmpuri conforme modelului Client</p></div>
          <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 px-3 sm:max-w-sm"><Search className="size-4 shrink-0 text-slate-400" /><span className="sr-only">Caută clienți</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nume, CUI sau contact" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" /></label>
        </div>

        {filtered.length === 0 ? <div className="px-5 py-14 text-center"><Building2 className="mx-auto size-10 text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-800">{customers.length ? 'Niciun rezultat' : 'Registrul este gol'}</h3><p className="mt-1 text-sm text-slate-500">{customers.length ? 'Schimbă termenul de căutare sau adaugă un client în prototip.' : 'Folosește acțiunea de mai sus pentru a explora formularul.'}</p></div> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filtered.map((customer) => <article key={customer.id} className="flex min-h-48 flex-col rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300">
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hii-50 text-hii-700"><Building2 className="size-5" /></span><div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{customer.name}</h3><p className="mt-1 text-xs text-slate-500">CUI · {customer.cui || 'Necompletat'}</p></div></div><button type="button" onClick={() => setDeleteTarget(customer)} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Elimină ${customer.name} din prototip`}><Trash2 className="size-4" /></button></div>
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600"><p className="flex items-center gap-2"><UserRound className="size-3.5 text-slate-400" />{customer.contactPerson || 'Persoană de contact nespecificată'}</p><a href={`mailto:${customer.contactEmail}`} className="flex min-h-8 items-center gap-2 break-all hover:text-hii-700"><Mail className="size-3.5 shrink-0 text-slate-400" />{customer.contactEmail || 'Email nespecificat'}</a><a href={`tel:${customer.contactPhone}`} className="flex min-h-8 items-center gap-2 hover:text-hii-700"><Phone className="size-3.5 text-slate-400" />{customer.contactPhone || 'Telefon nespecificat'}</a></div>
            </article>)}
          </div>
        )}
      </section>

      {openForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setOpenForm(false)}><section role="dialog" aria-modal="true" aria-labelledby="customer-form-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between"><div><h2 id="customer-form-title" className="text-lg font-bold text-slate-900">Client nou</h2><p className="mt-1 text-xs text-amber-800">Doar demonstrație — nu se salvează pe server.</p></div><button type="button" onClick={() => setOpenForm(false)} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100" aria-label="Închide formularul"><X className="size-5" /></button></div><form onSubmit={saveCustomer} className="mt-5 flex flex-col gap-4"><label className="text-sm font-medium text-slate-700">Denumire client *<input required value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-medium text-slate-700">CUI<input value={form.cui} onChange={(event) => setForm((previous) => ({ ...previous, cui: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Persoană de contact<input value={form.contactPerson} onChange={(event) => setForm((previous) => ({ ...previous, contactPerson: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-medium text-slate-700">Telefon<input type="tel" value={form.contactPhone} onChange={(event) => setForm((previous) => ({ ...previous, contactPhone: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label></div><label className="text-sm font-medium text-slate-700">Email contact<input type="email" value={form.contactEmail} onChange={(event) => setForm((previous) => ({ ...previous, contactEmail: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpenForm(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Anulează</button><button type="submit" disabled={saving || !form.name.trim()} className="min-h-11 rounded-lg bg-hii-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Se salvează local…' : 'Adaugă în prototip'}</button></div></form></section></div>}
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="customer-delete-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 id="customer-delete-title" className="text-base font-bold text-slate-900">Eliminare din prototip</h2><p className="mt-2 text-sm leading-6 text-slate-600">Elimini „{deleteTarget.name}” din lista locală de demonstrație? Acțiunea nu atinge date reale.</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Păstrează</button><button type="button" onClick={confirmDelete} className="min-h-11 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white">Elimină local</button></div></section></div>}
    </main>
  );
}

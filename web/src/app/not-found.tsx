import React from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
          <FileQuestion className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Pagina nu a fost găsită
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Pagina pe care încerci să o accesezi nu există sau a fost mutată.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg transition-colors"
        >
          Mergi la Panoul Principal
        </Link>
      </div>
    </div>
  );
}

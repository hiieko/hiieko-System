'use client';

import Link from 'next/link';
import { designReviewModules } from './DesignReviewWorkspace';

type ModuleAudit = {
  id: string;
  route: string;
  role: string;
  productionRoute: string;
  hierarchy: string[];
  boundary: string;
};

const moduleAudits: ModuleAudit[] = [
  { id: 'control-tower', route: '/design-review?module=control-tower', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [control-tower]', 'inline review-metrics → Metric × 4', 'inline review-content-grid → SectionCard "Atenție necesară" + SectionCard "Progres proiecte"', 'SectionCard "Activitate recentă" → TableFrame'], boundary: 'LOCAL MOCK; static portfolio, alert, project and activity values. The review module imports no API client.' },
  { id: 'worker-day', route: '/design-review?module=worker-day', role: 'WORKER (module name and worker-specific label)', productionRoute: '/', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [worker-day]', 'inline review-worker-welcome + review-weather', 'inline review-metrics → Metric × 3', 'SectionCard "Următoarea activitate" → StatusBadge; inline task/progress/meta', 'SectionCard "Restul zilei" → inline timeline'], boundary: 'LOCAL MOCK; the worker name, shift, weather, task and timeline are hard-coded in the review component.' },
  { id: 'tasks', route: '/design-review?module=tasks', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/tasks', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [tasks]', 'inline review-metrics → Metric × 3', 'SectionCard "Sarcini recente" → TableFrame → StatusBadge', 'SectionCard "Echipa pe teren" → inline avatar/status rows'], boundary: 'LOCAL MOCK; search is derived in ModuleContent from the local tasks array. This branch does not call task APIs.' },
  { id: 'planning', route: '/design-review?module=planning', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/planning', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [planning]', 'inline review-metrics → Metric × 3', 'SectionCard "Planificare · marți, 27 octombrie" → inline date strip and plan summary', 'SectionCard "Plan de lucru" → TableFrame → StatusBadge', 'SectionCard "Echipa pe teren" → inline avatar/status rows'], boundary: 'LOCAL MOCK; calendar, crew and plan values are fixed review data.' },
  { id: 'problems', route: '/design-review?module=problems', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/issues', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [problems]', 'inline review-metrics → Metric × 3', 'SectionCard "Probleme active" → inline review-issue-list → inline review-issue-card × 2 → StatusBadge'], boundary: 'LOCAL MOCK; displayed issue records are hard-coded, no issue API is called from this branch.' },
  { id: 'attendance', route: '/design-review?module=attendance', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/pontaj', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [attendance]', 'inline local-only note', 'inline review-metrics → Metric × 3', 'SectionCard "Registru pontaj · Valea Mare" → inline date strip + TableFrame → StatusBadge', 'SectionCard "Istoric corecții" → inline history rows + StatusBadge'], boundary: 'LOCAL MOCK + UI STATE; the "Corectează" control only invokes onPrototypeAction, which displays a temporary local notice. No correction modal is rendered by this review route.' },
  { id: 'reports', route: '/design-review?module=reports', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/rapoarte and /rapoarte/form', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [reports]', 'inline review-metrics (four report-status metrics)', 'inline daily-report register/list → review data and status elements'], boundary: 'LOCAL MOCK; report rows and status counts are hard-coded. Review buttons do not submit a report.' },
  { id: 'deliveries', route: '/design-review?module=deliveries', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/avize', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [deliveries]', 'inline review-metrics → Metric × 3', 'SectionCard "Avize și livrări" → TableFrame / inline delivery rows → StatusBadge'], boundary: 'LOCAL MOCK; supplier, delivery and receipt data are static in DesignReviewWorkspace.' },
  { id: 'stock', route: '/design-review?module=stock', role: 'NOT FOUND IN CURRENT SOURCE', productionRoute: '/stocuri', hierarchy: ['DesignReviewPage → DesignReviewWorkspace → ModuleContent [stock]', 'inline review-metrics → Metric × 3', 'SectionCard "Inventar materiale" → TableFrame → StatusBadge'], boundary: 'LOCAL MOCK; balances and movements are hard-coded.' },
];

function AuditTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="align-top">
            {row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell.slice(0, 18)}`} className="px-4 py-3 leading-6 text-slate-700">{cell}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ModuleTree({ audit }: { audit: ModuleAudit }) {
  return (
    <details id={`module-${audit.id}`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
        <span className="font-semibold text-slate-900">{designReviewModules.find((module) => module.id === audit.id)?.name ?? audit.id}</span>
        <span className="ml-3 text-xs text-slate-500">{audit.route}</span>
      </summary>
      <div className="grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,.9fr)]">
        <div>
          <dl className="grid gap-3 text-sm sm:grid-cols-[150px_1fr]">
            <dt className="font-semibold text-slate-500">MODULE</dt><dd>{designReviewModules.find((module) => module.id === audit.id)?.name}</dd>
            <dt className="font-semibold text-slate-500">ROUTE</dt><dd><code>{audit.route}</code></dd>
            <dt className="font-semibold text-slate-500">PRIMARY USER ROLES</dt><dd>{audit.role}</dd>
            <dt className="font-semibold text-slate-500">PRODUCTION ROUTE</dt><dd><code>{audit.productionRoute}</code></dd>
            <dt className="font-semibold text-slate-500">DATA BOUNDARY</dt><dd>{audit.boundary}</dd>
          </dl>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">COMPONENT TREE</h4>
          <ol className="flex flex-col gap-2 rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-success-soft">
            {audit.hierarchy.map((item) => <li key={item}>├─ {item}</li>)}
          </ol>
        </div>
      </div>
    </details>
  );
}

export function DesignReviewArchitecture() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-success-foreground">HIIEKO · DESIGN REVIEW</p>
            <h1 className="truncate text-lg font-bold sm:text-xl">Frontend Architecture</h1>
          </div>
          <Link href="/design-review" className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to Design Review</Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-7 sm:px-6 sm:py-10">
        <section aria-labelledby="module-tree" className="flex flex-col gap-4">
          <div><h2 id="module-tree" className="text-xl font-bold">Module Architecture</h2></div>
          <div className="flex flex-col gap-3">{moduleAudits.map((audit) => <ModuleTree key={audit.id} audit={audit} />)}</div>
        </section>
      </div>
    </main>
  );
}

export default DesignReviewArchitecture;
export { moduleAudits };
export type { ModuleAudit };

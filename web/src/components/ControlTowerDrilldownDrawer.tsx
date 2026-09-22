'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Boxes,
  Users,
  ShieldAlert,
  Layers,
  ChevronRight,
  Search,
  ExternalLink,
} from 'lucide-react';

export interface DrilldownData {
  isOpen: boolean;
  title: string;
  category: string;
  ruleExplanation: string;
  items: any[];
}

interface ControlTowerDrilldownDrawerProps {
  data: DrilldownData | null;
  onClose: () => void;
}

export function ControlTowerDrilldownDrawer({
  data,
  onClose,
}: ControlTowerDrilldownDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (data?.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [data?.isOpen, onClose]);

  if (!data || !data.isOpen) return null;

  const filteredItems = data.items.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white border-b border-slate-800 flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500 text-slate-950 uppercase tracking-wider">
                  {data.category}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {filteredItems.length} {filteredItems.length === 1 ? 'înregistrare' : 'înregistrări'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{data.title}</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                <span className="font-semibold text-slate-300">Regulă Deterministică:</span>{' '}
                {data.ruleExplanation}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Închide fereastra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Filter */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrează înregistrările după cod, nume, responsabil..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-900">
                  Nicio problemă detectată
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Nu există înregistrări care să încalce această regulă operațională.
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <DrilldownItemCard key={item.id || idx} item={item} category={data.category} />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Sursă date: API NestJS & PostgreSQL HIIEKO Master DB</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
            >
              Închide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrilldownItemCard({ item, category }: { item: any; category: string }) {
  // 1. BLOCKED TASKS
  if (item.blockedReason !== undefined || category === 'PRODUCTION_BLOCKED') {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 transition-colors shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-rose-200 text-rose-800 rounded">
                {item.taskCode}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {item.projectName} {item.zoneName ? `(${item.zoneName})` : ''}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.title}</h4>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold bg-rose-600 text-white rounded uppercase">
            Blocat
          </span>
        </div>

        <div className="mt-3 p-3 bg-white rounded-lg border border-rose-200 text-xs space-y-1.5">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-rose-900 font-medium">{item.blockedReason}</span>
          </div>
          {item.blockingTasks && item.blockingTasks.length > 0 && (
            <div className="text-slate-600 pl-6">
              <span className="font-semibold text-slate-700">Blocat de sarcinile:</span>{' '}
              {item.blockingTasks.join(', ')}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span className="font-medium text-slate-700">Responsabil:</span>{' '}
            {item.responsiblePerson || 'Nealocat'}
          </div>
          {item.assignedWorkers && item.assignedWorkers.length > 0 && (
            <div>
              <span className="font-medium text-slate-700">Muncitori alocați:</span>{' '}
              {item.assignedWorkers.join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. OVERDUE PROJECTS
  if (item.daysOverdue !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 transition-colors shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                {item.projectCode}
              </span>
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded">
                {item.stage}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.projectName}</h4>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-rose-600 text-white rounded-full">
            +{item.daysOverdue} zile întârziere
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">Termen limită inițial:</span>{' '}
            {item.targetEndDate ? item.targetEndDate.split('T')[0] : 'Nespecificat'}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Manager Proiect:</span>{' '}
            {item.responsiblePerson}
          </div>
        </div>
      </div>
    );
  }

  // 3. UPCOMING DEADLINES
  if (item.daysUntilDeadline !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/80 transition-colors shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
              {item.projectCode}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.projectName}</h4>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-full">
            {item.daysUntilDeadline} zile rămase
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">Data țintă:</span>{' '}
            {item.targetDate ? item.targetDate.split('T')[0] : ''}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Responsabil:</span>{' '}
            {item.responsiblePerson}
          </div>
        </div>
      </div>
    );
  }

  // 4. MISSING WORKFORCE
  if (item.expectedAt !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{item.fullName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Rol: <span className="font-medium text-slate-700">{item.role}</span> &bull; Șantier:{' '}
              <span className="font-medium text-slate-700">{item.projectName}</span>
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 rounded">
            Lipsă la pontaj
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Ora așteptată de sosire:{' '}
            <strong className="text-slate-700">{item.expectedAt}</strong>
          </span>
          <span>
            Responsabil raportare:{' '}
            <strong className="text-slate-700">{item.responsiblePerson}</strong>
          </span>
        </div>
      </div>
    );
  }

  // 5. OVERTIME WORKFORCE
  if (item.overtimeMinutes !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 hover:bg-blue-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{item.fullName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Șantier: <span className="font-medium text-slate-700">{item.projectName}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-blue-600 text-white rounded-full">
            {item.overtimeHours} ({item.overtimeMinutes} min)
          </span>
        </div>
      </div>
    );
  }

  // 6. LOW STOCK MATERIALS
  if (item.deficit !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                {item.materialCode}
              </span>
              <span className="text-xs text-slate-500">
                {item.warehouseName || item.projectName || 'Depozit'}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.materialName}</h4>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-full">
            Deficit: -{item.deficit} {item.unit}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">Stoc curent:</span>{' '}
            <strong className="text-rose-600">{item.currentQuantity}</strong> {item.unit}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Prag minim de siguranță:</span>{' '}
            <strong>{item.minThreshold}</strong> {item.unit}
          </div>
        </div>
      </div>
    );
  }

  // 7. PENDING DELIVERIES (Avize)
  if (item.avizNumber !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                {item.avizNumber}
              </span>
              <span className="text-xs text-slate-500">{item.projectName}</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.supplierName}</h4>
          </div>
          <span className="text-xs text-slate-500">
            {item.deliveryDate ? item.deliveryDate.split('T')[0] : ''}
          </span>
        </div>

        {item.items && item.items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
            <span className="font-semibold text-slate-700">Materiale recepționate:</span>
            {item.items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between pl-2">
                <span>{it.materialName}</span>
                <span className="font-mono font-medium">
                  {it.quantity} {it.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 8. FAILED INSPECTIONS
  if (item.failedParameters !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{item.projectName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspector: <span className="font-medium text-slate-700">{item.inspectorName}</span>
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-bold bg-rose-600 text-white rounded uppercase">
            Inspecție Eșuată
          </span>
        </div>

        <div className="mt-3 p-3 bg-white rounded-lg border border-rose-200 text-xs space-y-1">
          <span className="font-semibold text-rose-900">Parametri sub pragul de toleranță:</span>
          {item.failedParameters.map((param: any, pIdx: number) => (
            <div key={pIdx} className="flex justify-between text-rose-700">
              <span>{param.parameter}</span>
              <span className="font-mono font-bold">
                {param.value} {param.unit} (RESPINS)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 9. OPEN NCR
  if (item.ncrNumber !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-rose-200 text-rose-800 rounded">
              {item.ncrNumber}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.projectName}</h4>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
            {item.status}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-700">{item.description}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Data: {item.createdAt ? item.createdAt.split('T')[0] : ''}</span>
          <span>Responsabil: {item.responsiblePerson}</span>
        </div>
      </div>
    );
  }

  // 10. SUPERSEDED DOCUMENTS
  if (item.latestVersion !== undefined) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/70 transition-colors shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-800 font-mono rounded">
              {item.documentType}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.title}</h4>
            <p className="text-xs text-slate-500">{item.projectName}</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-full">
            Versiune v{item.currentVersion} (disponibil v{item.latestVersion})
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          Documentul din șantier a fost înlocuit cu o revizie nouă aprobată. Necesită actualizare imediată.
        </div>
      </div>
    );
  }

  // 11. RED FLAGS
  if (item.severity !== undefined && item.affectedEntity !== undefined) {
    const isCritical = item.severity === 'CRITICAL';
    return (
      <div
        className={`p-4 rounded-xl border ${
          isCritical
            ? 'border-rose-300 bg-rose-50/60'
            : 'border-amber-300 bg-amber-50/60'
        } shadow-sm`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded ${
                isCritical
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500 text-slate-950'
              }`}
            >
              {item.severity}
            </span>
            <span className="text-xs font-semibold text-slate-600 uppercase">
              {item.category}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {item.timestamp ? item.timestamp.split('T')[0] : ''}
          </span>
        </div>

        <h4 className="text-sm font-bold text-slate-900 mt-2">{item.affectedEntity}</h4>
        <p className="text-xs text-slate-800 mt-1 font-medium">{item.reason}</p>

        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
          <span>
            Responsabil: <strong className="text-slate-700">{item.responsiblePerson}</strong>
          </span>
          <span>
            Sursă: <span className="font-mono">{item.sourceRecord}</span>
          </span>
        </div>
      </div>
    );
  }

  // DEFAULT / ACTIVE PROJECTS
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
            {item.code || item.id}
          </span>
          <h4 className="text-sm font-semibold text-slate-900 mt-1">{item.name || item.title}</h4>
        </div>
        {item.stage && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
            {item.stage}
          </span>
        )}
      </div>
      {item.progressPercent !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Progres Lucrări</span>
            <span>{item.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full"
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

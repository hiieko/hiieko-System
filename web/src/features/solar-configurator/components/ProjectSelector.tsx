'use client';

import { useState } from 'react';

export interface ProjectOption {
  id: string;
  name: string;
  code?: string;
}

export function ProjectSelector({
  projects,
  projectId,
  designs,
  designId,
  onSelectProject,
  onSelectDesign,
  onCreateDesign,
  loading,
}: {
  projects: ProjectOption[];
  projectId: string;
  designs: Array<{ id: string; name: string }>;
  designId: string;
  onSelectProject: (id: string) => void;
  onSelectDesign: (id: string) => void;
  onCreateDesign: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Proiect</label>
        <select
          value={projectId}
          onChange={(e) => onSelectProject(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">— Selectează proiectul —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.code ? `(${p.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      {projectId && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Design existent</label>
            <select
              value={designId}
              onChange={(e) => onSelectDesign(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">— Design nou —</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nume design"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
            <button
              type="button"
              disabled={!name.trim() || loading}
              onClick={() => {
                onCreateDesign(name.trim());
                setName('');
              }}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-sm font-semibold rounded-lg"
            >
              Creează
            </button>
          </div>
        </>
      )}
    </div>
  );
}

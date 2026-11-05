'use client';

import React, { useState } from 'react';
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  Folder,
  FolderOpen,
  LockKeyhole,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import type { DocumentFolder, DocumentFolderListResponse } from '../../../lib/api-client';
import { DropdownMenu } from '../../../components/ui';
import type { UploadProject } from './DocumentUploadCard';

export type FolderSelection =
  | { scope: 'all' }
  | { scope: 'company'; folderId?: string; unfiled?: boolean }
  | { scope: 'project'; projectId: string; folderId?: string; unfiled?: boolean };

export type FolderScope = { projectId?: string };

export type FolderManagementRequest =
  | { kind: 'create'; scope: FolderScope; parentId?: string }
  | { kind: 'rename' | 'move' | 'delete'; scope: FolderScope; folder: DocumentFolder };

interface DocumentFolderExplorerProps {
  projects: UploadProject[];
  projectsLoading: boolean;
  projectsError: string | null;
  companyFolders: DocumentFolderListResponse | null;
  companyFoldersLoading: boolean;
  companyFoldersError: string | null;
  projectFolders: Record<string, DocumentFolderListResponse | undefined>;
  projectFoldersLoading: Record<string, boolean | undefined>;
  projectFoldersErrors: Record<string, string | undefined>;
  selection: FolderSelection;
  onLoadProjectFolders: (projectId: string) => void;
  onSelect: (selection: FolderSelection) => void;
  onFolderAction: (request: FolderManagementRequest) => void;
  onRetryCompanyFolders: () => void;
  onRetryProjects: () => void;
}

function isSelected(selection: FolderSelection, scope: FolderScope, folderId?: string, unfiled = false): boolean {
  if (scope.projectId) {
    return selection.scope === 'project' && selection.projectId === scope.projectId &&
      selection.folderId === folderId && Boolean(selection.unfiled) === unfiled;
  }
  return selection.scope === 'company' && selection.folderId === folderId && Boolean(selection.unfiled) === unfiled;
}

function folderActions(
  folder: DocumentFolder,
  canManage: boolean,
  scope: FolderScope,
  onAction: (request: FolderManagementRequest) => void,
  locale: 'ro' | 'en',
) {
  const templateDerived = Boolean(folder.template_folder_key || folder.source_template_version_id);
  const mutable = canManage && !templateDerived && folder.protection_policy !== 'IMMUTABLE';
  const items = [];
  if (mutable && folder.allow_custom_children) {
    items.push({
      key: 'create-child',
      label: t('documents.folder_new_child', locale),
      icon: <Plus className="size-4" aria-hidden="true" />,
      onClick: () => onAction({ kind: 'create', scope, parentId: folder.id }),
    });
  }
  if (mutable) {
    items.push({ key: 'rename', label: t('documents.folder_action_rename', locale), onClick: () => onAction({ kind: 'rename', scope, folder }) });
    items.push({ key: 'move', label: t('documents.folder_action_move', locale), onClick: () => onAction({ kind: 'move', scope, folder }) });
  }
  if (canManage && !templateDerived && folder.protection_policy === 'STANDARD') {
    items.push({ key: 'delete', label: t('documents.folder_action_delete', locale), onClick: () => onAction({ kind: 'delete', scope, folder }) });
  }
  return items;
}

function FolderTreeNodes({
  parentId,
  folders,
  scope,
  selection,
  canManage,
  expandedFolders,
  toggleFolder,
  onSelect,
  onAction,
  depth = 0,
}: {
  parentId: string | null;
  folders: DocumentFolder[];
  scope: FolderScope;
  selection: FolderSelection;
  canManage: boolean;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onSelect: (selection: FolderSelection) => void;
  onAction: (request: FolderManagementRequest) => void;
  depth?: number;
}) {
  const { locale } = useLocale();
  const children = folders.filter((folder) => folder.parent_id === parentId)
    .sort((left, right) => left.name.localeCompare(right.name));

  return (
    <ul className="space-y-0.5" role={depth === 0 ? 'group' : undefined}>
      {children.map((folder) => {
        const hasChildren = folders.some((candidate) => candidate.parent_id === folder.id);
        const expanded = expandedFolders.has(folder.id);
        const selected = isSelected(selection, scope, folder.id);
        const templateDerived = Boolean(folder.template_folder_key || folder.source_template_version_id);
        const actions = folderActions(folder, canManage, scope, onAction, locale);
        return (
          <li key={folder.id}>
            <div className={`group flex min-w-0 items-center gap-0.5 rounded-lg pr-1 ${selected ? 'bg-hii-50 text-hii-800' : 'text-slate-700 hover:bg-slate-50'}`}>
              <span className="w-2 shrink-0" style={{ marginInlineStart: depth * 12 }} />
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-hii-500 disabled:invisible"
                aria-label={expanded ? t('documents.folder_collapse', locale) : t('documents.folder_expand', locale)}
                aria-expanded={expanded}
                disabled={!hasChildren}
                onClick={() => toggleFolder(folder.id)}
              >
                {hasChildren ? expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
              </button>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded py-1 text-left text-sm focus:outline-none focus:ring-2 focus:ring-hii-500"
                onClick={() => onSelect(scope.projectId
                  ? { scope: 'project', projectId: scope.projectId, folderId: folder.id }
                  : { scope: 'company', folderId: folder.id })}
                title={folder.name}
              >
                {expanded ? <FolderOpen className="size-4 shrink-0" aria-hidden="true" /> : <Folder className="size-4 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {templateDerived && <LockKeyhole className="size-3.5 shrink-0 text-slate-400" aria-label={t('documents.folder_template_protected', locale)} />}
              </button>
              {actions.length > 0 && <DropdownMenu
                trigger={<><MoreHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">{t('documents.folder_actions', locale)}</span></>}
                items={actions}
                className="text-slate-500 [&>button]:grid [&>button]:size-7 [&>button]:place-items-center [&>button]:rounded [&>button]:hover:bg-white"
              />}
            </div>
            {expanded && hasChildren && <FolderTreeNodes
              parentId={folder.id}
              folders={folders}
              scope={scope}
              selection={selection}
              canManage={canManage}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onSelect={onSelect}
              onAction={onAction}
              depth={depth + 1}
            />}
          </li>
        );
      })}
    </ul>
  );
}

export function DocumentFolderExplorer({
  projects,
  projectsLoading,
  projectsError,
  companyFolders,
  companyFoldersLoading,
  companyFoldersError,
  projectFolders,
  projectFoldersLoading,
  projectFoldersErrors,
  selection,
  onLoadProjectFolders,
  onSelect,
  onFolderAction,
  onRetryCompanyFolders,
  onRetryProjects,
}: DocumentFolderExplorerProps) {
  const { locale } = useLocale();
  const [companyExpanded, setCompanyExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (id: string) => setExpandedFolders((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleProject = (projectId: string) => setExpandedProjects((previous) => {
    const next = new Set(previous);
    if (next.has(projectId)) next.delete(projectId);
    else {
      next.add(projectId);
      if (!projectFolders[projectId] && !projectFoldersLoading[projectId]) onLoadProjectFolders(projectId);
    }
    return next;
  });

  return (
    <nav className="space-y-1 p-2" data-testid="document-folder-explorer" aria-label={t('documents.folders_nav_aria', locale)}>
      <button type="button" aria-current={selection.scope === 'all' ? 'page' : undefined} onClick={() => onSelect({ scope: 'all' })} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm ${selection.scope === 'all' ? 'bg-hii-50 font-semibold text-hii-800' : 'text-slate-600 hover:bg-slate-50'}`}>
        <BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" />{t('documents.folder_all_documents', locale)}
      </button>

      <section className="border-t border-slate-100 pt-1" aria-label={t('documents.folder_company_heading', locale)}>
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-7 place-items-center rounded hover:bg-slate-50" aria-label={companyExpanded ? t('documents.folder_collapse', locale) : t('documents.folder_expand', locale)} aria-expanded={companyExpanded} onClick={() => setCompanyExpanded((value) => !value)}>
            {companyExpanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
          </button>
          <button type="button" className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50" aria-current={isSelected(selection, {}, undefined) ? 'page' : undefined} onClick={() => onSelect({ scope: 'company' })}>
            <FolderOpen className="size-4 shrink-0 text-slate-500" aria-hidden="true" />{t('documents.folder_company_heading', locale)}
          </button>
          {companyFolders?.canManage && <button type="button" className="grid size-8 shrink-0 place-items-center rounded text-slate-500 hover:bg-hii-50 hover:text-hii-800" aria-label={t('documents.folder_new', locale)} onClick={() => onFolderAction({ kind: 'create', scope: {} })}><Plus className="size-4" aria-hidden="true" /></button>}
        </div>
        {companyExpanded && <div className="ml-2 border-l border-slate-100 pl-1">
          <button type="button" aria-current={isSelected(selection, {}, undefined, true) ? 'page' : undefined} onClick={() => onSelect({ scope: 'company', unfiled: true })} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${isSelected(selection, {}, undefined, true) ? 'bg-hii-50 font-semibold text-hii-800' : 'text-slate-600 hover:bg-slate-50'}`}><FileQuestion className="size-4 shrink-0" aria-hidden="true" />{t('documents.folder_unfiled', locale)}</button>
          {companyFoldersLoading ? <p className="px-3 py-2 text-xs text-slate-500" role="status">{t('documents.folder_loading', locale)}</p> : companyFoldersError ? <div className="px-3 py-2 text-xs text-rose-700" role="alert"><p>{companyFoldersError}</p><button type="button" className="mt-1 underline" onClick={onRetryCompanyFolders}>{t('documents.folder_retry', locale)}</button></div> : !companyFolders?.folders.length ? <p className="px-3 py-2 text-xs text-slate-500">{t('documents.folder_empty', locale)}</p> : <FolderTreeNodes parentId={null} folders={companyFolders.folders} scope={{}} selection={selection} canManage={companyFolders.canManage} expandedFolders={expandedFolders} toggleFolder={toggleFolder} onSelect={onSelect} onAction={onFolderAction} />}
        </div>}
      </section>

      <section className="border-t border-slate-100 pt-1" aria-label={t('documents.folder_projects_heading', locale)}>
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-7 place-items-center rounded hover:bg-slate-50" aria-label={projectsExpanded ? t('documents.folder_collapse', locale) : t('documents.folder_expand', locale)} aria-expanded={projectsExpanded} onClick={() => setProjectsExpanded((value) => !value)}>
            {projectsExpanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
          </button>
          <span className="min-h-9 flex-1 content-center px-1 text-sm font-semibold text-slate-800">{t('documents.folder_projects_heading', locale)}</span>
        </div>
        {projectsExpanded && <div className="space-y-0.5">
          {projectsLoading ? <p className="px-3 py-2 text-xs text-slate-500" role="status">{t('documents.folder_loading', locale)}</p> : projectsError ? <div className="px-3 py-2 text-xs text-rose-700" role="alert"><p>{projectsError}</p><button type="button" className="mt-1 underline" onClick={onRetryProjects}>{t('documents.folder_retry', locale)}</button></div> : projects.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">{t('documents.projects_empty', locale)}</p> : projects.map((project) => {
            const expanded = expandedProjects.has(project.id);
            const response = projectFolders[project.id];
            const scope = { projectId: project.id };
            return <section key={project.id} className="min-w-0">
              <div className="flex min-w-0 items-center gap-0.5">
                <button type="button" className="grid size-7 shrink-0 place-items-center rounded hover:bg-slate-50" aria-label={expanded ? t('documents.folder_collapse', locale) : t('documents.folder_expand', locale)} aria-expanded={expanded} onClick={() => toggleProject(project.id)}>{expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}</button>
                <button type="button" className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-sm ${isSelected(selection, scope) ? 'bg-hii-50 font-semibold text-hii-800' : 'text-slate-600 hover:bg-slate-50'}`} aria-current={isSelected(selection, scope) ? 'page' : undefined} onClick={() => onSelect({ scope: 'project', projectId: project.id })} title={project.name}><BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{project.code ? `${project.code} — ` : ''}{project.name}</span></button>
                {response?.canManage && <button type="button" className="grid size-8 shrink-0 place-items-center rounded text-slate-500 hover:bg-hii-50 hover:text-hii-800" aria-label={`${t('documents.folder_new', locale)}: ${project.name}`} onClick={() => onFolderAction({ kind: 'create', scope })}><Plus className="size-4" aria-hidden="true" /></button>}
              </div>
              {expanded && <div className="ml-3 border-l border-slate-100 pl-1">
                {projectFoldersLoading[project.id] ? <p className="px-3 py-2 text-xs text-slate-500" role="status">{t('documents.folder_loading', locale)}</p> : projectFoldersErrors[project.id] ? <div className="px-3 py-2 text-xs text-rose-700" role="alert"><p>{projectFoldersErrors[project.id]}</p><button type="button" className="mt-1 underline" onClick={() => onLoadProjectFolders(project.id)}>{t('documents.folder_retry', locale)}</button></div> : response ? <>
                  <button type="button" aria-current={isSelected(selection, scope, undefined, true) ? 'page' : undefined} onClick={() => onSelect({ scope: 'project', projectId: project.id, unfiled: true })} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${isSelected(selection, scope, undefined, true) ? 'bg-hii-50 font-semibold text-hii-800' : 'text-slate-600 hover:bg-slate-50'}`}><FileQuestion className="size-4 shrink-0" aria-hidden="true" />{t('documents.folder_unfiled', locale)}</button>
                  {response.folders.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">{t('documents.folder_empty', locale)}</p> : <FolderTreeNodes parentId={null} folders={response.folders} scope={scope} selection={selection} canManage={response.canManage} expandedFolders={expandedFolders} toggleFolder={toggleFolder} onSelect={onSelect} onAction={onFolderAction} />}
                </> : <button type="button" className="px-3 py-2 text-xs text-hii-700 underline" onClick={() => onLoadProjectFolders(project.id)}>{t('documents.folder_load_project', locale)}</button>}
              </div>}
            </section>;
          })}
        </div>}
      </section>
    </nav>
  );
}

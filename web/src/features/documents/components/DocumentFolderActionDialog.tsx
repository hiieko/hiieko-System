'use client';

import { useEffect, useMemo, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { Button, Modal } from '../../../components/ui';
import type { DocumentFolder } from '../../../lib/api-client';
import type { FolderManagementRequest } from './DocumentFolderExplorer';

export type DocumentFolderActionRequest = FolderManagementRequest | {
  kind: 'fileDocument';
  scope: { projectId?: string };
  documentId: string;
  documentTitle: string;
  currentFolderId: string | null;
};

export type DocumentFolderActionPayload =
  | { name: string; parentId?: string }
  | { name: string }
  | { parentId: string | null }
  | { folderId: string | null }
  | Record<string, never>;

interface DocumentFolderActionDialogProps {
  request: DocumentFolderActionRequest | null;
  folders: DocumentFolder[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (request: DocumentFolderActionRequest, payload: DocumentFolderActionPayload) => void;
}

function descendantsOf(folderId: string, folders: DocumentFolder[]): Set<string> {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of folders) {
      if (child.parent_id === parentId && !descendants.has(child.id)) {
        descendants.add(child.id);
        visit(child.id);
      }
    }
  };
  visit(folderId);
  return descendants;
}

function folderPath(folder: DocumentFolder, folders: DocumentFolder[]): string {
  const byId = new Map(folders.map((candidate) => [candidate.id, candidate]));
  const names = [folder.name];
  let parentId = folder.parent_id;
  const seen = new Set<string>([folder.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return names.join(' / ');
}

export function DocumentFolderActionDialog({
  request,
  folders,
  saving,
  error,
  onClose,
  onSubmit,
}: DocumentFolderActionDialogProps) {
  const { locale } = useLocale();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [folderId, setFolderId] = useState('');

  useEffect(() => {
    if (!request) return;
    setName(request.kind === 'create' ? '' : request.kind === 'rename' ? request.folder.name : '');
    setParentId(request.kind === 'create' ? request.parentId ?? '' : request.kind === 'move' ? request.folder.parent_id ?? '' : '');
    setFolderId(request.kind === 'fileDocument' ? request.currentFolderId ?? '' : '');
  }, [request]);

  const eligibleFolders = useMemo(() => {
    if (request?.kind === 'move') {
      const excluded = descendantsOf(request.folder.id, folders);
      excluded.add(request.folder.id);
      return folders.filter((folder) => !excluded.has(folder.id) && folder.allow_custom_children);
    }
    return folders;
  }, [folders, request]);

  if (!request) return null;

  const scopeLabel = request.scope.projectId
    ? t('documents.folder_project_scope', locale)
    : t('documents.folder_company_scope', locale);
  const title = request.kind === 'create'
    ? t('documents.folder_create_title', locale)
    : request.kind === 'rename'
      ? t('documents.folder_rename_title', locale)
      : request.kind === 'move'
        ? t('documents.folder_move_title', locale)
        : request.kind === 'delete'
          ? t('documents.folder_delete_title', locale)
          : t('documents.folder_move_document_title', locale);

  const submit = () => {
    if (request.kind === 'create') {
      onSubmit(request, { name: name.trim(), ...(parentId ? { parentId } : {}) });
    } else if (request.kind === 'rename') {
      onSubmit(request, { name: name.trim() });
    } else if (request.kind === 'move') {
      onSubmit(request, { parentId: parentId || null });
    } else if (request.kind === 'fileDocument') {
      onSubmit(request, { folderId: folderId || null });
    } else {
      onSubmit(request, {});
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      size="md"
      title={title}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {t('general.cancel', locale)}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saving || ((request.kind === 'create' || request.kind === 'rename') && !name.trim())}
            loading={saving}
            onClick={submit}
          >
            {request.kind === 'create'
              ? t('documents.folder_create_submit', locale)
              : request.kind === 'move'
                ? t('documents.folder_move_submit', locale)
                : request.kind === 'delete'
                  ? t('documents.folder_delete_action', locale)
                  : request.kind === 'fileDocument'
                    ? t('documents.folder_move_document', locale)
                    : t('documents.folder_save', locale)}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">{scopeLabel}</p>
        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        {(request.kind === 'create' || request.kind === 'rename') && (
          <div>
            <label htmlFor="document-folder-name" className="mb-1 block text-sm font-medium text-slate-700">
              {t('documents.folder_name', locale)}
            </label>
            <input
              id="document-folder-name"
              className="hii-input w-full"
              maxLength={120}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
            {request.kind === 'create' && <p className="mt-1 text-xs text-slate-500">{t('documents.folder_create_hint', locale)}</p>}
          </div>
        )}

        {request.kind === 'create' && (
          <div>
            <label htmlFor="document-folder-parent" className="mb-1 block text-sm font-medium text-slate-700">
              {t('documents.folder_parent', locale)}
            </label>
            <select id="document-folder-parent" className="hii-select w-full" value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={saving}>
              <option value="">{t('documents.folder_root', locale)}</option>
              {folders.filter((folder) => folder.allow_custom_children).map((folder) => (
                <option key={folder.id} value={folder.id}>{folderPath(folder, folders)}</option>
              ))}
            </select>
          </div>
        )}

        {request.kind === 'move' && (
          <div>
            <label htmlFor="document-folder-move-parent" className="mb-1 block text-sm font-medium text-slate-700">
              {t('documents.folder_parent', locale)}
            </label>
            <select id="document-folder-move-parent" className="hii-select w-full" value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={saving}>
              <option value="">{t('documents.folder_root', locale)}</option>
              {eligibleFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folderPath(folder, folders)}</option>
              ))}
            </select>
          </div>
        )}

        {request.kind === 'fileDocument' && (
          <div>
            <p className="break-words text-sm font-medium text-slate-800">{request.documentTitle}</p>
            <label htmlFor="document-file-folder" className="mb-1 mt-3 block text-sm font-medium text-slate-700">
              {t('documents.folder_parent', locale)}
            </label>
            <select id="document-file-folder" className="hii-select w-full" value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={saving}>
              <option value="">{t('documents.folder_unfiled', locale)}</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder, folders)}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">{t('documents.folder_move_document_hint', locale)}</p>
          </div>
        )}

        {request.kind === 'delete' && (
          <p className="break-words text-sm leading-6 text-slate-600">
            <strong className="text-slate-900">{request.folder.name}</strong>
            <br />{t('documents.folder_delete_confirm', locale)}
          </p>
        )}
      </div>
    </Modal>
  );
}

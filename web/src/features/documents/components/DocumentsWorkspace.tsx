'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileText,
  FileCode2,
  Files,
  HardDrive,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  List,
  BrainCircuit,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  FolderOpen,
  Tag,
  X,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { t, useLocale, type Locale } from '@solar/shared';
import {
  apiClient,
  ApiError,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentListSummary,
} from '../../../lib/api-client';
import { Breadcrumbs, Button, Card, DropdownMenu, EmptyState, ErrorState, Pagination, Skeleton } from '../../../components/ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../components/ui/Toast';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL_KEYS,
  formatBytes,
  formatDateTime,
  isImage,
  isXml,
  isPreviewable,
} from '../documents.constants';
import { DocumentUploadCard, type UploadProject } from './DocumentUploadCard';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentMetadataEditor } from './DocumentMetadataEditor';
import { suggestDocumentClassification } from '../documents.classification';

type ViewMode = 'explorer' | 'projects' | 'recent' | 'search';
type FileFamily = keyof DocumentListSummary['fileTypeCounts'];

const FILE_FAMILY_META: Array<{
  id: FileFamily;
  filter: string;
  labelKey: string;
  color: string;
}> = [
  { id: 'pdf', filter: 'application/pdf', labelKey: 'documents.file_type_pdf', color: '#1686c8' },
  { id: 'images', filter: 'image/*', labelKey: 'documents.file_type_images', color: '#10a889' },
  { id: 'xml', filter: 'application/xml', labelKey: 'documents.file_type_xml', color: '#8558e8' },
  { id: 'other', filter: 'other', labelKey: 'documents.file_type_other', color: '#e98231' },
];

function documentFileVisual(mimeType: string | null, locale: Locale) {
  if (mimeType?.includes('pdf')) return { label: 'PDF', Icon: FileText };
  if (isImage(mimeType)) return { label: 'IMG', Icon: ImageIcon };
  if (isXml(mimeType)) return { label: 'XML', Icon: FileCode2 };

  // MIME type is derived from the stored key. If it is unknown, keep the
  // generic file treatment rather than guessing from an editable document title.
  return { label: t('documents.mime_other', locale), Icon: FileText };
}

const DEBOUNCE_MS = 350;

/** The filters the API actually supports. */
interface DocumentFilters {
  /** Free-text search over title and code. */
  q: string;
  /** Restrict to one authorized project. */
  projectId: string;
  /** Restrict to one document category. */
  documentType: string;
  /** Restrict to a MIME family derived from the stored object key. */
  mimeType: string;
  /** Inclusive lower bound on the creation date (YYYY-MM-DD). */
  from: string;
  /** Inclusive upper bound on the creation date (YYYY-MM-DD). */
  to: string;
}

const EMPTY_FILTERS: DocumentFilters = {
  q: '',
  projectId: '',
  documentType: '',
  mimeType: '',
  from: '',
  to: '',
};

/**
 * HIIEKO - Documents workspace.
 *
 * Everything shown here comes from the real backend:
 *   - `GET /api/projects` for the authorized projects,
 *   - `GET /api/documents` for the visible, filtered and paginated list,
 *   - `GET /api/documents/:id` for the details panel,
 *   - `POST /api/documents` / `POST /api/documents/:id/versions` for the writes,
 *   - `GET /api/upload/:documentId` for the preview and the download.
 *
 * The server decides what the user may see; the client only narrows the
 * query with the filters the API actually supports.
 */
export function DocumentsWorkspace() {
  const { locale } = useLocale();
  const toast = useToast();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [view, setView] = useState<ViewMode>('explorer');
  const [presentation, setPresentation] = useState<'grid' | 'list'>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [projectsTreeOpen, setProjectsTreeOpen] = useState(true);
  const [categoriesTreeOpen, setCategoriesTreeOpen] = useState(true);
  const [projects, setProjects] = useState<UploadProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>(EMPTY_FILTERS);
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<DocumentListSummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentListItem | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DocumentDetail | null>(null);
  const [selectedDetailLoading, setSelectedDetailLoading] = useState(false);
  const [selectedDetailError, setSelectedDetailError] = useState<string | null>(null);
  const [selectedDetailRetry, setSelectedDetailRetry] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageSize = isMobile ? 10 : 20;
  const { q: query, projectId: filterProjectId, documentType, mimeType, from, to } = filters;

  /**
   * Apply a filter change and return to the first page. Both updates are
   * batched, so a filter change triggers exactly one list request.
   */
  const updateFilters = useCallback((patch: Partial<DocumentFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
    setSelectedDocumentId(null);
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        const nextQuery = searchInput.trim();
        if (nextQuery !== query) updateFilters({ q: nextQuery });
      },
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput, query, updateFilters]);

  // ── Authorized projects ───────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await apiClient.getProjects();
      const rows = (response.data ?? []) as UploadProject[];
      setProjects(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      setProjects([]);
      setProjectsError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.error_title', locale),
      );
    } finally {
      setProjectsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // ── Documents list ────────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.listDocuments({
        q: query || undefined,
        projectId: filterProjectId || undefined,
        documentType: documentType || undefined,
        mimeType: mimeType || undefined,
        from: from || undefined,
        to: to || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      const payload = response.data;
      setDocuments(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === 'number' ? payload.total : 0);
      setSummary(payload?.summary ?? null);
    } catch (err: unknown) {
      setDocuments([]);
      setTotal(0);
      setSummary(null);
      setLoadError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.error_title', locale),
      );
    } finally {
      setLoading(false);
    }
  }, [query, filterProjectId, documentType, mimeType, from, to, page, pageSize, sortBy, sortOrder, locale]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  useEffect(() => {
    if (previewDocument && previewDocument.id !== selectedDocumentId) setPreviewDocument(null);
  }, [previewDocument, selectedDocumentId]);

  const selectedSuggestions = useMemo(() => selectedDocument
    ? suggestDocumentClassification({
        fileName: selectedDocument.title,
        title: selectedDocument.title,
        code: selectedDocument.code,
        mimeType: selectedDocument.mime_type,
        currentCategory: selectedDocument.document_type,
        projects,
      })
    : null, [selectedDocument, projects]);

  useEffect(() => {
    if (!selectedDocumentId || !selectedDocument) {
      setSelectedDetail(null);
      setSelectedDetailError(null);
      setSelectedDetailLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedDetail(null);
    setSelectedDetailError(null);
    setSelectedDetailLoading(true);

    void apiClient.getDocument(selectedDocumentId)
      .then((response) => {
        if (cancelled) return;
        if (response.error || !response.data) {
          throw new Error(response.error || t('documents.details_error', locale));
        }
        setSelectedDetail(response.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSelectedDetailError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : t('documents.details_error', locale),
        );
      })
      .finally(() => {
        if (!cancelled) setSelectedDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId, selectedDocument?.id, selectedDetailRetry, locale]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Every filter change returns to the first page.
  const hasFilters = Boolean(
    query || documentType || mimeType || from || to || filterProjectId,
  );

  const resetFilters = () => {
    setSearchInput('');
    updateFilters(EMPTY_FILTERS);
    setSelectedDocumentId(null);
    setUploadProjectId('');
    setView('explorer');
  };

  const selectProject = (projectId: string) => {
    updateFilters({ projectId });
    setUploadProjectId(projectId);
    setView('projects');
  };

  const openExplorer = () => {
    setView('explorer');
    setUploadProjectId('');
    updateFilters({ projectId: '' });
  };

  const openProjects = () => {
    setView('projects');
    setProjectsTreeOpen(true);
    setSelectedDocumentId(null);
  };

  const openRecent = () => {
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setView('recent');
    setSearchInput('');
    setFilters({ ...EMPTY_FILTERS, from: fromDate, to: toDate });
    setUploadProjectId('');
    setPage(1);
    setSelectedDocumentId(null);
  };

  const openSearch = () => {
    setView('search');
    searchInputRef.current?.focus();
  };

  const selectPage = (nextPage: number) => {
    setSelectedDocumentId(null);
    setPage(nextPage);
  };

  const typeLabel = useCallback(
    (value: string) =>
      t(
        DOCUMENT_TYPE_LABEL_KEYS[value as keyof typeof DOCUMENT_TYPE_LABEL_KEYS] ??
          'documents.type_other',
        locale,
      ),
    [locale],
  );

  const download = async (document: DocumentListItem) => {
    try {
      const blob = await apiClient.downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.title;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(
        t('documents.download_error', locale),
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.download_error', locale),
      );
    }
  };

  const projectLabel = useMemo(
    () => (id: string) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return t('documents.no_project', locale);
      return project.code ? `${project.code} — ${project.name}` : project.name;
    },
    [projects, locale],
  );

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === 'ro' ? 'ro-RO' : 'en-GB').format(value);

  const changeSort = (value: string) => {
    const [field, order] = value.split('-') as ['updated' | 'created' | 'title', 'asc' | 'desc'];
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
    setSelectedDocumentId(null);
  };

  const refresh = () => {
    void Promise.all([loadProjects(), loadDocuments()]);
  };

  const handleUploaded = () => {
    if (page === 1) {
      void loadDocuments();
    } else {
      setSelectedDocumentId(null);
      setPage(1);
    }
  };

  const handleDocumentChanged = () => {
    void loadDocuments();
    if (selectedDocumentId) setSelectedDetailRetry((retry) => retry + 1);
  };

  const handleMetadataSaved = (updated: DocumentDetail) => {
    setDocuments((current) => current.map((document) => document.id === updated.id ? updated : document));
    setSelectedDetail(updated);
    void loadDocuments();
  };

  const rows = documents.map((document) => {
    const { Icon: TypeIcon, label: typeBadge } = documentFileVisual(document.mime_type, locale);

    return (
      <tr
        key={document.id}
        aria-selected={selectedDocumentId === document.id}
        className={`group transition-colors ${selectedDocumentId === document.id ? 'bg-hii-50/70' : 'hover:bg-slate-50/80'}`}
      >
        <td className="py-3.5 pl-4 pr-3">
          <button
            type="button"
            onClick={() => setSelectedDocumentId(document.id)}
            aria-pressed={selectedDocumentId === document.id}
            className="flex min-w-0 w-full items-center gap-3 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-hii-500"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedDocumentId === document.id ? 'bg-white text-hii-700' : 'bg-slate-100 text-slate-600 group-hover:bg-white'}`}>
              <TypeIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-[22rem] truncate font-semibold text-slate-900" title={document.title}>
                {document.title}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                  {typeBadge}
                </span>
                {document.code && <span className="truncate font-mono">{document.code}</span>}
                {document.uploaded_by_name && <span className="hidden truncate xl:inline">{document.uploaded_by_name}</span>}
              </span>
            </span>
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
          {typeLabel(document.document_type)}
        </td>
        <td className="max-w-[14rem] px-3 py-3.5 text-sm text-slate-600">
          <span className="block truncate" title={projectLabel(document.project_id ?? '')}>
            {projectLabel(document.project_id ?? '')}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
          <span className="block font-medium tabular-nums">v{document.current_version}</span>
          <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
            {formatBytes(document.file_size)}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
          {formatDateTime(document.updated_at, locale)}
        </td>
        <td className="whitespace-nowrap py-3 pl-2 pr-4">
          <div className="flex justify-end">
            <DropdownMenu
              trigger={<><MoreHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">{t('documents.action_more', locale)}</span></>}
              items={[
                { key: 'details', label: t('documents.action_details', locale), icon: <Info className="size-4" />, onClick: () => {
                  setSelectedDocumentId(document.id);
                  setDetailId(document.id);
                } },
                { key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => {
                  setSelectedDocumentId(document.id);
                  setPreviewDocument(document);
                } },
                { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
              ]}
              className="text-slate-500 hover:text-slate-900 [&>button]:size-8 [&>button]:justify-center [&>button]:rounded [&>button]:hover:bg-slate-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-hii-500"
            />
          </div>
        </td>
      </tr>
    );
  });

  const cards = (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
      {documents.map((document) => {
        const { Icon: TypeIcon, label: typeBadge } = documentFileVisual(document.mime_type, locale);

        return (
          <Card
            key={document.id}
            className={`flex h-full flex-col gap-2 p-3 shadow-none ${selectedDocumentId === document.id ? 'border-hii-500 bg-hii-50/30 ring-1 ring-hii-500/20' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-600">
                <TypeIcon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setSelectedDocumentId(document.id)}
                  aria-pressed={selectedDocumentId === document.id}
                  className="block max-w-full truncate text-left font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-hii-500"
                  title={document.title}
                >{document.title}</button>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600">{typeBadge}</span>
                  <span className="truncate">{typeLabel(document.document_type)}</span>
                </div>
              </div>
              <DropdownMenu
                trigger={<><MoreHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">{t('documents.action_more', locale)}</span></>}
                items={[
                  { key: 'details', label: t('documents.action_details', locale), icon: <Info className="size-4" />, onClick: () => { setSelectedDocumentId(document.id); setDetailId(document.id); } },
                  ...(isPreviewable(document.mime_type) ? [{ key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => { setSelectedDocumentId(document.id); setPreviewDocument(document); } }] : []),
                  { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
                ]}
                className="shrink-0 text-slate-500 [&>button]:grid [&>button]:size-8 [&>button]:place-items-center [&>button]:rounded [&>button]:hover:bg-slate-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-hii-500"
              />
            </div>

            <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              <span className="min-w-0 truncate" title={projectLabel(document.project_id ?? '')}>{projectLabel(document.project_id ?? '')}</span>
              <span className="shrink-0 tabular-nums">v{document.current_version} · {formatBytes(document.file_size)} · {formatDateTime(document.updated_at, locale)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );

  const compactList = (
    <div className="divide-y divide-slate-100">
      {documents.map((document) => {
        const { Icon, label } = documentFileVisual(document.mime_type, locale);
        return (
          <div key={document.id} className={`flex min-w-0 items-center gap-3 px-2 py-2.5 ${selectedDocumentId === document.id ? 'bg-hii-50/50' : ''}`}>
            <button type="button" onClick={() => setSelectedDocumentId(document.id)} aria-pressed={selectedDocumentId === document.id} className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus:ring-2 focus:ring-hii-500">
              <span className="grid size-9 shrink-0 place-items-center rounded bg-slate-50 text-slate-600"><Icon className="size-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{document.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{label} · {typeLabel(document.document_type)} · {projectLabel(document.project_id ?? '')}</span>
              </span>
              <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-500">{formatBytes(document.file_size)}<span className="mt-0.5 block">{formatDateTime(document.updated_at, locale)}</span></span>
            </button>
            <DropdownMenu
              trigger={<><MoreHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">{t('documents.action_more', locale)}</span></>}
              items={[
                { key: 'details', label: t('documents.action_details', locale), icon: <Info className="size-4" />, onClick: () => { setSelectedDocumentId(document.id); setDetailId(document.id); } },
                ...(isPreviewable(document.mime_type) ? [{ key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => { setSelectedDocumentId(document.id); setPreviewDocument(document); } }] : []),
                { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
              ]}
              className="shrink-0 text-slate-500 [&>button]:grid [&>button]:size-8 [&>button]:place-items-center [&>button]:rounded [&>button]:hover:bg-slate-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-hii-500"
            />
          </div>
        );
      })}
    </div>
  );

  const projectPane = (
    <div className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto">
      <button
        type="button"
        onClick={() => selectProject('')}
        aria-pressed={filterProjectId === ''}
        className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${
          filterProjectId === ''
            ? 'bg-hii-50 font-semibold text-hii-700'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <BriefcaseBusiness className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('documents.filter_all_projects', locale)}
      </button>
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          onClick={() => selectProject(project.id)}
          aria-pressed={filterProjectId === project.id}
          className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${
            filterProjectId === project.id
              ? 'bg-hii-50 font-semibold text-hii-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BriefcaseBusiness className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {project.code ? `${project.code} — ` : ''}
            {project.name}
          </span>
        </button>
      ))}
      {!projectsLoading && projects.length === 0 && (
        <p className="px-3 py-2 text-xs text-slate-500">
          {t('documents.projects_empty', locale)}
        </p>
      )}
    </div>
  );

  const categoryPane = (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
      <button
        type="button"
        onClick={() => updateFilters({ documentType: '' })}
        aria-pressed={!documentType}
        className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${
          !documentType ? 'bg-hii-50 font-semibold text-hii-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Files className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t('documents.filter_all_types', locale)}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{summary && !loadError ? formatCount(summary.documentCount) : '—'}</span>
      </button>
      {DOCUMENT_TYPES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => updateFilters({ documentType: value })}
          aria-pressed={documentType === value}
          className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${
            documentType === value
              ? 'bg-hii-50 font-semibold text-hii-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Tag className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate">{typeLabel(value)}</span>
            <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{formatBytes(summary?.categoryStorageBytes[value])}</span>
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{summary && !loadError ? formatCount(summary.categoryCounts[value] ?? 0) : '—'}</span>
        </button>
      ))}
    </div>
  );

  const documentNavigation: Array<{
    id: ViewMode;
    label: string;
    Icon: LucideIcon;
    onSelect: () => void;
  }> = [
    { id: 'explorer', label: t('documents.nav_explorer', locale), Icon: FolderOpen, onSelect: openExplorer },
    { id: 'projects', label: t('documents.nav_projects', locale), Icon: BriefcaseBusiness, onSelect: openProjects },
    { id: 'recent', label: t('documents.nav_recent', locale), Icon: Clock3, onSelect: openRecent },
    { id: 'search', label: t('documents.nav_search', locale), Icon: Search, onSelect: openSearch },
  ];

  const breadcrumbItems = [
    { label: t('documents.title', locale) },
    {
      label: t(
        view === 'explorer'
          ? 'documents.nav_explorer'
          : view === 'projects'
            ? 'documents.nav_projects'
            : view === 'recent'
              ? 'documents.nav_recent'
              : 'documents.nav_search',
        locale,
      ),
    },
    ...(filterProjectId ? [{ label: projectLabel(filterProjectId) }] : []),
    ...(documentType ? [{ label: typeLabel(documentType) }] : []),
    ...(view === 'search' && query ? [{ label: query }] : []),
  ];

  const inspectorPane = selectedDocument ? (
        <aside
          className="min-w-0 xl:sticky xl:top-4 xl:self-start"
          aria-label={t('documents.inspector_aria', locale)}
          data-testid="documents-inspector"
        >
        <Card padding={false} className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{t('documents.inspector_title', locale)}</h2>
              <p className="mt-0.5 break-words text-sm font-medium text-slate-700">{selectedDocument.title}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDocumentId(null)}
              aria-label={t('documents.inspector_clear', locale)}
              title={t('documents.inspector_clear', locale)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {selectedDetailLoading ? (
            <div className="space-y-3 p-4" role="status" aria-label={t('documents.preview_loading', locale)}>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16" />
            </div>
          ) : selectedDetailError ? (
            <ErrorState
              title={t('documents.details_error', locale)}
              error={selectedDetailError}
              onRetry={() => setSelectedDetailRetry((retry) => retry + 1)}
              className="py-6"
            />
          ) : (
            <div className="space-y-4 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-slate-500">{t('documents.col_type', locale)}</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-800">{typeLabel(selectedDocument.document_type)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">{t('documents.detail_version', locale)}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-slate-800">v{selectedDocument.current_version}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">{t('documents.detail_code', locale)}</dt>
                  <dd className="mt-0.5 truncate font-mono font-medium text-slate-800">{selectedDocument.code || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">{t('documents.mime_label', locale)}</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-800">
                    {selectedDocument.mime_type || t('documents.mime_other', locale)}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-500">{t('documents.col_project', locale)}</dt>
                  <dd className="mt-0.5 break-words font-medium text-slate-800">
                    {projectLabel(selectedDocument.project_id ?? '')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('documents.version_size', locale)}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatBytes(selectedDocument.file_size)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('documents.col_updated', locale)}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatDateTime(selectedDocument.updated_at, locale)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('documents.detail_created', locale)}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatDateTime(selectedDocument.created_at, locale)}</dd>
                </div>
                {selectedDocument.uploaded_by_name && (
                  <div className="col-span-2 min-w-0">
                    <dt className="text-slate-500">{t('documents.col_uploader', locale)}</dt>
                    <dd className="mt-0.5 truncate font-medium text-slate-800">{selectedDocument.uploaded_by_name}</dd>
                  </div>
                )}
              </dl>

              <div className="rounded-md border border-hii-200 bg-hii-50/40 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-hii-900"><BrainCircuit className="size-4" aria-hidden="true" />{t('documents.classification_suggestions', locale)}</p>
                <p className="mt-1 text-xs leading-4 text-slate-600">
                  {selectedSuggestions?.categories.length || selectedSuggestions?.projects.length
                    ? t('documents.classification_review_hint', locale)
                    : t('documents.classification_no_match', locale)}
                </p>
                <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setMetadataEditorOpen(true)} icon={<Tag className="size-3.5" aria-hidden="true" />}>
                  {t('documents.metadata_review_action', locale)}
                </Button>
              </div>

              {selectedDetail && (
                <p className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <Files className="size-3.5 text-slate-400" aria-hidden="true" />
                  {t('documents.detail_versions', locale)} · {formatCount(selectedDetail.versions.length)}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {isPreviewable(selectedDocument.mime_type) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Eye className="size-4" aria-hidden="true" />}
                    onClick={() => setPreviewDocument(selectedDocument)}
                  >
                    {t('documents.action_preview', locale)}
                  </Button>
                ) : (
                  <p className="w-full text-xs text-slate-500">{t('documents.preview_unavailable', locale)}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Info className="size-4" aria-hidden="true" />}
                  onClick={() => setDetailId(selectedDocument.id)}
                >
                  {t('documents.action_details', locale)}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Download className="size-4" aria-hidden="true" />}
                  onClick={() => void download(selectedDocument)}
                >
                  {t('documents.action_download', locale)}
                </Button>
              </div>
              {previewDocument?.id === selectedDocument.id && (
                <DocumentPreviewModal
                  document={previewDocument}
                  open
                  inline
                  onClose={() => setPreviewDocument(null)}
                />
              )}
            </div>
          )}
        </Card>
        </aside>
  ) : null;

  return (
    <div className="space-y-4" data-testid="documents-workspace">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hii-700 text-white">
            <Files className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">{t('documents.title', locale)}</h1>
            <p className="truncate text-xs text-slate-500">{t('documents.subtitle', locale)}</p>
          </div>
        </div>
        <nav aria-label={t('documents.nav_aria', locale)} className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {documentNavigation.map(({ id, label, Icon, onSelect }) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              aria-pressed={view === id}
              onClick={onSelect}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${view === id ? 'bg-white text-hii-800 shadow-sm' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'}`}
            >
              <Icon className="size-4" aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
      </header>

      <div className={`grid gap-3 ${sidebarCollapsed ? (selectedDocument ? 'xl:grid-cols-[56px_minmax(0,1fr)_340px]' : 'xl:grid-cols-[56px_minmax(0,1fr)]') : selectedDocument ? 'xl:grid-cols-[250px_minmax(0,1fr)_340px]' : 'xl:grid-cols-[250px_minmax(0,1fr)]'}`} data-testid="documents-layout">
        <aside id="documents-sidebar" data-testid="documents-sidebar" className={`order-3 min-w-0 space-y-3 xl:order-1 ${sidebarCollapsed ? 'hidden xl:block' : ''}`} aria-label={t('documents.sidebar_aria', locale)}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5">
              <button type="button" aria-label={t('documents.sidebar_expand', locale)} title={t('documents.sidebar_expand', locale)} onClick={() => setSidebarCollapsed(false)} className="grid size-9 place-items-center rounded text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hii-500"><PanelLeftOpen className="size-4" /></button>
              <button type="button" aria-label={t('documents.nav_explorer', locale)} title={t('documents.nav_explorer', locale)} onClick={openExplorer} className="grid size-9 place-items-center rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hii-500"><FolderOpen className="size-4" /></button>
              <button type="button" aria-label={t('documents.nav_recent', locale)} title={t('documents.nav_recent', locale)} onClick={openRecent} className="grid size-9 place-items-center rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hii-500"><Clock3 className="size-4" /></button>
            </div>
          ) : (
          <>
          <section data-testid="documents-summary" aria-label={t('documents.summary_aria', locale)} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><HardDrive className="size-3.5 text-slate-400" aria-hidden="true" />{t('documents.storage_scope_label', locale)}</p>
                <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-slate-950">{loading || loadError || !summary ? '—' : formatBytes(summary.storageBytes, '0 B')}</p>
                <p className="text-[11px] tabular-nums text-slate-500">{t('documents.summary_matches', locale)}: {loading || loadError || !summary ? '—' : formatCount(summary.documentCount)}</p>
              </div>
              <span className="shrink-0 rounded bg-slate-50 px-1.5 py-1 text-[10px] tabular-nums text-slate-500">{loading || loadError || !summary ? '—' : `${formatCount(summary.knownSizeCount)}/${formatCount(summary.documentCount)}`}</span>
            </div>
            {summary && !loadError && summary.storageBytes > 0 && (
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={t('documents.storage_scope_note', locale)}>
                {FILE_FAMILY_META.map((family) => {
                  const bytes = summary.fileTypeStorageBytes[family.id] ?? 0;
                  if (!bytes) return null;
                  return <span key={family.id} style={{ width: `${(bytes / summary.storageBytes) * 100}%`, backgroundColor: family.color }} />;
                })}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-4 text-slate-500">{t('documents.storage_scope_note', locale)}</p>
          </section>

          <Card padding={false} className="overflow-hidden" data-testid="documents-shortcuts">
            <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-slate-500">{t('documents.shortcuts', locale)}</div>
            <div className="space-y-0.5 px-2 pb-2">
              {[
                { label: t('documents.nav_explorer', locale), Icon: FolderOpen, onClick: openExplorer, active: view === 'explorer' && !filterProjectId },
                { label: t('documents.nav_recent', locale), Icon: Clock3, onClick: openRecent, active: view === 'recent' },
              ].map(({ label, Icon, onClick, active }) => (
                <button key={label} type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm ${active ? 'bg-hii-50 font-medium text-hii-800' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="size-4" aria-hidden="true" />{label}</button>
              ))}
            </div>
          </Card>

          <Card padding={false} className="overflow-hidden" data-testid="documents-projects">
            <details className="group" open={projectsTreeOpen} onToggle={(event) => setProjectsTreeOpen(event.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">{t('documents.projects_heading', locale)}<ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
              <div className="border-t border-slate-100 p-2">{projectsLoading ? <div className="space-y-2 p-2"><Skeleton className="h-8" count={4} /></div> : projectsError ? <ErrorState title={t('documents.projects_load_error', locale)} error={projectsError} onRetry={() => void loadProjects()} className="py-5" /> : projectPane}</div>
            </details>
          </Card>

          <div data-testid="documents-categories">
          <Card padding={false} className="overflow-hidden">
            <details className="group" open={categoriesTreeOpen} onToggle={(event) => setCategoriesTreeOpen(event.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">{t('documents.categories_heading', locale)}<ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
              <div className="border-t border-slate-100 p-2">{categoryPane}</div>
            </details>
          </Card>
          </div>
          <p className="px-1 text-[11px] leading-4 text-slate-500">{t('documents.virtual_hierarchy_note', locale)}</p>
          </>
          )}
        </aside>

        <main className="order-1 min-w-0 xl:order-2">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Breadcrumbs items={breadcrumbItems} className="min-w-0 overflow-hidden text-xs" />
              {view === 'recent' && <p className="mt-1 text-xs text-slate-500">{t('documents.recent_period', locale)}</p>}
              {view === 'projects' && filterProjectId && <p className="mt-1 text-xs text-slate-500">{t('documents.scope_hint', locale)} · {projectLabel(filterProjectId)}</p>}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{loading || loadError ? '—' : `${formatCount(documents.length)} / ${formatCount(total)}`}</span>
          </div>
          <div className="mb-2 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[auto_minmax(220px,1fr)_180px_auto_auto] sm:items-center" data-testid="documents-toolbar">
            <Button type="button" variant="ghost" size="icon" aria-label={sidebarCollapsed ? t('documents.sidebar_expand', locale) : t('documents.sidebar_collapse', locale)} aria-expanded={!sidebarCollapsed} aria-controls="documents-sidebar" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} title={sidebarCollapsed ? t('documents.sidebar_expand', locale) : t('documents.sidebar_collapse', locale)}>
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
            </Button>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input ref={searchInputRef} type="search" value={searchInput} onFocus={() => setView('search')} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('documents.search_placeholder', locale)} aria-label={t('documents.search_aria', locale)} className="hii-input w-full pl-9" />
            </div>
            <div>
              <label className="sr-only" htmlFor="documents-sort">{t('documents.sort_aria', locale)}</label>
              <select id="documents-sort" className="hii-select w-full" value={`${sortBy}-${sortOrder}`} onChange={(event) => changeSort(event.target.value)}>
                <option value="updated-desc">{t('documents.sort_updated_desc', locale)}</option>
                <option value="updated-asc">{t('documents.sort_updated_asc', locale)}</option>
                <option value="created-desc">{t('documents.sort_created_desc', locale)}</option>
                <option value="created-asc">{t('documents.sort_created_asc', locale)}</option>
                <option value="title-asc">{t('documents.sort_title_asc', locale)}</option>
                <option value="title-desc">{t('documents.sort_title_desc', locale)}</option>
              </select>
            </div>
            <div className="flex items-center rounded-md border border-slate-200 p-0.5" role="group" aria-label={t('documents.presentation_aria', locale)}>
              <button type="button" aria-pressed={presentation === 'grid'} onClick={() => setPresentation('grid')} className={`grid size-9 place-items-center rounded focus:outline-none focus:ring-2 focus:ring-hii-500 ${presentation === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`} aria-label={t('documents.view_grid', locale)}><LayoutGrid className="size-4" /></button>
              <button type="button" aria-pressed={presentation === 'list'} onClick={() => setPresentation('list')} className={`grid size-9 place-items-center rounded focus:outline-none focus:ring-2 focus:ring-hii-500 ${presentation === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`} aria-label={t('documents.view_list', locale)}><List className="size-4" /></button>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Button variant="ghost" size="icon" onClick={refresh} disabled={loading || projectsLoading} aria-label={t('general.refresh', locale)} title={t('general.refresh', locale)}><RefreshCw className={`size-4 ${loading || projectsLoading ? 'animate-spin' : ''}`} aria-hidden="true" /></Button>
              <Button variant="primary" size="md" onClick={() => setUploadOpen(true)} icon={<Upload className="size-4" aria-hidden="true" />}>{t('documents.add_document', locale)}</Button>
            </div>
          </div>

          <section aria-labelledby="documents-file-types-heading" data-testid="documents-file-type-breakdown" className="mb-3 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="documents-file-types-heading" className="text-xs font-semibold text-slate-600">{t('documents.file_type_overview', locale)}</h2>
              <button type="button" aria-pressed={!mimeType} onClick={() => updateFilters({ mimeType: '' })} className={`shrink-0 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-hii-500 ${!mimeType ? 'font-semibold text-hii-800' : 'text-slate-500 hover:bg-white'}`}>{t('documents.file_type_all', locale)}</button>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="status"><Skeleton className="h-[76px]" count={4} /></div>
            ) : loadError ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">{t('documents.page_category_unavailable', locale)}</p>
            ) : !summary || !FILE_FAMILY_META.some((family) => summary.fileTypeCounts[family.id] > 0) ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">{t('documents.page_category_empty', locale)}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FILE_FAMILY_META.filter((family) => (summary.fileTypeCounts[family.id] ?? 0) > 0).map((family) => {
                  const count = summary.fileTypeCounts[family.id];
                  const bytes = summary.fileTypeStorageBytes[family.id];
                  const knownSizeCount = summary.fileTypeKnownSizeCounts[family.id] ?? 0;
                  const share = summary.storageBytes > 0 && knownSizeCount > 0 ? (bytes / summary.storageBytes) * 100 : null;
                  const active = mimeType === family.filter;
                  return (
                    <button key={family.id} type="button" aria-pressed={active} onClick={() => updateFilters({ mimeType: active ? '' : family.filter })} className={`min-w-0 rounded-md border px-2.5 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 ${active ? 'border-hii-400 bg-hii-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: family.color }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{t(family.labelKey, locale)}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{formatCount(count)}</span>
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span>{formatBytes(bytes)}</span><span>{share === null ? '—' : `${share.toFixed(0)}%`}</span></span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mb-3 grid gap-2 rounded-md bg-slate-50/70 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="documents-filters">
            <div><label htmlFor="documente-filter-from" className="mb-1 block text-[10px] font-medium text-slate-600">{t('documents.filter_date_from', locale)}</label><input id="documente-filter-from" type="date" className="hii-input w-full" value={from} max={to || undefined} onChange={(event) => updateFilters({ from: event.target.value })} /></div>
            <div><label htmlFor="documente-filter-to" className="mb-1 block text-[10px] font-medium text-slate-600">{t('documents.filter_date_to', locale)}</label><input id="documente-filter-to" type="date" className="hii-input w-full" value={to} min={from || undefined} onChange={(event) => updateFilters({ to: event.target.value })} /></div>
            <Button variant="secondary" size="sm" onClick={resetFilters} disabled={!hasFilters} icon={<X className="size-4" aria-hidden="true" />} className="min-h-10">{t('documents.filter_reset', locale)}</Button>
          </div>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label={t('documents.results_aria', locale)}>
            {loadError ? (
              <div className="p-4"><ErrorState title={t('documents.error_title', locale)} error={loadError} onRetry={() => void loadDocuments()} /></div>
            ) : loading ? (
              <div className="space-y-2 p-4" role="status" aria-label={t('documents.preview_loading', locale)}>{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
            ) : documents.length === 0 ? (
              <div className="p-4">{hasFilters ? <EmptyState icon={<Search className="size-6" aria-hidden="true" />} title={t('documents.no_results_title', locale)} description={t('documents.no_results_hint', locale)} action={{ label: t('documents.filter_reset', locale), onClick: resetFilters }} /> : <EmptyState icon={<FileText className="size-6" aria-hidden="true" />} title={t('documents.empty_title', locale)} description={t('documents.empty_hint', locale)} action={<Button variant="primary" size="sm" onClick={() => setUploadOpen(true)} icon={<Upload className="size-4" aria-hidden="true" />}>{t('documents.add_document', locale)}</Button>} />}</div>
            ) : (
              <div className="p-3" data-testid="documents-results">
                {presentation === 'grid' ? cards : isMobile ? compactList : (
                  <div className="overflow-hidden rounded-md border border-slate-100">
                    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500"><th scope="col" className="py-2.5 pl-3 pr-2">{t('documents.col_title', locale)}</th><th scope="col" className="px-2 py-2.5">{t('documents.col_type', locale)}</th><th scope="col" className="px-2 py-2.5">{t('documents.col_project', locale)}</th><th scope="col" className="px-2 py-2.5">{t('documents.version_size', locale)}</th><th scope="col" className="px-2 py-2.5">{t('documents.col_updated', locale)}</th><th scope="col" className="py-2.5 pl-2 pr-3 text-right">{t('documents.action_details', locale)}</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{rows}</tbody>
                    </table></div>
                  </div>
                )}
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={selectPage} />
              </div>
            )}
          </section>
        </main>

        {inspectorPane && <div className="order-2 min-w-0 xl:order-3">{inspectorPane}</div>}
      </div>

      <DocumentUploadCard open={uploadOpen} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} projectId={uploadProjectId} onClose={() => setUploadOpen(false)} onProjectChange={setUploadProjectId} onOpenDocument={(id) => setDetailId(id)} onUploaded={handleUploaded} />
      <DocumentDetailsModal documentId={detailId} open={detailId !== null} onClose={() => setDetailId(null)} onChanged={handleDocumentChanged} />
      <DocumentMetadataEditor documentId={selectedDocumentId} open={metadataEditorOpen} projects={projects} onClose={() => setMetadataEditorOpen(false)} onSaved={handleMetadataSaved} />
    </div>
  );
}

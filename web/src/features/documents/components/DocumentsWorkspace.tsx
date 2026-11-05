'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  Archive,
  ArchiveRestore,
  AlertTriangle,
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
  type DocumentFolder,
  type DocumentFolderListResponse,
  type DocumentListItem,
  type DocumentListSummary,
} from '../../../lib/api-client';
import { Breadcrumbs, Button, Card, ConfirmDialog, Drawer, DropdownMenu, EmptyState, ErrorState, Pagination, Skeleton } from '../../../components/ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../components/ui/Toast';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL_KEYS,
  formatBytes,
  formatDateTime,
  formatVersionFilename,
  isImage,
  isXml,
  isPreviewable,
} from '../documents.constants';
import { DocumentUploadCard, type UploadDestination, type UploadProject } from './DocumentUploadCard';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentMetadataEditor } from './DocumentMetadataEditor';
import { suggestDocumentClassification } from '../documents.classification';
import { DocumentFolderExplorer, type FolderManagementRequest, type FolderSelection } from './DocumentFolderExplorer';
import { DocumentFolderActionDialog, type DocumentFolderActionPayload, type DocumentFolderActionRequest } from './DocumentFolderActionDialog';

type ViewMode = 'explorer' | 'projects' | 'recent' | 'search' | 'archived';
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

function DocumentImageThumbnail({
  document,
  Icon,
  label,
  locale,
}: {
  document: DocumentListItem;
  Icon: LucideIcon;
  label: string;
  locale: Locale;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const image = isImage(document.mime_type);
  const canLoadThumbnail = image && document.file_size !== null && document.file_size <= 2 * 1024 * 1024;

  useEffect(() => {
    if (!canLoadThumbnail) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    setFailed(false);

    void apiClient.downloadDocument(document.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id, canLoadThumbnail]);

  return (
    <div className="relative flex h-14 items-center justify-center overflow-hidden bg-slate-50 sm:h-16">
      {src ? (
        // Authenticated bytes are converted to a temporary URL; storage paths never reach the UI.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={document.title} className="h-full w-full object-cover" />
      ) : canLoadThumbnail && !failed ? (
        <span role="status" aria-label={t('documents.preview_loading', locale)} className="h-full w-full animate-pulse bg-slate-100" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-400" title={failed ? t('documents.preview_error', locale) : undefined}>
          {failed ? <AlertTriangle className="size-6 text-amber-600" aria-hidden="true" /> : <Icon className="size-8 text-hii-700" aria-hidden="true" />}
          <span className="text-[10px] font-semibold tracking-wide">{failed ? t('documents.preview_unavailable', locale) : label}</span>
        </div>
      )}
    </div>
  );
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
  const isNarrowWorkspace = useMediaQuery('(max-width: 1023px)');
  const isWideWorkspace = !isNarrowWorkspace;

  const [view, setView] = useState<ViewMode>('explorer');
  const [presentation, setPresentation] = useState<'grid' | 'list'>('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categoriesTreeOpen, setCategoriesTreeOpen] = useState(true);
  const [projects, setProjects] = useState<UploadProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [folderSelection, setFolderSelection] = useState<FolderSelection>({ scope: 'company' });
  const [companyFolders, setCompanyFolders] = useState<DocumentFolder[]>([]);
  const [projectFolders, setProjectFolders] = useState<DocumentFolder[]>([]);
  const [projectFolderLists, setProjectFolderLists] = useState<Record<string, DocumentFolderListResponse | undefined>>({});
  const [projectFolderLoading, setProjectFolderLoading] = useState<Record<string, boolean | undefined>>({});
  const [projectFolderErrors, setProjectFolderErrors] = useState<Record<string, string | undefined>>({});
  const [companyCanManage, setCompanyCanManage] = useState(false);
  const [projectCanManage, setProjectCanManage] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [folderAction, setFolderAction] = useState<DocumentFolderActionRequest | null>(null);
  const [folderActionBusy, setFolderActionBusy] = useState(false);
  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [actionFolders, setActionFolders] = useState<DocumentFolder[]>([]);
  const [uploadFolders, setUploadFolders] = useState<DocumentFolder[]>([]);
  const [uploadFoldersCanManage, setUploadFoldersCanManage] = useState(false);
  const [uploadFoldersLoading, setUploadFoldersLoading] = useState(false);
  const [uploadFoldersError, setUploadFoldersError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>(EMPTY_FILTERS);
  const [uploadDestination, setUploadDestination] = useState<UploadDestination | null>(null);
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
  const [archiveTarget, setArchiveTarget] = useState<DocumentListItem | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageSize = isMobile ? 10 : 20;
  const { q: query, projectId: filterProjectId, documentType, mimeType, from, to } = filters;
  const companyScope = folderSelection.scope === 'company';
  const activeFolderId = folderSelection.scope === 'all' ? null : folderSelection.folderId ?? null;
  const unfiled = folderSelection.scope !== 'all' && Boolean(folderSelection.unfiled);
  const currentFolders = folderSelection.scope === 'project' ? projectFolders : companyFolders;
  const activeFolder = currentFolders.find((folder) => folder.id === activeFolderId) ?? null;

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

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFoldersError(null);
    try {
      const companyResult = await apiClient.listCompanyDocumentFolders();
      if (companyResult.error || !companyResult.data) throw new Error(companyResult.error || t('documents.folder_load_error', locale));
      setCompanyFolders(Array.isArray(companyResult.data.folders) ? companyResult.data.folders : []);
      setCompanyCanManage(Boolean(companyResult.data.canManage));
    } catch (err: unknown) {
      setFoldersError(err instanceof ApiError || err instanceof Error ? err.message : t('documents.folder_load_error', locale));
    } finally {
      setFoldersLoading(false);
    }
  }, [locale]);

  const loadProjectFolders = useCallback(async (projectId: string) => {
    setProjectFolderLoading((current) => ({ ...current, [projectId]: true }));
    setProjectFolderErrors((current) => ({ ...current, [projectId]: undefined }));
    try {
      const response = await apiClient.listProjectDocumentFolders(projectId);
      if (response.error || !response.data) throw new Error(response.error || t('documents.folder_load_error', locale));
      setProjectFolderLists((current) => ({ ...current, [projectId]: response.data }));
      if (filterProjectId === projectId) {
        setProjectFolders(response.data.folders ?? []);
        setProjectCanManage(Boolean(response.data.canManage));
      }
    } catch (err: unknown) {
      setProjectFolderErrors((current) => ({
        ...current,
        [projectId]: err instanceof ApiError || err instanceof Error ? err.message : t('documents.folder_load_error', locale),
      }));
    } finally {
      setProjectFolderLoading((current) => ({ ...current, [projectId]: false }));
    }
  }, [filterProjectId, locale]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const loadUploadFolders = useCallback(async (destination: UploadDestination | null) => {
    if (!destination) {
      setUploadFolders([]);
      setUploadFoldersCanManage(false);
      setUploadFoldersError(null);
      return;
    }
    setUploadFoldersLoading(true);
    setUploadFoldersError(null);
    try {
      const response = destination.kind === 'company'
        ? await apiClient.listCompanyDocumentFolders()
        : await apiClient.listProjectDocumentFolders(destination.projectId);
      if (response.error || !response.data) throw new Error(response.error || t('documents.folder_load_error', locale));
      setUploadFolders(Array.isArray(response.data.folders) ? response.data.folders : []);
      setUploadFoldersCanManage(Boolean(response.data.canManage));
    } catch (err: unknown) {
      setUploadFolders([]);
      setUploadFoldersCanManage(false);
      setUploadFoldersError(err instanceof ApiError || err instanceof Error ? err.message : t('documents.folder_load_error', locale));
    } finally {
      setUploadFoldersLoading(false);
    }
  }, [locale]);

  // ── Documents list ────────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.listDocuments({
        q: query || undefined,
        projectId: folderSelection.scope === 'project'
          ? folderSelection.projectId
          : folderSelection.scope === 'all'
            ? filterProjectId || undefined
            : undefined,
        scope: folderSelection.scope === 'company' ? 'company' : undefined,
        folderId: activeFolderId || undefined,
        unfiled: unfiled ? true : undefined,
        documentType: documentType || undefined,
        mimeType: mimeType || undefined,
        from: from || undefined,
        to: to || undefined,
        archived: view === 'archived',
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
  }, [query, filterProjectId, folderSelection, activeFolderId, unfiled, documentType, mimeType, from, to, page, pageSize, sortBy, sortOrder, locale, view]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const selectedDocumentIsLoaded = Boolean(
    selectedDocumentId && documents.some((document) => document.id === selectedDocumentId),
  );
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
    if (!selectedDocumentId || !selectedDocumentIsLoaded) {
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
  }, [selectedDocumentId, selectedDocumentIsLoaded, selectedDetailRetry, locale]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Every filter change returns to the first page.
  const hasFilters = Boolean(
    query || documentType || mimeType || from || to || filterProjectId || activeFolderId || unfiled,
  );

  const resetFilters = () => {
    setSearchInput('');
    updateFilters(EMPTY_FILTERS);
    setSelectedDocumentId(null);
    setFolderSelection({ scope: 'company' });
    setUploadDestination({ kind: 'company' });
    setView('explorer');
  };

  const selectProject = (projectId: string) => {
    updateFilters({ projectId });
    setFolderSelection(projectId ? { scope: 'project', projectId } : { scope: 'all' });
    setUploadDestination(projectId ? { kind: 'project', projectId } : null);
    setUploadFolders(projectId ? [] : companyFolders);
    if (projectId && !projectFolderLists[projectId] && !projectFolderLoading[projectId]) void loadProjectFolders(projectId);
    setView((current) => current === 'archived' ? 'archived' : 'projects');
  };

  const openExplorer = () => {
    setView('explorer');
    setFolderSelection({ scope: 'company' });
    setUploadDestination({ kind: 'company' });
    setUploadFolders(companyFolders);
    updateFilters({ projectId: '' });
  };

  const selectFolderSelection = (selection: FolderSelection) => {
    setFolderSelection(selection);
    setView((current) => current === 'archived' ? 'archived' : 'explorer');
    updateFilters({ projectId: selection.scope === 'project' ? selection.projectId : '' });
    if (selection.scope === 'project' && !projectFolderLists[selection.projectId] && !projectFolderLoading[selection.projectId]) {
      void loadProjectFolders(selection.projectId);
    }
    setUploadDestination(selection.scope === 'project'
      ? { kind: 'project', projectId: selection.projectId }
      : selection.scope === 'company'
        ? { kind: 'company' }
        : null);
  };

  const openProjects = () => {
    setView('projects');
    setFolderSelection({ scope: 'all' });
    updateFilters({ projectId: '' });
    setSelectedDocumentId(null);
  };

  const openRecent = () => {
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setView('recent');
    setFolderSelection({ scope: 'all' });
    setSearchInput('');
    setFilters({ ...EMPTY_FILTERS, from: fromDate, to: toDate });
    setUploadDestination(null);
    setPage(1);
    setSelectedDocumentId(null);
  };

  const openArchived = () => {
    setView('archived');
    setSearchInput('');
    setFilters({ ...EMPTY_FILTERS, projectId: folderSelection.scope === 'project' ? folderSelection.projectId : '' });
    setUploadDestination(null);
    setPage(1);
    setSelectedDocumentId(null);
  };

  const openSearch = () => {
    setView('search');
    searchInputRef.current?.focus();
  };

  const closeNavigation = () => setNavigationOpen(false);
  const closeUploadDialog = () => {
    setUploadOpen(false);
    setUploadDestination(null);
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

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const download = async (document: DocumentListItem) => {
    try {
      const blob = await apiClient.downloadDocument(document.id);
      saveBlob(blob, document.title);
    } catch (err: unknown) {
      toast.error(
        t('documents.download_error', locale),
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('documents.download_error', locale),
      );
    }
  };

  const downloadVersion = async (document: DocumentListItem, version: DocumentDetail['versions'][number]) => {
    try {
      const blob = await apiClient.downloadDocumentVersion(document.id, version.id);
      saveBlob(blob, formatVersionFilename(document.title, version.version));
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
    void Promise.all([
      loadProjects(),
      loadFolders(),
      ...(filterProjectId ? [loadProjectFolders(filterProjectId)] : []),
      loadDocuments(),
    ]);
  };

  const updateArchiveState = async (document: DocumentListItem, archive: boolean) => {
    setArchiveBusy(true);
    try {
      const response = archive
        ? await apiClient.archiveDocument(document.id)
        : await apiClient.restoreDocument(document.id);
      if (response.error || !response.data) {
        throw new Error(response.error || (archive ? t('documents.archive_error', locale) : t('documents.restore_error', locale)));
      }
      toast.success(t(archive ? 'documents.archived_success' : 'documents.restored_success', locale));
      setArchiveTarget(null);
      setSelectedDocumentId(null);
      await loadDocuments();
    } catch (err: unknown) {
      toast.error(
        t(archive ? 'documents.archive_error' : 'documents.restore_error', locale),
        err instanceof ApiError || err instanceof Error ? err.message : undefined,
      );
    } finally {
      setArchiveBusy(false);
    }
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

  const folderActionErrorMessage = (err: unknown) => {
    if (err instanceof ApiError) {
      const key = err.statusCode === 403
        ? 'documents.folder_forbidden'
        : err.statusCode === 404
          ? 'documents.folder_not_found'
          : err.statusCode === 409
            ? 'documents.folder_conflict'
            : 'documents.folder_action_error';
      return `${t(key, locale)}${err.message ? ` ${err.message}` : ''}`;
    }
    return err instanceof Error ? err.message : t('documents.folder_action_error', locale);
  };

  const openFolderAction = (action: FolderManagementRequest) => {
    const scopedFolders = action.scope.projectId
      ? projectFolderLists[action.scope.projectId]?.folders ?? (filterProjectId === action.scope.projectId ? projectFolders : [])
      : companyFolders;
    setActionFolders(scopedFolders);
    setFolderActionError(null);
    setFolderAction(action);
  };

  const requestDocumentFolderMove = async (document: DocumentDetail) => {
    setFolderActionError(null);
    setActionFolders([]);
    try {
      const response = document.project_id
        ? await apiClient.listProjectDocumentFolders(document.project_id)
        : await apiClient.listCompanyDocumentFolders();
      if (response.error || !response.data) throw new Error(response.error || t('documents.folder_load_error', locale));
      setActionFolders(response.data.folders ?? []);
      setFolderAction({
        kind: 'fileDocument',
        scope: document.project_id ? { projectId: document.project_id } : {},
        documentId: document.id,
        documentTitle: document.title,
        currentFolderId: document.folder_id ?? null,
      });
      setDetailId(null);
    } catch (err: unknown) {
      setFolderActionError(folderActionErrorMessage(err));
      toast.error(t('documents.folder_action_error', locale), folderActionErrorMessage(err));
    }
  };

  const executeFolderAction = async (request: DocumentFolderActionRequest, payload: DocumentFolderActionPayload) => {
    setFolderActionBusy(true);
    setFolderActionError(null);
    try {
      let successKey = 'documents.folder_moved';
      let refreshProjectId = request.scope.projectId;
      if (request.kind === 'create') {
        const createPayload = payload as { name: string; parentId?: string };
        const response = await apiClient.createDocumentFolder(createPayload.name, {
          projectId: request.scope.projectId,
          parentId: createPayload.parentId ?? request.parentId ?? null,
        });
        if (response.error || !response.data) throw new Error(response.error || t('documents.folder_action_error', locale));
        if (response.data.project_id) {
          setFolderSelection({ scope: 'project', projectId: response.data.project_id, folderId: response.data.id });
          refreshProjectId = response.data.project_id;
          updateFilters({ projectId: response.data.project_id });
        } else {
          setFolderSelection({ scope: 'company', folderId: response.data.id });
          updateFilters({ projectId: '' });
        }
        successKey = 'documents.folder_created';
      } else if (request.kind === 'rename') {
        const renamePayload = payload as { name: string };
        const response = await apiClient.renameDocumentFolder(request.folder.id, renamePayload.name);
        if (response.error || !response.data) throw new Error(response.error || t('documents.folder_action_error', locale));
        successKey = 'documents.folder_renamed';
      } else if (request.kind === 'move') {
        const movePayload = payload as { parentId: string | null };
        const response = await apiClient.moveDocumentFolder(request.folder.id, movePayload.parentId);
        if (response.error || !response.data) throw new Error(response.error || t('documents.folder_action_error', locale));
        successKey = 'documents.folder_moved';
      } else if (request.kind === 'delete') {
        const response = await apiClient.deleteDocumentFolder(request.folder.id);
        if (response.error || !response.data) throw new Error(response.error || t('documents.folder_action_error', locale));
        if (folderSelection.scope !== 'all' && folderSelection.folderId === request.folder.id) {
          setFolderSelection(request.scope.projectId
            ? { scope: 'project', projectId: request.scope.projectId }
            : { scope: 'company' });
        }
        successKey = 'documents.folder_deleted';
      } else if (request.kind === 'fileDocument') {
        const filePayload = payload as { folderId: string | null };
        const response = await apiClient.moveDocumentToFolder(request.documentId, filePayload.folderId);
        if (response.error || !response.data) throw new Error(response.error || t('documents.folder_move_error', locale));
        successKey = 'documents.document_filed';
        if (selectedDocumentId === request.documentId) setSelectedDetailRetry((retry) => retry + 1);
      }
      setFolderAction(null);
      toast.success(t(successKey, locale));
      await Promise.all([
        refreshProjectId ? loadProjectFolders(refreshProjectId) : loadFolders(),
        loadDocuments(),
      ]);
    } catch (err: unknown) {
      const message = folderActionErrorMessage(err);
      setFolderActionError(message);
      toast.error(t(request.kind === 'fileDocument' ? 'documents.folder_move_error' : 'documents.folder_action_error', locale), message);
    } finally {
      setFolderActionBusy(false);
    }
  };

  const changeUploadDestination = (destination: UploadDestination | null) => {
    setUploadDestination(destination);
    void loadUploadFolders(destination);
  };

  const openUploadDialog = () => {
    const destination = folderSelection.scope === 'project'
      ? { kind: 'project' as const, projectId: folderSelection.projectId }
      : folderSelection.scope === 'company'
        ? { kind: 'company' as const }
        : null;
    setUploadDestination(destination);
    void loadUploadFolders(destination);
    setUploadOpen(true);
  };

  const folderName = (folderId: string | null | undefined) =>
    folderId ? [...companyFolders, ...Object.values(projectFolderLists).flatMap((list) => list?.folders ?? []), ...actionFolders].find((folder) => folder.id === folderId)?.name ?? null : null;

  const handleMetadataSaved = (updated: DocumentDetail) => {
    setDocuments((current) => current.map((document) => document.id === updated.id ? updated : document));
    setSelectedDetail(updated);
    void loadDocuments();
  };

  const selectDocument = (document: DocumentListItem) => {
    setSelectedDocumentId(document.id);
    setPreviewDocument(isPreviewable(document.mime_type) ? document : null);
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
            onClick={() => selectDocument(document)}
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
                  selectDocument(document);
                  setDetailId(document.id);
                } },
                { key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => {
                  selectDocument(document);
                } },
                { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
                document.is_archived
                  ? { key: 'restore', label: t('documents.restore', locale), icon: <ArchiveRestore className="size-4" />, onClick: () => void updateArchiveState(document, false) }
                  : { key: 'archive', label: t('documents.archive', locale), icon: <Archive className="size-4" />, onClick: () => setArchiveTarget(document) },
              ]}
              className="text-slate-500 hover:text-slate-900 [&>button]:size-8 [&>button]:justify-center [&>button]:rounded [&>button]:hover:bg-slate-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-hii-500"
            />
          </div>
        </td>
      </tr>
    );
  });

  const cards = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2" data-testid="documents-grid">
      {documents.map((document) => {
        const { Icon: TypeIcon, label: typeBadge } = documentFileVisual(document.mime_type, locale);

        return (
          <Card
            key={document.id}
            padding={false}
            className={`group h-full overflow-hidden shadow-none transition-colors ${selectedDocumentId === document.id ? 'border-hii-500 ring-1 ring-hii-500/30' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className="relative border-b border-slate-100">
              <DocumentImageThumbnail document={document} Icon={TypeIcon} label={typeBadge} locale={locale} />
              <div className="absolute right-2 top-2">
                <DropdownMenu
                  trigger={<><MoreHorizontal className="size-4" aria-hidden="true" /><span className="sr-only">{t('documents.action_more', locale)}</span></>}
                  items={[
                    { key: 'details', label: t('documents.action_details', locale), icon: <Info className="size-4" />, onClick: () => { selectDocument(document); setDetailId(document.id); } },
                    ...(isPreviewable(document.mime_type) ? [{ key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => selectDocument(document) }] : []),
                    { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
                    document.is_archived
                      ? { key: 'restore', label: t('documents.restore', locale), icon: <ArchiveRestore className="size-4" />, onClick: () => void updateArchiveState(document, false) }
                      : { key: 'archive', label: t('documents.archive', locale), icon: <Archive className="size-4" />, onClick: () => setArchiveTarget(document) },
                  ]}
                  className="rounded-lg bg-white/95 text-slate-600 shadow-sm [&>button]:grid [&>button]:size-8 [&>button]:place-items-center [&>button]:rounded-lg [&>button]:hover:bg-hii-50 [&>button]:hover:text-hii-800"
                />
              </div>
            </div>

            <div className="flex min-h-[132px] flex-col gap-2.5 p-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => selectDocument(document)}
                  aria-pressed={selectedDocumentId === document.id}
                  className="line-clamp-2 min-h-10 w-full text-left text-[13px] font-semibold leading-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-hii-500"
                  title={document.title}
                >{document.title}</button>
                {document.code && <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{document.code}</p>}
              </div>
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600" title={projectLabel(document.project_id ?? '')}>
                <BriefcaseBusiness className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{projectLabel(document.project_id ?? '')}</span>
              </p>
              <div className="mt-auto flex min-w-0 items-center gap-1.5">
                <span className="max-w-[65%] truncate rounded-md bg-hii-50 px-2 py-1 text-[10px] font-medium text-hii-800" title={typeLabel(document.document_type)}>{typeLabel(document.document_type)}</span>
                {document.is_archived && <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{t('documents.archived_status', locale)}</span>}
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                <span className="shrink-0 font-medium tabular-nums">v{document.current_version} · {formatBytes(document.file_size)}</span>
                <span className="truncate text-right" title={document.uploaded_by_name || undefined}>{document.uploaded_by_name || '—'}</span>
              </div>
              <p className="text-[10px] text-slate-500">{formatDateTime(document.updated_at, locale)}</p>
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
            <button type="button" onClick={() => selectDocument(document)} aria-pressed={selectedDocumentId === document.id} className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus:ring-2 focus:ring-hii-500">
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
                { key: 'details', label: t('documents.action_details', locale), icon: <Info className="size-4" />, onClick: () => { selectDocument(document); setDetailId(document.id); } },
                ...(isPreviewable(document.mime_type) ? [{ key: 'preview', label: t('documents.action_preview', locale), icon: <Eye className="size-4" />, onClick: () => selectDocument(document) }] : []),
                { key: 'download', label: t('documents.action_download', locale), icon: <Download className="size-4" />, onClick: () => void download(document) },
                document.is_archived
                  ? { key: 'restore', label: t('documents.restore', locale), icon: <ArchiveRestore className="size-4" />, onClick: () => void updateArchiveState(document, false) }
                  : { key: 'archive', label: t('documents.archive', locale), icon: <Archive className="size-4" />, onClick: () => setArchiveTarget(document) },
              ]}
              className="shrink-0 text-slate-500 [&>button]:grid [&>button]:size-8 [&>button]:place-items-center [&>button]:rounded [&>button]:hover:bg-slate-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-hii-500"
            />
          </div>
        );
      })}
    </div>
  );

  const categoryPane = (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
      <button
        type="button"
        onClick={() => { updateFilters({ documentType: '' }); closeNavigation(); }}
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
          onClick={() => { updateFilters({ documentType: value }); closeNavigation(); }}
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

  const navigationPanel = (collapsed = false) => collapsed ? (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-card">
      <button type="button" aria-label={t('documents.sidebar_expand', locale)} title={t('documents.sidebar_expand', locale)} onClick={() => setSidebarCollapsed(false)} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-hii-50 hover:text-hii-800 focus:outline-none focus:ring-2 focus:ring-hii-500"><PanelLeftOpen className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label={t('documents.nav_explorer', locale)} title={t('documents.nav_explorer', locale)} onClick={() => { openExplorer(); closeNavigation(); }} className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-hii-50 hover:text-hii-800 focus:outline-none focus:ring-2 focus:ring-hii-500"><FolderOpen className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label={t('documents.nav_recent', locale)} title={t('documents.nav_recent', locale)} onClick={() => { openRecent(); closeNavigation(); }} className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-hii-50 hover:text-hii-800 focus:outline-none focus:ring-2 focus:ring-hii-500"><Clock3 className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label={t('documents.nav_archived', locale)} title={t('documents.nav_archived', locale)} onClick={() => { openArchived(); closeNavigation(); }} className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-hii-50 hover:text-hii-800 focus:outline-none focus:ring-2 focus:ring-hii-500"><Archive className="size-4" aria-hidden="true" /></button>
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <button type="button" onClick={() => { openExplorer(); closeNavigation(); }} data-testid="documents-summary" aria-label={t('documents.summary_aria', locale)} className="block w-full bg-hii-800 p-3 text-left text-white transition-colors hover:bg-hii-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/75"><HardDrive className="size-3.5" aria-hidden="true" />{t('documents.storage_scope_label', locale)}</span>
        <span className="mt-1 flex items-end justify-between gap-2">
          <span className="truncate text-xl font-semibold tabular-nums tracking-tight">{loading || loadError || !summary ? '—' : formatBytes(summary.storageBytes, '0 B')}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-white/75">{loading || loadError || !summary ? '—' : formatCount(summary.documentCount)}</span>
        </span>
        <span className="mt-2 block text-[10px] leading-4 text-white/70">{t('documents.storage_scope_note', locale)}</span>
      </button>

      <nav className="space-y-1 p-2" data-testid="documents-shortcuts" aria-label={t('documents.nav_aria', locale)}>
        {[
          { label: t('documents.nav_explorer', locale), Icon: FolderOpen, onClick: openExplorer, active: view === 'explorer' && !filterProjectId },
          { label: t('documents.nav_projects', locale), Icon: BriefcaseBusiness, onClick: openProjects, active: view === 'projects' },
          { label: t('documents.nav_recent', locale), Icon: Clock3, onClick: openRecent, active: view === 'recent' },
          { label: t('documents.nav_search', locale), Icon: Search, onClick: openSearch, active: view === 'search' },
          { label: t('documents.nav_archived', locale), Icon: Archive, onClick: openArchived, active: view === 'archived' },
        ].map(({ label, Icon, onClick, active }) => (
          <button key={label} type="button" onClick={() => { onClick(); closeNavigation(); }} aria-current={active ? 'page' : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors ${active ? 'bg-hii-50 font-semibold text-hii-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="size-4" aria-hidden="true" />{label}</button>
        ))}
      </nav>

      <DocumentFolderExplorer
        projects={projects}
        projectsLoading={projectsLoading}
        projectsError={projectsError}
        companyFolders={{ folders: companyFolders, canManage: companyCanManage }}
        companyFoldersLoading={foldersLoading}
        companyFoldersError={foldersError}
        projectFolders={projectFolderLists}
        projectFoldersLoading={projectFolderLoading}
        projectFoldersErrors={projectFolderErrors}
        selection={folderSelection}
        onLoadProjectFolders={(projectId) => void loadProjectFolders(projectId)}
        onSelect={(selection) => { selectFolderSelection(selection); closeNavigation(); }}
        onFolderAction={openFolderAction}
        onRetryCompanyFolders={() => void loadFolders()}
        onRetryProjects={() => void loadProjects()}
      />

      <details data-testid="documents-categories" className="group border-t border-slate-100" open={categoriesTreeOpen} onToggle={(event) => setCategoriesTreeOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">{t('documents.categories_heading', locale)}<ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="border-t border-slate-100 p-2">{categoryPane}</div>
      </details>

    </div>
  );

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
              : view === 'archived'
                ? 'documents.nav_archived'
                : 'documents.nav_search',
        locale,
      ),
    },
    ...(companyScope && !filterProjectId ? [{ label: t('documents.company_documents', locale) }] : []),
    ...(filterProjectId ? [{ label: projectLabel(filterProjectId) }] : []),
    ...(activeFolder ? [{ label: activeFolder.name }] : []),
    ...(unfiled ? [{ label: t('documents.folder_unfiled', locale) }] : []),
    ...(documentType ? [{ label: typeLabel(documentType) }] : []),
    ...(view === 'search' && query ? [{ label: query }] : []),
  ];

  const isInspectorDrawer = Boolean(selectedDocument && isNarrowWorkspace && !isMobile);
  const currentScopeCanManage = companyScope && !filterProjectId
    ? companyCanManage
    : filterProjectId
      ? projectCanManage
      : false;
  const canCreateInCurrent = !activeFolder || activeFolder.allow_custom_children;
  const scopeHeading = unfiled
    ? t('documents.folder_unfiled', locale)
    : activeFolder?.name
      ?? (companyScope && !filterProjectId
        ? t('documents.company_documents', locale)
        : filterProjectId
          ? t('documents.project_documents', locale)
          : t('documents.list_heading', locale));
  const inspectorPane = selectedDocument ? (
        <aside
          className="min-w-0"
          aria-label={t('documents.inspector_aria', locale)}
          data-testid="documents-inspector"
        >
        <Card padding={false} className="overflow-hidden">
          {!isInspectorDrawer && <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{t('documents.inspector_title', locale)}</h2>
              <p className="mt-0.5 break-words text-sm font-medium text-slate-700">{selectedDocument.title}</p>
              {selectedDocument.is_archived && (
                <span className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {t('documents.archived_status', locale)}
                </span>
              )}
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
          </div>}

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
              {isInspectorDrawer && <h2 className="break-words text-sm font-semibold text-slate-900">{selectedDocument.title}</h2>}
              {previewDocument?.id === selectedDocument.id && (
                <DocumentPreviewModal
                  document={previewDocument}
                  open
                  inline
                  onClose={() => setPreviewDocument(null)}
                />
              )}
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
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-500">{t('documents.folder_location', locale)}</dt>
                  <dd className="mt-0.5 break-words font-medium text-slate-800">
                    {selectedDetail?.folder_id ? folderName(selectedDetail.folder_id) || selectedDetail.folder_name || '—' : t('documents.folder_unfiled_location', locale)}
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

              {!selectedDocument.is_archived && <div className="rounded-md border border-hii-200 bg-hii-50/40 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-hii-900"><BrainCircuit className="size-4" aria-hidden="true" />{t('documents.classification_suggestions', locale)}</p>
                <p className="mt-1 text-xs leading-4 text-slate-600">
                  {selectedSuggestions?.categories.length || selectedSuggestions?.projects.length
                    ? t('documents.classification_review_hint', locale)
                    : t('documents.classification_no_match', locale)}
                </p>
                <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setMetadataEditorOpen(true)} icon={<Tag className="size-3.5" aria-hidden="true" />}>
                  {t('documents.metadata_review_action', locale)}
                </Button>
              </div>}

              {selectedDetail && (
                <section className="border-t border-slate-100 pt-3" aria-label={t('documents.detail_versions', locale)}>
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Files className="size-3.5 text-slate-400" aria-hidden="true" />
                    {t('documents.detail_versions', locale)}
                    <span className="ml-auto font-normal tabular-nums text-slate-500">{formatCount(selectedDetail.versions.length)}</span>
                  </h3>
                  <ul className="mt-2 max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                    {selectedDetail.versions.slice(0, 5).map((version) => (
                      <li key={version.id ?? version.version} className="flex items-center gap-2 px-2.5 py-2 text-[11px]">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-700">
                            v{version.version}{version.version === selectedDocument.current_version ? ` · ${t('documents.version_current', locale)}` : ''}
                          </span>
                          <span className="ml-2 truncate text-slate-500">
                            {formatBytes(version.file_size)} · {formatDateTime(version.created_at, locale)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadVersion(selectedDocument, version)}
                          aria-label={t('documents.download_version', locale).replace('{version}', String(version.version))}
                          title={t('documents.download_version', locale).replace('{version}', String(version.version))}
                          className="grid size-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-hii-50 hover:text-hii-700 focus:outline-none focus:ring-2 focus:ring-hii-500"
                        >
                          <Download className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                    {selectedDetail.versions.length === 0 && <li className="px-2.5 py-2 text-[11px] text-slate-500">—</li>}
                  </ul>
                </section>
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
                {currentScopeCanManage && !selectedDocument.is_archived && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => selectedDetail ? void requestDocumentFolderMove(selectedDetail) : setDetailId(selectedDocument.id)}
                  >
                    {t('documents.folder_move_document', locale)}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Download className="size-4" aria-hidden="true" />}
                  onClick={() => void download(selectedDocument)}
                >
                  {t('documents.action_download', locale)}
                </Button>
                {selectedDocument.is_archived ? (
                  <Button type="button" variant="secondary" size="sm" icon={<ArchiveRestore className="size-4" aria-hidden="true" />} onClick={() => void updateArchiveState(selectedDocument, false)}>
                    {t('documents.restore', locale)}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" icon={<Archive className="size-4" aria-hidden="true" />} onClick={() => setArchiveTarget(selectedDocument)}>
                    {t('documents.archive', locale)}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
        </aside>
  ) : (
    <aside
      className="hidden min-w-0 lg:block"
      aria-label={t('documents.inspector_aria', locale)}
      data-testid="documents-inspector-empty"
    >
      <Card padding={false} className="flex min-h-[420px] items-center justify-center p-6 text-center shadow-none">
        <div className="max-w-[230px]">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-hii-50 text-hii-700">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">{t('documents.inspector_select_title', locale)}</h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">{t('documents.inspector_select_hint', locale)}</p>
        </div>
      </Card>
    </aside>
  );

  return (
    <div className="min-w-0 w-full max-w-full space-y-4" data-testid="documents-workspace">
      <header className="flex min-w-0 items-center gap-3 border-b border-slate-200 pb-3">
        {isNarrowWorkspace && (
          <Button type="button" variant="secondary" size="icon" onClick={() => setNavigationOpen(true)} aria-label={t('documents.sidebar_expand', locale)} title={t('documents.sidebar_expand', locale)} className="shrink-0 lg:hidden">
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          </Button>
        )}
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-hii-700 text-white">
          <Files className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">{t('documents.title', locale)}</h1>
          <p className="truncate text-xs text-slate-500">{t('documents.subtitle', locale)}</p>
        </div>
      </header>

      <div className={`grid w-full min-w-0 max-w-full gap-3 ${isNarrowWorkspace ? (sidebarCollapsed ? 'lg:grid-cols-[56px_minmax(0,1fr)]' : 'lg:grid-cols-[200px_minmax(0,1fr)]') : sidebarCollapsed ? 'lg:grid-cols-[56px_minmax(0,1fr)_300px] 2xl:grid-cols-[56px_minmax(0,1fr)_340px]' : 'lg:grid-cols-[200px_minmax(0,1fr)_300px] 2xl:grid-cols-[240px_minmax(0,1fr)_340px]'}`} data-testid="documents-layout">
        <aside id="documents-sidebar" data-testid="documents-sidebar" className="order-3 hidden min-w-0 lg:order-1 lg:block" aria-label={t('documents.sidebar_aria', locale)}>
          {navigationPanel(sidebarCollapsed)}
        </aside>
        <Drawer open={isNarrowWorkspace && navigationOpen} onClose={() => setNavigationOpen(false)} title={t('documents.sidebar_aria', locale)} side="right" size="md" className="!max-w-[360px] lg:hidden">
          {navigationPanel(false)}
        </Drawer>

        <main className={`order-1 min-w-0 lg:order-2 ${isMobile && selectedDocument ? 'hidden' : ''}`}>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              {(view === 'explorer' || view === 'projects') && <>
                <h2 className="truncate text-sm font-semibold text-slate-900">{scopeHeading}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{t('documents.folder_current_scope', locale)}</p>
              </>}
              <Breadcrumbs items={breadcrumbItems} className="min-w-0 overflow-hidden text-xs" />
              {view === 'recent' && <p className="mt-1 text-xs text-slate-500">{t('documents.recent_period', locale)}</p>}
              {view === 'archived' && <p className="mt-1 text-xs text-slate-500">{t('documents.archived_period', locale)}</p>}
              {view === 'projects' && filterProjectId && <p className="mt-1 text-xs text-slate-500">{t('documents.scope_hint', locale)} · {projectLabel(filterProjectId)}</p>}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{loading || loadError ? '—' : `${formatCount(documents.length)} / ${formatCount(total)}`}</span>
          </div>
          <section className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-white p-2.5" data-testid="documents-toolbar" aria-label={t('documents.results_aria', locale)}>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(140px,1fr)_minmax(140px,1fr)] lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.4fr)_minmax(140px,1fr)_minmax(140px,1fr)]" data-testid="documents-toolbar-search">
              <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 transition-colors focus-within:border-hii-500 focus-within:ring-2 focus-within:ring-hii-500/20 lg:col-span-2 2xl:col-span-1">
                <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchInput}
                  onFocus={() => setView('search')}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={activeFolder ? t('documents.folder_search_hint', locale) : t('documents.search_placeholder', locale)}
                  aria-label={t('documents.search_aria', locale)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                />
              </label>
              <div className="min-w-0">
                <label className="sr-only" htmlFor="documents-project-filter">{t('documents.filter_project', locale)}</label>
                <select
                  id="documents-project-filter"
                  className="hii-select h-10 w-full min-w-0 truncate"
                  value={filterProjectId}
                  onChange={(event) => selectProject(event.target.value)}
                  disabled={projectsLoading}
                >
                  <option value="">{t('documents.filter_all_projects', locale)}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.code ? `${project.code} — ` : ''}{project.name}</option>)}
                </select>
              </div>
              <div className="min-w-0">
                <label className="sr-only" htmlFor="documents-category-filter">{t('documents.filter_type', locale)}</label>
                <select
                  id="documents-category-filter"
                  className="hii-select h-10 w-full min-w-0 truncate"
                  value={documentType}
                  onChange={(event) => updateFilters({ documentType: event.target.value })}
                >
                  <option value="">{t('documents.filter_all_types', locale)}</option>
                  {DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2" data-testid="documents-toolbar-actions">
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={sidebarCollapsed ? t('documents.sidebar_expand', locale) : t('documents.sidebar_collapse', locale)}
                  aria-expanded={!sidebarCollapsed}
                  aria-controls="documents-sidebar"
                  onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                  title={sidebarCollapsed ? t('documents.sidebar_expand', locale) : t('documents.sidebar_collapse', locale)}
                  className="hidden !h-10 !w-10 lg:inline-flex"
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
                </Button>
                <div className="min-w-0 sm:w-[190px] sm:shrink-0">
                  <label className="sr-only" htmlFor="documents-sort">{t('documents.sort_aria', locale)}</label>
                  <select id="documents-sort" className="hii-select h-10 w-full min-w-0" value={`${sortBy}-${sortOrder}`} onChange={(event) => changeSort(event.target.value)}>
                    <option value="updated-desc">{t('documents.sort_updated_desc', locale)}</option>
                    <option value="updated-asc">{t('documents.sort_updated_asc', locale)}</option>
                    <option value="created-desc">{t('documents.sort_created_desc', locale)}</option>
                    <option value="created-asc">{t('documents.sort_created_asc', locale)}</option>
                    <option value="title-asc">{t('documents.sort_title_asc', locale)}</option>
                    <option value="title-desc">{t('documents.sort_title_desc', locale)}</option>
                  </select>
                </div>
                <div className="flex h-10 items-center rounded-lg border border-slate-200 p-0.5" role="group" aria-label={t('documents.presentation_aria', locale)}>
                  <button type="button" aria-pressed={presentation === 'grid'} onClick={() => setPresentation('grid')} className={`grid size-9 place-items-center rounded-md focus:outline-none focus:ring-2 focus:ring-hii-500 ${presentation === 'grid' ? 'bg-hii-50 text-hii-800' : 'text-slate-500 hover:bg-slate-50'}`} aria-label={t('documents.view_grid', locale)}><LayoutGrid className="size-4" aria-hidden="true" /></button>
                  <button type="button" aria-pressed={presentation === 'list'} onClick={() => setPresentation('list')} className={`grid size-9 place-items-center rounded-md focus:outline-none focus:ring-2 focus:ring-hii-500 ${presentation === 'list' ? 'bg-hii-50 text-hii-800' : 'text-slate-500 hover:bg-slate-50'}`} aria-label={t('documents.view_list', locale)}><List className="size-4" aria-hidden="true" /></button>
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                {currentScopeCanManage && canCreateInCurrent && <Button variant="secondary" size="md" onClick={() => openFolderAction({ kind: 'create', scope: folderSelection.scope === 'project' ? { projectId: folderSelection.projectId } : {}, ...(activeFolderId ? { parentId: activeFolderId } : {}) })} icon={<FolderOpen className="size-4" aria-hidden="true" />} className="h-10 shrink-0">{t('documents.folder_new', locale)}</Button>}
                <Button variant="ghost" size="icon" onClick={refresh} disabled={loading || projectsLoading || foldersLoading} aria-label={t('general.refresh', locale)} title={t('general.refresh', locale)} className="!h-10 !w-10"><RefreshCw className={`size-4 ${loading || projectsLoading || foldersLoading ? 'animate-spin' : ''}`} aria-hidden="true" /></Button>
                <Button variant="primary" size="md" onClick={openUploadDialog} icon={<Upload className="size-4" aria-hidden="true" />} className="h-10 shrink-0">{t('documents.add_document', locale)}</Button>
              </div>
            </div>
          </section>

          <details className="mb-3 rounded-lg border border-slate-200 bg-white" data-testid="documents-filters">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
              {t('documents.filters_more', locale)}
              <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />
            </summary>
            <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="documents-mime-filter" className="mb-1 block text-[11px] font-medium text-slate-600">{t('documents.file_type_overview', locale)}</label>
                <select id="documents-mime-filter" className="hii-select h-10 w-full" value={mimeType} onChange={(event) => updateFilters({ mimeType: event.target.value })}>
                  <option value="">{t('documents.file_type_all', locale)}</option>
                  {FILE_FAMILY_META.map((family) => <option key={family.id} value={family.filter}>{t(family.labelKey, locale)}</option>)}
                </select>
              </div>
              <div><label htmlFor="documente-filter-from" className="mb-1 block text-[11px] font-medium text-slate-600">{t('documents.filter_date_from', locale)}</label><input id="documente-filter-from" type="date" className="hii-input w-full" value={from} max={to || undefined} onChange={(event) => updateFilters({ from: event.target.value })} /></div>
              <div><label htmlFor="documente-filter-to" className="mb-1 block text-[11px] font-medium text-slate-600">{t('documents.filter_date_to', locale)}</label><input id="documente-filter-to" type="date" className="hii-input w-full" value={to} min={from || undefined} onChange={(event) => updateFilters({ to: event.target.value })} /></div>
              <div className="sm:col-span-2">
                <Button variant="secondary" size="sm" onClick={resetFilters} disabled={!hasFilters} icon={<X className="size-4" aria-hidden="true" />} className="min-h-10">{t('documents.filter_reset', locale)}</Button>
              </div>
            </div>
          </details>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label={t('documents.results_aria', locale)}>
            {loadError ? (
              <div className="p-4"><ErrorState title={t('documents.error_title', locale)} error={loadError} onRetry={() => void loadDocuments()} /></div>
            ) : loading ? (
              <div className="space-y-2 p-4" role="status" aria-label={t('documents.preview_loading', locale)}>{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
            ) : documents.length === 0 ? (
              <div className="p-4">{view === 'archived' && !hasFilters ? (
                <EmptyState icon={<Archive className="size-6" aria-hidden="true" />} title={t('documents.archived_empty_title', locale)} description={t('documents.archived_empty_hint', locale)} action={{ label: t('documents.nav_explorer', locale), onClick: openExplorer }} />
              ) : hasFilters ? (
                <EmptyState icon={<Search className="size-6" aria-hidden="true" />} title={t('documents.no_results_title', locale)} description={t('documents.no_results_hint', locale)} action={{ label: t('documents.filter_reset', locale), onClick: resetFilters }} />
              ) : (
                <EmptyState icon={<FileText className="size-6" aria-hidden="true" />} title={t('documents.empty_title', locale)} description={t('documents.empty_hint', locale)} />
              )}</div>
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

        {selectedDocument && isWideWorkspace && <div className="order-2 min-w-0 lg:order-3 lg:sticky lg:top-4 lg:self-start">{inspectorPane}</div>}
        {!selectedDocument && <div className="order-2 hidden min-w-0 lg:order-3 lg:sticky lg:top-4 lg:block lg:self-start">{inspectorPane}</div>}
        {isInspectorDrawer && (
          <Drawer
            open
            onClose={() => setSelectedDocumentId(null)}
            title={t('documents.inspector_title', locale)}
            side="right"
            size="sm"
            className="!max-w-[390px]"
          >
            {inspectorPane}
          </Drawer>
        )}
        {isMobile && selectedDocument && <div className="order-2 min-w-0">{inspectorPane}</div>}
      </div>

      <DocumentUploadCard open={uploadOpen} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} folders={uploadFolders} foldersLoading={uploadFoldersLoading} foldersError={uploadFoldersError} canManageFolders={uploadFoldersCanManage} destination={uploadDestination} onClose={closeUploadDialog} onDestinationChange={changeUploadDestination} onOpenDocument={(id) => setDetailId(id)} onUploaded={handleUploaded} />
      <DocumentDetailsModal documentId={detailId} open={detailId !== null} onClose={() => setDetailId(null)} onChanged={handleDocumentChanged} folderName={folderName(selectedDetail?.folder_id) ?? selectedDetail?.folder_name} canManageFolders={currentScopeCanManage} onRequestMoveToFolder={(document) => void requestDocumentFolderMove(document)} />
      {folderAction && <DocumentFolderActionDialog request={folderAction} folders={actionFolders} saving={folderActionBusy} error={folderActionError} onClose={() => !folderActionBusy && setFolderAction(null)} onSubmit={(request, payload) => void executeFolderAction(request, payload)} />}
      <DocumentMetadataEditor documentId={selectedDocumentId} open={metadataEditorOpen} projects={projects} onClose={() => setMetadataEditorOpen(false)} onSaved={handleMetadataSaved} />
      <ConfirmDialog
        open={archiveTarget !== null}
        title={t('documents.archive_confirm_title', locale)}
        message={archiveTarget ? `${archiveTarget.title}\n${t('documents.archive_confirm_message', locale)}` : t('documents.archive_confirm_message', locale)}
        confirmLabel={t('documents.archive_confirm_action', locale)}
        cancelLabel={t('general.cancel', locale)}
        variant="warning"
        loading={archiveBusy}
        onCancel={() => !archiveBusy && setArchiveTarget(null)}
        onConfirm={() => archiveTarget && void updateArchiveState(archiveTarget, true)}
      />
    </div>
  );
}

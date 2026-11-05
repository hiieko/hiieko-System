import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext, type Locale } from '@solar/shared';
import { ToastProvider } from '../../../components/ui/Toast';
import { DocumentsWorkspace } from './DocumentsWorkspace';

jest.mock('../../../lib/api-client', () => {
  const actual = jest.requireActual('../../../lib/api-client');
  return {
    ...actual,
    apiClient: {
      getProjects: jest.fn(),
      listDocuments: jest.fn(),
      listCompanyDocumentFolders: jest.fn(),
      listProjectDocumentFolders: jest.fn(),
      createDocumentFolder: jest.fn(),
      renameDocumentFolder: jest.fn(),
      moveDocumentFolder: jest.fn(),
      deleteDocumentFolder: jest.fn(),
      moveDocumentToFolder: jest.fn(),
      getDocument: jest.fn(),
      updateDocumentMetadata: jest.fn(),
      archiveDocument: jest.fn(),
      restoreDocument: jest.fn(),
      downloadDocumentVersion: jest.fn(),
      uploadDocument: jest.fn(),
      uploadDocumentVersion: jest.fn(),
      downloadDocument: jest.fn(),
    },
  };
});

import { apiClient, ApiError, type DocumentFolder, type DocumentListItem } from '../../../lib/api-client';

const mockedApi = apiClient as unknown as {
  getProjects: jest.Mock;
  listDocuments: jest.Mock;
  listCompanyDocumentFolders: jest.Mock;
  listProjectDocumentFolders: jest.Mock;
  createDocumentFolder: jest.Mock;
  renameDocumentFolder: jest.Mock;
  moveDocumentFolder: jest.Mock;
  deleteDocumentFolder: jest.Mock;
  moveDocumentToFolder: jest.Mock;
  getDocument: jest.Mock;
  updateDocumentMetadata: jest.Mock;
  archiveDocument: jest.Mock;
  restoreDocument: jest.Mock;
  downloadDocumentVersion: jest.Mock;
  uploadDocument: jest.Mock;
  uploadDocumentVersion: jest.Mock;
  downloadDocument: jest.Mock;
};

const PROJECT = { id: 'project-1', name: 'Bucecea 0.9 MW', code: 'BCJ' };
const PROJECT2 = { id: 'project-2', name: 'Fălticeni 1 MW', code: 'FLT' };
const COMPANY_FOLDER: DocumentFolder = {
  id: 'company-folder', name: 'Legal', parent_id: null, organization_id: 'org-1', project_id: null,
  created_by: 'user-1', template_folder_key: null, source_template_version_id: null,
  protection_policy: 'STANDARD', allow_custom_children: true, created_at: '2026-01-01', updated_at: '2026-01-01',
};
const PROJECT_FOLDER: DocumentFolder = {
  ...COMPANY_FOLDER, id: 'project-folder', name: 'Drawings', project_id: PROJECT.id,
};
const NESTED_FOLDER: DocumentFolder = {
  ...COMPANY_FOLDER, id: 'nested-folder', name: 'Issued', parent_id: COMPANY_FOLDER.id,
};

const ROW: DocumentListItem = {
  id: 'doc-1',
  title: 'Contract de execuție',
  code: 'CTR-042',
  document_type: 'CONTRACT',
  project_id: PROJECT.id,
  project_name: PROJECT.name,
  project_code: PROJECT.code,
  folder_id: null,
  current_version: 2,
  created_at: '2026-01-10T08:00:00.000Z',
  updated_at: '2026-02-11T09:30:00.000Z',
  mime_type: 'application/pdf',
  file_size: 2048,
  uploaded_by: 'user-1',
  uploaded_by_name: 'Ana Popescu',
};

function listResponse(rows: DocumentListItem[], total = rows.length) {
  return {
    data: {
      data: rows,
      total,
      page: 1,
      pageSize: 20,
      summary: {
        documentCount: total,
        storageBytes: rows.reduce((sum, row) => sum + (row.file_size ?? 0), 0),
        knownSizeCount: rows.filter((row) => row.file_size !== null).length,
        categoryCounts: rows.reduce<Record<string, number>>((counts, row) => {
          counts[row.document_type] = (counts[row.document_type] ?? 0) + 1;
          return counts;
        }, {}),
        categoryStorageBytes: rows.reduce<Record<string, number>>((sizes, row) => {
          if (row.file_size !== null) sizes[row.document_type] = (sizes[row.document_type] ?? 0) + row.file_size;
          return sizes;
        }, {}),
        fileTypeCounts: rows.reduce<Record<'pdf' | 'images' | 'xml' | 'other', number>>((counts, row) => {
          const family = row.mime_type === 'application/pdf'
            ? 'pdf'
            : row.mime_type?.startsWith('image/')
              ? 'images'
              : row.mime_type === 'application/xml' || row.mime_type === 'text/xml'
                ? 'xml'
                : 'other';
          counts[family] += 1;
          return counts;
        }, { pdf: 0, images: 0, xml: 0, other: 0 }),
        fileTypeStorageBytes: rows.reduce<Record<'pdf' | 'images' | 'xml' | 'other', number>>((sizes, row) => {
          const family = row.mime_type === 'application/pdf'
            ? 'pdf'
            : row.mime_type?.startsWith('image/')
              ? 'images'
              : row.mime_type === 'application/xml' || row.mime_type === 'text/xml'
                ? 'xml'
                : 'other';
          if (row.file_size !== null) sizes[family] += row.file_size;
          return sizes;
        }, { pdf: 0, images: 0, xml: 0, other: 0 }),
        fileTypeKnownSizeCounts: rows.reduce<Record<'pdf' | 'images' | 'xml' | 'other', number>>((counts, row) => {
          if (row.file_size === null) return counts;
          const family = row.mime_type === 'application/pdf'
            ? 'pdf'
            : row.mime_type?.startsWith('image/')
              ? 'images'
              : row.mime_type === 'application/xml' || row.mime_type === 'text/xml'
                ? 'xml'
                : 'other';
          counts[family] += 1;
          return counts;
        }, { pdf: 0, images: 0, xml: 0, other: 0 }),
      },
    },
  };
}

function renderWorkspace(locale: Locale = 'ro') {
  return render(
    <LocaleContext.Provider value={{ locale, setLocale: jest.fn() }}>
      <ToastProvider>
        <DocumentsWorkspace />
      </ToastProvider>
    </LocaleContext.Provider>,
  );
}

async function openUploadDialog(user = userEvent.setup()) {
  await user.click(within(screen.getByTestId('documents-toolbar')).getByRole('button', { name: 'Adaugă document' }));
  return within(await screen.findByRole('dialog', { name: 'Încarcă un document' }));
}

function filterPanel() {
  return within(screen.getByTestId('documents-filters'));
}

function resultsPanel() {
  return within(screen.getByTestId('documents-results'));
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: jest.fn(() => 'blob:documents-test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: jest.fn() });
  mockedApi.getProjects.mockResolvedValue({ data: [PROJECT] });
  mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [], canManage: true } });
  mockedApi.listProjectDocumentFolders.mockResolvedValue({ data: { folders: [], canManage: true } });
  mockedApi.createDocumentFolder.mockResolvedValue({ data: { id: 'folder-created', name: 'New folder', project_id: null } });
  mockedApi.renameDocumentFolder.mockResolvedValue({ data: { id: 'folder-1', name: 'Renamed' } });
  mockedApi.moveDocumentFolder.mockResolvedValue({ data: { id: 'folder-1', name: 'Moved' } });
  mockedApi.deleteDocumentFolder.mockResolvedValue({ data: { id: 'folder-1', deleted: true } });
  mockedApi.moveDocumentToFolder.mockResolvedValue({ data: { ...ROW, folder_id: 'folder-1', versions: [] } });
  mockedApi.listDocuments.mockResolvedValue(listResponse([ROW]));
  mockedApi.getDocument.mockResolvedValue({ data: { ...ROW, versions: [] } });
  mockedApi.updateDocumentMetadata.mockResolvedValue({ data: { ...ROW, versions: [] } });
  mockedApi.archiveDocument.mockResolvedValue({ data: { ...ROW, is_archived: true, versions: [] } });
  mockedApi.restoreDocument.mockResolvedValue({ data: { ...ROW, is_archived: false, versions: [] } });
  mockedApi.downloadDocumentVersion.mockResolvedValue(new Blob(['historical revision']));
  mockedApi.uploadDocumentVersion.mockResolvedValue({ data: { documentId: ROW.id, version: ROW.current_version + 1 } });
  mockedApi.uploadDocument.mockResolvedValue({
    data: {
      documentId: 'doc-2',
      url: '/api/upload/doc-2',
      fileName: 'Plan tehnic.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      checksum: 'abc',
    },
  });
  mockedApi.downloadDocument.mockResolvedValue(new Blob(['x']));
});

describe('DocumentsWorkspace', () => {
  it('loads the authorized documents and the authorized projects', async () => {
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );
    expect(screen.getByText('CTR-042')).toBeInTheDocument();
    expect(resultsPanel().getByText('Contract')).toBeInTheDocument();
    expect(resultsPanel().getByText('BCJ — Bucecea 0.9 MW')).toBeInTheDocument();
    expect(resultsPanel().getByText('Ana Popescu')).toBeInTheDocument();
    expect(screen.queryByTestId('documents-inspector')).not.toBeInTheDocument();
    expect(screen.getByTestId('documents-inspector-empty')).toBeInTheDocument();
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('1');
    expect(screen.getByText('Document PDF')).toBeInTheDocument();

    expect(mockedApi.getProjects).toHaveBeenCalledTimes(1);
    expect(mockedApi.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it('shows a result count from the API and responsive workspace columns', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse([ROW], 41));
    renderWorkspace();

    const summary = within(screen.getByTestId('documents-summary'));
    await waitFor(() => expect(screen.getByTestId('documents-summary')).toHaveTextContent('41'));
    expect(summary.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByTestId('documents-layout')).toHaveClass('lg:grid-cols-[200px_minmax(0,1fr)_300px]');
    expect(screen.getByTestId('documents-layout')).toHaveClass('2xl:grid-cols-[240px_minmax(0,1fr)_340px]');
  });

  it('sends the search term to the API after the debounce', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText('Caută documente'), 'contract');

    await waitFor(
      () =>
        expect(mockedApi.listDocuments).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'contract' }),
        ),
      { timeout: 3000 },
    );
  });

  it('sends the category and date filters to the API', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );

    const callsBefore = mockedApi.listDocuments.mock.calls.length;

    await user.click(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Aviz/ }));
    await waitFor(() =>
      expect(mockedApi.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: 'AVIZ' }),
      ),
    );

    await user.click(filterPanel().getByText('Filtre suplimentare'));
    await user.type(filterPanel().getByLabelText('De la'), '2026-01-01');
    await waitFor(() =>
      expect(mockedApi.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-01-01' }),
      ),
    );

    // One filter change = exactly one list request (no duplicated round-trip).
    expect(mockedApi.listDocuments).toHaveBeenCalledTimes(callsBefore + 2);
  });

  it('filters directly by authorized project and category from the explorer toolbar', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.selectOptions(screen.getByLabelText('Proiect'), PROJECT.id);
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: PROJECT.id }),
    ));
    await user.selectOptions(screen.getByLabelText('Categorie'), 'CONTRACT');
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: PROJECT.id, documentType: 'CONTRACT' }),
    ));
  });

  it('filters by stored MIME family and sends server-supported sort options', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByText('Filtre suplimentare'));
    await user.selectOptions(screen.getByLabelText('Tipuri de fișier'), 'application/pdf');
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf' }),
    ));
    await user.selectOptions(screen.getByLabelText('Sortează documentele'), 'title-asc');

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf', sortBy: 'title', sortOrder: 'asc' }),
    ));
  });

  it('switches between file cards and the detailed list', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vizualizare listă' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vizualizare carduri' }));
    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
  });

  it('uses an authenticated image thumbnail when the stored file is an image', async () => {
    const imageDocument = { ...ROW, title: 'PV layout.png', mime_type: 'image/png' };
    mockedApi.listDocuments.mockResolvedValue(listResponse([imageDocument]));
    renderWorkspace();

    expect(await screen.findByRole('img', { name: 'PV layout.png' })).toBeInTheDocument();
    expect(mockedApi.downloadDocument).toHaveBeenCalledWith(imageDocument.id);
  });

  it('keeps explorer controls in two rows and uses a permanent desktop three-column workspace', async () => {
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    const searchRow = screen.getByTestId('documents-toolbar-search');
    const actionRow = screen.getByTestId('documents-toolbar-actions');
    expect(within(searchRow).getByRole('searchbox', { name: 'Caută documente' })).toBeInTheDocument();
    expect(within(searchRow).getByLabelText('Proiect')).toBeInTheDocument();
    expect(within(searchRow).getByLabelText('Categorie')).toBeInTheDocument();
    expect(within(actionRow).getByLabelText('Sortează documentele')).toBeInTheDocument();
    expect(within(actionRow).getByRole('group', { name: 'Mod de afișare' })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'Reîmprospătează' })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'Adaugă document' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Adaugă document' })).toHaveLength(1);

    expect(screen.getByTestId('documents-layout')).toHaveClass('lg:grid-cols-[200px_minmax(0,1fr)_300px]');
    expect(screen.getByTestId('documents-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('documents-inspector-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('documents-storage-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('documents-file-type-breakdown')).not.toBeInTheDocument();
  });

  it('collapses and expands the project/category sidebar without losing its navigation', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    const collapse = screen.getByRole('button', { name: 'Restrânge panoul lateral' });

    await user.click(collapse);
    await user.click(within(screen.getByTestId('documents-sidebar')).getByRole('button', { name: 'Extinde panoul lateral' }));
    expect(within(screen.getByTestId('documents-sidebar')).getByText('Documente proiect')).toBeInTheDocument();
  });

  it('resets category and date filters', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Aviz/ }));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentType: 'AVIZ' }),
    ));
    await user.click(filterPanel().getByText('Filtre suplimentare'));
    await user.type(filterPanel().getByLabelText('De la'), '2026-01-01');
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-01-01' }),
    ));

    await user.click(filterPanel().getByRole('button', { name: 'Resetează filtrele' }));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentType: undefined, from: undefined, to: undefined }),
    ));
  });

  it('requests the next server page from the pagination control', async () => {
    const user = userEvent.setup();
    mockedApi.listDocuments.mockResolvedValue(listResponse([ROW], 41));
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByRole('navigation', { name: 'Paginare' })).getByRole('button', { name: 'Următor' }));

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 }),
    ));
  });

  it('scopes the list to the project selected in the Projects view', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );
    await user.click(within(screen.getByRole('navigation', { name: 'Navigare documente' })).getByRole('button', { name: 'Proiecte' }));

    const projectButton = within(screen.getByTestId('document-folder-explorer')).getByRole('button', { name: /BCJ — Bucecea/ });
    await user.click(projectButton);

    await waitFor(() =>
      expect(mockedApi.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PROJECT.id }),
      ),
    );
  });

  it('opens Recent using the existing created-date API filters', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const expectedTo = today.toISOString().slice(0, 10);
    const expectedFrom = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByRole('navigation', { name: 'Navigare documente' })).getByRole('button', { name: 'Recente' }));

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: expectedFrom, to: expectedTo }),
    ));
    expect(screen.getByText('Documente create în ultimele 30 de zile.')).toBeInTheDocument();
  });

  it('loads archived documents through the authorized archive filter', async () => {
    const user = userEvent.setup();
    mockedApi.listDocuments.mockResolvedValue(listResponse([{ ...ROW, is_archived: true }]));
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByRole('navigation', { name: 'Navigare documente' })).getByRole('button', { name: 'Arhivate' }));

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ archived: true }),
    ));
    expect(screen.getByText('Documente arhivate · fișierele și versiunile sunt păstrate.')).toBeInTheDocument();
  });

  it('archives a document only after confirmation and refreshes the active list', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByRole('button', { name: 'Mai multe acțiuni' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arhivează' }));
    expect(mockedApi.archiveDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Arhivează documentul' }));

    await waitFor(() => expect(mockedApi.archiveDocument).toHaveBeenCalledWith(ROW.id));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('restores an archived document from the archive explorer', async () => {
    const user = userEvent.setup();
    mockedApi.listDocuments.mockResolvedValue(listResponse([{ ...ROW, is_archived: true }]));
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    await user.click(within(screen.getByRole('navigation', { name: 'Navigare documente' })).getByRole('button', { name: 'Arhivate' }));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ archived: true })));

    await user.click(screen.getByRole('button', { name: 'Mai multe acțiuni' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restaurează' }));

    await waitFor(() => expect(mockedApi.restoreDocument).toHaveBeenCalledWith(ROW.id));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(3));
  });

  it('shows authorized-filter storage and category totals from the result summary', async () => {
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    expect(screen.getByTestId('documents-summary')).toHaveTextContent('2.0 KB');
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('Suma acoperă documentele autorizate');
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('1');
  });

  it('filters documents by MIME family from compact additional filters', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByText('Filtre suplimentare'));
    await user.selectOptions(screen.getByLabelText('Tipuri de fișier'), 'application/pdf');

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf' }),
    ));
  });

  it('selects an authorized document into the inspector using the real details endpoint', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByText('Contract de execuție'));

    expect(screen.getByRole('button', { name: 'Contract de execuție' })).toHaveAttribute('aria-pressed', 'true');
    const inspector = within(screen.getByTestId('documents-inspector'));
    expect(await inspector.findByText('Ana Popescu')).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Previzualizare' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Descarcă' })).toBeInTheDocument();
    expect(mockedApi.getDocument).toHaveBeenCalledWith(ROW.id);
    await user.click(screen.getByRole('button', { name: 'Vizualizare listă' }));
    expect(screen.getByTestId('documents-inspector')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vizualizare carduri' }));
    expect(screen.getByTestId('documents-inspector')).toBeInTheDocument();
  });

  it('updates the permanent desktop inspector when selection changes to another document', async () => {
    const user = userEvent.setup();
    const secondDocument = { ...ROW, id: 'doc-2', title: 'Plan tehnic', code: 'PLN-017' };
    mockedApi.listDocuments.mockResolvedValue(listResponse([ROW, secondDocument]));
    mockedApi.getDocument.mockImplementation(async (id: string) => ({
      data: { ...(id === secondDocument.id ? secondDocument : ROW), versions: [] },
    }));
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByRole('button', { name: 'Contract de execuție' }));
    const inspector = within(screen.getByTestId('documents-inspector'));
    expect(await inspector.findByText('CTR-042')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plan tehnic' }));
    expect(await inspector.findByText('PLN-017')).toBeInTheDocument();
    expect(mockedApi.getDocument).toHaveBeenLastCalledWith(secondDocument.id);
    expect(screen.getByTestId('documents-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('documents-results')).toBeInTheDocument();
  });

  it('uses the selected document as the mobile detail screen and returns to the explorer', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 767px)' || query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(() => false),
    })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    try {
      renderWorkspace();
      await screen.findByText('Contract de execuție');
      await user.click(screen.getByRole('button', { name: 'Extinde panoul lateral' }));
      const navigationDrawer = await screen.findByRole('dialog', { name: 'Navigare și filtre documente' });
      expect(within(navigationDrawer).getByTestId('document-folder-explorer')).toBeInTheDocument();
      await user.click(within(navigationDrawer).getByRole('button', { name: 'Documente companie' }));
      await user.click(screen.getByText('Contract de execuție'));

      expect(screen.getByRole('main')).toHaveClass('hidden');
      const inspector = within(await screen.findByTestId('documents-inspector'));
      expect(await inspector.findByText('Ana Popescu')).toBeInTheDocument();
      await user.click(inspector.getByRole('button', { name: 'Închide detaliile' }));
      expect(screen.getByRole('main')).not.toHaveClass('hidden');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('opens the selected-document inspector in a right drawer at narrower desktop widths', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(() => false),
    })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    try {
      renderWorkspace();
      await screen.findByText('Contract de execuție');
      await user.click(screen.getByText('Contract de execuție'));

      const inspectorDrawer = await screen.findByRole('dialog', { name: 'Detalii document' });
      expect(within(inspectorDrawer).getByTestId('documents-inspector')).toBeInTheDocument();
      expect(screen.getByTestId('documents-layout')).toHaveClass('lg:grid-cols-[200px_minmax(0,1fr)]');
      expect(screen.getByRole('main')).not.toHaveClass('hidden');
      await user.click(within(inspectorDrawer).getByRole('button', { name: 'Închide panoul' }));
      expect(screen.queryByRole('dialog', { name: 'Detalii document' })).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('opens the navigation panel on tablet widths and closes it after choosing a view', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(() => false),
    })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    try {
      renderWorkspace();
      await screen.findByText('Contract de execuție');
      await user.click(screen.getByRole('button', { name: 'Extinde panoul lateral' }));

      const navigationDrawer = await screen.findByRole('dialog', { name: 'Navigare și filtre documente' });
      expect(within(navigationDrawer).getByTestId('document-folder-explorer')).toBeInTheDocument();
      await user.click(within(navigationDrawer).getByRole('button', { name: 'Recente' }));

      expect(screen.queryByRole('dialog', { name: 'Navigare și filtre documente' })).not.toBeInTheDocument();
      await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      ));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('shows a download-only fallback for a document MIME type without browser preview support', async () => {
    const user = userEvent.setup();
    const cadDocument = { ...ROW, title: 'Plan de situație.dwg', mime_type: 'application/acad' };
    mockedApi.listDocuments.mockResolvedValue(listResponse([cadDocument]));
    mockedApi.getDocument.mockResolvedValue({ data: { ...cadDocument, versions: [] } });
    renderWorkspace();
    await screen.findByText('Plan de situație.dwg');
    expect(resultsPanel().getByText('Fișier')).toBeInTheDocument();

    await user.click(screen.getByText('Plan de situație.dwg'));

    const inspector = within(screen.getByTestId('documents-inspector'));
    expect(await inspector.findByText(/Acest tip de fișier nu poate fi previzualizat/)).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Descarcă' })).toBeInTheDocument();
    expect(mockedApi.downloadDocument).not.toHaveBeenCalled();
  });

  it('downloads a selected document through the authenticated document API', async () => {
    const user = userEvent.setup();
    const createObjectUrl = jest.fn(() => 'blob:authorized-document');
    const revokeObjectUrl = jest.fn();
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const clickAnchor = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    try {
      renderWorkspace();
      await screen.findByText('Contract de execuție');
      await user.click(screen.getByText('Contract de execuție'));
      const inspector = within(await screen.findByTestId('documents-inspector'));
      await user.click(inspector.getByRole('button', { name: 'Descarcă' }));

      await waitFor(() => expect(mockedApi.downloadDocument).toHaveBeenCalledWith(ROW.id));
      expect(createObjectUrl).toHaveBeenCalled();
      expect(clickAnchor).toHaveBeenCalled();
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:authorized-document');
    } finally {
      clickAnchor.mockRestore();
      if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      else delete (URL as Partial<typeof URL>).createObjectURL;
      if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
      else delete (URL as Partial<typeof URL>).revokeObjectURL;
    }
  });

  it('downloads a historical revision through its authenticated version endpoint', async () => {
    const user = userEvent.setup();
    const versionedRow = { ...ROW, title: 'Contract.pdf' };
    const versions = [
      {
        id: 'version-2', document_id: ROW.id, version: 2, file_size: 2048, checksum: 'new',
        uploaded_by: 'user-1', uploaded_by_name: 'Ana Popescu', mime_type: 'application/pdf', created_at: '2026-02-11T09:30:00.000Z',
      },
      {
        id: 'version-1', document_id: ROW.id, version: 1, file_size: 1024, checksum: 'old',
        uploaded_by: 'user-1', uploaded_by_name: 'Ana Popescu', mime_type: 'application/pdf', created_at: '2026-01-10T08:00:00.000Z',
      },
    ];
    mockedApi.listDocuments.mockResolvedValue(listResponse([versionedRow]));
    mockedApi.getDocument.mockResolvedValue({ data: { ...versionedRow, versions } });
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createObjectUrl = jest.fn(() => 'blob:historical-version');
    const revokeObjectUrl = jest.fn();
    const clickAnchor = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Contract.v1.pdf');
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    try {
      renderWorkspace();
      await screen.findByText('Contract.pdf');
      await user.click(screen.getByText('Contract.pdf'));
      const inspector = within(await screen.findByTestId('documents-inspector'));
      await user.click(await inspector.findByRole('button', { name: 'Descarcă versiunea v1' }));

      await waitFor(() => expect(mockedApi.downloadDocumentVersion).toHaveBeenCalledWith(ROW.id, 'version-1'));
      expect(createObjectUrl).toHaveBeenCalled();
      expect(clickAnchor).toHaveBeenCalled();
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:historical-version');
    } finally {
      clickAnchor.mockRestore();
      if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      else delete (URL as Partial<typeof URL>).createObjectURL;
      if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
      else delete (URL as Partial<typeof URL>).revokeObjectURL;
    }
  });

  it('loads the stored category when reviewing metadata and saves only after an explicit confirmation', async () => {
    const user = userEvent.setup();
    mockedApi.getProjects.mockResolvedValue({ data: [PROJECT, PROJECT2] });
    const classifiedRow = { ...ROW, code: `${PROJECT2.code} FACTURA` };
    const updatedDocument = {
      ...classifiedRow,
      title: 'Factura revizuită',
      document_type: 'FACTURA',
      project_id: PROJECT2.id,
      project_name: PROJECT2.name,
      project_code: PROJECT2.code,
    };
    mockedApi.listDocuments.mockResolvedValueOnce(listResponse([classifiedRow]));
    mockedApi.listDocuments.mockResolvedValue(listResponse([updatedDocument]));
    mockedApi.getDocument.mockResolvedValue({ data: { ...classifiedRow, versions: [] } });
    mockedApi.updateDocumentMetadata.mockResolvedValue({ data: { ...updatedDocument, versions: [] } });
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    await user.click(screen.getByText('Contract de execuție'));

    const inspector = within(screen.getByTestId('documents-inspector'));
    await inspector.findByText('Ana Popescu');
    await user.click(inspector.getByRole('button', { name: 'Revizuiește clasificarea' }));

    const editor = within(await screen.findByRole('dialog', { name: 'Revizuiește clasificarea' }));
    expect(editor.getByLabelText('Categorie')).toHaveValue('CONTRACT');
    expect(mockedApi.updateDocumentMetadata).not.toHaveBeenCalled();
    await user.click(editor.getByRole('button', { name: 'Folosește sugestia: Factură' }));
    await user.clear(editor.getByLabelText('Titlu'));
    await user.type(editor.getByLabelText('Titlu'), updatedDocument.title);
    await user.click(editor.getByRole('button', { name: `Folosește sugestia: ${PROJECT2.name}` }));
    expect(mockedApi.updateDocumentMetadata).not.toHaveBeenCalled();
    await user.click(editor.getByRole('button', { name: 'Salvează clasificarea' }));

    await waitFor(() => expect(mockedApi.updateDocumentMetadata).toHaveBeenCalledWith(
      ROW.id,
      expect.objectContaining({
        documentType: 'FACTURA',
        title: updatedDocument.title,
        code: `${PROJECT2.code} FACTURA`,
        projectId: PROJECT2.id,
      }),
    ));
    expect(await inspector.findByText('Factură')).toBeInTheDocument();

    mockedApi.getDocument.mockResolvedValue({ data: { ...updatedDocument, versions: [] } });
    await user.click(inspector.getByRole('button', { name: 'Revizuiește clasificarea' }));
    const reopenedEditor = within(await screen.findByRole('dialog', { name: 'Revizuiește clasificarea' }));
    await waitFor(() => expect(reopenedEditor.getByLabelText('Categorie')).toHaveValue('FACTURA'));
    expect(reopenedEditor.getByLabelText('Proiect')).toHaveValue(PROJECT2.id);
  });

  it('shows the "no results" state when the filtered list is empty', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse([], 0));
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByLabelText('Caută documente'), 'zzz');

    // The debounced query reaches the API first, then the state switches from
    // "empty" to "no results" - the assertion retries until the DOM is stable.
    await waitFor(() =>
      expect(mockedApi.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'zzz' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText('Niciun rezultat')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Niciun document nu corespunde filtrelor/),
      ).toBeInTheDocument(),
    );
  });

  it('shows the empty state when there is no document at all', async () => {
    mockedApi.listDocuments.mockResolvedValue(listResponse([], 0));
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Niciun document')).toBeInTheDocument(),
    );
  });

  it('surfaces a load error with a retry action', async () => {
    mockedApi.listDocuments.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(listResponse([ROW]));
    const user = userEvent.setup();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Eroare la încărcarea documentelor')).toBeInTheDocument(),
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Încearcă din nou' }));
    expect(await screen.findByText('Contract de execuție')).toBeInTheDocument();
  });

  it('uploads a document through the API and refreshes the list', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );

    const dialog = await openUploadDialog(user);
    const file = new File(['%PDF-1.4'], `${PROJECT.code} Factura.pdf`, { type: 'application/pdf' });
    const uploadedRow: DocumentListItem = {
      ...ROW,
      id: 'doc-2',
      title: file.name,
      code: null,
      document_type: 'FACTURA',
    };
    mockedApi.listDocuments.mockResolvedValue(listResponse([uploadedRow]));
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.click(dialog.getByRole('button', { name: 'Folosește sugestia: Factură' }));
    await user.click(dialog.getByRole('button', { name: 'Folosește sugestia: Bucecea 0.9 MW' }));
    await user.selectOptions(dialog.getByLabelText('Destinație'), `scope:project:${PROJECT.id}`);
    expect(dialog.getByLabelText('Categorie')).toHaveValue('FACTURA');
    await user.click(
      dialog.getByRole('button', { name: 'Încarcă documentul' }),
    );

    await waitFor(() =>
      expect(mockedApi.uploadDocument).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          projectId: PROJECT.id,
          documentType: 'FACTURA',
        }),
      ),
    );

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2));
    expect(resultsPanel().getByText('Factură')).toBeInTheDocument();
    expect(resultsPanel().getByText('BCJ — Bucecea 0.9 MW')).toBeInTheDocument();
  });

  it('uploads a company document without sending an organization identifier or project id', async () => {
    const user = userEvent.setup();
    mockedApi.uploadDocument.mockResolvedValue({ data: { documentId: 'company-doc-1' } });
    const companyRow: DocumentListItem = {
      ...ROW,
      id: 'company-doc-1',
      title: 'Organization policy.pdf',
      project_id: null,
      project_name: null,
      project_code: null,
    };
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    mockedApi.listDocuments.mockResolvedValue(listResponse([companyRow]));

    const dialog = await openUploadDialog(user);
    const file = new File(['%PDF-1.4'], 'Organization policy.pdf', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.selectOptions(dialog.getByLabelText('Destinație'), 'scope:company');
    await user.selectOptions(dialog.getByLabelText('Categorie'), 'CONTRACT');
    await user.click(dialog.getByRole('button', { name: 'Încarcă documentul' }));

    await waitFor(() => expect(mockedApi.uploadDocument).toHaveBeenCalledTimes(1));
    expect(mockedApi.uploadDocument).toHaveBeenCalledWith(file, expect.any(Object));
    const uploadOptions = mockedApi.uploadDocument.mock.calls[0][1];
    expect(uploadOptions).not.toHaveProperty('projectId');
    expect(uploadOptions).not.toHaveProperty('organizationId');
    expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2);
  });

  it('warns on an exact same-project byte duplicate and uploads separately only after confirmation', async () => {
    const user = userEvent.setup();
    mockedApi.uploadDocument
      .mockResolvedValueOnce({ data: {
        duplicate: true,
        matchScope: 'authorized_projects',
        matches: [{
          documentId: 'doc-existing',
          title: 'Contract original.pdf',
          code: 'CTR-1',
          documentType: 'CONTRACT',
          projectId: PROJECT.id,
          projectName: PROJECT.name,
          projectCode: PROJECT.code,
          currentVersion: 3,
          matchingVersion: 2,
        }],
      } })
      .mockResolvedValueOnce({ data: { documentId: 'doc-3' } });
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    const dialog = await openUploadDialog(user);
    const file = new File(['identical-byte-fixture'], 'Contract original.pdf', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.selectOptions(dialog.getByLabelText('Destinație'), `scope:project:${PROJECT.id}`);
    await user.selectOptions(dialog.getByLabelText('Categorie'), 'CONTRACT');
    await user.click(dialog.getByRole('button', { name: 'Încarcă documentul' }));

    expect(await dialog.findByText('Contract original.pdf')).toBeInTheDocument();
    expect(dialog.getByText(/SHA-256 corespunde/)).toBeInTheDocument();
    expect(mockedApi.uploadDocument).toHaveBeenCalledTimes(1);
    expect(mockedApi.listDocuments).toHaveBeenCalledTimes(1);

    await user.click(dialog.getByRole('button', { name: 'Încarcă separat oricum' }));
    await waitFor(() => expect(mockedApi.uploadDocument).toHaveBeenNthCalledWith(
      2,
      file,
      expect.objectContaining({ projectId: PROJECT.id, documentType: 'CONTRACT', allowDuplicate: true }),
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens and closes the compact upload dialog accessibly', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    const dialog = await openUploadDialog(user);
    expect(dialog.getByLabelText('Destinație')).toBeInTheDocument();
    expect(dialog.getByLabelText('Categorie')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Anulează' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers a filename metadata suggestion that preserves the source extension and requires a click', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    const dialog = await openUploadDialog(user);
    const file = new File(['scan bytes'], 'scan001.PDF', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.selectOptions(dialog.getByLabelText('Destinație'), `scope:project:${PROJECT.id}`);
    await user.selectOptions(dialog.getByLabelText('Categorie'), 'CONTRACT');

    expect(await dialog.findByText('BCJ_contract_scan001.PDF')).toBeInTheDocument();
    expect(dialog.getByLabelText('Titlu')).toHaveValue('');
    await user.click(dialog.getByRole('button', { name: 'Folosește în titlu' }));
    expect(dialog.getByLabelText('Titlu')).toHaveValue('BCJ_contract_scan001.PDF');
    expect(mockedApi.uploadDocument).not.toHaveBeenCalled();
  });

  it('reports upload progress while the upload request is active', async () => {
    const user = userEvent.setup();
    let finishUpload: (() => void) | undefined;
    mockedApi.uploadDocument.mockImplementation((_file: File, options: any) => {
      options.onProgress?.(46);
      return new Promise((resolve) => {
        finishUpload = () => resolve({ data: { documentId: 'doc-2' } });
      });
    });
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    const dialog = await openUploadDialog(user);
    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.selectOptions(dialog.getByLabelText('Destinație'), `scope:project:${PROJECT.id}`);
    await user.selectOptions(dialog.getByLabelText('Categorie'), 'CONTRACT');
    await user.click(dialog.getByRole('button', { name: 'Încarcă documentul' }));

    expect(await dialog.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '46');
    await act(async () => finishUpload?.());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('refuses an unsupported file type before calling the API', async () => {
    // `applyAccept: false` bypasses the `accept` attribute so the client-side
    // MIME check is the one under test.
    const user = userEvent.setup({ applyAccept: false });
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );

    const dialog = await openUploadDialog(user);
    const file = new File(['nope'], 'notes.exe', {
      type: 'application/x-msdownload',
    });
    await user.upload(dialog.getByLabelText('Fișier'), file);
    await user.selectOptions(dialog.getByLabelText('Destinație'), `scope:project:${PROJECT.id}`);
    await user.selectOptions(dialog.getByLabelText('Categorie'), 'CONTRACT');
    await user.click(
      dialog.getByRole('button', { name: 'Încarcă documentul' }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Tip de fișier nesuportat/),
      ).toBeInTheDocument(),
    );
    expect(mockedApi.uploadDocument).not.toHaveBeenCalled();
  });

  it('opens the details panel with the real version history', async () => {
    const user = userEvent.setup();
    mockedApi.getDocument.mockResolvedValue({
      data: {
        ...ROW,
        versions: [
          {
            id: 'v2',
            document_id: ROW.id,
            version: 2,
            file_size: 2048,
            checksum: 'abc',
            uploaded_by: 'user-1',
            uploaded_by_name: 'Ana Popescu',
            mime_type: 'application/pdf',
            created_at: '2026-02-11T09:30:00.000Z',
          },
          {
            id: 'v1',
            document_id: ROW.id,
            version: 1,
            file_size: 1024,
            checksum: 'def',
            uploaded_by: 'user-1',
            uploaded_by_name: 'Ana Popescu',
            mime_type: 'application/pdf',
            created_at: '2026-01-10T08:00:00.000Z',
          },
        ],
      },
    });

    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Contract de execuție')).toBeInTheDocument(),
    );
    await user.click(screen.getByText('Contract de execuție'));
    await user.click(within(screen.getByTestId('documents-inspector')).getByRole('button', { name: 'Detalii' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Detalii document')).toBeInTheDocument();
    expect(within(dialog).getByText('Istoricul versiunilor')).toBeInTheDocument();
    expect(mockedApi.getDocument).toHaveBeenCalledWith(ROW.id);
  });

  it('requires an explicit choice before adding bytes that match a prior version', async () => {
    const user = userEvent.setup();
    mockedApi.uploadDocumentVersion
      .mockResolvedValueOnce({ data: {
        duplicate: true,
        matchScope: 'document',
        matches: [{
          documentId: ROW.id,
          title: ROW.title,
          code: ROW.code,
          documentType: ROW.document_type,
          projectId: ROW.project_id,
          projectName: ROW.project_name,
          projectCode: ROW.project_code,
          currentVersion: ROW.current_version,
          matchingVersion: 1,
        }],
      } })
      .mockResolvedValueOnce({ data: { documentId: ROW.id, version: 3 } });
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    await user.click(screen.getByText('Contract de execuție'));
    const inspector = within(screen.getByTestId('documents-inspector'));
    await inspector.findByText('Ana Popescu');
    await user.click(inspector.getByRole('button', { name: 'Detalii' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Detalii document' }));
    const file = new File(['same-revision-bytes'], 'contract-v1.pdf', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('Versiune nouă'), file);
    await user.click(dialog.getByRole('button', { name: 'Versiune nouă' }));

    expect(await dialog.findByText(/corespunde unei versiuni existente/)).toBeInTheDocument();
    expect(mockedApi.uploadDocumentVersion).toHaveBeenCalledTimes(1);
    await user.click(dialog.getByRole('button', { name: 'Adaugă oricum ca versiune nouă' }));

    await waitFor(() => expect(mockedApi.uploadDocumentVersion).toHaveBeenNthCalledWith(
      2,
      ROW.id,
      file,
      expect.objectContaining({ allowDuplicate: true }),
    ));
  });

  it('opens the supported XML preview through the authenticated download API', async () => {
    const user = userEvent.setup();
    mockedApi.listDocuments.mockResolvedValue(listResponse([{ ...ROW, mime_type: 'application/xml' }]));
    mockedApi.downloadDocument.mockResolvedValue({
      text: jest.fn().mockResolvedValue('<Invoice />'),
    } as unknown as Blob);
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByText('Contract de execuție'));
    await user.click(within(screen.getByTestId('documents-inspector')).getByRole('button', { name: 'Previzualizare' }));
    expect(await screen.findByText('<Invoice />')).toBeInTheDocument();
    expect(mockedApi.downloadDocument).toHaveBeenCalledWith(ROW.id);
  });

  it('keeps company and project folder queries separate and composes Unfiled with other filters', async () => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER, NESTED_FOLDER], canManage: true } });
    mockedApi.listProjectDocumentFolders.mockResolvedValue({ data: { folders: [PROJECT_FOLDER], canManage: true } });
    renderWorkspace('en');

    await screen.findByText('Contract de execuție');
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'company' })));
    await user.click(screen.getAllByRole('button', { name: 'Unfiled' })[0]);
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'company', unfiled: true })));

    const folderExplorer = within(screen.getByTestId('document-folder-explorer'));
    const projectButton = folderExplorer.getByRole('button', { name: /BCJ — Bucecea/ });
    await user.click(projectButton);
    const projectRow = projectButton.parentElement as HTMLElement;
    await user.click(within(projectRow).getByRole('button', { name: 'Expand folder' }));
    await waitFor(() => expect(mockedApi.listProjectDocumentFolders).toHaveBeenCalledWith(PROJECT.id));
    await user.click(screen.getAllByRole('button', { name: 'Unfiled' })[1]);
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: PROJECT.id, unfiled: true })));

    await user.click(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Invoice/ }));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: PROJECT.id, unfiled: true, documentType: 'FACTURA' })));
  });

  it('uploads a document into a selected folder without sending ownership fields', async () => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER], canManage: true } });
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');
    await user.click(within(screen.getByTestId('documents-toolbar')).getByRole('button', { name: 'Upload document' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Upload a document' }));
    await waitFor(() => expect(dialog.getByLabelText('Folder location')).toBeInTheDocument());
    const file = new File(['%PDF-1.4'], 'policy.pdf', { type: 'application/pdf' });
    await user.upload(dialog.getByLabelText('File'), file);
    await user.selectOptions(dialog.getByLabelText('Destination'), 'scope:company');
    await user.selectOptions(dialog.getByLabelText('Folder location'), COMPANY_FOLDER.id);
    await user.selectOptions(dialog.getByLabelText('Category'), 'CONTRACT');
    await user.click(dialog.getByRole('button', { name: 'Upload document' }));

    await waitFor(() => expect(mockedApi.uploadDocument).toHaveBeenCalledWith(file, expect.objectContaining({ folderId: COMPANY_FOLDER.id })));
    expect(mockedApi.uploadDocument.mock.calls[0][1]).not.toHaveProperty('organizationId');
    expect(mockedApi.uploadDocument.mock.calls[0][1]).not.toHaveProperty('projectId');
  });

  it('files an existing document through an explicit same-scope move dialog and refreshes the list', async () => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER], canManage: true } });
    mockedApi.getDocument.mockResolvedValue({ data: { ...ROW, project_id: null, folder_id: null, versions: [] } });
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');
    await user.click(screen.getByText('Contract de execuție'));
    await user.click(within(screen.getByTestId('documents-inspector')).getByRole('button', { name: 'Details' }));
    const detailDialog = within(await screen.findByRole('dialog', { name: 'Document details' }));
    await user.click(detailDialog.getByRole('button', { name: 'Move to folder' }));

    const moveDialog = within(await screen.findByRole('dialog', { name: 'Move document to folder' }));
    await user.selectOptions(moveDialog.getByLabelText('Parent folder'), COMPANY_FOLDER.id);
    await user.click(moveDialog.getByRole('button', { name: 'Move to folder' }));

    await waitFor(() => expect(mockedApi.moveDocumentToFolder).toHaveBeenCalledWith(ROW.id, COMPANY_FOLDER.id));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('shows localized permission/conflict errors and does not close the folder dialog on failure', async () => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER], canManage: true } });
    mockedApi.renameDocumentFolder.mockRejectedValue(new ApiError('Folder has documents', 409));
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');
    const folderRow = screen.getByRole('button', { name: COMPANY_FOLDER.name }).parentElement as HTMLElement;
    await user.click(within(folderRow).getByRole('button', { name: 'Folder actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Rename folder' }));
    await user.clear(dialog.getByLabelText('Folder name'));
    await user.type(dialog.getByLabelText('Folder name'), 'Contracts');
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await dialog.findByText(/The folder cannot be changed in its current state/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename folder' })).toBeInTheDocument();
  });

  it.each([
    [403, 'You do not have permission to do this.'],
    [404, 'The folder or document no longer exists. Reload the workspace.'],
  ])('maps folder HTTP %i errors to a localized message', async (statusCode, localizedMessage) => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER], canManage: true } });
    mockedApi.renameDocumentFolder.mockRejectedValue(new ApiError('Request failed', statusCode));
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');
    const folderRow = within(screen.getByTestId('document-folder-explorer')).getByRole('button', { name: 'Legal' }).parentElement as HTMLElement;
    await user.click(within(folderRow).getByRole('button', { name: 'Folder actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Rename folder' }));
    await user.clear(dialog.getByLabelText('Folder name'));
    await user.type(dialog.getByLabelText('Folder name'), 'Contracts');
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(localizedMessage);
  });

  it('refreshes the affected folder tree and document list after a rename', async () => {
    const user = userEvent.setup();
    mockedApi.listCompanyDocumentFolders.mockResolvedValue({ data: { folders: [COMPANY_FOLDER], canManage: true } });
    mockedApi.renameDocumentFolder.mockResolvedValue({ data: { ...COMPANY_FOLDER, name: 'Contracts' } });
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');
    const folderRow = within(screen.getByTestId('document-folder-explorer')).getByRole('button', { name: 'Legal' }).parentElement as HTMLElement;
    await user.click(within(folderRow).getByRole('button', { name: 'Folder actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Rename folder' }));
    await user.clear(dialog.getByLabelText('Folder name'));
    await user.type(dialog.getByLabelText('Folder name'), 'Contracts');
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockedApi.renameDocumentFolder).toHaveBeenCalledWith(COMPANY_FOLDER.id, 'Contracts'));
    await waitFor(() => expect(mockedApi.listCompanyDocumentFolders).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('renders the workspace actions and categories in English', async () => {
    const user = userEvent.setup();
    mockedApi.getDocument.mockResolvedValue({ data: { ...ROW, versions: [] } });
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');

    expect(screen.getByLabelText('Search documents')).toBeInTheDocument();
    expect(within(screen.getByTestId('documents-toolbar')).getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Document navigation' })).toBeInTheDocument();
    expect(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Invoice/ })).toBeInTheDocument();

    await user.click(screen.getByText('Contract de execuție'));
    await user.click(within(screen.getByTestId('documents-inspector')).getByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Document details' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

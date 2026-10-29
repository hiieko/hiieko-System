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
      getDocument: jest.fn(),
      updateDocumentMetadata: jest.fn(),
      uploadDocument: jest.fn(),
      uploadDocumentVersion: jest.fn(),
      downloadDocument: jest.fn(),
    },
  };
});

import { apiClient, type DocumentListItem } from '../../../lib/api-client';

const mockedApi = apiClient as unknown as {
  getProjects: jest.Mock;
  listDocuments: jest.Mock;
  getDocument: jest.Mock;
  updateDocumentMetadata: jest.Mock;
  uploadDocument: jest.Mock;
  uploadDocumentVersion: jest.Mock;
  downloadDocument: jest.Mock;
};

const PROJECT = { id: 'project-1', name: 'Bucecea 0.9 MW', code: 'BCJ' };
const PROJECT2 = { id: 'project-2', name: 'Fălticeni 1 MW', code: 'FLT' };

const ROW: DocumentListItem = {
  id: 'doc-1',
  title: 'Contract de execuție',
  code: 'CTR-042',
  document_type: 'CONTRACT',
  project_id: PROJECT.id,
  project_name: PROJECT.name,
  project_code: PROJECT.code,
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
  await user.click(screen.getByRole('button', { name: 'Adaugă document' }));
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
  mockedApi.getProjects.mockResolvedValue({ data: [PROJECT] });
  mockedApi.listDocuments.mockResolvedValue(listResponse([ROW]));
  mockedApi.getDocument.mockResolvedValue({ data: { ...ROW, versions: [] } });
  mockedApi.updateDocumentMetadata.mockResolvedValue({ data: { ...ROW, versions: [] } });
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
    expect(screen.getByTestId('documents-summary').parentElement).toHaveTextContent('Documente găsite: 1');
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
    expect(screen.getByTestId('documents-layout')).toHaveClass('xl:grid-cols-[250px_minmax(0,1fr)]');
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

    await user.type(filterPanel().getByLabelText('De la'), '2026-01-01');
    await waitFor(() =>
      expect(mockedApi.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-01-01' }),
      ),
    );

    // One filter change = exactly one list request (no duplicated round-trip).
    expect(mockedApi.listDocuments).toHaveBeenCalledTimes(callsBefore + 2);
  });

  it('filters by stored MIME family and sends server-supported sort options', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByTestId('documents-file-type-breakdown')).getByRole('button', { name: /Document PDF/ }));
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

    expect(screen.getByRole('table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vizualizare carduri' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vizualizare listă' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('collapses and expands the project/category sidebar without losing its navigation', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');
    const collapse = screen.getByRole('button', { name: 'Restrânge panoul lateral' });

    await user.click(collapse);
    expect(screen.getByTestId('documents-sidebar')).toHaveClass('hidden');
    await user.click(within(screen.getByTestId('documents-sidebar')).getByRole('button', { name: 'Extinde panoul lateral' }));
    expect(screen.getByTestId('documents-sidebar')).not.toHaveClass('hidden');
    expect(within(screen.getByTestId('documents-sidebar')).getByText('Proiecte autorizate')).toBeInTheDocument();
  });

  it('resets category and date filters', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Aviz/ }));
    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentType: 'AVIZ' }),
    ));
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
    await user.click(screen.getByRole('button', { name: 'Proiecte' }));

    const projectButton = await screen.findByRole('button', { name: /Bucecea/ });
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

  it('shows authorized-filter storage and category totals from the result summary', async () => {
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    expect(screen.getByTestId('documents-summary')).toHaveTextContent('2.0 KB');
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('1/1');
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('Suma acoperă documentele autorizate');
    expect(screen.getByTestId('documents-summary')).toHaveTextContent('Documente găsite: 1');
    expect(screen.getByTestId('documents-file-type-breakdown')).toHaveTextContent('Document PDF');
    expect(screen.getByTestId('documents-file-type-breakdown')).toHaveTextContent('Toate tipurile');
  });

  it('filters documents from a category breakdown card using the existing category filter', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(within(screen.getByTestId('documents-file-type-breakdown')).getByRole('button', { name: /Document PDF/ }));

    await waitFor(() => expect(mockedApi.listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf' }),
    ));
  });

  it('selects an authorized document into the inspector using the real details endpoint', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText('Contract de execuție');

    await user.click(screen.getByText('Contract de execuție'));

    expect(screen.getByRole('row', { name: /Contract de execuție/ })).toHaveAttribute('aria-selected', 'true');
    const inspector = within(screen.getByTestId('documents-inspector'));
    expect(await inspector.findByText('Ana Popescu')).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Previzualizare' })).toBeInTheDocument();
    expect(inspector.getByRole('button', { name: 'Descarcă' })).toBeInTheDocument();
    expect(mockedApi.getDocument).toHaveBeenCalledWith(ROW.id);
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
    mockedApi.listDocuments.mockRejectedValue(new Error('boom'));
    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('Eroare la încărcarea documentelor')).toBeInTheDocument(),
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
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
    await user.selectOptions(dialog.getByLabelText('Proiect'), PROJECT.id);
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
    await user.selectOptions(dialog.getByLabelText('Proiect'), PROJECT.id);
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
    expect(dialog.getByLabelText('Proiect')).toBeInTheDocument();
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
    await user.selectOptions(dialog.getByLabelText('Proiect'), PROJECT.id);
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
    await user.selectOptions(dialog.getByLabelText('Proiect'), PROJECT.id);
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
    await user.selectOptions(dialog.getByLabelText('Proiect'), PROJECT.id);
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

  it('renders the workspace actions and categories in English', async () => {
    const user = userEvent.setup();
    mockedApi.getDocument.mockResolvedValue({ data: { ...ROW, versions: [] } });
    renderWorkspace('en');
    await screen.findByText('Contract de execuție');

    expect(screen.getByLabelText('Search documents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
    expect(within(screen.getByTestId('documents-categories')).getByRole('button', { name: /Invoice/ })).toBeInTheDocument();

    await user.click(screen.getByText('Contract de execuție'));
    await user.click(within(screen.getByTestId('documents-inspector')).getByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Document details' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

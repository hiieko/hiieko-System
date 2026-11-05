import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext } from '@solar/shared';
import type { DocumentFolder } from '../../../lib/api-client';
import { DocumentFolderExplorer, type FolderManagementRequest, type FolderSelection } from './DocumentFolderExplorer';

const companyFolder: DocumentFolder = {
  id: 'company-legal', name: 'Legal', parent_id: null, organization_id: 'org-1', project_id: null,
  created_by: 'user-1', template_folder_key: null, source_template_version_id: null,
  protection_policy: 'STANDARD', allow_custom_children: true,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};
const nestedFolder: DocumentFolder = { ...companyFolder, id: 'company-contracts', name: 'Contracts', parent_id: companyFolder.id };
const projectFolder: DocumentFolder = { ...companyFolder, id: 'project-drawings', name: 'Drawings', project_id: 'project-1' };
const templateFolder: DocumentFolder = {
  ...companyFolder, id: 'template-folder', name: 'Template', template_folder_key: 'template/legal',
};

function renderExplorer(overrides: Partial<React.ComponentProps<typeof DocumentFolderExplorer>> = {}) {
  const onSelect = jest.fn<void, [FolderSelection]>();
  const onFolderAction = jest.fn<void, [FolderManagementRequest]>();
  const onLoadProjectFolders = jest.fn();
  const props: React.ComponentProps<typeof DocumentFolderExplorer> = {
    projects: [{ id: 'project-1', name: 'Solar park', code: 'SP' }],
    projectsLoading: false,
    projectsError: null,
    companyFolders: { folders: [companyFolder, nestedFolder, templateFolder], canManage: true },
    companyFoldersLoading: false,
    companyFoldersError: null,
    projectFolders: { 'project-1': { folders: [projectFolder], canManage: true } },
    projectFoldersLoading: {},
    projectFoldersErrors: {},
    selection: { scope: 'company' },
    onLoadProjectFolders,
    onSelect,
    onFolderAction,
    onRetryCompanyFolders: jest.fn(),
    onRetryProjects: jest.fn(),
    ...overrides,
  };
  const result = render(
    <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
      <DocumentFolderExplorer {...props} />
    </LocaleContext.Provider>,
  );
  return { ...result, onSelect, onFolderAction, onLoadProjectFolders };
}

describe('DocumentFolderExplorer', () => {
  it('expands nested folders and selects a folder in its company scope', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderExplorer();

    const companyRegion = screen.getByRole('region', { name: 'Company Documents' });
    const companyRow = within(companyRegion).getByRole('button', { name: 'Legal' }).parentElement as HTMLElement;
    await user.click(within(companyRow).getByRole('button', { name: 'Expand folder' }));
    await user.click(screen.getByRole('button', { name: 'Contracts' }));

    expect(onSelect).toHaveBeenCalledWith({ scope: 'company', folderId: nestedFolder.id });
  });

  it('keeps company folders separate while lazy-loading a project tree', async () => {
    const user = userEvent.setup();
    const { onSelect, onLoadProjectFolders } = renderExplorer({
      projectFolders: {},
      selection: { scope: 'company' },
    });

    await user.click(screen.getByRole('button', { name: /SP — Solar park/ }));
    const projectsRegion = screen.getByRole('region', { name: 'Project Documents' });
    await user.click(within(projectsRegion).getByRole('button', { name: 'Expand folder' }));

    expect(onLoadProjectFolders).toHaveBeenCalledWith('project-1');
    expect(onSelect).toHaveBeenCalledWith({ scope: 'project', projectId: 'project-1' });
    expect(within(projectsRegion).queryByRole('button', { name: 'Legal' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Legal' })).toBeInTheDocument();
  });

  it('selects project Unfiled without selecting company Unfiled', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderExplorer({ selection: { scope: 'project', projectId: 'project-1' } });
    const projectsRegion = screen.getByRole('region', { name: 'Project Documents' });

    await user.click(within(projectsRegion).getByRole('button', { name: 'Expand folder' }));
    await user.click(within(projectsRegion).getByRole('button', { name: 'Unfiled' }));

    expect(onSelect).toHaveBeenCalledWith({ scope: 'project', projectId: 'project-1', unfiled: true });
  });

  it('hides management actions for protected template-derived folders', async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole('button', { name: 'Legal' }));
    const templateButton = screen.getByRole('button', { name: /^Template/ });
    const templateItem = templateButton.closest('li') as HTMLElement;
    expect(within(templateItem).queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Template/ })).toBeInTheDocument();
  });
});

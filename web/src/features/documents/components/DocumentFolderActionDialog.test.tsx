import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext } from '@solar/shared';
import type { DocumentFolder } from '../../../lib/api-client';
import { DocumentFolderActionDialog, type DocumentFolderActionRequest } from './DocumentFolderActionDialog';

const folder = (id: string, name: string, parent_id: string | null = null): DocumentFolder => ({
  id, name, parent_id, organization_id: 'org-1', project_id: null, created_by: 'user-1',
  template_folder_key: null, source_template_version_id: null, protection_policy: 'STANDARD',
  allow_custom_children: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
});

describe('DocumentFolderActionDialog', () => {
  it('offers explicit folder move destinations but excludes the folder and its descendants', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const request: DocumentFolderActionRequest = { kind: 'move', scope: {}, folder: folder('a', 'Alpha') };
    render(
      <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
        <DocumentFolderActionDialog
          request={request}
          folders={[folder('a', 'Alpha'), folder('b', 'Beta', 'a'), folder('c', 'Gamma')]}
          saving={false}
          error={null}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </LocaleContext.Provider>,
    );

    const destination = screen.getByLabelText('Parent folder') as HTMLSelectElement;
    expect(within(destination).queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(within(destination).queryByRole('option', { name: 'Alpha / Beta' })).not.toBeInTheDocument();
    await user.selectOptions(destination, 'c');
    await user.click(screen.getByRole('button', { name: 'Move folder' }));

    expect(onSubmit).toHaveBeenCalledWith(request, { parentId: 'c' });
  });

  it('keeps a permission or conflict error visible without closing the dialog', () => {
    render(
      <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
        <DocumentFolderActionDialog
          request={{ kind: 'create', scope: {} }}
          folders={[]}
          saving={false}
          error="The folder cannot be changed in its current state."
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />
      </LocaleContext.Provider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The folder cannot be changed in its current state.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

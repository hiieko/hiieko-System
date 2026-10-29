import React from 'react';
import { render, screen } from '@testing-library/react';
import { LocaleContext } from '@solar/shared';

import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';

const localeValue = { locale: 'ro' as const, setLocale: jest.fn() };

it('portals the modal outside transformed task layouts', () => {
  const { container } = render(
    <LocaleContext.Provider value={localeValue}>
      <div>
        <Modal open onClose={jest.fn()} title="Test modal">
          <p>Modal body</p>
        </Modal>
      </div>
    </LocaleContext.Provider>,
  );

  const dialog = screen.getByRole('dialog', { name: 'Test modal' });
  expect(container).not.toContainElement(dialog);
  expect(dialog.parentElement?.parentElement).toBe(document.body);
});

it('portals confirmation dialogs outside transformed task layouts', () => {
  const { container } = render(
    <ConfirmDialog
      open
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      title="Confirm test"
      message="Message"
    />,
  );

  const dialog = screen.getByRole('alertdialog', { name: 'Confirm test' });
  expect(container).not.toContainElement(dialog);
  expect(dialog.parentElement?.parentElement).toBe(document.body);
});

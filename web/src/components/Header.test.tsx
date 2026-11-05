import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

const mockSetProjectId = jest.fn();
const mockSetLocale = jest.fn();
const mockSignOut = jest.fn();
const mockOpenPhotoUpload = jest.fn();

jest.mock('next/link', () => {
  const ReactModule = jest.requireActual('react');
  return ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    ReactModule.createElement('a', { href, ...props }, children);
});
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('@solar/shared', () => ({
  getRoleLabel: (role: string) => role,
  t: (key: string) => key,
  useLocale: () => ({ locale: 'en', setLocale: mockSetLocale }),
}));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'HIIEKO User', role: 'pm' }, loading: false, signOut: mockSignOut }),
}));
jest.mock('../contexts/ProjectContext', () => ({
  useProject: () => ({
    projects: [{ id: 'project-1', name: 'Valea Mare', code: 'VM' }],
    selectedProjectId: '',
    setSelectedProjectId: mockSetProjectId,
    selectedProject: null,
    loading: false,
  }),
}));
jest.mock('../contexts/PhotoUploadModalContext', () => ({
  usePhotoUploadModal: () => ({ openPhotoUpload: mockOpenPhotoUpload }),
}));
jest.mock('./GlobalQuickSearch', () => ({
  GlobalQuickSearch: () => <button type="button" aria-label="Global search" />,
}));
jest.mock('../lib/api-client', () => ({ apiClient: { getTasks: jest.fn(), getIssues: jest.fn() } }));

describe('global application header', () => {
  beforeEach(() => {
    mockSetProjectId.mockClear();
    mockSetLocale.mockClear();
    mockSignOut.mockClear();
    mockOpenPhotoUpload.mockClear();
  });

  it('provides the brand, sidebar control, search, project, locale, notification, and account actions', async () => {
    const user = userEvent.setup();
    const onMenuClick = jest.fn();
    const onToggleSidebar = jest.fn();
    render(<Header onMenuClick={onMenuClick} onToggleSidebar={onToggleSidebar} />);

    expect(screen.getByText('HIIEKO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sidebar.collapse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'header.menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Global search' })).toBeInTheDocument();
    const projectSelectors = screen.getAllByLabelText('header.select_project');
    expect(projectSelectors).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'language' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.notificari' })).toHaveAttribute('href', '/notificari');

    await user.click(screen.getByRole('button', { name: 'sidebar.collapse' }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'header.menu' }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
    await user.selectOptions(projectSelectors[0], 'project-1');
    expect(mockSetProjectId).toHaveBeenCalledWith('project-1');
  });
});

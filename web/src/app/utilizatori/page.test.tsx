import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LocaleContext } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api-client';
import UtilizatoriPage from './page';

const mockApi = apiClient as any;

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('../../lib/auth-guard', () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../components/PageTutorial', () => ({ PageTutorial: () => null }));
jest.mock('../../lib/api-client', () => ({
  apiClient: {
    getUsers: jest.fn(),
    get: jest.fn(),
    updateUserRole: jest.fn(),
    setRolePermissions: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    statusCode = 500;
  },
}));

const mockedUseAuth = useAuth as unknown as jest.Mock;

const roles = [
  { id: 'role-worker', code: 'WORKER', permissions: [] },
  { id: 'role-admin', code: 'ADMIN', permissions: [] },
  { id: 'role-owner', code: 'OWNER', permissions: [] },
];
const permissions = [
  { id: 'perm-read', module: 'projects', action: 'read', description: 'Read assigned projects' },
];
const employee = {
  id: 'employee-1',
  email: 'employee@hiieko.ro',
  role: 'WORKER',
  status: 'ACTIVE',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  last_login_at: null,
  profile: { full_name: 'Employee One' },
  project_members: [],
};

function renderPage(role: 'ADMIN' | 'OWNER') {
  mockedUseAuth.mockReturnValue({
    user: { id: `${role.toLowerCase()}-1`, email: `${role.toLowerCase()}@hiieko.ro`, role },
    loading: false,
    signOut: jest.fn(),
    refreshUser: jest.fn(),
  });
  return render(
    <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
      <UtilizatoriPage />
    </LocaleContext.Provider>,
  );
}

describe('User administration screen privilege boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.getUsers.mockResolvedValue({ data: [employee] });
    mockApi.setRolePermissions.mockResolvedValue({ data: {} });
    mockApi.get.mockImplementation((path: string) =>
      Promise.resolve({ data: path === '/api/permissions' ? permissions : roles }),
    );
  });

  it('does not offer OWNER assignment or permission-grant editing to an ordinary ADMIN', async () => {
    renderPage('ADMIN');

    await screen.findAllByText('employee@hiieko.ro');
    const roleSelects = screen.getAllByLabelText('Change role') as HTMLSelectElement[];
    expect(roleSelects).toHaveLength(2);
    roleSelects.forEach((roleSelect) => {
      expect(within(roleSelect).queryByRole('option', { name: 'Owner' })).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Edit explicit grants' })).toBeNull();
  });

  it('lets only OWNER edit explicit grants already represented by RolePermission', async () => {
    renderPage('OWNER');

    await screen.findAllByText('employee@hiieko.ro');
    fireEvent.click(screen.getByRole('button', { name: /Roles & permissions/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit explicit grants' }));
    const readPermission = await screen.findByLabelText(/projects:read/);
    fireEvent.click(readPermission);
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(mockApi.setRolePermissions).toHaveBeenCalledWith('WORKER', ['perm-read']));
  });
});

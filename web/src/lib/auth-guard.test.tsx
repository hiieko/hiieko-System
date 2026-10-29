import React from 'react';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import { RoleGuard } from './auth-guard';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

const mockedUseAuth = useAuth as unknown as jest.Mock;

function renderGuard(allowedRoles: string[] | null) {
  return render(
    <ToastProvider>
      <RoleGuard allowedRoles={allowedRoles}>
        <div>contenut protejat</div>
      </RoleGuard>
    </ToastProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    user: { id: 'user-1', role: 'viewer' },
    loading: false,
    signOut: jest.fn(),
    refreshUser: jest.fn(),
  });
});

describe('RoleGuard', () => {
  it('renders the children for every authenticated role when allowedRoles is null', () => {
    renderGuard(null);

    expect(screen.getByText('contenut protejat')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects when the role is not in the allowed list', () => {
    renderGuard(['admin']);

    expect(screen.queryByText('contenut protejat')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('lets an administrator through a restricted list', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'admin' },
      loading: false,
      signOut: jest.fn(),
      refreshUser: jest.fn(),
    });

    renderGuard(['viewer']);

    expect(screen.getByText('contenut protejat')).toBeInTheDocument();
  });
});

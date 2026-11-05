import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('next/link', () => {
  const ReactModule = jest.requireActual('react');
  return ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    ReactModule.createElement('a', { href, ...props }, children);
});
const mockSignOut = jest.fn();
const mockSetLocale = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'A. Manager', role: 'admin' }, signOut: mockSignOut }),
}));
jest.mock('@solar/shared', () => ({
  getRoleLabel: () => 'Administrator',
  t: (key: string) => key,
  useLocale: () => ({ locale: 'en', setLocale: mockSetLocale }),
}));

describe('Sidebar grouped navigation', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockSetLocale.mockClear();
  });

  it('renders expanded labels and a compact icon rail with tooltips', () => {
    const { rerender } = render(<Sidebar collapsed={false} />);
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();

    rerender(<Sidebar collapsed />);
    const compactDashboardLink = screen.getByRole('link', { name: 'nav.dashboard' });
    expect(compactDashboardLink).toHaveAttribute('title', 'nav.dashboard');
    expect(compactDashboardLink.querySelector('.sr-only')).toHaveTextContent('nav.dashboard');
  });

  it('expands and collapses an expandable navigation group', () => {
    render(<Sidebar collapsed={false} />);

    const groupHeader = screen.getByRole('button', { name: 'nav.group_workspace' });
    expect(groupHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toBeInTheDocument();

    fireEvent.click(groupHeader);
    expect(groupHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'nav.dashboard' })).not.toBeInTheDocument();

    fireEvent.click(groupHeader);
    expect(groupHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toBeInTheDocument();
  });

  it('changes the application locale from the sidebar language selector', () => {
    render(<Sidebar collapsed={false} />);

    const trigger = screen.getByTestId('sidebar-language-trigger');
    expect(trigger).toHaveTextContent('English');
    expect(trigger).toHaveTextContent('EN');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /Română/ }));

    expect(mockSetLocale).toHaveBeenCalledWith('ro');
  });

  it('calls the shared sign-out handler from the sidebar logout row', () => {
    render(<Sidebar collapsed={false} />);

    fireEvent.click(screen.getByTestId('sidebar-logout'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows centered language and logout icons with tooltips when collapsed', () => {
    render(<Sidebar collapsed />);

    const languageButton = screen.getByTestId('sidebar-language-compact');
    expect(languageButton).toHaveAttribute('title', 'language: EN → RO');
    fireEvent.click(languageButton);
    expect(mockSetLocale).toHaveBeenCalledWith('ro');

    const logoutButton = screen.getByTestId('sidebar-logout');
    expect(logoutButton).toHaveAttribute('title', 'header.logout');
    fireEvent.click(logoutButton);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('places language, logout and profile controls in the mobile footer', () => {
    render(<Sidebar mobileOpen onMobileClose={jest.fn()} collapsed />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('sidebar-language-trigger')).toBeInTheDocument();
    expect(within(dialog).getByTestId('sidebar-logout')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'nav.profil' })).toBeInTheDocument();
  });

  it('keeps mobile navigation expanded and closes the drawer after navigation', () => {
    const onMobileClose = jest.fn();
    render(<Sidebar mobileOpen onMobileClose={onMobileClose} collapsed />);

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'nav.dashboard' }));
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });
});

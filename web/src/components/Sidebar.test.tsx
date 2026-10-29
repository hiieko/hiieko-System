import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('next/link', () => {
  const ReactModule = jest.requireActual('react');
  return ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    ReactModule.createElement('a', { href, ...props }, children);
});
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'A. Manager', role: 'admin' }, signOut: jest.fn() }),
}));
jest.mock('@solar/shared', () => ({
  getRoleLabel: () => 'Administrator',
  t: (key: string) => key,
  useLocale: () => ({ locale: 'en' }),
}));

describe('Sidebar compact navigation', () => {
  it('switches between expanded labels and a compact icon rail with tooltips', () => {
    const onToggleCollapsed = jest.fn();
    const { rerender } = render(
      <Sidebar collapsed={false} onToggleCollapsed={onToggleCollapsed} />,
    );

    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    const collapseButton = screen.getByRole('button', { name: 'sidebar.collapse' });
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapseButton);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);

    rerender(<Sidebar collapsed onToggleCollapsed={onToggleCollapsed} />);
    const compactDashboardLink = screen.getByRole('link', { name: 'nav.dashboard' });
    expect(compactDashboardLink).toHaveAttribute('title', 'nav.dashboard');
    expect(compactDashboardLink.querySelector('.sr-only')).toHaveTextContent('nav.dashboard');
    expect(screen.getByRole('button', { name: 'sidebar.expand' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps mobile navigation expanded and closes the drawer after navigation', () => {
    const onMobileClose = jest.fn();
    render(<Sidebar mobileOpen onMobileClose={onMobileClose} collapsed />);

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'nav.dashboard' }));
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

const mockUseAuth = jest.fn();

jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../components/ControlTowerSurface', () => ({
  ControlTowerSurface: () => <div>Control tower view</div>,
}));
jest.mock('../components/WorkerDashboard', () => ({
  WorkerDashboard: () => <div>Field operations view</div>,
}));
jest.mock('../components/WorkerMyDay', () => ({
  WorkerMyDay: () => <div>Personal day view</div>,
}));

describe('role-based dashboard home', () => {
  it.each([
    ['admin', 'Control tower view'],
    ['site_manager', 'Control tower view'],
    ['team_leader', 'Field operations view'],
    ['foreman', 'Field operations view'],
    ['worker', 'Personal day view'],
  ])('shows the existing authorized home surface for %s', (role, expected) => {
    mockUseAuth.mockReturnValue({ user: { role } });
    render(<DashboardPage />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

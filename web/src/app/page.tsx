'use client';

/**
 * This route is the role router. Managers see Control Tower. Workers see their
 * dashboard. There is no second Control Tower surface here — the manager branch
 * renders the shared `ControlTowerSurface`, the same component `/control-tower`
 * uses (the canonical, manager-direct entry that redirects disallowed roles back
 * to `/`). Every role keeps a home at `/`.
 */

import React from 'react';

import { ControlTowerSurface } from '../components/ControlTowerSurface';
import { WorkerDashboard } from '../components/WorkerDashboard';
import { WorkerMyDay } from '../components/WorkerMyDay';
import { useAuth } from '../contexts/AuthContext';

export default function ControlTowerDashboardPage() {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();

  if (userRole === 'worker') {
    return <WorkerMyDay />;
  }

  // Preserve the existing landing destination for the other field roles.
  // `site_manager` is a manager and lands on the Control Tower below (Test 11).
  const keepsWorkerDashboard =
    userRole === 'team_leader' ||
    userRole === 'technician' ||
    userRole === 'foreman';
  if (keepsWorkerDashboard) {
    return <WorkerDashboard />;
  }

  return <ControlTowerSurface />;
}

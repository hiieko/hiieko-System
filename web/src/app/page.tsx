'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WorkerDashboard } from '../components/WorkerDashboard';
import { WorkerMyDay } from '../components/WorkerMyDay';
import { V0OperationsHome } from '../components/V0OperationsHome';

export default function HomePage() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();

  if (role === 'worker') {
    return <WorkerMyDay />;
  }

  if (role === 'team_leader' || role === 'technician' || role === 'foreman' || role === 'site_manager') {
    return <WorkerDashboard />;
  }

  return <V0OperationsHome />;
}

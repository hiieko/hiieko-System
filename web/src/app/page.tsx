'use client';

/**
 * Role router for `/` (UX-R1A C2).
 *
 * `/` must stay hooks-safe: the previous version returned early for the worker
 * and field roles *before* calling `useState` / `useEffect` / `useCallback` /
 * `useLocale` / `useProject`, which broke hook order whenever the resolved role
 * changed after the first render. Those hooks now live in the extracted
 * `ControlTowerSurface`, and this page only branches in JSX after all of its own
 * hooks have run.
 *
 * Role-home intent is preserved exactly:
 *   worker                                        → `WorkerMyDay`
 *   technician / team_leader / foreman / site_manager → `WorkerDashboard`
 *   every other role                              → `ControlTowerSurface`
 *
 * The Control Tower branch is guarded with the canonical
 * `ROUTE_ROLES['/control-tower']` list, so the surface `/` renders for a role and
 * the canonical `/control-tower` route grant exactly the same access.
 */
import { Loader2 } from 'lucide-react';
import { WorkerDashboard } from '../components/WorkerDashboard';
import { WorkerMyDay } from '../components/WorkerMyDay';
import { ControlTowerSurface } from '../components/ControlTowerSurface';
import { FIELD_HOME_ROLES, ROUTE_ROLES, WORKER_HOME_ROLES } from '../config/route-roles';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from '../lib/auth-guard';

export default function RoleHomePage() {
  const { user, loading } = useAuth();
  const userRole = user?.role?.toLowerCase();

  // All hooks are above this point: the branches below are plain rendering
  // decisions and cannot change the hook order.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-hii-500" aria-hidden="true" />
        <span className="sr-only">Se încarcă...</span>
      </div>
    );
  }

  if (userRole && WORKER_HOME_ROLES.includes(userRole)) return <WorkerMyDay />;
  if (userRole && FIELD_HOME_ROLES.includes(userRole)) return <WorkerDashboard />;

  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/control-tower']}>
      <ControlTowerSurface />
    </RoleGuard>
  );
}
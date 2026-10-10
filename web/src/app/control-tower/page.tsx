'use client';

/**
 * Canonical Control Tower route (UX-R1A C2).
 *
 * Renders the extracted `ControlTowerSurface` directly. Roles outside
 * `ROUTE_ROLES['/control-tower']` are redirected to `/`, which routes them to
 * their own home surface (worker day / field dashboard) instead of leaving them
 * on a dead end. This route never renders `WorkerMyDay` or `WorkerDashboard`.
 *
 * Hooks note: every hook runs before the first conditional return, so the hook
 * order stays stable even though the resolved role can change after the first
 * paint.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '../../components/ui';
import { ControlTowerSurface } from '../../components/ControlTowerSurface';
import { ROUTE_ROLES } from '../../config/route-roles';
import { useAuth } from '../../contexts/AuthContext';

export default function ControlTowerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const userRole = user?.role?.toLowerCase();
  const isAllowed = !!userRole && ROUTE_ROLES['/control-tower'].includes(userRole);

  useEffect(() => {
    if (!loading && !isAllowed) router.replace('/');
  }, [loading, isAllowed, router]);

  if (loading || !isAllowed) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={96} />
          ))}
        </div>
        <Skeleton variant="rectangular" height={320} />
      </div>
    );
  }

  return <ControlTowerSurface />;
}

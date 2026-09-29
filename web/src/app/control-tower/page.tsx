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
import { Loader2 } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-hii-500" aria-hidden="true" />
        <span className="sr-only">Se încarcă...</span>
      </div>
    );
  }

  return <ControlTowerSurface />;
}

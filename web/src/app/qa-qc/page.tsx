'use client';

import { AuthGuard, RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { QualityWorkspace } from '../../features/quality/QualityWorkspace';

export default function QualityPage() {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={ROUTE_ROLES['/qa-qc']}>
        <QualityWorkspace />
      </RoleGuard>
    </AuthGuard>
  );
}

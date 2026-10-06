'use client';

import { AuthGuard, RoleGuard } from '../../lib/auth-guard';
import { CustomersWorkspace } from '../../features/customers/CustomersWorkspace';

export default function CustomersPage() {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader']}>
        <CustomersWorkspace />
      </RoleGuard>
    </AuthGuard>
  );
}

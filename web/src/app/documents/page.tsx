'use client';

import { AuthGuard, RoleGuard } from '../../lib/auth-guard';
import { DocumentsWorkspace } from '../../features/documents/DocumentsWorkspace';

export default function DocumentsPage() {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader']}>
        <DocumentsWorkspace />
      </RoleGuard>
    </AuthGuard>
  );
}

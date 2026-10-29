'use client';

import React from 'react';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { DocumentsWorkspace } from '../../features/documents/components/DocumentsWorkspace';

function DocumentsPageInner() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <DocumentsWorkspace />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/documente']}>
      <DocumentsPageInner />
    </RoleGuard>
  );
}

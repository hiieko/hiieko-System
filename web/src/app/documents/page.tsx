'use client';

import { AuthGuard } from '../../lib/auth-guard';
import { DocumentsWorkspace } from '../../features/documents/DocumentsWorkspace';

export default function DocumentsPage() {
  return <AuthGuard><DocumentsWorkspace /></AuthGuard>;
}

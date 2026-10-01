'use client';

import { AuthGuard } from '../../lib/auth-guard';
import { CustomersWorkspace } from '../../features/customers/CustomersWorkspace';

export default function CustomersPage() {
  return <AuthGuard><CustomersWorkspace /></AuthGuard>;
}

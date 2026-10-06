'use client';

import { AuthGuard } from '../../lib/auth-guard';
import { QualityWorkspace } from '../../features/quality/QualityWorkspace';

export default function QualityPage() {
  return <AuthGuard><QualityWorkspace /></AuthGuard>;
}

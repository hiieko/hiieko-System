import type { Metadata } from 'next';
import { ArchitectureAuditWorkspace } from '../../../components/ArchitectureAuditWorkspace';

export const metadata: Metadata = {
  title: 'HIIEKO — Frontend Architecture Audit',
  description:
    'Read-only, source-grounded map of HIIEKO frontend routes, components, overlays, roles, state and implementation readiness.',
};

export default function FrontendArchitecturePage() {
  return <ArchitectureAuditWorkspace />;
}

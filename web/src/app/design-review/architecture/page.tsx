import type { Metadata } from 'next';
import { ArchitectureAuditWorkspace } from '../../../components/ArchitectureAuditWorkspace';

export const metadata: Metadata = {
  title: 'HIIEKO — Frontend Architecture Audit',
  description:
    'Read-only, source-grounded map of HIIEKO frontend routes, components, overlays, roles, state and implementation readiness.',
};

export default async function FrontendArchitecturePage({
  searchParams,
}: {
  searchParams: Promise<{ download?: string }>;
}) {
  const { download } = await searchParams;
  return <ArchitectureAuditWorkspace autoDownload={download === '1'} />;
}

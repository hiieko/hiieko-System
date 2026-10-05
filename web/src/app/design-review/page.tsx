import type { Metadata } from 'next';
import { DesignReviewWorkspace } from '../../components/DesignReviewWorkspace';

export const metadata: Metadata = {
  title: 'HIIEKO — Frontend Design Review',
  description:
    'Frontend-only HIIEKO prototype walkthrough with local mock data. No authentication or production data.',
};

export default function DesignReviewPage() {
  return <DesignReviewWorkspace />;
}

import type { Metadata, Viewport } from 'next';
import { GlobalExperienceWorkspace } from '../../../components/GlobalExperienceWorkspace';

export const metadata: Metadata = {
  title: 'HIIEKO — Global Experience Design Review',
  description:
    'Frontend-only prototype for HIIEKO global navigation, profile, language, theme, help, notifications, support, authentication and user administration.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f6f4' },
    { media: '(prefers-color-scheme: dark)', color: '#101713' },
  ],
};

export default function GlobalExperiencePage() {
  return <GlobalExperienceWorkspace />;
}

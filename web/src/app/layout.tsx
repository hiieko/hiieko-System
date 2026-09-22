import './globals.css';
import type { Metadata } from 'next';
import { LocaleProviderClient } from '../components/LocaleProviderClient';
import { AuthProvider } from '../contexts/AuthContext';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Solar Site Management — Panou Manager',
  description: 'Sistem integrat de pontaj, rapoarte zilnice, avize și gestiune stocuri parcuri solare',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="flex h-screen overflow-hidden bg-slate-50 antialiased font-sans">
        <LocaleProviderClient>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </LocaleProviderClient>
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import { LocaleProviderClient } from '../components/LocaleProviderClient';
import { AuthProvider } from '../contexts/AuthContext';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'HIIEKO — Sistem Opera\u021bional EPC',
  description: 'Sistem integrat de gestiune opera\u021bional\u0103 pentru proiecte solare EPC — pontaj, rapoarte, avize, stocuri, cheltuieli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className="h-full">
      <body className="h-full bg-slate-50 antialiased">
        <LocaleProviderClient>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </LocaleProviderClient>
      </body>
    </html>
  );
}

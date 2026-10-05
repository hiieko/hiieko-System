import './globals.css';
import type { Metadata } from 'next';
import { LocaleProviderClient } from '../components/LocaleProviderClient';
import { AuthProvider } from '../contexts/AuthContext';
import { AppShell } from '../components/AppShell';
import { ThemeProvider } from '../contexts/ThemeContext';
import Script from 'next/script';

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
    <html lang="ro" className="h-full" suppressHydrationWarning>
      <head>
        <Script id="hiieko-theme-init" strategy="beforeInteractive">
          {`(()=>{try{const s=localStorage.getItem('hiieko-theme-preference');let t='light';if(s==='light'||s==='dark')t=s;else if(matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch{document.documentElement.dataset.theme='light'}})()`}
        </Script>
      </head>
      <body className="h-full hii-shell-canvas antialiased">
        <ThemeProvider>
          <LocaleProviderClient>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </LocaleProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}

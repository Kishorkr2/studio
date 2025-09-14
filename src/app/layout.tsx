
import type {Metadata} from 'next';
import './globals.css';
import {Inter} from 'next/font/google';
import {AppLayout, type AppLayoutProps} from '@/components/app-layout';
import {ThemeProvider} from '@/components/theme-provider';
import {Toaster} from '@/components/ui/toaster';
import {AuthProvider} from '@/components/auth-provider';
import {PWAInstall} from '@/components/pwa-install';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'TyreTrack Pro',
  description: 'Manage tyre production with precision and efficiency.',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TyreTrack Pro',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-body antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
          <Toaster />
          <PWAInstall />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

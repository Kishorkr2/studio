
import type {Metadata, Viewport} from 'next';
import './globals.css';
import {Inter} from 'next/font/google';
import {AppLayout, type AppLayoutProps} from '@/components/app-layout';
import {ThemeProvider} from '@/components/theme-provider';
import {Toaster} from '@/components/ui/toaster';
import {AuthProvider} from '@/components/auth-provider';
import {PWAInstall} from '@/components/pwa-install';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'RTPMS - Real Time Prod Management System',
  description: 'Manage production with precision and efficiency.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RTPMS',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
          <Toaster />
          <PWAInstall />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}

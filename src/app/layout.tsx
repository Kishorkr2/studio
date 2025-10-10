import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { AppLayout } from '@/components/app-layout';

// ✅ Font setup
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// ✅ App metadata
export const metadata: Metadata = {
  title: 'RTPMS - Real Time Production Management System',
  description: 'Manage production with precision and efficiency.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RTPMS',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
};

// ✅ Viewport setup
export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// ✅ Main Layout Component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-body antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, DM_Sans } from 'next/font/google';
import { AuthProvider } from '@/providers/AuthProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ServiceWorkerProvider } from '@/providers/ServiceWorkerProvider';
import { OfflineProvider } from '@/providers/OfflineProvider';
import { OrientationLock } from '@/components/layout/OrientationLock';
import './globals.css';

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Intuitive Mobility',
  description: 'Build and execute personal workout routines',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Intuitive Mobility',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0D0B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${dmSans.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <OrientationLock />
        <div className="landscape-blocker" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
          <p className="text-lg font-medium">Please rotate your device</p>
          <p className="text-fg-muted text-sm">This app works best in portrait mode</p>
        </div>
        <AuthProvider>
          <OfflineProvider>
            <div className="main-content">
              {children}
            </div>
          </OfflineProvider>
          <ToastProvider />
          <ServiceWorkerProvider />
        </AuthProvider>
      </body>
    </html>
  );
}

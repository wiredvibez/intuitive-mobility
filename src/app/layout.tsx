import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, DM_Sans } from 'next/font/google';
import { AuthProvider } from '@/providers/AuthProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ServiceWorkerProvider } from '@/providers/ServiceWorkerProvider';
import { OfflineProvider } from '@/providers/OfflineProvider';
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
        <AuthProvider>
          <OfflineProvider>
            {children}
          </OfflineProvider>
          <ToastProvider />
          <ServiceWorkerProvider />
        </AuthProvider>
      </body>
    </html>
  );
}

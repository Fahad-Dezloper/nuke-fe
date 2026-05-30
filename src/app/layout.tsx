import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { AppShell } from '@/components/layout/app-shell';
import { TurnkeyProvider } from '@/lib/turnkey';
import { AuthProvider } from '@/lib/auth';
import { LoadingOverlay } from '@/components/layout/loading-overlay';
import { QueryProvider } from '@/components/providers/query-provider';
import { MarketFeedProvider } from '@/components/providers/market-feed-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { GA_MEASUREMENT_ID } from '@/lib/analytics';
import { Analytics } from '@vercel/analytics/next';
import { PWAProvider } from '@/components/pwa/pwa-provider';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  display: 'swap',
});

const APP_NAME = 'Nuke';
const APP_TITLE = 'Nuke | Perpetual Arbitrage Terminal';
const APP_DESCRIPTION = 'Solana native delta-neutral funding arbitrage terminal';

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#020202',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
        <ErrorBoundary>
          <QueryProvider>
            <TurnkeyProvider>
              <AuthProvider>
                <MarketFeedProvider>
                  <LoadingOverlay />
                  <PWAProvider>
                    <AppShell navbar={<Navbar />}>{children}</AppShell>
                  </PWAProvider>
                  <Toaster position="bottom-right" theme="dark" richColors closeButton />
                </MarketFeedProvider>
              </AuthProvider>
            </TurnkeyProvider>
          </QueryProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}

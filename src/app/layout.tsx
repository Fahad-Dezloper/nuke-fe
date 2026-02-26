import type { Metadata } from 'next';
import { Roboto_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { TurnkeyProvider } from '@/lib/turnkey';
import { AuthProvider } from '@/lib/auth';
import { LoadingOverlay } from '@/components/layout/loading-overlay';
import { QueryProvider } from '@/components/providers/query-provider';
import { MarketFeedProvider } from '@/components/providers/market-feed-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { GA_MEASUREMENT_ID } from '@/lib/analytics';
import { Analytics } from '@vercel/analytics/next';

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nuke | Perpetual Arbitrage Terminal',
  description: 'Chain agnostic delta-neutral funding arbitrage terminal',
  icons: {
    icon: [
      {
        url: '/icon.jpg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon.jpg',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/icon.jpg',
  },
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
      <body className={`${robotoMono.variable} antialiased overflow-hidden`}>
        <ErrorBoundary>
          <QueryProvider>
            <TurnkeyProvider>
              <AuthProvider>
                <MarketFeedProvider>
                  <LoadingOverlay />
                  <div className="flex h-screen flex-col">
                    <Navbar />
                    <main className="flex-1 overflow-hidden">{children}</main>
                  </div>
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

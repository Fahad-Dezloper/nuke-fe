import type { Metadata } from 'next';
import { Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { TurnkeyProvider } from '@/lib/turnkey';
import { LoadingOverlay } from '@/components/layout/loading-overlay';
import { MarketFeedProvider } from '@/components/providers/market-feed-provider';
// import { Footer } from '@/components/layout/footer';

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
      <body className={`${robotoMono.variable} antialiased overflow-hidden`}>
        <TurnkeyProvider>
          <MarketFeedProvider>
            <LoadingOverlay />
            <div className="flex h-screen flex-col">
              <Navbar />
              <main className="flex-1 overflow-hidden">{children}</main>
              {/* <Footer /> */}
            </div>
          </MarketFeedProvider>
        </TurnkeyProvider>
      </body>
    </html>
  );
}

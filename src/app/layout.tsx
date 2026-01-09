import type { Metadata } from 'next';
import { Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

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
    <html
      lang='en'
      className='dark'>
      <body className={`${robotoMono.variable} antialiased`}>
        <div className='flex min-h-screen flex-col'>
          <Header />
          <main className='flex-1'>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

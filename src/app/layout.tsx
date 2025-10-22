import type { Viewport } from 'next';
import Metadata from 'next/metadata'; // default import for Next 15+
import { Inter as FontSans, Playfair_Display as FontHeadline } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontHeadline = FontHeadline({
  subsets: ['latin'],
  variable: '--font-headline',
});

export const metadata: Metadata = {
  title: 'DKC Registrations',
  description: 'Tournament registrations for the Dallas Chess Club.',
  icons: {
    icon: '/new-knight-logo.svg',
    shortcut: '/new-knight-logo.svg',
    apple: '/new-knight-logo.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable,
          fontHeadline.variable
        )}
      >
        <Providers>
          <div vaul-drawer-wrapper="">{children}</div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

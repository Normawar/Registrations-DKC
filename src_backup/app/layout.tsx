
import type { Metadata, Viewport } from 'next';
import { Inter as FontSans } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'DKC Registrations',
  description: 'Tournament registrations for the Dallas Chess Club.',
  icons: {
    icon: '/knight-icon.svg',
    shortcut: '/knight-icon.svg',
    apple: '/knight-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn(
        'min-h-screen bg-background font-sans antialiased',
        fontSans.variable
      )}>
        <Providers>
          <div vaul-drawer-wrapper="">
            {children}
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

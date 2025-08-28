
import type { Metadata } from "next";
import { Playfair_Display, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-headline",
});

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "ChessMate",
  description: "Manage chess tournaments with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const profile = localStorage.getItem('current_user_profile');
                if (profile && JSON.parse(profile).email !== 'norma@dkchess.com') {
                  localStorage.removeItem('current_user_profile');
                }
              } catch (e) {
                console.error('Failed to clear profile', e);
              }
            `,
          }}
        />
      </head>
      <body className={`${playfair.variable} ${ptSans.variable} font-body antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

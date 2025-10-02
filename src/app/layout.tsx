
import type { Metadata } from "next";
import { Playfair_Display, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider"; // Import the new AuthProvider
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
        
      </head>
      <body className={`${playfair.variable} ${ptSans.variable} font-body antialiased`}>
        <div className="bg-background text-foreground">
          <AuthProvider> {/* Wrap the existing providers with the new AuthProvider */}
            <Providers>
              {children}
              <Toaster />
            </Providers>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}

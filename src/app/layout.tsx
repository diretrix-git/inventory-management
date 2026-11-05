import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

// Fontsource CSS retains the original families, weights and Unicode subsets.
// Assets are bundled by Next.js; neither build nor browser contacts Google.
const fontVariables = {
  "--font-sans": '"DM Sans Variable", Arial, sans-serif',
  "--font-mono": '"IBM Plex Mono", "Courier New", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Mini-Mart IMS",
  description: "Mini-Mart Inventory and Sales Management System",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

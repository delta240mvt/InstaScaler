import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({ src: "../public/fonts/inter.woff", variable: "--font-inter", weight: "100 900", display: "swap" });
const plex = localFont({ src: [
  { path: "../public/fonts/ibm-plex-mono-400.woff", weight: "400" },
  { path: "../public/fonts/ibm-plex-mono-500.woff", weight: "500" },
], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "InstaScaler",
  description: "Panel kampanii, wiadomości i automatyzacji Instagrama — InstaScaler by DELTA240MVT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`h-full ${inter.variable} ${plex.variable}`}>
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

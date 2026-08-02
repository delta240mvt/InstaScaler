import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenReply",
  description: "Private Instagram automation dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

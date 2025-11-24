import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./pdf-viewer.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pitch Deck Verification",
  description: "Upload and verify claims in PDF pitch decks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}


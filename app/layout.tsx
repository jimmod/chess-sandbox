import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Sandbox — Make your own rules",
  description: "Play chess against AI with a rulebook of your own. Explore custom chess variants and three difficulty levels.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/chess-sandbox-icon.png",
    shortcut: "/chess-sandbox-icon.png",
    apple: "/chess-sandbox-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

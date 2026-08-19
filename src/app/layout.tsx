import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { THEME_BOOT_SCRIPT } from "@/lib/hooks/use-theme";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  // Absolute URLs are required for social previews, and a static export has no
  // request to infer the origin from.
  metadataBase: new URL("https://martin-k-m.github.io/snare/"),
  title: "snare — a regular expression workbench",
  description: "Write a regular expression, watch it match, read it back in plain English, and check it for catastrophic backtracking before it ships.",
  applicationName: "snare",
  openGraph: {
    title: "snare",
    description: "Regular expressions: match, explain, and catch the backtracking traps.",
    url: "https://martin-k-m.github.io/snare/",
    siteName: "snare",
    images: [{ url: "https://raw.githubusercontent.com/martin-k-m/snare/main/docs/screenshot.png", width: 2760, height: 2080, alt: "snare in use" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "snare",
    description: "Regular expressions: match, explain, and catch the backtracking traps.",
    images: ["https://raw.githubusercontent.com/martin-k-m/snare/main/docs/screenshot.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161f" },
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}

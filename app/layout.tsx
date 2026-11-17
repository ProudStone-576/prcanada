import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "PRPath Canada", template: "%s | PRPath Canada" },
  description: "Understand your Canadian immigration options: a CRS calculator built on IRCC's official tables, a guided assessment and a personal dashboard.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&display=swap" />
      </head>
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <filter id="press">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n" />
            <feComponentTransfer in="n" result="mask"><feFuncA type="discrete" tableValues="0.55 0.85 1 1" /></feComponentTransfer>
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </svg>
        <TopBar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

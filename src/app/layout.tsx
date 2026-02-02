// src/app/layout.tsx
import "./globals.css";
import Script from "next/script";
import type { ReactNode } from "react";

// If your header/footer are in a different path, adjust these imports.
// From your screenshots it looks like you have: src/components/ui/SiteHeader.tsx (and maybe SiteFooter.tsx)
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";

export const metadata = {
  title: "Sculp3D",
  description: "Turn a portrait into a custom 3D-printed bust.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Viewport prevents weird scaling on mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* model-viewer custom element loader */}
        <Script
          type="module"
          src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
          strategy="afterInteractive"
        />

        {/* Top bar (logo/nav) */}
        <SiteHeader />

        {/* Page shell */}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Footer (optional, but recommended for consistent layout) */}
        <SiteFooter />
      </body>
    </html>
  );
}

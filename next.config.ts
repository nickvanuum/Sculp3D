// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next dev origin allowlist (ngrok/local dev)
  // Next 16.1.x expects this at top-level (NOT under experimental)
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.0.2.2:3000", // Android emulator
    "https://scotty-expurgatory-jaxen.ngrok-free.dev",
  ],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "ncybccgmvhxdwzwqhmda.supabase.co" },
    ],
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

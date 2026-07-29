import type { NextConfig } from "next";

// Single source of truth for the backend origin — set via NEXT_PUBLIC_API_URL
// (e.g. http://localhost:8000 for local dev). The frontend always calls the
// relative "/api/v1" path (see src/lib/api.ts); this rewrite proxies that
// path to the actual backend so there is only one place the backend
// host/port is configured, instead of a separately hardcoded value here.
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: BACKEND_ORIGIN,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Turbopack dev runtime requires 'unsafe-eval'; omit in production
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Allow profile avatars from Google OAuth, GitHub, and Supabase storage
      "img-src 'self' data: https://unpkg.com https://*.googleusercontent.com https://*.githubusercontent.com https://*.supabase.co",
      // Allow Supabase auth + realtime, Google OAuth endpoints
      // In dev, local Supabase runs on 127.0.0.1:54321
      isDev
        ? "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321 https://*.supabase.co wss://*.supabase.co https://accounts.google.com"
        : "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "unpkg.com",
        pathname: "/aws-icons@3.2.0/**",
      },
      {
        protocol: "https",
        hostname: "unpkg.com",
        pathname: "/gcp-icons@1.0.4/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LOCAL_DEMO === "true" ? ".next-demo" : ".next",
  turbopack: {},
  webpack(config) {
    if (process.env.LOCAL_DEMO === "true")
      config.watchOptions = {
        ...config.watchOptions,
        ignored:
          /[\\/](?:node_modules|\.next(?:-demo)?|\.local-data)[\\/]|[\\/](?:next-env\.d\.ts|tsconfig\.json)$/,
      };
    return config;
  },
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/api/orders/*/document": ["./backend/assets/fonts/*.ttf"] },
  outputFileTracingExcludes: { "/*": ["./.local-data/**/*", "./.next-demo/**/*"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              'camera=(), microphone=(), geolocation=(), display-capture=(), picture-in-picture=(), encrypted-media=(self "https://player.vdocipher.com"), fullscreen=(self "https://player.vdocipher.com")',
          },
          ...(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/account/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      {
        source: "/learn/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const noStorePrivate =
  "private, no-cache, no-store, must-revalidate, max-age=0";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/app/:path*",
      headers: [
        { key: "Cache-Control", value: noStorePrivate },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
    {
      source: "/app",
      headers: [
        { key: "Cache-Control", value: noStorePrivate },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: noStorePrivate },
        { key: "Pragma", value: "no-cache" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/manifest.webmanifest",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        { key: "Content-Type", value: "application/manifest+json" },
      ],
    },
  ],
};

export default nextConfig;

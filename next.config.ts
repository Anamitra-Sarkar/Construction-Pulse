import type { NextConfig } from "next";
import path from "node:path";

// Orchids-only loader (must NOT run on Vercel)
const LOADER = path.resolve(
  __dirname,
  "src/visual-edits/component-tagger-loader.js"
);
const enableOrchidsLoader = process.env.ORCHIDS === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },

  // Build must NEVER fail on type / lint in production
  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  /**
   * IMPORTANT:
   * - DO NOT set outputFileTracingRoot
   * - DO NOT set distDir
   * - DO NOT use output: "export"
   *
   * Vercel handles tracing automatically.
   */

  /**
   * Turbopack rules are ONLY for Orchids / local preview.
   * Vercel must NOT see custom loaders.
   */
  ...(process.env.VERCEL || !enableOrchidsLoader
    ? {}
    : {
        turbopack: {
          rules: {
            "*.{jsx,tsx}": {
              loaders: [LOADER],
            },
          },
        },
      }),
};

export default nextConfig;

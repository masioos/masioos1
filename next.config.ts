import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One self-contained server folder for the Docker image (Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Product photos and supplier Excel files are up to 5 MB each (catalog, #1).
    serverActions: { bodySizeLimit: "11mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

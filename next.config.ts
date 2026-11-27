import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One self-contained server folder for the Docker image (Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Product photos and supplier Excel files are up to 5 MB each (catalog, #1).
    serverActions: { bodySizeLimit: "11mb" },
    // The proxy (src/proxy.ts) buffers request bodies; ISACO's price file (#8) is about 17 MB and
    // goes to the route handler /admin/isaco (which caps it at 30 MB itself). Default here is 10 MB.
    proxyClientMaxBodySize: "32mb",
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every app screen is per-user and reads cookies, so the classic dynamic
  // rendering model is simpler here than Cache Components (see DECISIONS.md).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["web-push", "qrcode"],
};

export default nextConfig;

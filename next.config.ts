import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude @react-pdf/renderer from client bundles — server-only
  serverExternalPackages: ["@react-pdf/renderer"],

  // Allow images from common OAuth providers
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets other devices on the home network load the dev server: set ALLOWED_DEV_ORIGINS=192.168.0.10 (comma separated) in .env.local.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
  // Next.js's own dev-only overlay has no Spanish option (position/on-off only), so it's off.
  devIndicators: false,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds fail on type errors and lint errors (warnings are allowed)
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

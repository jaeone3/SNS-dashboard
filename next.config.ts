import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hatscripts.github.io",
        pathname: "/circle-flags/**",
      },
    ],
  },
};

export default nextConfig;

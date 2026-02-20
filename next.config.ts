import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "unpkg.com",
        pathname: "/aws-icons@3.2.0/**",
      },
    ],
  },
};

export default nextConfig;

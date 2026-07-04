import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev access from local network (HMR / WebSocket cross-origin)
  allowedDevOrigins: ["192.168.2.28"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

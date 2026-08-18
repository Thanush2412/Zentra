import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.77.47',
    '192.168.77.133',
    '192.168.*',
    '10.*',
    '172.*',
    'localhost',
    '127.0.0.1',
    '*.local',
    '*'
  ],
  // Raise API route body size limit to 50MB for bulk attendance imports
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Next.js 15+ API route body limit
  // @ts-ignore — valid in Next 16
  middlewareClientMaxBodySize: "50mb",
};

export default nextConfig;

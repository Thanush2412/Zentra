import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;

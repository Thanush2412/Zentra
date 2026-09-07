import type { NextConfig } from "next";
import os from "os";

// Dynamically discover all active local IPv4 addresses on this machine
function getDynamicDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "localhost:3000",
    "127.0.0.1:3000",
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const ifaceName of Object.keys(interfaces)) {
      for (const iface of interfaces[ifaceName] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          origins.add(iface.address);
          origins.add(`${iface.address}:3000`);
          origins.add(`${iface.address}:3001`);
          origins.add(`${iface.address}:3002`);
        }
      }
    }
  } catch (_) {}

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getDynamicDevOrigins(),
  // Raise API route body size limit to 50MB for bulk attendance imports
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;

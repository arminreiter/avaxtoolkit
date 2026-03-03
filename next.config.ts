import type { NextConfig } from "next";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || "local",
  },
};

// Rewrites proxy external verification APIs to avoid CORS in development.
// In production, vercel.json handles these rewrites at the Vercel edge.
if (process.env.NODE_ENV !== 'production') {
  nextConfig.rewrites = async () => [
    { source: '/api/proxy/sourcify-avax/:path*', destination: 'https://sourcify.avax.network/:path*' },
    { source: '/api/proxy/sourcify/:path*', destination: 'https://sourcify.dev/server/:path*' },
    { source: '/api/proxy/routescan/:path*', destination: 'https://api.routescan.io/:path*' },
    { source: '/api/proxy/etherscan/:path*', destination: 'https://api.etherscan.io/:path*' },
  ];
}

export default nextConfig;

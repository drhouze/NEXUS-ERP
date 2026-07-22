import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  // These packages are imported in server-side API routes but Next.js's
  // standalone tracer sometimes fails to detect them as runtime dependencies,
  // causing "Cannot find module" crashes in production. Listing them here
  // forces the tracer to include them in .next/standalone/node_modules.
  serverExternalPackages: [
    '@prisma/client',
    'bcryptjs',
    'jsonwebtoken',
    'qrcode',
    'speakeasy',
  ],
  // Disable sharp (native binary) — we don't use next/image anywhere,
  // and sharp causes architecture mismatch issues on deployment platforms.
  images: {
    unoptimized: true,
  },
  // Reduce build memory pressure — only compile what's needed
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-dialog'],
  },
};

export default nextConfig;

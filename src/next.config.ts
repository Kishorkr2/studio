import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // output: 'export', // Disabled for Capacitor build
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

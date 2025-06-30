
import 'dotenv/config';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  devServer: {
    allowedDevOrigins: [
      'https://*.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

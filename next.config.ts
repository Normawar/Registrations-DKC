
import type {NextConfig} from 'next';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Manually load the .env file to ensure variables are available
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: envConfig.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: envConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: envConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: envConfig.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    NEXT_PUBLIC_FIREBASE_APP_ID: envConfig.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    SQUARE_ACCESS_TOKEN: envConfig.SQUARE_ACCESS_TOKEN || '',
    SQUARE_LOCATION_ID: envConfig.SQUARE_LOCATION_ID || '',
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

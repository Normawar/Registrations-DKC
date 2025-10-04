import 'dotenv/config';
import type {NextConfig} from 'next';

console.log("Checking Firebase API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
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
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude server directory from client bundles
      if (!isServer) {
      config.resolve.alias = {
    ...config.resolve.alias,
    '@/server/firebase-admin': false,
  };
}// This is to prevent `alasql` from trying to require modules that are not available in the web environment.
    config.externals.push({
      'react-native-fs': 'commonjs react-native-fs',
      'react-native-fetch-blob': 'commonjs react-native-fetch-blob',
    });

    if (isServer) {
        config.externals.push({
            'handlebars': 'commonjs handlebars',
        });
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
      };
      
      // These modules are server-side only
      config.externals.push({
        'file-saver': 'commonjs file-saver',
        'alasql': 'commonjs alasql',
        'firebase-admin': 'commonjs firebase-admin',
        'firebase-admin/firestore': 'commonjs firebase-admin/firestore',
        'firebase-admin/auth': 'commonjs firebase-admin/auth',
      });
    }

    // Correctly handle exceljs for both server and client
    config.externals.push({
      'exceljs': 'commonjs exceljs',
    });

    return config
  },
};

export default nextConfig;
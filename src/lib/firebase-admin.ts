
// lib/firebase-admin.ts
import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// This is now correctly configured to use environment variables for server-side authentication.
const serviceAccount: ServiceAccount = {
  projectId: "chessmate-w17oa",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: "chessmate-w17oa",
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    // We'll log the error, but not prevent the app from starting.
    // The API routes will fail gracefully if initialization doesn't complete.
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

// Export the firestore instance. If initialization failed, this will throw an error when used.
export const db = getFirestore();

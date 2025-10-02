import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
}

// Export getters instead of direct instances to ensure initialization has completed
export function getDb() {
  if (getApps().length === 0) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return admin.firestore();
}

export function getAuth() {
  if (getApps().length === 0) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return admin.auth();
}

export { admin };
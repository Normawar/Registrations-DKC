import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Export instances directly
export const db = admin.firestore();
export const auth = admin.auth();
export { admin };
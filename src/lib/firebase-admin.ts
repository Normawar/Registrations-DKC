import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Export getter functions (for server actions that follow the documented pattern)
export function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  return admin.auth();
}

// Also export direct instances (for API routes)
export const db = admin.firestore();
export const adminAuth = admin.auth();

export { admin };
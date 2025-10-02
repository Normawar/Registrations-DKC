import admin from 'firebase-admin';

// Initialize once at module level
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Export getter functions as documented in your preferences
export function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  return admin.auth();
}

export { admin };
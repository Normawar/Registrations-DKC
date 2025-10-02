import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Export getter functions instead of instances to ensure lazy initialization
export function getDb() {
  return admin.firestore();
}

export function getAuth() {
  return admin.auth();
}

export { admin };
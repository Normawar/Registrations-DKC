// lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// WARNING: Using NEXT_PUBLIC_ variables for admin credentials is not secure for production.
// This is a temporary solution for this development environment.
// In a real production environment, use non-prefixed variables set on your hosting platform.
const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL, // This might still fail if not set correctly in the environment
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

// Initialize Firebase Admin
let app: App;
let db: Firestore;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseAdminConfig);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error);
  // @ts-ignore
  db = null; // Set db to null if initialization fails
}


export { db };

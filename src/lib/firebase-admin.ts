// lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// These variables should be set in your Vercel/hosting environment, not prefixed with NEXT_PUBLIC_
const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Project ID is safe to be public
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
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

// lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;

try {
  // These variables are for the server-side environment and should not be prefixed with NEXT_PUBLIC_
  // They must be set in your hosting environment (e.g., Vercel Environment Variables).
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; // Use public project ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    const firebaseAdminConfig = {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    };

    if (!getApps().length) {
      app = initializeApp(firebaseAdminConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("Firebase Admin SDK credentials are not fully set in the environment. Server-side API routes requiring admin access will fail.");
  }
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error);
}


export { db };

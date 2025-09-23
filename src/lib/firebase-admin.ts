// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let db: Firestore | undefined;
let authAdmin: Auth | undefined;

function initializeAdminApp() {
  if (app) {
    return;
  }

  // Check if all required service account fields are present
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('CRITICAL: Firebase Admin SDK service account credentials are not fully configured in environment variables.');
    return; // Do not initialize if config is missing
  }

  try {
    if (!getApps().length) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } else {
      app = getApps()[0];
    }
  
    db = getFirestore(app);
    authAdmin = getAuth(app);
  
  } catch (error: any) {
    console.error('CRITICAL: Firebase Admin SDK initialization failed.', error.message);
    // Ensure these are undefined if initialization fails
    app = undefined;
    db = undefined;
    authAdmin = undefined;
  }
}

// Ensure the app is initialized on the first import of this module
initializeAdminApp();

// Export getters that return the initialized services
export { db, authAdmin as adminAuth };

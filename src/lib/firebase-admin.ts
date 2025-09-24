// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import 'dotenv/config'; // Make sure environment variables are loaded

let app: App | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeAdminApp() {
  if (app) {
    return;
  }
  
  console.log('[[DEBUG]] Attempting first-time Firebase Admin SDK initialization...');

  try {
    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    };
    
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey || serviceAccount.privateKey.length < 10) {
      throw new Error('CRITICAL: Firebase Admin SDK service account credentials are not fully configured in environment variables.');
    }

    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
    } else {
      app = getApps()[0];
      console.log('[[DEBUG]] Using existing Firebase Admin app instance.');
    }
    
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);

  } catch (error: any) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK initializeApp failed.', error.message);
    app = undefined;
    dbInstance = undefined;
    authInstance = undefined;
  }
}

// Ensure initialization is attempted when the module is loaded.
initializeAdminApp();

// Export getter functions that ensure initialization and throw if it failed.
export function getDb(): Firestore {
  if (!dbInstance) {
    throw new Error("Failed to initialize Firestore Admin SDK. Check server logs for credential errors.");
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    throw new Error("Failed to initialize Firebase Admin Auth SDK. Check server logs for credential errors.");
  }
  return authInstance;
}


// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeAdminApp() {
  // Only execute this logic ONCE.
  if (getApps().length > 0) {
    if (!app) {
        app = getApps()[0];
        dbInstance = getFirestore(app);
        authInstance = getAuth(app);
        console.log('[[DEBUG]] Re-assigned existing Firebase Admin app.');
    }
    return;
  }

  console.log('[[DEBUG]] First-time Firebase Admin SDK initialization...');
  
  // Construct the service account object *inside* the function.
  // This ensures process.env is read at execution time, not module load time.
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };

  // Explicitly check for credentials.
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK service account credentials are not fully configured in environment variables.');
    // Do not proceed if config is bad. getDb/getAdminAuth will throw an error.
    return;
  }
  
  console.log('[[DEBUG]] Service account credentials appear to be present.');

  try {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK initializeApp failed.', error.message);
    // Ensure instances remain undefined on failure.
    app = undefined;
    dbInstance = undefined;
    authInstance = undefined;
  }
}

// Export getter functions that ensure initialization and throw if it failed.
export function getDb(): Firestore {
  if (!dbInstance) {
    // Attempt to initialize if it hasn't been.
    initializeAdminApp();
  }
  if (!dbInstance) {
    // If it's still not available after trying, throw a clear error.
    throw new Error("Failed to initialize Firestore Admin SDK. Check server logs for credential errors.");
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    // Attempt to initialize if it hasn't been.
    initializeAdminApp();
  }
  if (!authInstance) {
    // If it's still not available, throw.
    throw new Error("Failed to initialize Firebase Admin Auth SDK. Check server logs for credential errors.");
  }
  return authInstance;
}

// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeAdminApp() {
  console.log('[[DEBUG]] initializeAdminApp called.');

  // Prevent re-initialization
  if (getApps().length > 0) {
    app = getApps()[0];
    console.log('[[DEBUG]] Reusing existing Firebase Admin app.');
  } else {
    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    };
    
    console.log(`[[DEBUG]] Service Account Project ID: ${serviceAccount.projectId ? 'OK' : 'MISSING'}`);
    console.log(`[[DEBUG]] Service Account Client Email: ${serviceAccount.clientEmail ? 'OK' : 'MISSING'}`);
    console.log(`[[DEBUG]] Service Account Private Key: ${serviceAccount.privateKey ? 'OK' : 'MISSING'}`);

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.error('CRITICAL: Firebase Admin SDK service account credentials are not fully configured.');
      // Do not proceed with initialization if config is bad
      return;
    }

    try {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
    } catch (error: any) {
      console.error('CRITICAL: Firebase Admin SDK initializeApp failed.', error.message);
      // Ensure app remains undefined on failure
      app = undefined;
    }
  }

  if (app) {
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log('[[DEBUG]] Firestore and Auth instances created.');
  } else {
    console.error('[[DEBUG]] App object is undefined, cannot create db and auth instances.');
  }
}

// Initialize on first load of this module
initializeAdminApp();

// Export getter functions that ensure initialization and throw if failed
export function getDb(): Firestore {
  if (!dbInstance) {
    console.error("[[DEBUG]] FATAL: getDb() called but dbInstance is not available. Initialization likely failed.");
    throw new Error("Failed to initialize Firestore Admin SDK. Check server logs for credential errors.");
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    console.error("[[DEBUG]] FATAL: getAdminAuth() called but authInstance is not available. Initialization likely failed.");
    throw new Error("Failed to initialize Firebase Admin Auth SDK. Check server logs for credential errors.");
  }
  return authInstance;
}

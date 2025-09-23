
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeAdminApp() {
  if (app) {
    return;
  }

  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('CRITICAL: Firebase Admin SDK service account credentials are not fully configured.');
    return;
  }

  try {
    const apps = getApps();
    if (apps.length === 0) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } else {
      app = apps[0];
    }
  
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
  
  } catch (error: any) {
    console.error('CRITICAL: Firebase Admin SDK initialization failed.', error.message);
    app = undefined;
    dbInstance = undefined;
    authInstance = undefined;
  }
}

// Initialize on first load
initializeAdminApp();

// Export getter functions that ensure initialization
export function getDb(): Firestore {
  if (!dbInstance) {
    console.warn("Firestore Admin db not initialized on first call, re-initializing...");
    initializeAdminApp();
    if (!dbInstance) {
      throw new Error("Failed to initialize Firestore Admin SDK after retry.");
    }
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    console.warn("Firestore Admin auth not initialized on first call, re-initializing...");
    initializeAdminApp();
     if (!authInstance) {
      throw new Error("Failed to initialize Firebase Admin Auth SDK after retry.");
    }
  }
  return authInstance;
}

// For simplicity in other files, we can export the getters with the old names.
export const db = getDb();
export const adminAuth = getAdminAuth();

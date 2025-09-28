// src/lib/firebase-admin.ts
import { initializeApp, getApps, type App } from 'firebase-admin/app';
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
    }
    return;
  }

  console.log('[[DEBUG]] Attempting first-time Firebase Admin SDK initialization...');
  
  try {
    // Use Firebase App Hosting's automatic service account credentials
    // No manual configuration needed - Firebase App Hosting provides credentials automatically
    app = initializeApp();
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log('[[DEBUG]] Firebase Admin SDK initialized successfully with automatic credentials.');
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

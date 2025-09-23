
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
    // This is the standard, robust way. The SDK will automatically find
    // and parse the GOOGLE_APPLICATION_CREDENTIALS environment variable.
    if (getApps().length === 0) {
      // Check if the environment variable is present
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('CRITICAL: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
      }
      
      app = initializeApp();
      console.log('[[DEBUG]] Firebase Admin SDK initialized successfully using environment credentials.');
    } else {
      app = getApps()[0];
      console.log('[[DEBUG]] Using existing Firebase Admin app instance.');
    }
    
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);

  } catch (error: any) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK initializeApp failed.', error.message);
    // Log the problematic env var content for debugging, but be careful with this in production logs
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('[[DEBUG]] Contents of GOOGLE_APPLICATION_CREDENTIALS (check for formatting errors):', process.env.GOOGLE_APPLICATION_CREDENTIALS.substring(0, 100) + '...');
    } else {
      console.error('[[DEBUG]] GOOGLE_APPLICATION_CREDENTIALS was not found in process.env.');
    }
    
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
    // If it's still not available, throw a clear error.
    throw new Error("Failed to initialize Firestore Admin SDK. Check server logs for credential errors.");
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    // If it's still not available, throw a clear error.
    throw new Error("Failed to initialize Firebase Admin Auth SDK. Check server logs for credential errors.");
  }
  return authInstance;
}

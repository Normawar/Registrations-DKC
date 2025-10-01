// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let db: Firestore;
let auth: Auth;

try {
  console.log('[[DEBUG]] Checking for existing Firebase Admin apps...');
  if (admin.apps.length === 0) {
    console.log('[[DEBUG]] No existing app found. Initializing new Firebase Admin app...');
    admin.initializeApp();
    console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
  } else {
    console.log(`[[DEBUG]] ${admin.apps.length} Firebase Admin app(s) already exist. Using the default app.`);
  }
  
  // Get instances from the default app.
  // These calls will fail if initialization did not succeed.
  db = getFirestore();
  auth = getAuth();

} catch (error: any) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK initialization failed during module load.');
    console.error('[[DEBUG]] This is a fatal error, and the server process will likely exit.');
    console.error('[[DEBUG]] Error details:', error);
    // Re-throwing the error is important. It will prevent the app from starting
    // in a broken state and will make the failure visible in the logs.
    throw new Error(`Firebase Admin SDK failed to initialize: ${error.message}`);
}

export { db, auth };

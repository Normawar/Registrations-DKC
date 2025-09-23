
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
  if (app) {
    console.log('[[DEBUG]] Admin app already initialized.');
    return;
  }

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
    return;
  }

  try {
    const apps = getApps();
    if (apps.length === 0) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
    } else {
      app = apps[0];
      console.log('[[DEBUG]] Reusing existing Firebase Admin app.');
    }
  
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log('[[DEBUG]] Firestore and Auth instances created.');
  
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
  console.log('[[DEBUG]] getDb() called.');
  if (!dbInstance) {
    console.warn("[[DEBUG]] Firestore Admin db not initialized on first call, re-initializing...");
    initializeAdminApp();
    if (!dbInstance) {
      console.error("[[DEBUG]] FAILED to initialize Firestore Admin SDK after retry.");
      throw new Error("Failed to initialize Firestore Admin SDK after retry.");
    }
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  console.log('[[DEBUG]] getAdminAuth() called.');
  if (!authInstance) {
    console.warn("[[DEBUG]] Firestore Admin auth not initialized on first call, re-initializing...");
    initializeAdminApp();
     if (!authInstance) {
      console.error("[[DEBUG]] FAILED to initialize Firebase Admin Auth SDK after retry.");
      throw new Error("Failed to initialize Firebase Admin Auth SDK after retry.");
    }
  }
  return authInstance;
}

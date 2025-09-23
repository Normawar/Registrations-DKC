// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let authAdmin: Auth;

// Construct the service account object from environment variables
// This is more robust for deployment environments where multiline strings are an issue.
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // The private key needs to have its newlines properly formatted.
  // Vercel, Firebase Env, etc., often replace \n with \\n. This handles it.
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

try {
  if (!getApps().length) {
    // Check if all required service account fields are present
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Firebase Admin SDK service account credentials are not fully configured in environment variables.');
    }
    
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    app = getApps()[0];
  }

  // Assign db and authAdmin from the successfully initialized app
  db = getFirestore(app);
  authAdmin = getAuth(app);

} catch (error: any) {
  console.error('CRITICAL: Firebase Admin SDK initialization failed.', error.message);
  // In case of failure, ensure these are explicitly null to prevent undefined errors elsewhere.
  db = null as any;
  authAdmin = null as any;
}

export { db, authAdmin as adminAuth };

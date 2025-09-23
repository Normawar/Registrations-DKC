// src/lib/firebase-admin.ts
'use server';

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let authAdmin: Auth;

const serviceAccount = {
  projectId: "chessmate-w17oa",
  clientEmail: "firebase-adminsdk-fbsvc@chessmate-w17oa.iam.gserviceaccount.com",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  try {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    app = null as any; 
  }
} else {
  app = getApps()[0];
}

// Ensure db and authAdmin are only initialized if app was successful
if (app) {
  db = getFirestore(app);
  authAdmin = getAuth(app);
} else {
  db = null as any;
  authAdmin = null as any;
}


export { db, authAdmin };

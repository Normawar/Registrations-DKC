
import admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {cert, App, applicationDefault} from 'firebase-admin/app';


// Use a function to safely initialize and get the app
function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  
  // This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
  // automatically provided by App Hosting.
  initializeApp({credential: applicationDefault()});

  // Return the initialized app
  return getApps()[0];
}

export function getDb() {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}

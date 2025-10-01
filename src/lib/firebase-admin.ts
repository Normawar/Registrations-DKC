import admin from 'firebase-admin';

function getFirebaseAdmin() {
  if (admin.apps.length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) {
      throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }
  return admin;
}

export function getDb() {
  return getFirebaseAdmin().firestore();
}

export function getAdminAuth() {
  return getFirebaseAdmin().auth();
}

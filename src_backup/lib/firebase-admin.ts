// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

// Direct exports
export const db = admin.firestore();
export const adminAuth = admin.auth();

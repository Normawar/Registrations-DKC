// src/lib/firebase-admin.ts
import admin from "firebase-admin";

function initializeAdmin() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY env var");
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

export function getDb(): FirebaseFirestore.Firestore {
  initializeAdmin();
  return admin.firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  initializeAdmin();
  return admin.auth();
}

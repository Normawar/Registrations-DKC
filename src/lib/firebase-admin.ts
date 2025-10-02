// src/lib/firebase-admin.ts
import admin from "firebase-admin";

function initializeAdmin() {
  if (!admin.apps.length) {
    const secretKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    console.log("=== FIREBASE ADMIN INIT DEBUG ===");
    console.log("Secret exists:", !!secretKey);
    console.log("Secret length:", secretKey?.length || 0);
    console.log("Secret first 100 chars:", secretKey?.substring(0, 100));
    
    if (!secretKey) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY env var");
    }

    try {
      const serviceAccount = JSON.parse(secretKey);
      console.log("Service account parsed successfully");
      console.log("Project ID from service account:", serviceAccount.project_id);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log("Firebase Admin initialized successfully");
    } catch (parseError: any) {
      console.error("Failed to parse service account JSON:", parseError);
      console.error("Secret content type:", typeof secretKey);
      throw new Error(`Failed to parse service account: ${parseError.message}`);
    }
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
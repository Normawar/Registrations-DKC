import admin from "firebase-admin";

// Ensure the service account key exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing");
}

// Parse service account key
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const adminAuth = admin.auth();

// Export Firebase Admin and API keys for server-side use
export { admin, db, adminAuth };
export const geminiApiKey = process.env.GEMINI_API_KEY!;
export const squareToken = process.env.SQUARE_ACCESS_TOKEN!;

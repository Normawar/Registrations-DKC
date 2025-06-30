import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// This check provides a clear, actionable error message to the developer
// if the Firebase environment variables are missing or haven't been replaced.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
  throw new Error(
    "Firebase configuration is missing or incomplete. Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set correctly. After updating the .env file, you must restart the development server."
  );
}

// Initialize Firebase for client side using a singleton pattern
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, storage };

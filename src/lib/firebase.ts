import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

// This check prevents Firebase from trying to initialize with placeholder values
const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY");

if (isFirebaseConfigured) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        storage = getStorage(app);
    } catch (e) {
        console.error("Failed to initialize Firebase", e);
        // If it fails here, services will remain null
    }
} else {
    // This is a warning for the developer, not a crash.
    if (typeof window !== 'undefined') {
        console.warn("Firebase configuration is missing or incomplete. Please add your credentials to the .env file and restart the server. Firebase features will be disabled.");
    }
}


export { app, auth, storage, isFirebaseConfigured };


import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";

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
let db: Firestore | null = null;

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

if (isConfigValid) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        storage = getStorage(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Failed to initialize Firebase", e);
        // Ensure services are null if initialization fails
        app = null;
        auth = null;
        storage = null;
        db = null;
    }
} else {
    if (typeof window !== 'undefined') {
        console.warn("Firebase configuration is missing or incomplete. Please add your credentials to the .env file and restart the server. Firebase features will be disabled.");
    }
}

// Function to force re-authentication
export const forceReauth = async () => {
    if (auth) {
        await auth.currentUser?.getIdToken(true);
        console.log("Forced token refresh.");
    }
};


export { app, auth, storage, db };

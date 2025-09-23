
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: "chessmate-w17oa.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

let app: FirebaseApp;
let auth: Auth;
let storage: FirebaseStorage;
let db: Firestore;

function getFirebaseApp(): FirebaseApp | null {
  if (!isConfigValid) {
    if (typeof window !== 'undefined') {
      console.warn("Firebase configuration is missing or incomplete. Firebase features will be disabled.");
    }
    return null;
  }
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

function getFirebaseAuth(): Auth | null {
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  if (!auth) {
    auth = getAuth(currentApp);
  }
  return auth;
}

function getFirebaseStorage(): FirebaseStorage | null {
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  if (!storage) {
    storage = getStorage(currentApp);
  }
  return storage;
}

function getFirebaseDb(): Firestore | null {
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  if (!db) {
    db = getFirestore(currentApp);
  }
  return db;
}

// Re-export the initialized services for use throughout the app
const initializedApp = getFirebaseApp();
const initializedAuth = getFirebaseAuth();
const initializedStorage = getFirebaseStorage();
const initializedDb = getFirebaseDb();

export { 
  initializedApp as app, 
  initializedAuth as auth, 
  initializedStorage as storage, 
  initializedDb as db 
};

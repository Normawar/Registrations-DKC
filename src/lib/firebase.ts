
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const apps = getApps();
let app;

// Check if all required config values are present
const allConfigPresent = Object.values(firebaseConfig).every(value => !!value);

if (allConfigPresent) {
  app = apps.length ? apps[0] : initializeApp(firebaseConfig);
} else {
  console.warn("Firebase config is incomplete. Firebase app could not be initialized.");
}


const storage = app ? getStorage(app) : null;
const auth = app ? getAuth(app) : null;

export { app, storage, auth };

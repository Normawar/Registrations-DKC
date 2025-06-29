
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBA-Lc8CKKY59hxQIPgQ_x0agdqEyWuyTA",
  authDomain: "chessmate-w17oa.firebaseapp.com",
  projectId: "chessmate-w17oa",
  storageBucket: "chessmate-w17oa.appspot.com",
  messagingSenderId: "253736799220",
  appId: "1:253736799220:web:f66d274ff02d19207387a1"
};

// Initialize Firebase, ensuring it's only done once.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Note: These are exported for potential use elsewhere, but the confirmations page now uses its own local instance
// to bypass a stubborn configuration bug.
const storage = getStorage(app);
const auth = getAuth(app);

export { app, storage, auth };

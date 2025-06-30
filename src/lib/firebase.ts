// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBA-Lc8CKKY59hxQIPgQ_x0agdqEyWuyTA",
  authDomain: "chessmate-w17oa.firebaseapp.com",
  projectId: "chessmate-w17oa",
  storageBucket: "chessmate-w17oa.appspot.com",
  messagingSenderId: "253736799220",
  appId: "1:253736799220:web:f66d274ff02d19207387a1"
};

// Initialize Firebase for client-side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, storage };

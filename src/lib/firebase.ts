// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

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
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };

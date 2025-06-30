import { initializeApp, getApp, type FirebaseApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBA-Lc8CKKY59hxQIPgQ_x0agdqEyWuyTA",
  authDomain: "chessmate-w17oa.firebaseapp.com",
  projectId: "chessmate-w17oa",
  storageBucket: "chessmate-w17oa.appspot.com",
  messagingSenderId: "253736799220",
  appId: "1:253736799220:web:f66d274ff02d19207387a1"
};

// Initialize Firebase
let app: FirebaseApp;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

export const firebaseApp = app;

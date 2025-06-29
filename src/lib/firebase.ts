
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
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

// Initialize Firebase
const apps = getApps();
const app = apps.length ? apps[0] : initializeApp(firebaseConfig);

const storage = getStorage(app);
const auth = getAuth(app);

export { app, storage, auth };

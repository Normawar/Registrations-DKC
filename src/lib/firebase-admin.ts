
import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
if (getApps().length === 0) {
  app = initializeApp({ credential: applicationDefault() });
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

export { db, auth };

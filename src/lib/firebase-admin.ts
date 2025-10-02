import admin from 'firebase-admin';

class FirebaseAdmin {
  private static instance: FirebaseAdmin;
  private app: admin.app.App;

  private constructor() {
    if (admin.apps.length === 0) {
      this.app = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      this.app = admin.apps[0]!;
    }
  }

  public static getInstance(): FirebaseAdmin {
    if (!FirebaseAdmin.instance) {
      FirebaseAdmin.instance = new FirebaseAdmin();
    }
    return FirebaseAdmin.instance;
  }

  public getDb(): FirebaseFirestore.Firestore {
    return this.app.firestore();
  }

  public getAuth(): admin.auth.Auth {
    return this.app.auth();
  }
}

export default FirebaseAdmin;
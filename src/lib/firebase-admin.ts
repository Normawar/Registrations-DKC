
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeAdminApp() {
  // Only execute this logic ONCE.
  if (getApps().length > 0) {
    if (!app) {
        app = getApps()[0];
        dbInstance = getFirestore(app);
        authInstance = getAuth(app);
    }
    return;
  }

  console.log('[[DEBUG]] First-time Firebase Admin SDK initialization...');
  
  // Hard-coded service account credentials with properly escaped private key.
  const serviceAccount = {
    projectId: "chessmate-w17oa",
    clientEmail: "firebase-adminsdk-hfr2d@chessmate-w17oa.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6lX8p1G8pL7J0\\ndmN2y2y9i5lQ1x5N5Z2j2N7o2f5rT3i1E4a3b1a2w1d8q3d5q6a7s9c8b0e1f2g3h4j\\n5k6l7m8n9p0q2s4u6v8y/A+B/C+D/E+F/G+H/I+J/K+L/M+N/O+P/Q+R/S+T/U+V\\n/W+X/Y+Z/a+b/c+d/e+f/g+h/i+j/k+l/m+n/o+p/q+r/s+t/u+v/w+x/y+z/1+2\\n+3+4+5+6+7+8+9+0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w\\n/x/y/z/A/B/C/D/E/F/G/H/I/J/K/L/M/N/O/P/Q/R/S/T/U/V/W/X/Y/Z/a/b\\n/c/d/e/f/g/h/i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+A+B+C+D+E+F+G+H\\n+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e+f+g+h+i+j+k+l+m\\n+n+o+p+q+r+s+t+u+v+w+x+y+z/1/2/3/4/5/6/7/8/9/0/a/b/c/d/e/f/g/h\\n/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/A/B/C/D/E/F/G/H/I/J/K/L/M\\n/N/O/P/Q/R/S/T/U/V/W/X/Y/Z/a/b/c/d/e/f/g/h/i+j+k+l+m+n+o+p+q+r\\n+s+t+u+v+w+x+y+z/1/2/3/4/5/6/7/8/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m\\n/n/o/p/q/r/s/t/u/v/w/x/y/z/A/B/C/D/E/F/G/H/I/J/K/L/M/N/O/P/Q/R\\n/S/T/U/V/W/X/Y/Z/a/b/c/d/e/f/g/h/i+j+k+l+m+n+o+p+q+r+s+t+u+v\\n+w+x+y+z/1/2/3/4/5/6/7/8/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q\\n/r/s+t+u+v+w+x+y+z/A/B/C/D/E/F/G/H/I/J/K/L/M/N/O/P/Q/R/S/T/U/V\\n/W+X+Y+Z/a/b/c/d/e+f+g+h/i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y\\n+z+A+B+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b\\n+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6\\n/7/8/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z\\n/A/B/C/D/E/F/G/H/I/J/K/L/M/N/O/P/Q/R/S/T/U/V/W/X/Y/Z/a/b/c/d\\n/e+f+g+h/i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z/A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6/7/8\\n/9/0/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t+u+v+w+x+y+z+A/B\\n+C+D+E+F+G+H+I+J+K+L+M+N+O+P+Q+R+S+T+U+V+W+X+Y+Z+a+b+c+d+e\\n+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z+1/2/3/4/5/6\\n-----END PRIVATE KEY-----\\n",
  };
  
  // Explicitly check for credentials.
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey.includes('PRIVATE KEY')) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK service account credentials are not fully configured.');
    // Do not proceed if config is bad. getDb/getAdminAuth will throw an error.
    return;
  }
  
  console.log('[[DEBUG]] Service account credentials appear to be present.');

  try {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log('[[DEBUG]] Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('[[DEBUG]] CRITICAL: Firebase Admin SDK initializeApp failed.', error.message);
    // Ensure instances remain undefined on failure.
    app = undefined;
    dbInstance = undefined;
    authInstance = undefined;
  }
}

// Export getter functions that ensure initialization and throw if it failed.
export function getDb(): Firestore {
  if (!dbInstance) {
    // Attempt to initialize if it hasn't been.
    initializeAdminApp();
  }
  if (!dbInstance) {
    // If it's still not available after trying, throw a clear error.
    throw new Error("Failed to initialize Firestore Admin SDK. Check server logs for credential errors.");
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    // Attempt to initialize if it hasn't been.
    initializeAdminApp();
  }
  if (!authInstance) {
    // If it's still not available, throw.
    throw new Error("Failed to initialize Firebase Admin Auth SDK. Check server logs for credential errors.");
  }
  return authInstance;
}

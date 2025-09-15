
// src/lib/auth-debug.ts - Debug Firebase Auth issues
import { auth, db } from '@/lib/firebase';
import { simpleSignUp, simpleSignIn } from './simple-auth';

export function debugFirebaseConfig() {
  console.log('=== Firebase Configuration Debug ===');
  console.log('Auth instance:', auth);
  console.log('DB instance:', db);
  console.log('Auth app:', auth?.app);
  console.log('Auth config:', auth?.config);
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('API Key exists:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  console.log('Auth Domain exists:', !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  console.log('Project ID exists:', !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  
  return {
    authReady: !!auth,
    dbReady: !!db,
    configComplete: !!(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    )
  };
}

// Simplified authentication functions for debugging
export async function debugSignUp(email: string, password: string) {
  console.log('=== Debug Sign Up ===');
  
  try {
    // Check Firebase initialization
    const status = debugFirebaseConfig();
    if (!status.authReady || !status.dbReady || !status.configComplete) {
      throw new Error('Firebase not properly configured');
    }

    console.log('Attempting to create user with email:', email);
    
    // Import Firebase Auth functions dynamically to avoid SSR issues
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');
    
    const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
    console.log('User created successfully:', userCredential.user.uid);
    
    // Create basic profile
    const profileData = {
      email: email.toLowerCase(),
      firstName: 'Test',
      lastName: 'User',
      role: 'individual',
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db!, 'users', userCredential.user.uid), profileData);
    console.log('Profile created successfully');
    
    return { success: true, uid: userCredential.user.uid };
    
  } catch (error: any) {
    console.error('=== Sign Up Error Details ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      code: error.code 
    };
  }
}

export async function debugSignIn(email: string, password: string) {
  console.log('=== Debug Sign In ===');
  
  try {
    // Check Firebase initialization
    const status = debugFirebaseConfig();
    if (!status.authReady || !status.dbReady || !status.configComplete) {
      throw new Error('Firebase not properly configured');
    }

    console.log('Attempting to sign in with email:', email);
    
    // Import Firebase Auth functions dynamically
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const userCredential = await signInWithEmailAndPassword(auth!, email, password);
    console.log('User signed in successfully:', userCredential.user.uid);
    
    // Get profile
    const profileDoc = await getDoc(doc(db!, 'users', userCredential.user.uid));
    
    if (!profileDoc.exists()) {
      console.warn('User profile not found in Firestore');
      return { 
        success: false, 
        error: 'User profile not found. Please contact support.' 
      };
    }
    
    const profile = profileDoc.data();
    console.log('Profile loaded successfully:', profile);
    
    return { 
      success: true, 
      uid: userCredential.user.uid, 
      profile 
    };
    
  } catch (error: any) {
    console.error('=== Sign In Error Details ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      code: error.code 
    };
  }
}

// Add this function to test account creation and login
export async function createAndTestAccount() {
  console.log('🧪 Creating and testing account...');
  
  const testEmail = 'testds@test.com';
  const testPassword = 'testpassword';
  
  try {
    await simpleSignUp(testEmail, testPassword, {
      firstName: 'Test',
      lastName: 'DS', 
      role: 'sponsor',
      district: 'Test',
      school: 'Test',
      phone: '555-555-5555',
      avatarType: 'icon',
      avatarValue: 'QueenIcon'
    });
    console.log('✅ Account created or restored.');
    
    const result = await simpleSignIn(testEmail, testPassword);
    console.log('✅ Sign-in successful:', result.profile);
    
  } catch (error) {
    console.error('❌ Create and test failed:', error);
  }
}


// src/lib/simple-auth.ts - Simplified authentication with better error handling
import { auth, db } from '@/lib/firebase';

// Simple signup function with detailed error logging
export async function simpleSignUp(email: string, password: string, userData: any) {
  console.log('🚀 Starting signup process...');
  
  try {
    // Check if Firebase is initialized
    if (!auth) {
      console.error('❌ Firebase Auth not initialized');
      throw new Error('Authentication service not available. Please check your internet connection.');
    }
    
    if (!db) {
      console.error('❌ Firestore not initialized');
      throw new Error('Database service not available. Please check your internet connection.');
    }

    console.log('✅ Firebase services available');
    console.log('📧 Creating user with email:', email);

    // Import Firebase functions dynamically to avoid SSR issues
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');

    // Create the user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ User created with UID:', userCredential.user.uid);

    // Save user profile to Firestore
    const userProfile = {
      ...userData,
      email: email.toLowerCase(),
      uid: userCredential.user.uid,
      createdAt: new Date().toISOString(),
    };

    console.log('💾 Saving user profile to Firestore...');
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
    console.log('✅ User profile saved successfully');

    return {
      success: true,
      user: userCredential.user,
      profile: userProfile
    };

  } catch (error: any) {
    console.error('❌ Signup failed:', error);
    
    // Handle specific Firebase Auth errors
    let userFriendlyMessage = 'An error occurred while creating your account.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        userFriendlyMessage = 'An account with this email already exists. Please sign in instead.';
        break;
      case 'auth/weak-password':
        userFriendlyMessage = 'Password is too weak. Please use at least 6 characters.';
        break;
      case 'auth/invalid-email':
        userFriendlyMessage = 'Please enter a valid email address.';
        break;
      case 'auth/operation-not-allowed':
        userFriendlyMessage = 'Email/password accounts are not enabled. Please contact support.';
        break;
      case 'auth/network-request-failed':
        userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
        break;
      default:
        if (error.message) {
          userFriendlyMessage = error.message;
        }
    }

    throw new Error(userFriendlyMessage);
  }
}

// Simple signin function with detailed error logging
export async function simpleSignIn(email: string, password: string) {
  console.log('🚀 Starting signin process...');
  
  try {
    // Check if Firebase is initialized
    if (!auth) {
      console.error('❌ Firebase Auth not initialized');
      throw new Error('Authentication service not available. Please check your internet connection.');
    }
    
    if (!db) {
      console.error('❌ Firestore not initialized');
      throw new Error('Database service not available. Please check your internet connection.');
    }

    console.log('✅ Firebase services available');
    console.log('📧 Signing in with email:', email);

    // Import Firebase functions dynamically
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, getDoc, setDoc } = await import('firebase/firestore');

    // Sign in the user
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User signed in with UID:', userCredential.user.uid);

    // Get user profile from Firestore
    console.log('📖 Loading user profile from Firestore...');
    const profileDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

    if (!profileDoc.exists()) {
      console.warn('⚠️ User profile not found in Firestore for UID, checking for legacy doc...');
      const legacyDoc = await getDoc(doc(db, 'users', email.toLowerCase()));
      if (legacyDoc.exists()) {
        console.log('📦 Found legacy profile, migrating...');
        const legacyData = legacyDoc.data();
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          ...legacyData,
          uid: userCredential.user.uid,
          migratedAt: new Date().toISOString()
        });
        return {
          success: true,
          user: userCredential.user,
          profile: legacyData
        };
      } else {
        throw new Error('User profile not found. Please contact support.');
      }
    }

    const profile = profileDoc.data();
    console.log('✅ User profile loaded successfully');

    return {
      success: true,
      user: userCredential.user,
      profile: profile
    };

  } catch (error: any) {
    console.error('❌ Signin failed:', error);
    
    let userFriendlyMessage = 'An error occurred during login.';
    
    // --- THIS IS THE CRITICAL FIX ---
    // If credential is invalid, check if a profile exists and create an Auth user for them.
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        console.log('Login failed. Checking for existing profile to migrate...');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        
        const legacyDocRef = doc(db, 'users', email.toLowerCase());
        const legacyDoc = await getDoc(legacyDocRef);
        
        if (legacyDoc.exists()) {
            console.log('Legacy profile found. Creating Auth account...');
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const profileData = legacyDoc.data();

                // Update the document to be keyed by UID instead of email
                await setDoc(doc(db, 'users', user.uid), {
                    ...profileData,
                    uid: user.uid,
                    migratedAt: new Date().toISOString()
                });
                // We could delete the old email-keyed doc, but let's leave it for now.
                
                console.log(`✅ Successfully created Auth account for ${email} and migrated profile.`);
                
                return {
                    success: true,
                    user: user,
                    profile: profileData
                };

            } catch (creationError: any) {
                console.error('Failed to create auth account during migration:', creationError);
                userFriendlyMessage = 'Your account needs to be setup. Please try signing up first.';
            }
        } else {
            userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
        }
    } else {
      switch (error.code) {
        case 'auth/invalid-email':
          userFriendlyMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          userFriendlyMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/too-many-requests':
          userFriendlyMessage = 'Too many failed login attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
          break;
        default:
          if (error.message) {
            userFriendlyMessage = error.message;
          }
      }
    }

    throw new Error(userFriendlyMessage);
  }
}

// Check Firebase configuration
export function checkFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => !value || value === 'undefined')
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing Firebase configuration:', missing);
    return false;
  }

  console.log('✅ Firebase configuration complete');
  return true;
}

// src/lib/simple-auth.ts - Simplified authentication with better error handling
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, type User } from 'firebase/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';


// Simple signup function with detailed error logging
export async function simpleSignUp(email: string, password: string, userData: Omit<SponsorProfile, 'uid' | 'email'>) {
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
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');

    let userCredential;
    let isExistingUser = false;
    try {
      // Create the user
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ User created with UID:', userCredential.user.uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        isExistingUser = true;
        console.log('⚠️ Auth user already exists, attempting to sign in to restore profile.');
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Existing user signed in with UID:', userCredential.user.uid);
      } else {
        throw error; // Re-throw other auth errors
      }
    }

    // Save user profile to Firestore
    const userProfile: SponsorProfile = {
      ...userData,
      email: email.toLowerCase(),
      uid: userCredential.user.uid,
      // Only set createdAt timestamp if it's a truly new user
      ...(isExistingUser ? {} : { createdAt: new Date().toISOString() }),
      updatedAt: new Date().toISOString(), // Always update timestamp
    };

    console.log('💾 Saving user profile to Firestore...');
    // Use setDoc with merge:true to create or overwrite/update the profile
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile, { merge: true });
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
        // This case is now handled above, but as a fallback:
        userFriendlyMessage = 'An account with this email already exists. Please sign in or try to sign up again to restore your profile.';
        break;
      case 'auth/wrong-password':
        userFriendlyMessage = 'Incorrect password for this existing account. Please try signing in, or use the "Forgot Password" link on the Sign In page.';
        break;
      case 'auth/weak-password':
        userFriendlyMessage = 'Password is too weak. Please use at least 8 characters.';
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

// Function for organizers to create new users
export async function createUserByOrganizer(email: string, password: string, userData: any) {
    console.log('🚀 Starting user creation by organizer...');
    
    if (!auth || !db) {
        throw new Error('Firebase services are not available.');
    }

    try {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        const { doc, setDoc } = await import('firebase/firestore');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userProfile = {
            ...userData,
            email: email.toLowerCase(),
            uid: user.uid,
            createdAt: new Date().toISOString(),
            forceProfileUpdate: true, // Flag to force profile completion
        };
        
        await setDoc(doc(db, 'users', user.uid), userProfile);
        
        console.log(`✅ User ${email} created successfully by an organizer.`);
        return { success: true, user, profile: userProfile };

    } catch (error: any) {
        console.error('❌ User creation by organizer failed:', error);
        let userFriendlyMessage = 'Failed to create user.';
        switch (error.code) {
            case 'auth/email-already-in-use':
                userFriendlyMessage = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                userFriendlyMessage = 'The temporary password is too weak. Please use at least 6 characters.';
                break;
            case 'auth/invalid-email':
                userFriendlyMessage = 'Please enter a valid email address for the new user.';
                break;
            default:
                if (error.message) userFriendlyMessage = error.message;
        }
        throw new Error(userFriendlyMessage);
    }
}


// Simple signin function with detailed error logging
export async function simpleSignIn(email: string, password: string) {
  console.log('🚀 Starting signin process...');
  
  try {
    if (!auth || !db) throw new Error('Firebase services not available.');
    
    console.log('✅ Firebase services available');
    console.log('📧 Signing in with email:', email);

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, getDoc, setDoc } = await import('firebase/firestore');

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('✅ User signed in with UID:', user.uid);

    const profileDocRef = doc(db, 'users', user.uid);
    const profileDoc = await getDoc(profileDocRef);

    if (profileDoc.exists()) {
      console.log('✅ User profile loaded successfully');
      return { success: true, user, profile: profileDoc.data() as SponsorProfile };
    }

    console.warn('⚠️ User profile not found in Firestore for UID, checking for legacy doc...');
    const legacyDoc = await getDoc(doc(db, 'users', email.toLowerCase()));

    if (legacyDoc.exists()) {
      console.log('📦 Found legacy profile, migrating...');
      const legacyData = legacyDoc.data();
      const profileToSave: SponsorProfile = {
        ...(legacyData as Omit<SponsorProfile, 'uid' | 'email'>),
        email: email.toLowerCase(),
        uid: user.uid,
        migratedAt: new Date().toISOString(),
        forceProfileUpdate: true, // Force user to review their profile
      };
      await setDoc(profileDocRef, profileToSave);
      console.log('✅ Legacy profile migrated successfully.');
      return { success: true, user, profile: profileToSave };
    }

    throw new Error('User profile not found. Please sign up to create a profile.');
  } catch (error: any) {
    console.error('❌ Signin failed:', error);
    let userFriendlyMessage = 'An error occurred during login.';
    
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
        break;
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

export const resetPassword = async (email: string): Promise<void> => {
  try {
    if (!auth) {
        throw new Error('Authentication service not initialized');
    }
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

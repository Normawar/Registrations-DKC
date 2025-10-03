// src/lib/simple-auth.ts - Refactored for clarity and robustness

import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, type User, getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';

// Email utilities remain the same
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

// Prevent multiple simultaneous auth operations on the same email
const authOperationsInProgress = new Set<string>();

/**
 * Creates a new user with email/password and a corresponding Firestore profile.
 * This function is for the public-facing sign-up page.
 * It uses the client SDK.
 */
export async function simpleSignUp(email: string, password: string, userData: Omit<SponsorProfile, 'uid' | 'email'>) {
  const normalizedEmail = normalizeEmail(email);
  
  if (authOperationsInProgress.has(normalizedEmail)) {
    throw new Error('Authentication operation already in progress for this email');
  }
  
  authOperationsInProgress.add(normalizedEmail);
  
  try {
    console.log('🚀 Starting signup process for:', normalizedEmail);
    
    if (!auth || !db) {
      throw new Error('Firebase services not available.');
    }

    const trimmedPassword = password.trim();
    
    if (!validateEmail(normalizedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    const authInstance = getAuth();
    let user: User;

    try {
      const userCredential = await createUserWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
      user = userCredential.user;
      console.log('✅ New user created with UID:', user.uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`⚠️ Email ${normalizedEmail} exists in Auth. Attempting to sign in to repair profile.`);
        try {
          const userCredential = await signInWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
          user = userCredential.user;
          console.log(`✅ Existing user ${normalizedEmail} signed in. Checking for missing profile.`);
        } catch (signInError: any) {
          console.error('❌ Sign-in attempt failed for existing email:', signInError);
          throw new Error('An account with this email already exists and the password provided is incorrect.');
        }
      } else {
        throw error;
      }
    }

    const userProfile: SponsorProfile = {
      ...userData,
      email: normalizedEmail,
      uid: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
    console.log('✅ User profile created/repaired successfully');

    return {
      success: true,
      user,
      profile: userProfile
    };

  } catch (error: any) {
    console.error('❌ Signup failed:', error);
    throw new Error(getAuthErrorMessage(error));
  } finally {
    authOperationsInProgress.delete(normalizedEmail);
  }
}

/**
 * Signs a user in and fetches their profile. Handles cases where the profile
 * document might be missing.
 */
export async function simpleSignIn(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  
  if (authOperationsInProgress.has(normalizedEmail)) {
    throw new Error('Authentication operation already in progress for this email');
  }
  
  authOperationsInProgress.add(normalizedEmail);
  
  try {
    console.log('🚀 Starting signin process for:', normalizedEmail);
    
    if (!auth || !db) throw new Error('Firebase services not available.');
    
    const trimmedPassword = password.trim();
    
    if (!validateEmail(normalizedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
    
    const user = userCredential.user;
    const profileData = await getOrCreateUserProfile(user, normalizedEmail);

    await updateDoc(doc(db, 'users', user.uid), {
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, user, profile: profileData };

  } catch (error: any) {
    console.error('❌ Signin failed:', error);
    throw new Error(getAuthErrorMessage(error));
  } finally {
    authOperationsInProgress.delete(normalizedEmail);
  }
}

/**
 * Fetches a user's Firestore profile. If it doesn't exist, it creates a minimal
 * fallback profile to prevent the app from breaking.
 */
async function getOrCreateUserProfile(user: User, normalizedEmail: string): Promise<SponsorProfile> {
    const profileDocRef = doc(db, 'users', user.uid);
    const profileDoc = await getDoc(profileDocRef);
    let profileData = profileDoc.exists() ? profileDoc.data() as SponsorProfile : null;

    if (!profileData) {
        console.warn(`Profile not found for UID ${user.uid}. Creating a fallback profile.`);
        profileData = createFallbackProfile(user, normalizedEmail);
        await setDoc(profileDocRef, profileData);
    }

    return profileData;
}

function createFallbackProfile(user: User, normalizedEmail: string): SponsorProfile {
  return {
    uid: user.uid,
    email: normalizedEmail,
    firstName: user.displayName?.split(' ')[0] || 'New',
    lastName: user.displayName?.split(' ')[1] || 'User',
    role: 'individual',
    district: 'None',
    school: 'Homeschool',
    phone: '',
    avatarType: 'icon',
    avatarValue: 'PawnIcon',
    forceProfileUpdate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getAuthErrorMessage(error: any): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/weak-password': 'Password is too weak. Please use at least 8 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'The email or password you entered is incorrect. Please try again.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  };

  return errorMessages[error.code] || error.message || 'Authentication failed. Please try again.';
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

export function checkFirebaseConfig() {
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

export async function updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error("No user is currently signed in.");
    }
    
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error("The current password you entered is incorrect.");
      }
      if (error.code === 'auth/weak-password') {
        throw new Error("The new password is too weak. It must be at least 8 characters long.");
      }
      if (error.code === 'auth/requires-recent-login') {
          throw new Error("This operation is sensitive and requires recent authentication. Please sign out and sign in again before changing your password.");
      }
      console.error("Error updating password:", error);
      throw new Error("An unexpected error occurred while updating the password.");
    }
}

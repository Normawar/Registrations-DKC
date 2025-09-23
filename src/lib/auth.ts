// src/lib/auth.ts - Complete authentication service with React hooks
import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
  AuthError 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';

export class AuthService {
  // Sign up with Firebase Auth and create Firestore profile
  static async signUp(email: string, password: string, profileData: Omit<SponsorProfile, 'email'>) {
    try {
      if (!auth || !db) {
        throw new Error('Firebase services not initialized');
      }

      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore using Auth UID
      const userProfile: SponsorProfile = {
        ...profileData,
        email: email.toLowerCase(),
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      return { user, profile: userProfile };
    } catch (error) {
      console.error('Sign up error:', error);
      throw this.handleAuthError(error as AuthError);
    }
  }

  // Sign in with Firebase Auth and load Firestore profile
  static async signIn(email: string, password: string) {
    try {
      if (!auth || !db) {
        throw new Error('Firebase services not initialized');
      }

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get user profile from Firestore
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!profileDoc.exists()) {
        throw new Error('User profile not found');
      }

      const profile = profileDoc.data() as SponsorProfile;
      return { user, profile };
    } catch (error) {
      console.error('Sign in error:', error);
      throw this.handleAuthError(error as AuthError);
    }
  }

  // Sign out
  static async signOut() {
    try {
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Get current user profile from Firestore
  static async getCurrentUserProfile(uid: string): Promise<SponsorProfile | null> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const profileDoc = await getDoc(doc(db, 'users', uid));
      
      if (!profileDoc.exists()) {
        return null;
      }

      return profileDoc.data() as SponsorProfile;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: User | null, profile: SponsorProfile | null) => void) {
    if (!auth) {
      console.warn('Firebase Auth not initialized');
      return () => {};
    }

    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await this.getCurrentUserProfile(user.uid);
        callback(user, profile);
      } else {
        callback(null, null);
      }
    });
  }

  static async updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error("No user is currently signed in.");
    }
    
    try {
      // Create a credential with the user's email and current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      
      // Re-authenticate the user to confirm their identity
      await reauthenticateWithCredential(user, credential);
      
      // If re-authentication is successful, update the password
      await updatePassword(user, newPassword);
      
    } catch (error: any) {
      // Handle specific errors for re-authentication and password update
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error("The current password you entered is incorrect.");
      }
      if (error.code === 'auth/weak-password') {
        throw new Error("The new password is too weak. It must be at least 6 characters long.");
      }
      if (error.code === 'auth/requires-recent-login') {
          throw new Error("This operation is sensitive and requires recent authentication. Please sign out and sign in again before changing your password.");
      }
      console.error("Error updating password:", error);
      throw new Error("An unexpected error occurred while updating the password.");
    }
  }


  // Handle Firebase Auth errors
  private static handleAuthError(error: AuthError): Error {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return new Error('An account with this email already exists.');
      case 'auth/weak-password':
        return new Error('Password is too weak. Please choose a stronger password.');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return new Error('Invalid email or password.');
      case 'auth/invalid-email':
        return new Error('Please enter a valid email address.');
      case 'auth/too-many-requests':
        return new Error('Too many failed attempts. Please try again later.');
      default:
        return new Error('An error occurred during authentication. Please try again.');
    }
  }
}

// Export auth state hook for React components
export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged((user, profile) => {
      setUser(user);
      setProfile(profile);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, profile, loading };
}

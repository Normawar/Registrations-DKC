
// src/lib/simple-auth.ts - Simplified authentication with better error handling
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
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
    
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');
    const authInstance = getAuth();
    let user: User;

    // Handle special test user cases
    const lowerCaseEmail = email.toLowerCase().trim(); // Also trim here
    if (lowerCaseEmail.startsWith('test')) {
        try {
            // Use cleaned email consistently
            const userCredential = await signInWithEmailAndPassword(authInstance, lowerCaseEmail, password.trim());
            user = userCredential.user;
            console.log(`✅ Test user ${lowerCaseEmail} already exists, signed in.`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                // Use cleaned email consistently
                const userCredential = await createUserWithEmailAndPassword(authInstance, lowerCaseEmail, password.trim());
                user = userCredential.user;
                console.log(`✅ Test user ${lowerCaseEmail} created successfully.`);
            } else {
                throw error; // Re-throw other sign-in errors
            }
        }
        
        let testProfile: SponsorProfile;

        switch (lowerCaseEmail) {
            case 'test@test.com':
                testProfile = {
                    uid: user.uid, email: 'test@test.com', firstName: 'Test', lastName: 'Sponsor',
                    role: 'sponsor', district: 'Test', school: 'Test', phone: '555-555-5555',
                    avatarType: 'icon', avatarValue: 'RookIcon', forceProfileUpdate: false,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                };
                break;
            case 'testds@test.com':
                testProfile = {
                    uid: user.uid, email: 'testds@test.com', firstName: 'Test', lastName: 'DS',
                    role: 'sponsor', district: 'Test', school: 'Test', phone: '555-555-5555',
                    isDistrictCoordinator: true, avatarType: 'icon', avatarValue: 'QueenIcon',
                    forceProfileUpdate: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                };
                break;
            case 'testdist@test.com':
                 testProfile = {
                    uid: user.uid, email: 'testdist@test.com', firstName: 'Test', lastName: 'District',
                    role: 'district_coordinator', district: 'Test', school: 'All Schools', phone: '555-555-5555',
                    isDistrictCoordinator: true, avatarType: 'icon', avatarValue: 'KingIcon',
                    forceProfileUpdate: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                };
                break;
            default:
                throw new Error("Unknown test user email");
        }

        await setDoc(doc(db, 'users', user.uid), testProfile, { merge: true });
        console.log(`✅ Test user profile for ${email} created/updated.`);
        return { success: true, user, profile: testProfile };
    }
    
    console.log('📧 Creating user with email:', email);

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

// Enhanced simpleSignIn function with better debugging and input validation
export async function simpleSignIn(email: string, password: string) {
  console.log('🚀 Starting signin process...');
  
  try {
    if (!auth || !db) throw new Error('Firebase services not available.');
    
    console.log('✅ Firebase services available');
    
    // Clean and validate inputs
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    console.log('🔍 Debug info:');
    console.log('  - Original email:', `"${email}"`);
    console.log('  - Cleaned email:', `"${cleanEmail}"`);
    console.log('  - Email length:', cleanEmail.length);
    console.log('  - Password length:', cleanPassword.length);
    console.log('  - Has whitespace in original email:', email !== email.trim());
    console.log('  - Email format looks valid:', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
    
    // Basic validation
    if (!cleanEmail) {
      throw new Error('Email is required');
    }
    if (!cleanPassword) {
      throw new Error('Password is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address');
    }

    console.log('📧 Attempting to sign in with:', cleanEmail);

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, getDoc, setDoc, writeBatch } = await import('firebase/firestore');

    // Attempt sign in with cleaned credentials
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    const user = userCredential.user;
    console.log('✅ User signed in with UID:', user.uid);
    console.log('✅ User email from auth:', user.email);

    const profileDocRef = doc(db, 'users', user.uid);
    let profileDoc = await getDoc(profileDocRef);

    if (!profileDoc.exists()) {
      console.warn('⚠️ User profile not found under UID, checking for legacy doc using email...');
      const legacyDocRef = doc(db, 'users', cleanEmail);
      const legacyDoc = await getDoc(legacyDocRef);
      
      if (legacyDoc.exists()) {
        console.log('📦 Found legacy profile, migrating...');
        const legacyData = legacyDoc.data();
        const profileToSave: SponsorProfile = {
          ...(legacyData as Omit<SponsorProfile, 'uid' | 'email'>),
          email: cleanEmail,
          uid: user.uid,
          migratedAt: new Date().toISOString(),
          forceProfileUpdate: true, // Force user to review their profile
        };
        
        // Create the new document with the UID and delete the old one
        const batch = writeBatch(db);
        batch.set(profileDocRef, profileToSave);
        batch.delete(legacyDocRef);
        await batch.commit();

        console.log('✅ Legacy profile migrated successfully.');

        // Re-fetch the profile to ensure consistency
        profileDoc = await getDoc(profileDocRef);

      } else {
        // If no legacy doc, this is an orphaned auth user. Force profile creation.
        console.error("❌ No profile found under UID or legacy email. Creating minimal profile.");
        const forcedProfile: SponsorProfile = {
            uid: user.uid,
            email: user.email || cleanEmail,
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
        await setDoc(profileDocRef, forcedProfile);
        profileDoc = await getDoc(profileDocRef);
        console.log('✅ Created minimal profile for orphaned auth user');
      }
    }
    
    console.log('✅ User profile loaded successfully');
    const profileData = profileDoc.data() as SponsorProfile;
    
    // Update the last login timestamp
    await setDoc(profileDocRef, {
      ...profileData,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    return { success: true, user, profile: profileData };

  } catch (error: any) {
    console.error('❌ Signin failed:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    let userFriendlyMessage = 'An error occurred during login.';
    
    switch (error.code) {
      case 'auth/invalid-credential':
        userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
        break;
      case 'auth/user-not-found':
        userFriendlyMessage = 'No account found with this email address. Please check your email or sign up for a new account.';
        break;
      case 'auth/wrong-password':
        userFriendlyMessage = 'Incorrect password. Please try again or use the "Forgot Password" link.';
        break;
      case 'auth/invalid-email':
        userFriendlyMessage = 'Please enter a valid email address.';
        break;
      case 'auth/user-disabled':
        userFriendlyMessage = 'This account has been disabled. Please contact support.';
        break;
      case 'auth/too-many-requests':
        userFriendlyMessage = 'Too many failed login attempts. Please try again later or reset your password.';
        break;
      case 'auth/network-request-failed':
        userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
        break;
      case 'auth/popup-closed-by-user':
        userFriendlyMessage = 'Sign-in was cancelled. Please try again.';
        break;
      case 'auth/cancelled-popup-request':
        userFriendlyMessage = 'Another sign-in popup is already open.';
        break;
      default:
        // For debugging: include the original error code and message
        userFriendlyMessage = error.message || `Authentication failed (${error.code || 'unknown'})`;
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

// Add this temporary debugging function to your simple-auth.ts file
export async function debugAuthIssue(email: string, password: string) {
  console.log('🔍 DEBUG: Starting authentication debug...');
  
  // Log all the inputs
  console.log('📝 Input Analysis:');
  console.log('  Email (raw):', JSON.stringify(email));
  console.log('  Email length:', email.length);
  console.log('  Email has spaces:', email.includes(' '));
  console.log('  Email trimmed:', JSON.stringify(email.trim()));
  console.log('  Email lowercase:', JSON.stringify(email.trim().toLowerCase()));
  console.log('  Password length:', password.length);
  console.log('  Password has spaces at start/end:', password !== password.trim());
  
  // Check Firebase config
  console.log('🔧 Firebase Config Check:');
  console.log('  Auth instance:', !!auth);
  console.log('  DB instance:', !!db);
  console.log('  Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.log('  Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  
  // Test with Firebase directly
  try {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    console.log('🧪 Testing Firebase Auth directly...');
    console.log('  Using email:', cleanEmail);
    console.log('  Using password length:', cleanPassword.length);
    
    const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    console.log('✅ Firebase Auth SUCCESS:', result.user.uid);
    return { success: true, uid: result.user.uid };
    
  } catch (error: any) {
    console.error('❌ Firebase Auth FAILED:', error.code, error.message);
    
    // Try to get more details about the error
    if (error.code === 'auth/invalid-credential') {
      console.log('🔍 Invalid credential details:');
      console.log('  This usually means:');
      console.log('  1. Wrong email/password combination');
      console.log('  2. Account doesn\'t exist');
      console.log('  3. Account was disabled');
      console.log('  4. Password was changed elsewhere');
      
      // Try to check if the user exists (this will also fail but might give different error)
      try {
        const { fetchSignInMethodsForEmail } = await import('firebase/auth');
        const methods = await fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
        console.log('📧 Sign-in methods for this email:', methods);
      } catch (methodError: any) {
        console.log('📧 Could not fetch sign-in methods:', methodError.code);
      }
    }
    
    return { success: false, error: error.code, message: error.message };
  }
}

// Quick test function for your test accounts
export async function testKnownAccounts() {
  console.log('🧪 Testing known test accounts...');
  
  const testAccounts = [
    { email: 'test@test.com', password: 'testpassword' },
    { email: 'testds@test.com', password: 'testpassword' },
    { email: 'testdist@test.com', password: 'testpassword' }
  ];
  
  for (const account of testAccounts) {
    console.log(`\n🔍 Testing ${account.email}...`);
    try {
      const result = await debugAuthIssue(account.email, account.password);
      console.log(`✅ ${account.email}:`, result.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log(`❌ ${account.email}: ERROR -`, error);
    }
  }
}

// Alternative sign-in function that bypasses your custom logic
export async function directFirebaseSignIn(email: string, password: string) {
  try {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password.trim());
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('Direct Firebase sign-in failed:', error);
    throw error;
  }
}

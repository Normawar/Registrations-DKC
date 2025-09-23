
// FIXED VERSION: Refactored to prevent recursion and handle zombie auth users

import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, type User, getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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

// FIXED: `simpleSignUp` now correctly handles zombie users
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
      // Try to create the user first
      const userCredential = await createUserWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
      user = userCredential.user;
      console.log('✅ New user created with UID:', user.uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`⚠️ Email ${normalizedEmail} exists in Auth. Attempting to sign in and repair profile.`);
        try {
          // If email exists, try to sign in. This confirms ownership.
          const userCredential = await signInWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
          user = userCredential.user;
          console.log(`✅ Existing user ${normalizedEmail} signed in. Checking for missing profile.`);
          // If sign-in succeeds, it means they are the owner but might be missing a Firestore profile.
        } catch (signInError: any) {
          // If sign-in fails, it means email is taken AND password is wrong.
          console.error('❌ Sign-in attempt failed for existing email:', signInError);
          throw new Error('An account with this email already exists and the password provided is incorrect.');
        }
      } else {
        // For other creation errors (weak password, etc.), re-throw
        throw error;
      }
    }

    // Create or update profile
    const userProfile: SponsorProfile = {
      ...userData,
      email: normalizedEmail,
      uid: user.uid,
      createdAt: new Date().toISOString(), // Always set createdAt for a new user
      updatedAt: new Date().toISOString(),
    };

    // Use setDoc with merge to either create or overwrite the profile, fixing "zombie" accounts
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


// FIXED: Simplified signin function. Removed on-the-fly test account creation.
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

    // Update last login
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

// Helper functions to reduce complexity
function isTestAccount(email: string): boolean {
  return email.startsWith('test') || 
         email === 'sandra.ojeda@psjaisd.us' || 
         email === 'noemi.cuello@psjaisd.us';
}

function getTestAccountProfile(email: string): Partial<SponsorProfile> | null {
  const testProfiles: Record<string, Partial<SponsorProfile>> = {
    'sandra.ojeda@psjaisd.us': {
      firstName: 'Sandra',
      lastName: 'Ojeda',
      role: 'district_coordinator',
      district: 'PHARR-SAN JUAN-ALAMO ISD',
      school: 'All Schools',
      phone: '555-555-5555',
      isDistrictCoordinator: true,
      avatarType: 'icon',
      avatarValue: 'KingIcon',
    },
    // Add other test profiles...
  };
  
  return testProfiles[email] || null;
}

async function getOrCreateUserProfile(user: User, normalizedEmail: string): Promise<SponsorProfile> {
  try {
    const profileDoc = await getDoc(doc(db, 'users', user.uid));
    let profileData = profileDoc.exists() ? profileDoc.data() as SponsorProfile : null;

    // Apply corrections if needed
    profileData = applyProfileCorrections(profileData, user, normalizedEmail);

    if (!profileData) {
      const testProfileData = getTestAccountProfile(normalizedEmail);
      if (testProfileData) {
          profileData = {
              uid: user.uid,
              email: normalizedEmail,
              ...testProfileData,
          } as SponsorProfile;
      } else {
          profileData = createFallbackProfile(user, normalizedEmail);
      }
      await setDoc(doc(db, 'users', user.uid), profileData);
    }

    return profileData;
  } finally {
  }
}

function applyProfileCorrections(profileData: SponsorProfile | null, user: User, normalizedEmail: string): SponsorProfile | null {
  if (!profileData) return null;

  // Apply specific corrections for known accounts
  if (normalizedEmail === 'norma@dkchess.com') {
    return {
      ...profileData,
      role: 'organizer',
      district: 'All Districts',
      school: 'Dark Knight Chess',
      firstName: 'Norma',
      lastName: 'Guerra-Stueber',
    };
  }

  // Ensure email is always normalized
  if (profileData.email !== normalizedEmail) {
    profileData.email = normalizedEmail;
  }

  return profileData;
}

function createFallbackProfile(user: User, normalizedEmail: string): SponsorProfile {
  return {
    uid: user.uid,
    email: normalizedEmail,
    firstName: 'New',
    lastName: 'User',
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
    'auth/wrong-password': 'Incorrect password.',
    'auth/weak-password': 'Password is too weak. Please use at least 8 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };

  return errorMessages[error.code] || error.message || 'Authentication failed.';
}

// Keep your other utility functions as they are
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

// Functions from auth-debug merged here for simplicity and to avoid circular dependencies.
export function checkFirebaseConfig() {
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

export async function debugSignUp(email: string, password: string) {
  return simpleSignUp(email, password, {
    firstName: 'Debug',
    lastName: 'User',
    role: 'individual',
    district: 'None',
    school: 'Homeschool',
    phone: '',
    avatarType: 'icon',
    avatarValue: 'PawnIcon',
  });
}

export async function debugSignIn(email: string, password: string) {
  return simpleSignIn(email, password);
}

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

export async function createUserByOrganizer(email: string, password: string, profileData: any) {
    console.log(`🔑 Creating user ${email} via organizer flow...`);
    try {
        const result = await simpleSignUp(email, password, {
            ...profileData,
            forceProfileUpdate: true, // New users should complete their profile
        });
        return result;
    } catch (error) {
        console.error('❌ Organizer user creation failed:', error);
        throw error;
    }
}

export async function testKnownAccounts() {
  console.log('🧪 Testing known test accounts...');
  
  const testAccounts = [
    { email: 'test@test.com', password: 'testpassword' },
    { email: 'testds@test.com', password: 'testpassword' },
    { email: 'testdist@test.com', password: '1Disttester' },
    { email: 'testmcallen@test.com', password: 'testpassword' },
    { email: 'testecisd@test.com', password: 'testpassword' },
    { email: 'testshary@test.com', password: 'testpassword' },
    { email: 'sandra.ojeda@psjaisd.us', password: 'password' },
    { email: 'noemi.cuello@psjaisd.us', password: 'password' },
  ];
  
  for (const account of testAccounts) {
    console.log(`\n🔍 Testing ${account.email}...`);
    try {
      const result = await simpleSignIn(account.email, account.password);
      console.log(`✅ ${account.email}:`, result.success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log(`❌ ${account.email}: ERROR -`, error);
    }
  }
}

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


// Helper function to correct organizer account data
export async function correctOrganizerAccountData(email: string, password: string) {
  try {
      console.log('🔧 Attempting to correct organizer account data for:', email);
    
      // First, try to sign in to get the user's UID
      const signInResult = await simpleSignIn(email, password);
      
      if (signInResult.success && signInResult.user) {
        const uid = signInResult.user.uid;
        console.log('✅ Successfully signed in, UID:', uid);
        
        // Now update the user's profile in Firestore with correct organizer data
        const userDocRef = doc(db, 'users', uid);
        const correctedProfile: Partial<SponsorProfile> & {correctedAt?: string} = {
          role: 'organizer',
          isDistrictCoordinator: false, // Organizers are not district coordinators
          district: 'All Districts', // Organizers can manage all districts
          school: 'Dark Knight Chess', // Organization name
          updatedAt: new Date().toISOString(),
          correctedAt: new Date().toISOString(), // Mark when this correction happened
        };
        
        await setDoc(userDocRef, correctedProfile, { merge: true });
        console.log('✅ Profile corrected successfully');
        
        // Return the corrected profile
        const updatedProfile = { ...signInResult.profile, ...correctedProfile };
        return {
          success: true,
          user: signInResult.user,
          profile: updatedProfile
        };
      }
      
      throw new Error('Failed to sign in for data correction');
  } catch (error) {
    console.error('❌ Data correction failed:', error);
    throw error;
  } finally {
  }
}

    
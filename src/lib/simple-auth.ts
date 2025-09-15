
// src/lib/simple-auth.ts - Simplified authentication with better error handling

import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, type User } from 'firebase/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';

// src/lib/email-utils.ts - Utility functions for case-insensitive email handling
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

// Updated authentication functions with consistent case-insensitive handling

// Enhanced simpleSignUp with case-insensitive email handling
export async function simpleSignUp(email: string, password: string, userData: Omit<SponsorProfile, 'uid' | 'email'>) {
  console.log('🚀 Starting signup process...');
  
  try {
    if (!auth || !db) {
      throw new Error('Firebase services not available.');
    }

    // ALWAYS normalize email first
    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = password.trim();
    
    console.log(`Original email: "${email}"`);
    console.log(`Normalized email: "${normalizedEmail}"`);
    
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }

    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');
    const authInstance = getAuth();
    let user: User;

    // Special handling for the main organizer account
    if (normalizedEmail === 'norma@dkchess.com') {
      try {
        const userCredential = await signInWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
        user = userCredential.user;
        console.log(`✅ Main organizer ${normalizedEmail} already exists, signed in.`);
      } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
          const userCredential = await createUserWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
          user = userCredential.user;
          console.log(`✅ Main organizer ${normalizedEmail} created successfully.`);
        } else {
          throw error;
        }
      }
      
      const organizerProfile: SponsorProfile = {
        uid: user.uid, 
        email: normalizedEmail,
        firstName: 'Norma', 
        lastName: 'Guerra-Stueber',
        role: 'organizer', 
        district: 'All Districts', 
        school: 'Dark Knight Chess', 
        phone: '956-393-8875',
        isDistrictCoordinator: true,
        avatarType: 'icon', 
        avatarValue: 'KingIcon',
        forceProfileUpdate: false, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'users', user.uid), organizerProfile, { merge: true });
      console.log(`✅ Main organizer profile for ${normalizedEmail} created/updated.`);
      return { success: true, user, profile: organizerProfile };
    }
    
    // Handle special test user cases with normalized email
    if (normalizedEmail.startsWith('test')) {
        let userCredential;
        try {
            // Attempt to sign in first to check if the auth user exists.
            userCredential = await signInWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
            user = userCredential.user;
            console.log(`✅ Test user ${normalizedEmail} already exists, signed in.`);
        } catch (error: any) {
            // If user does not exist, create them.
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
                console.log(`⚠️ Test user ${normalizedEmail} does not exist, creating...`);
                userCredential = await createUserWithEmailAndPassword(authInstance, normalizedEmail, trimmedPassword);
                user = userCredential.user;
                console.log(`✅ Test user ${normalizedEmail} created successfully.`);
            } else {
                // For other errors (wrong password, etc.), re-throw.
                throw error;
            }
        }
        
        let testProfile: SponsorProfile;

        switch (normalizedEmail) {
            case 'test@test.com':
                testProfile = {
                    uid: user.uid, 
                    email: normalizedEmail, // Use normalized email
                    firstName: 'Test', 
                    lastName: 'Sponsor',
                    role: 'sponsor', 
                    district: 'Test', 
                    school: 'Test', 
                    phone: '555-555-5555',
                    avatarType: 'icon', 
                    avatarValue: 'RookIcon', 
                    forceProfileUpdate: false,
                    createdAt: new Date().toISOString(), 
                    updatedAt: new Date().toISOString(),
                };
                break;
            case 'testds@test.com':
                testProfile = {
                    uid: user.uid, 
                    email: normalizedEmail, // Use normalized email
                    firstName: 'Test', 
                    lastName: 'DS',
                    role: 'sponsor', 
                    district: 'Test', 
                    school: 'Test', 
                    phone: '555-555-5555',
                    isDistrictCoordinator: true, 
                    avatarType: 'icon', 
                    avatarValue: 'QueenIcon',
                    forceProfileUpdate: false, 
                    createdAt: new Date().toISOString(), 
                    updatedAt: new Date().toISOString(),
                };
                break;
            case 'testdist@test.com':
                 testProfile = {
                    uid: user.uid, 
                    email: normalizedEmail, // Use normalized email
                    firstName: 'Test', 
                    lastName: 'District',
                    role: 'district_coordinator', 
                    district: 'Test', 
                    school: 'All Schools', 
                    phone: '555-555-5555',
                    isDistrictCoordinator: true, 
                    avatarType: 'icon', 
                    avatarValue: 'KingIcon',
                    forceProfileUpdate: false, 
                    createdAt: new Date().toISOString(), 
                    updatedAt: new Date().toISOString(),
                };
                break;
            case 'testmcallen@test.com':
                 testProfile = {
                    uid: user.uid, 
                    email: normalizedEmail,
                    firstName: 'Test', 
                    lastName: 'McAllen',
                    role: 'sponsor', 
                    district: 'TestMcAllen', 
                    school: 'TestMcAllen', 
                    phone: '555-555-5555',
                    isDistrictCoordinator: false, 
                    avatarType: 'icon', 
                    avatarValue: 'PawnIcon',
                    forceProfileUpdate: false, 
                    createdAt: new Date().toISOString(), 
                    updatedAt: new Date().toISOString(),
                };
                break;
            default:
                throw new Error("Unknown test user email");
        }

        await setDoc(doc(db, 'users', user.uid), testProfile, { merge: true });
        console.log(`✅ Test user profile for ${normalizedEmail} created/updated.`);
        return { success: true, user, profile: testProfile };
    }
    
    console.log('📧 Creating user with email:', normalizedEmail);

    let userCredential;
    let isExistingUser = false;
    try {
      // Create the user with normalized email
      userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
      console.log('✅ User created with UID:', userCredential.user.uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        isExistingUser = true;
        console.log('⚠️ Auth user already exists, attempting to sign in to restore profile.');
        userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
        console.log('✅ Existing user signed in with UID:', userCredential.user.uid);
      } else {
        throw error;
      }
    }

    // Save user profile to Firestore with normalized email
    const userProfile: SponsorProfile = {
      ...userData,
      email: normalizedEmail, // Always use normalized email
      uid: userCredential.user.uid,
      ...(isExistingUser ? {} : { createdAt: new Date().toISOString() }),
      updatedAt: new Date().toISOString(),
    };

    console.log('💾 Saving user profile to Firestore...');
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile, { merge: true });
    console.log('✅ User profile saved successfully');

    return {
      success: true,
      user: userCredential.user,
      profile: userProfile
    };

  } catch (error: any) {
    console.error('❌ Signup failed:', error);
    
    let userFriendlyMessage = 'An error occurred while creating your account.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
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

// Enhanced simpleSignIn with case-insensitive email handling
export async function simpleSignIn(email: string, password: string) {
  console.log('🚀 Starting signin process...');
  
  try {
    if (!auth || !db) throw new Error('Firebase services not available.');
    
    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = password.trim();
    
    console.log(`Normalized email for sign-in: "${normalizedEmail}"`);
    
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, getDoc, setDoc, writeBatch } = await import('firebase/firestore');

    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
    const user = userCredential.user;
    console.log('✅ User signed in with UID:', user.uid);

    const profileDocRef = doc(db, 'users', user.uid);
    let profileDoc = await getDoc(profileDocRef);
    let profileData = profileDoc.exists() ? profileDoc.data() as SponsorProfile : null;

    // **FORCEFUL CORRECTION BLOCK FOR ORGANIZER**
    // If the user is the main organizer, ensure their profile is always correct.
    if (normalizedEmail === 'norma@dkchess.com') {
      console.log('👑 Organizer login detected. Verifying profile...');
      const correctOrganizerProfile: SponsorProfile = {
        uid: user.uid, 
        email: normalizedEmail,
        firstName: 'Norma', 
        lastName: 'Guerra-Stueber',
        role: 'organizer', 
        district: 'All Districts', 
        school: 'Dark Knight Chess', 
        phone: '956-393-8875',
        isDistrictCoordinator: true,
        avatarType: 'icon', 
        avatarValue: 'KingIcon',
        forceProfileUpdate: false,
        createdAt: profileData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check if the current profile is incorrect and needs to be overwritten.
      const isIncorrect = !profileData || 
                            profileData.firstName !== 'Norma' || 
                            profileData.role !== 'organizer' ||
                            profileData.school !== 'Dark Knight Chess';
      
      if (isIncorrect) {
        console.warn('⚠️ DETECTED INCORRECT PROFILE FOR ORGANIZER. FORCIBLY CORRECTING.');
        await setDoc(profileDocRef, correctOrganizerProfile, { merge: true });
        profileData = correctOrganizerProfile;
        console.log('✅ Forcibly corrected profile for norma@dkchess.com.');
      } else {
        console.log('✅ Organizer profile is correct.');
      }
    }
    
    // **FORCEFUL CORRECTION BLOCK FOR TESTMCALLEN**
    // If the user is a known test user and their profile data is incorrect, overwrite it.
    if (normalizedEmail === 'testmcallen@test.com' && (!profileData || profileData.school !== 'TestMcAllen')) {
        console.warn('⚠️ DETECTED INCORRECT PROFILE FOR testmcallen@test.com. FORCIBLY CORRECTING.');
        const correctedProfile: SponsorProfile = {
            uid: user.uid, 
            email: normalizedEmail,
            firstName: 'Test', 
            lastName: 'McAllen',
            role: 'sponsor', 
            district: 'TestMcAllen', 
            school: 'TestMcAllen', 
            phone: '555-555-5555',
            isDistrictCoordinator: false, 
            avatarType: 'icon', 
            avatarValue: 'PawnIcon',
            forceProfileUpdate: false, 
            createdAt: profileData?.createdAt || new Date().toISOString(), 
            updatedAt: new Date().toISOString(),
        };
        await setDoc(profileDocRef, correctedProfile, { merge: true });
        profileData = correctedProfile;
        console.log('✅ Forcibly corrected profile for testmcallen@test.com.');
    }


    if (!profileData) {
      console.error("❌ No profile found under UID. This indicates an orphaned auth account.");
      const forcedProfile: SponsorProfile = {
          uid: user.uid,
          email: user.email || normalizedEmail,
          firstName: 'New',
          lastName: 'User',
          role: 'individual', // Default to least privileged role
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
      profileData = forcedProfile;
      console.log(`✅ Created minimal fallback profile for orphaned auth user.`);
    }
    
    // Ensure the profile email in the DB is always the correct normalized version
    if (profileData.email !== normalizedEmail) {
      console.log(`🔄 Updating profile email from "${profileData.email}" to "${normalizedEmail}"`);
      profileData.email = normalizedEmail;
    }
    
    await setDoc(profileDocRef, {
      ...profileData,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true, user, profile: profileData };

  } catch (error: any) {
    console.error('❌ Signin failed:', error);
    let userFriendlyMessage = 'An error occurred during login.';
    
    switch (error.code) {
      case 'auth/invalid-credential':
        userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
        break;
      // ... other error cases
      default:
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

// Quick test function for your test accounts
export async function testKnownAccounts() {
  console.log('🧪 Testing known test accounts...');
  
  const testAccounts = [
    { email: 'test@test.com', password: 'testpassword' },
    { email: 'testds@test.com', password: 'testpassword' },
    { email: 'testdist@test.com', password: '1Disttester' },
    { email: 'testmcallen@test.com', password: 'testpassword' }
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

// Helper function to correct organizer account data
export async function correctOrganizerAccountData(email: string, password: string) {
  console.log('🔧 Attempting to correct organizer account data for:', email);
  
  try {
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
  }
}

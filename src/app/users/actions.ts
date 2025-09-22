
'use server';

import { auth as adminAuth } from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { auth as clientAuth, db as clientDb } from '@/lib/firebase'; // Renamed to avoid conflict

// --- Admin SDK Initialization ---
// This needs to be secure and should only run on the server.
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: "chessmate-w17oa",
        clientEmail: "firebase-adminsdk-fbsvc@chessmate-w17oa.iam.gserviceaccount.com",
        // The private key is sensitive and stored securely.
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
      projectId: "chessmate-w17oa",
    });
    console.log('Firebase Admin SDK initialized successfully for user actions.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
}

const adminDb = getFirestore();

/**
 * Deletes a user from Firebase Authentication using the Admin SDK.
 * THIS IS A DESTRUCTIVE SERVER-SIDE ACTION.
 */
export async function deleteAuthUserByEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const userRecord = await adminAuth().getUserByEmail(email);
    await adminAuth().deleteUser(userRecord.uid);
    console.log(`Successfully deleted auth user: ${email} (UID: ${userRecord.uid})`);
    return { success: true, message: `Successfully deleted authentication entry for ${email}.` };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log(`No auth user found for ${email}. Nothing to delete.`);
      return { success: true, message: `No auth entry found for ${email}, which is okay.` };
    }
    console.error(`Error deleting auth user ${email}:`, error);
    return { success: false, message: `Failed to delete auth user ${email}: ${error.message}` };
  }
}


// Standalone function for organizer to create users
export async function createUserByOrganizer(
  email: string, 
  password: string, 
  profileData: Partial<SponsorProfile>
): Promise<{ success: true; user: any; profile: SponsorProfile }> {
  
  console.log('🔑 Organizer creating user:', email);
  
  if (!clientAuth || !clientDb) {
    throw new Error('Firebase services not available.');
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();
  
  // Basic validation
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  
  if (trimmedPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  
  try {
    console.log('Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(clientAuth, normalizedEmail, trimmedPassword);
    const newUser = userCredential.user;
    console.log('✅ Auth user created with UID:', newUser.uid);
    
    const now = new Date().toISOString();
    const profile: SponsorProfile = {
      uid: newUser.uid,
      email: normalizedEmail,
      firstName: profileData.firstName || 'New',
      lastName: profileData.lastName || 'User',
      role: profileData.role || 'individual',
      district: profileData.district || 'None',
      school: profileData.school || 'Homeschool',
      phone: profileData.phone || '',
      isDistrictCoordinator: profileData.isDistrictCoordinator || false,
      avatarType: profileData.avatarType || 'icon',
      avatarValue: profileData.avatarValue || 'PawnIcon',
      forceProfileUpdate: true,
      createdAt: now,
      updatedAt: now,
    };
    
    console.log('Saving user profile...');
    await setDoc(doc(clientDb, 'users', newUser.uid), profile);
    console.log('✅ User profile saved successfully');
    
    console.log('✅ Organizer user creation completed for:', normalizedEmail);
    return {
      success: true,
      user: newUser,
      profile
    };
    
  } catch (error: any) {
    console.error('❌ Organizer user creation failed:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`A user with email ${normalizedEmail} already exists.`);
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to create user account.');
    }
  }
}

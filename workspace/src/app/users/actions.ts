
'use server';

import { adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { UserRecord } from 'firebase-admin/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';

/**
 * Server action to fetch all users from Firestore
 * Replaces direct client-side Firestore access
 */
export async function fetchUsersAction(): Promise<{
  users: Array<{
    email: string;
    role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
    firstName?: string;
    lastName?: string;
    school?: string;
    district?: string;
    isDistrictCoordinator?: boolean;
    isOrganizer?: boolean;
    phone?: string;
    bookkeeperEmail?: string;
    gtCoordinatorEmail?: string;
  }>;
  error?: string;
}> {
  try {
    // Ensure admin SDK is initialized before using
    if (!adminDb) {
      throw new Error("Firestore Admin SDK is not initialized.");
    }
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.get();
    
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        email: data.email || '',
        role: data.role || 'sponsor',
        firstName: data.firstName,
        lastName: data.lastName,
        school: data.school,
        district: data.district,
        isDistrictCoordinator: data.isDistrictCoordinator,
        isOrganizer: data.isOrganizer,
        phone: data.phone,
        bookkeeperEmail: data.bookkeeperEmail,
        gtCoordinatorEmail: data.gtCoordinatorEmail,
      };
    });
    
    return { users };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { 
      users: [], 
      error: 'Failed to fetch users from database' 
    };
  }
}

/**
 * Server action to update a user's information
 * Replaces direct client-side Firestore writes
 */
export async function updateUserAction(
  originalEmail: string,
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
    isDistrictCoordinator?: boolean;
    school?: string;
    district?: string;
    phone?: string;
    bookkeeperEmail?: string;
    gtCoordinatorEmail?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb || !adminAuth) {
      throw new Error("Firebase Admin SDK is not initialized.");
    }
    // Find the user document by email
    const usersRef = adminDb.collection('users');
    const userRecord = await adminAuth.getUserByEmail(originalEmail);
    const docRef = usersRef.doc(userRecord.uid);
    
    await docRef.update({
      ...userData,
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { 
      success: false, 
      error: 'Failed to update user in database' 
    };
  }
}


/**
 * Server action to create a new user in Firebase Auth and Firestore.
 * This now uses the Admin SDK as required for server-side operations.
 */
export async function createUserAction(
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
    isDistrictCoordinator?: boolean;
    school?: string;
    district?: string;
    phone?: string;
    bookkeeperEmail?: string;
    gtCoordinatorEmail?: string;
  },
  tempPassword?: string
): Promise<{ success: boolean; error?: string; tempPassword?: string }> {
  const { email, ...profileData } = userData;

  if (!email || !tempPassword) {
    return { success: false, error: 'Email and temporary password are required.' };
  }

  try {
    if (!adminAuth || !adminDb) {
      throw new Error('Firebase Admin SDK not initialized.');
    }
    
    const userRecord = await adminAuth.createUser({
      email,
      password: tempPassword,
      emailVerified: true,
      displayName: `${profileData.firstName} ${profileData.lastName}`,
    });

    const newProfile: Omit<SponsorProfile, 'uid'> = {
      ...profileData,
      email: userRecord.email!,
      role: profileData.role,
      isDistrictCoordinator: profileData.isDistrictCoordinator,
      avatarType: 'icon',
      avatarValue: 'PawnIcon',
      forceProfileUpdate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('users').doc(userRecord.uid).set(newProfile);

    return { success: true, tempPassword };
  } catch (error: any) {
    console.error('Error creating user with Admin SDK:', error);
    let message = 'Failed to create user.';
    if (error.code === 'auth/email-already-exists') {
      message = 'This email address is already in use by an existing account.';
    } else if (error.code === 'auth/invalid-password') {
      message = 'The temporary password must be at least 6 characters long.';
    }
    return { success: false, error: message };
  }
}


/**
 * Server action to permanently delete users from both Firestore and Firebase Authentication.
 * This is a protected action intended for organizers.
 * This version is corrected to properly handle deletion from both services.
 */
export async function forceDeleteUsersAction(emails: string[]): Promise<{ 
  deleted: string[], 
  failed: { email: string, reason: string }[] 
}> {
  console.log('Starting force delete for emails:', emails);
  
  if (!emails || emails.length === 0) {
    return { deleted: [], failed: [] };
  }
  
  const deletedEmails: string[] = [];
  const failedDeletions: { email: string, reason: string }[] = [];

  for (const email of emails) {
    let uid: string | null = null;
    try {
      if (!adminAuth || !adminDb) {
        throw new Error("Firebase Admin SDK is not initialized.");
      }
      console.log(`Processing deletion for: ${email}`);
      
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`Found user in Auth with UID: ${uid}`);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          console.log(`User ${email} not found in Firebase Auth. Will attempt Firestore cleanup only.`);
        } else {
          throw new Error(`Firebase Auth error: ${authError.message || JSON.stringify(authError)}`);
        }
      }

      if (uid) {
        try {
          await adminAuth.deleteUser(uid);
          console.log(`Deleted ${email} from Firebase Auth (UID: ${uid})`);
        } catch (deleteError: any) {
          console.error(`Failed to delete user from Auth: ${deleteError.message}`);
          failedDeletions.push({ email, reason: `Auth Deletion Failed: ${deleteError.message}` });
        }
      }

      let firestoreDeleted = false;
      if (uid) {
        const userDocRef = adminDb.collection('users').doc(uid);
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
          await userDocRef.delete();
          console.log(`Deleted ${email} from Firestore by UID.`);
          firestoreDeleted = true;
        }
      }
      
      if (!firestoreDeleted) {
        const usersQuery = adminDb.collection('users').where('email', '==', email);
        const querySnapshot = await usersQuery.get();
        
        if (!querySnapshot.empty) {
          const batch = adminDb.batch();
          querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log(`Deleted ${querySnapshot.size} document(s) for ${email} by email field query.`);
          firestoreDeleted = true;
        }
      }

      if (uid || firestoreDeleted) {
        if(!deletedEmails.includes(email)){
          deletedEmails.push(email);
        }
        console.log(`Successfully processed deletion for: ${email}`);
      } else {
        if (!failedDeletions.some(f => f.email === email)) {
          failedDeletions.push({ 
            email, 
            reason: 'User not found in Auth or Firestore.' 
          });
        }
        console.log(`Failed to find/delete: ${email}`);
      }
      
    } catch (error: any) {
      console.error(`Unexpected error deleting ${email}:`, error);
      if (!failedDeletions.some(f => f.email === email)) {
        failedDeletions.push({ 
          email, 
          reason: error.message || 'Unknown error' 
        });
      }
    }
  }

  console.log('Deletion complete. Results:', { deleted: deletedEmails, failed: failedDeletions });
  return { deleted: deletedEmails, failed: failedDeletions };
}

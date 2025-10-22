
'use server';

import { adminAuth, db } from '@/lib/firebase-admin';
import { UserRecord } from 'firebase-admin/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { simpleSignUp } from '@/lib/simple-auth';

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
    const adminDb = db;
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
    const adminDb = db;
    const adminAuth = adminAuth;
    const userRecord = await adminAuth.getUserByEmail(originalEmail);
    const docRef = adminDb.collection('users').doc(userRecord.uid);
    
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

  // Delegate user creation to simpleSignUp to ensure consistent logic
  // This approach is not ideal as it calls a client-SDK-dependent function from the server,
  // but it's a temporary workaround to the problem of inconsistent user creation.
  // The correct long-term fix is to use Firebase Admin SDK exclusively here.
  try {
    const result = await simpleSignUp(email, tempPassword, {
      ...profileData,
      role: profileData.role,
      isDistrictCoordinator: profileData.isDistrictCoordinator,
      avatarType: 'icon',
      avatarValue: 'PawnIcon',
      forceProfileUpdate: true,
    });

    if (result.success) {
      return { success: true, tempPassword };
    } else {
      // This path is unlikely given the simpleSignUp implementation
      return { success: false, error: 'Failed to create user account.' };
    }
  } catch (error: any) {
    console.error('Error creating user via simpleSignUp from server action:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}


/**
 * Server action to permanently delete users from both Firestore and Firebase Authentication.
 */
export async function forceDeleteUsersAction(emails: string[]): Promise<{ 
  deleted: string[], 
  failed: { email: string, reason: string }[] 
}> {
  if (!emails || emails.length === 0) {
    return { deleted: [], failed: [] };
  }
  
  const adminDb = db;
  const adminAuth = adminAuth;
  const deletedEmails: string[] = [];
  const failedDeletions: { email: string, reason: string }[] = [];

  for (const email of emails) {
    let uid: string | null = null;
    try {
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

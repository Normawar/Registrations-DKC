
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
    // Find the user document by email
    const usersRef = adminDb.collection('users');
    const querySnapshot = await usersRef.where('email', '==', originalEmail).get();
    
    if (querySnapshot.empty) {
        // Fallback: If UID was used as doc ID, which is the correct pattern now
        try {
            const userRecord = await adminAuth.getUserByEmail(originalEmail);
            const docRef = usersRef.doc(userRecord.uid);
            await docRef.update({ ...userData, updatedAt: new Date().toISOString() });
            return { success: true };
        } catch(e) {
             return { success: false, error: 'User not found in database or auth.' };
        }
    } else {
      // Update the first matching document
      const docRef = querySnapshot.docs[0].ref;
      await docRef.update({
        ...userData,
        updatedAt: new Date().toISOString()
      });
    }
    
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

  try {
    // Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password: tempPassword,
      emailVerified: true, // Mark as verified since an organizer is creating it
      displayName: `${profileData.firstName} ${profileData.lastName}`,
    });

    // Prepare profile data for Firestore
    const newProfile: Omit<SponsorProfile, 'uid'> = {
      ...profileData,
      email: userRecord.email,
      role: profileData.role,
      isDistrictCoordinator: profileData.isDistrictCoordinator,
      avatarType: 'icon',
      avatarValue: 'PawnIcon',
      forceProfileUpdate: true, // Force user to review their profile and change password
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create user document in Firestore with their UID as the document ID
    await adminDb.collection('users').doc(userRecord.uid).set(newProfile);

    return { success: true, tempPassword };
  } catch (error: any) {
    console.error('Error creating user:', error);
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
      console.log(`Processing deletion for: ${email}`);
      
      // Step 1: Find user in Firebase Auth to get their UID.
      // This is the most reliable way to link Auth and Firestore records.
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`Found user in Auth with UID: ${uid}`);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          // User doesn't exist in Auth. This is okay, we'll still try to clean up Firestore.
          console.log(`User ${email} not found in Firebase Auth. Will attempt Firestore cleanup only.`);
        } else {
          // For other auth errors, rethrow to be caught by the outer catch block.
          throw new Error(`Firebase Auth error: ${authError.message || JSON.stringify(authError)}`);
        }
      }

      // Step 2: Delete from Firebase Authentication if UID was found.
      if (uid) {
        try {
          await adminAuth.deleteUser(uid);
          console.log(`Deleted ${email} from Firebase Auth (UID: ${uid})`);
        } catch (deleteError: any) {
          // Log the error but continue, as we still want to try deleting from Firestore.
          console.error(`Failed to delete user from Auth: ${deleteError.message}`);
          failedDeletions.push({ email, reason: `Auth Deletion Failed: ${deleteError.message}` });
          // If we can't delete the auth user, we probably shouldn't proceed.
          // But for cleanup, we'll try Firestore anyway.
        }
      }

      // Step 3: Delete from Firestore.
      let firestoreDeleted = false;
      // Primary method: Delete by UID.
      if (uid) {
        const userDocRef = adminDb.collection('users').doc(uid);
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
          await userDocRef.delete();
          console.log(`Deleted ${email} from Firestore by UID.`);
          firestoreDeleted = true;
        }
      }
      
      // Fallback method: Find by email field if deletion by UID didn't happen.
      // This cleans up records that might not be keyed by UID or if UID wasn't found.
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

      // Step 4: Report success
      // If we could delete from either service, or if the user was not found at all, it's a success for cleanup purposes.
      if (uid || firestoreDeleted) {
        deletedEmails.push(email);
        console.log(`Successfully processed deletion for: ${email}`);
      } else {
        // This case happens if user was not in Auth and not found in Firestore.
        failedDeletions.push({ 
          email, 
          reason: 'User not found in Auth or Firestore.' 
        });
        console.log(`Failed to find/delete: ${email}`);
      }
      
    } catch (error: any) {
      console.error(`Unexpected error deleting ${email}:`, error);
      failedDeletions.push({ 
        email, 
        reason: error.message || 'Unknown error' 
      });
    }
  }

  console.log('Deletion complete. Results:', { deleted: deletedEmails, failed: failedDeletions });
  return { deleted: deletedEmails, failed: failedDeletions };
}

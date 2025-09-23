
'use server';

import { getAuth } from 'firebase-admin/auth';
import { db as adminDb } from '@/lib/firebase-admin';

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
      // Try to find by document ID (some users might have email as ID)
      const docRef = usersRef.doc(originalEmail);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return { 
          success: false, 
          error: 'User not found in database' 
        };
      }
      
      // Update the document
      await docRef.update({
        ...userData,
        updatedAt: new Date().toISOString()
      });
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
 * Server action to permanently delete users from both Firestore and Firebase Authentication.
 * This is a protected action intended for organizers.
 */
export async function forceDeleteUsersAction(emails: string[]): Promise<{ 
  deleted: string[], 
  failed: { email: string, reason: string }[] 
}> {
  console.log('Starting force delete for emails:', emails);
  
  if (!emails || emails.length === 0) {
    return { deleted: [], failed: [] };
  }
  
  const adminAuth = getAuth();
  const deletedEmails: string[] = [];
  const failedDeletions: { email: string, reason: string }[] = [];

  for (const email of emails) {
    try {
      console.log(`Processing deletion for: ${email}`);
      
      // Step 1: Try to find user in Firebase Auth
      let uid: string | null = null;
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`Found user in Auth with UID: ${uid}`);
        
        // Delete from Firebase Authentication
        await adminAuth.deleteUser(uid);
        console.log(`Deleted ${email} from Firebase Auth`);
      } catch (authError: any) {
        console.log(`User ${email} not found in Auth:`, authError.code);
        // Continue to try Firestore deletion even if not in Auth
      }

      // Step 2: Delete from Firestore - try multiple approaches
      let firestoreDeleted = false;
      
      // Try deleting by UID if we have it
      if (uid) {
        try {
          const userDocRef = adminDb.collection('users').doc(uid);
          const docSnap = await userDocRef.get();
          if (docSnap.exists) {
            await userDocRef.delete();
            console.log(`Deleted ${email} from Firestore by UID`);
            firestoreDeleted = true;
          }
        } catch (error) {
          console.log(`Failed to delete by UID:`, error);
        }
      }
      
      // Try deleting by email as document ID (legacy format)
      try {
        const emailDocRef = adminDb.collection('users').doc(email);
        const emailDocSnap = await emailDocRef.get();
        if (emailDocSnap.exists) {
          await emailDocRef.delete();
          console.log(`Deleted ${email} from Firestore by email as ID`);
          firestoreDeleted = true;
        }
      } catch (error) {
        console.log(`Failed to delete by email as ID:`, error);
      }
      
      // Try finding and deleting by email field query
      try {
        const usersQuery = adminDb.collection('users').where('email', '==', email);
        const querySnapshot = await usersQuery.get();
        
        if (!querySnapshot.empty) {
          const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletePromises);
          console.log(`Deleted ${querySnapshot.size} document(s) for ${email} by email query`);
          firestoreDeleted = true;
        }
      } catch (error) {
        console.log(`Failed to delete by email query:`, error);
      }

      if (uid || firestoreDeleted) {
        deletedEmails.push(email);
        console.log(`Successfully processed deletion for: ${email}`);
      } else {
        failedDeletions.push({ 
          email, 
          reason: 'User not found in Auth or Firestore' 
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

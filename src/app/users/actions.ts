
'use server';

import { getAuth } from 'firebase-admin/auth';
import { db } from '@/lib/firebase-admin';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

/**
 * Server action to permanently delete users from both Firestore and Firebase Authentication.
 * This is a protected action intended for organizers.
 */
export async function forceDeleteUsersAction(emails: string[]): Promise<{ deleted: string[], failed: { email: string, reason: string }[] }> {
  if (!emails || emails.length === 0) {
    return { deleted: [], failed: [] };
  }

  const deletedEmails: string[] = [];
  const failedDeletions: { email: string, reason: string }[] = [];

  for (const email of emails) {
    try {
      // Find user by email in Firebase Auth
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;

      // Delete from Firebase Authentication
      await getAuth().deleteUser(uid);
      
      // Delete from Firestore
      const userDocRef = doc(db, 'users', uid);
      await deleteDoc(userDocRef);
      
      // Also try to find and delete any records where the doc ID was the email
      const oldDocRef = doc(db, 'users', email);
      const oldDocSnap = await getDoc(oldDocRef);
      if (oldDocSnap.exists()) {
        await deleteDoc(oldDocRef);
      }

      deletedEmails.push(email);

    } catch (error: any) {
      // Handle cases where the user might only exist in one system
      if (error.code === 'auth/user-not-found') {
        // User not in Auth, try deleting from Firestore by email as ID
        try {
          const oldDocRef = doc(db, 'users', email);
          await deleteDoc(oldDocRef);
          deletedEmails.push(`${email} (Firestore only)`);
        } catch (dbError) {
          failedDeletions.push({ email, reason: `Not in Auth, and failed to delete from Firestore.` });
        }
      } else {
        failedDeletions.push({ email, reason: error.message });
      }
    }
  }

  return { deleted: deletedEmails, failed: failedDeletions };
}

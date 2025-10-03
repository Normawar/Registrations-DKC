// src/scripts/migrate-users.ts - Migration script for existing user data
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface OldUserFormat {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  // ... other fields
}

/**
 * This script helps migrate existing users from email-based document IDs 
 * to Firebase Auth UID-based document IDs
 * 
 * WARNING: Run this carefully in a test environment first!
 * This will create Firebase Auth accounts for existing users.
 */
export async function migrateExistingUsers() {
  if (!db || !auth) {
    throw new Error('Firebase services not initialized');
  }

  console.log('Starting user migration...');
  
  try {
    // Get all existing users from Firestore
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    
    const migrationResults = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const batch = writeBatch(db);
    
    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data() as OldUserFormat;
      const oldDocId = userDoc.id;
      
      try {
        // Check if this document ID is already a UID (28 chars, alphanumeric)
        if (oldDocId.length === 28 && /^[a-zA-Z0-9]+$/.test(oldDocId)) {
          console.log(`Skipping ${userData.email} - already migrated`);
          continue;
        }

        console.log(`Migrating user: ${userData.email}`);

        // Create Firebase Auth account (you may need to handle existing accounts)
        // For existing users, you might want to set a temporary password
        const tempPassword = 'TempPassword123!'; // Users will need to reset
        
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, userData.email, tempPassword);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // If user already exists in Auth, you'll need to handle this case
            console.log(`Auth account already exists for ${userData.email}`);
            migrationResults.errors.push(`Auth account exists: ${userData.email}`);
            continue;
          }
          throw authError;
        }

        const newUID = userCredential.user.uid;

        // Create new document with UID as key
        const newUserRef = doc(db, 'users', newUID);
        batch.set(newUserRef, userData);

        // Mark old document for deletion
        const oldUserRef = doc(db, 'users', oldDocId);
        batch.delete(oldUserRef);

        migrationResults.success++;
        console.log(`✅ Migrated ${userData.email} to UID: ${newUID}`);

      } catch (error) {
        console.error(`❌ Failed to migrate ${userData.email}:`, error);
        migrationResults.failed++;
        migrationResults.errors.push(`${userData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit all changes
    if (migrationResults.success > 0) {
      await batch.commit();
      console.log('✅ Migration batch committed');
    }

    console.log('\n=== Migration Results ===');
    console.log(`✅ Successfully migrated: ${migrationResults.success}`);
    console.log(`❌ Failed migrations: ${migrationResults.failed}`);
    
    if (migrationResults.errors.length > 0) {
      console.log('\n=== Errors ===');
      migrationResults.errors.forEach(error => console.log(`- ${error}`));
    }

    console.log('\n=== Post-Migration Steps ===');
    console.log('1. Ask users to reset their passwords using Firebase Auth');
    console.log('2. Test login functionality thoroughly');
    console.log('3. Update any other collections that reference user emails to use UIDs');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Alternative: If you don't want to create Auth accounts automatically,
 * this function just moves the data structure without creating Auth accounts
 */
export async function prepareUserDataForAuth() {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  console.log('Preparing user data structure for Auth migration...');
  
  // This would just restructure the data in Firestore
  // Users would need to manually create accounts via the signup flow
  // But their profile data would be ready to link
  
  const usersCollection = collection(db, 'users');
  const userSnapshot = await getDocs(usersCollection);
  
  const batch = writeBatch(db);
  
  for (const userDoc of userSnapshot.docs) {
    const userData = userDoc.data();
    const oldDocId = userDoc.id;
    
    // Move to a temporary collection for manual linking later
    const tempRef = doc(db, 'users_to_migrate', oldDocId);
    batch.set(tempRef, userData);
  }
  
  await batch.commit();
  console.log('User data prepared for migration');
}

// Utility function to clean up after successful migration
export async function cleanupOldUserData() {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const tempCollection = collection(db, 'users_to_migrate');
  const snapshot = await getDocs(tempCollection);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('Cleaned up temporary migration data');
}
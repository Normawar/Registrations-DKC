// scripts/manage-users.ts
import { db, adminAuth } from '../src/lib/firebase-admin';
import readline from 'readline';

// Helper to read input from terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('Fetching all users from Firestore...');
  const snapshot = await db.collection('users').get();

  if (snapshot.empty) {
    console.log('No users found.');
    rl.close();
    return;
  }

  console.log(`Found ${snapshot.size} users:`);
  snapshot.forEach(doc => console.log(`- UID: ${doc.id}, Data:`, doc.data()));

  const uid = await ask('\nEnter UID to delete a user (or leave blank to exit): ');

  if (!uid) {
    console.log('No user deleted. Exiting.');
    rl.close();
    return;
  }

  try {
    // Delete Firestore document
    await db.collection('users').doc(uid).delete();
    console.log(`Deleted Firestore document for UID: ${uid}`);

    // Delete Firebase Auth user
    await adminAuth.deleteUser(uid);
    console.log(`Deleted Firebase Auth user for UID: ${uid}`);
  } catch (error: any) {
    console.error('Error deleting user:', error.message);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  rl.close();
});

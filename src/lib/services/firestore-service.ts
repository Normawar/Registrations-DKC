
import { getFirestore } from 'firebase/firestore';
import { app } from '@/lib/firebase';

// This file is now the official source for the db instance.
// It ensures we get the firestore instance from the initialized app.
const db = app ? getFirestore(app) : null;

export { db };

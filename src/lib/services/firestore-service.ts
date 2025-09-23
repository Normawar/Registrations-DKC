
import { db as adminDb } from '@/lib/firebase-admin';
import { db as clientDb } from '@/lib/firebase';

// This file now acts as a switch for the database instance.
// Server-side code will use adminDb via their direct imports.
// Client-side code will use clientDb.
const db = typeof window === 'undefined' ? adminDb : clientDb;

export { db };

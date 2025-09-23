
import { db as clientDb } from '@/lib/firebase';

// This service now ONLY exports the client-side database instance.
// Server-side files should import the admin db directly from 'firebase-admin.ts'
// All client-side data fetching should be done via API routes, not directly using this instance.
const db = clientDb;

export { db };

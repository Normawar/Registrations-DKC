
// This file is no longer used for data fetching in the main application flow.
// The useMasterDb context now fetches data directly on the client.
// This route can be kept for debugging or removed.

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin'; // Admin SDK instance

export async function GET() {
  if (!db) {
    console.error('Firestore admin not initialized');
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    const playersRef = db.collection('players');
    const snapshot = await playersRef.get();
    
    const players = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
}

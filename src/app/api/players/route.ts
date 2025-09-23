
import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  if (!db) {
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    const playersRef = collection(db, 'players');
    const snapshot = await playersRef.get();
    
    const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
}

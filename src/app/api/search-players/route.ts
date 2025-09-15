import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    console.log('Search players endpoint called');
    
    const playersRef = db.collection('players');
    const snapshot = await playersRef.limit(10).get();
    
    const players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    return NextResponse.json(players);
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' }, 
      { status: 500 }
    );
  }
}

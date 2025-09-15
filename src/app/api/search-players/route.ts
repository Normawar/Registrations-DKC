import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Using client-side SDK

export async function POST(request: Request) {
  if (!db) {
    return NextResponse.json(
      { error: 'Firestore is not initialized' },
      { status: 500 }
    );
  }
  
  try {
    const criteria = await request.json();
    console.log('Searching players with criteria:', criteria);
    
    const playersRef = collection(db, 'players');
    const constraints = [];

    if (criteria.uscfId) {
        constraints.push(where('uscfId', '==', criteria.uscfId));
    }
    if (criteria.firstName) {
        constraints.push(where('firstName', '>=', criteria.firstName));
        constraints.push(where('firstName', '<=', criteria.firstName + '\uf8ff'));
    }
    if (criteria.lastName) {
        constraints.push(where('lastName', '>=', criteria.lastName));
        constraints.push(where('lastName', '<=', criteria.lastName + '\uf8ff'));
    }
    if (criteria.school) {
        constraints.push(where('school', '==', criteria.school));
    }
    if (criteria.district) {
        constraints.push(where('district', '==', criteria.district));
    }
    if (criteria.state) {
        constraints.push(where('state', '==', criteria.state));
    }
    if (criteria.minRating) {
        constraints.push(where('regularRating', '>=', criteria.minRating));
    }
    if (criteria.maxRating) {
        constraints.push(where('regularRating', '<=', criteria.maxRating));
    }
    
    // Always order by something for consistent pagination
    constraints.push(orderBy('lastName'));
    constraints.push(limit(criteria.pageSize || 25));

    const q = query(playersRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    return NextResponse.json({
        players,
        total: players.length,
        hasMore: players.length === (criteria.pageSize || 25)
    });

  } catch (error: any) {
    console.error('Search error:', error);
    const errorMessage = error.message.includes('requires an index') 
      ? `Query failed: The required Firestore index is missing. Please create it. Details: ${error.message}`
      : `Search failed: ${error.message}`;

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

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

    // Add where clauses based on criteria
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
    if (criteria.school && criteria.school !== 'all') {
      constraints.push(where('school', '==', criteria.school));
    }
    if (criteria.district && criteria.district !== 'all') {
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

    // Create the query
    const q = query(playersRef, ...constraints as any);
    
    // Execute the query using getDocs() - this is the fix!
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
    
    // Handle specific Firestore errors
    let errorMessage = `Search failed: ${error.message}`;
    
    if (error.message.includes('requires an index')) {
      errorMessage = `Query failed: The required Firestore index is missing. Please create the composite index in Firebase Console. Details: ${error.message}`;
    } else if (error.message.includes('inequality filter')) {
      errorMessage = `Query failed: Multiple inequality filters require a composite index. Consider using exact matches or creating the required index. Details: ${error.message}`;
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}


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
    // Always start with a base query
    let constraints = [];

    if (criteria.uscfId?.trim()) {
      // USCF ID search is exclusive
      constraints.push(where('uscfId', '==', criteria.uscfId.trim()));
    } else {
        // Build query for other fields
        if (criteria.lastName?.trim()) {
            constraints.push(where('lastName', '>=', criteria.lastName.trim()));
            constraints.push(where('lastName', '<=', criteria.lastName.trim() + '\uf8ff'));
        }
        if (criteria.firstName?.trim()) {
            constraints.push(where('firstName', '>=', criteria.firstName.trim()));
            constraints.push(where('firstName', '<=', criteria.firstName.trim() + '\uf8ff'));
        }
    }
    
    // Add ordering
    if (criteria.uscfId) {
        // no specific order needed for a unique ID search
    } else if (criteria.lastName) {
        constraints.push(orderBy('lastName'));
    } else if (criteria.firstName) {
        constraints.push(orderBy('firstName'));
    } else {
        constraints.push(orderBy('lastName')); // Default sort
    }

    // Add limit
    constraints.push(limit(criteria.pageSize || 25));

    const q = query(playersRef, ...constraints);
    const snapshot = await getDocs(q);
    
    let players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    // Client-side filtering for fields that would require composite indexes
    let filteredPlayers = players.filter(player => {
        if (criteria.district && criteria.district !== 'all' && player.district !== criteria.district) {
            return false;
        }
        if (criteria.school && criteria.school !== 'all' && player.school !== criteria.school) {
            return false;
        }
        if (criteria.minRating && (!player.regularRating || player.regularRating < criteria.minRating)) {
            return false;
        }
        if (criteria.maxRating && (!player.regularRating || player.regularRating > criteria.maxRating)) {
            return false;
        }
        return true;
    });

    return NextResponse.json({
      players: filteredPlayers,
      total: filteredPlayers.length,
      hasMore: snapshot.docs.length === (criteria.pageSize || 25),
      message: `Found ${filteredPlayers.length} players.`
    });

  } catch (error: any) {
    console.error('Search error:', error);
    
    let errorMessage = `Search failed: ${error.message}`;
    
    if (error.message.includes('requires an index')) {
      errorMessage = `Database index still being created. Please wait a few minutes and try again.`;
    } else if (error.message.includes('inequality filter')) {
      errorMessage = `Search criteria too complex. Try fewer filters or search by name/USCF ID only.`;
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

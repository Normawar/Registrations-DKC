
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
    const constraints: any[] = [];

    // Prioritize USCF ID search above all else
    if (criteria.uscfId?.trim()) {
      constraints.push(where('uscfId', '==', criteria.uscfId.trim()));
      // When searching by USCF ID, we should ignore all other filters
      // as USCF ID is a unique identifier.
    } else {
      // Build constraints for other fields only if no USCF ID is provided
      
      // District filter
      if (criteria.district && criteria.district !== 'all') {
        if (criteria.district === 'Unassigned') {
          constraints.push(where('district', 'in', ['', 'Unassigned', 'None', null]));
        } else {
          constraints.push(where('district', '==', criteria.district));
        }
      }
      
      // School filter
      if (criteria.school && criteria.school !== 'all') {
        if (criteria.school === 'Unassigned') {
           constraints.push(where('school', 'in', ['', 'Unassigned', 'None', null]));
        } else {
          constraints.push(where('school', '==', criteria.school));
        }
      }
      
      // Name filters
      if (criteria.lastName?.trim()) {
        const lastName = criteria.lastName.trim();
        constraints.push(where('lastName', '>=', lastName));
        constraints.push(where('lastName', '<=', lastName + '\uf8ff'));
      }
      
      if (criteria.firstName?.trim()) {
        const firstName = criteria.firstName.trim();
        constraints.push(where('firstName', '>=', firstName));
        constraints.push(where('firstName', '<=', firstName + '\uf8ff'));
      }
      
      // State filter
      if (criteria.state?.trim()) {
        constraints.push(where('state', '==', criteria.state.trim()));
      }
      
      // Rating filters
      if (criteria.minRating) {
        constraints.push(where('regularRating', '>=', Number(criteria.minRating)));
      }
      if (criteria.maxRating) {
        constraints.push(where('regularRating', '<=', Number(criteria.maxRating)));
      }
    }
    
    // Add ordering
    if (constraints.length === 0) {
      // If no filters, just order and limit
      constraints.push(orderBy('lastName'));
    } else if (!criteria.uscfId?.trim()) {
      // Add ordering for non-USCF ID searches to ensure consistency
      constraints.push(orderBy('lastName'));
    }

    // Add limit
    constraints.push(limit(criteria.pageSize || 25));

    // Create and execute the query
    const q = query(playersRef, ...constraints);
    console.log('Executing indexed query with', constraints.length, 'constraints');
    
    const snapshot = await getDocs(q);
    
    const players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    // Generate helpful message
    let message = '';
    let searchStrategy = '';
    
    if (criteria.uscfId) {
      searchStrategy = 'uscfId';
      message = players.length > 0 ? 
        `Found player with USCF ID: ${criteria.uscfId}` : 
        'No player found with that USCF ID';
    } else if (criteria.district === 'Unassigned' || criteria.school === 'Unassigned') {
      searchStrategy = 'unassigned';
      message = `Found ${players.length} unassigned players`;
    } else if (criteria.lastName || criteria.firstName) {
      searchStrategy = 'name';
      message = `Found ${players.length} players matching name criteria`;
    } else if (criteria.district || criteria.school) {
      searchStrategy = 'location';
      message = `Found ${players.length} players in specified district/school`;
    } else {
      searchStrategy = 'general';
      message = `Found ${players.length} players`;
    }
    
    console.log(`Search completed: ${players.length} results using ${searchStrategy} strategy`);
    
    return NextResponse.json({
      players,
      total: players.length,
      hasMore: players.length === (criteria.pageSize || 25),
      searchStrategy,
      message
    });

  } catch (error: any) {
    console.error('Search error:', error);
    
    let errorMessage = `Search failed: ${error.message}`;
    
    if (error.message.includes('requires an index')) {
      errorMessage = `Database index still being created. Please wait a few minutes and try again. Complex searches require database optimization.`;
    } else if (error.message.includes('inequality filter')) {
      errorMessage = `Search criteria too complex. Try fewer filters or search by name/USCF ID only.`;
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

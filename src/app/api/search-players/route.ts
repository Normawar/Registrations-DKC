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
    let constraints = [];

    // Now that we have the composite index, we can use proper where clauses
    
    if (criteria.uscfId?.trim()) {
      // Exact USCF ID match - highest priority
      constraints.push(where('uscfId', '==', criteria.uscfId.trim()));
    } else {
      // Use the composite index for district/school filtering
      
      // District filter - now use where clause instead of client-side filtering
      if (criteria.district && criteria.district !== 'all') {
        if (criteria.district === 'Unassigned') {
          constraints.push(where('district', 'in', ['', 'Unassigned', 'None']));
        } else {
          constraints.push(where('district', '==', criteria.district));
        }
      }
      
      // School filter - now use where clause
      if (criteria.school && criteria.school !== 'all') {
        if (criteria.school === 'Unassigned') {
          constraints.push(where('school', 'in', ['', 'Unassigned', 'None']));
        } else {
          constraints.push(where('school', '==', criteria.school));
        }
      }
      
      // Name filters with range queries
      if (criteria.lastName?.trim()) {
        const lastName = criteria.lastName.trim();
        constraints.push(where('lastName', '>=', lastName));
        constraints.push(where('lastName', '<=', lastName + '\uf8ff'));
      } else if (criteria.firstName?.trim()) {
        // Only if lastName is not specified
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
        constraints.push(where('regularRating', '>=', criteria.minRating));
      }
      if (criteria.maxRating) {
        constraints.push(where('regularRating', '<=', criteria.maxRating));
      }
    }
    
    // Add ordering - must be compatible with the where clauses
    if (criteria.uscfId?.trim()) {
      // No ordering needed for unique ID
    } else if (criteria.lastName?.trim()) {
      constraints.push(orderBy('lastName'));
    } else if (criteria.firstName?.trim() && !criteria.lastName?.trim()) {
      constraints.push(orderBy('firstName'));
    } else if (criteria.minRating || criteria.maxRating) {
      constraints.push(orderBy('regularRating'));
      constraints.push(orderBy('lastName')); // Secondary sort
    } else {
      // For district/school searches, order by lastName
      constraints.push(orderBy('lastName'));
    }

    // Add limit
    constraints.push(limit(criteria.pageSize || 50));

    console.log('Building query with constraints:', constraints.length);
    const q = query(playersRef, ...constraints);
    
    const snapshot = await getDocs(q);
    
    let players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Query returned ${players.length} players before additional filtering`);
    
    // Only minimal client-side filtering for criteria that couldn't be in the main query
    let filteredPlayers = players.filter(player => {
      // Additional firstName filtering if lastName was the primary search
      if (criteria.firstName?.trim() && criteria.lastName?.trim()) {
        const firstName = (player.firstName || '').toLowerCase();
        const searchFirst = criteria.firstName.toLowerCase().trim();
        if (!firstName.includes(searchFirst)) {
          return false;
        }
      }
      
      return true;
    });

    // Generate appropriate message
    let message = '';
    if (criteria.uscfId?.trim()) {
      message = filteredPlayers.length > 0 ? 
        `Found player with USCF ID: ${criteria.uscfId}` : 
        `No player found with USCF ID: ${criteria.uscfId}`;
    } else if (criteria.district === 'TestMcAllen') {
      message = `Found ${filteredPlayers.length} players in TestMcAllen district`;
    } else if (criteria.school === 'TestMcAllen') {
      message = `Found ${filteredPlayers.length} players in TestMcAllen school`;
    } else if (criteria.district === 'Unassigned' || criteria.school === 'Unassigned') {
      message = `Found ${filteredPlayers.length} unassigned players`;
    } else {
      message = `Found ${filteredPlayers.length} players matching your criteria`;
    }

    console.log(`Final result: ${filteredPlayers.length} players`);

    return NextResponse.json({
      players: filteredPlayers,
      total: filteredPlayers.length,
      hasMore: snapshot.docs.length === (criteria.pageSize || 50),
      message
    });

  } catch (error: any) {
    console.error('Search error:', error);
    
    let errorMessage = `Search failed: ${error.message}`;
    
    if (error.message.includes('requires an index')) {
      errorMessage = `Database index still building. Please wait a few more minutes and try again.`;
    } else if (error.message.includes('inequality filter')) {
      errorMessage = `Search criteria too complex. Try simpler criteria.`;
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}
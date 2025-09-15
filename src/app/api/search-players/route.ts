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

    // Build query constraints based on criteria priority
    // This approach uses the indexes we created
    
    if (criteria.uscfId?.trim()) {
      // Exact USCF ID match - highest priority
      constraints.push(where('uscfId', '==', criteria.uscfId.trim()));
    } else {
      // Build constraints for indexed fields
      
      // District filter
      if (criteria.district && criteria.district !== 'all') {
        if (criteria.district === 'Unassigned') {
          constraints.push(where('district', 'in', ['', 'Unassigned', 'None', null]));
        } else {
          constraints.push(where('district', '==', criteria.district));
        }
      }
      
      // School filter (only if district is also specified or district is 'all')
      if (criteria.school && criteria.school !== 'all' && 
          (criteria.district === 'all' || !criteria.district || constraints.length === 0)) {
        if (criteria.school === 'Unassigned') {
          constraints.push(where('school', 'in', ['', 'Unassigned', 'None', null]));
        } else {
          constraints.push(where('school', '==', criteria.school));
        }
      }
      
      // Name filters - use range queries for partial matching
      if (criteria.lastName?.trim()) {
        const lastName = criteria.lastName.trim();
        constraints.push(where('lastName', '>=', lastName));
        constraints.push(where('lastName', '<=', lastName + '\uf8ff'));
      }
      
      // First name filter (only if lastName is not specified to avoid conflicts)
      if (criteria.firstName?.trim() && !criteria.lastName?.trim()) {
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
    
    // Add ordering - this must match our index
    if (criteria.uscfId) {
      // For USCF ID searches, no additional ordering needed
    } else if (criteria.lastName?.trim()) {
      constraints.push(orderBy('lastName'));
    } else if (criteria.firstName?.trim() && !criteria.lastName) {
      constraints.push(orderBy('firstName'));
    } else if (criteria.minRating || criteria.maxRating) {
      constraints.push(orderBy('regularRating'));
      constraints.push(orderBy('lastName')); // Secondary sort
    } else {
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
    
    // Apply any remaining client-side filters that couldn't be done in the query
    let filteredPlayers = players.filter(player => {
      // First name filter (if lastName was the primary search)
      if (criteria.firstName?.trim() && criteria.lastName?.trim()) {
        const firstName = (player.firstName || '').toLowerCase();
        const searchFirst = criteria.firstName.toLowerCase().trim();
        if (!firstName.includes(searchFirst)) {
          return false;
        }
      }
      
      // School filter (if district was the primary filter)
      if (criteria.school && criteria.school !== 'all' && criteria.district && criteria.district !== 'all') {
        if (criteria.school === 'Unassigned') {
          const school = player.school || '';
          if (school && school !== '' && school !== 'Unassigned' && school !== 'None') {
            return false;
          }
        } else if (player.school !== criteria.school) {
          return false;
        }
      }
      
      return true;
    });
    
    // Generate helpful message
    let message = '';
    let searchStrategy = '';
    
    if (criteria.uscfId) {
      searchStrategy = 'uscfId';
      message = filteredPlayers.length > 0 ? 
        `Found player with USCF ID: ${criteria.uscfId}` : 
        'No player found with that USCF ID';
    } else if (criteria.district === 'Unassigned' || criteria.school === 'Unassigned') {
      searchStrategy = 'unassigned';
      message = `Found ${filteredPlayers.length} unassigned players`;
    } else if (criteria.lastName || criteria.firstName) {
      searchStrategy = 'name';
      message = `Found ${filteredPlayers.length} players matching name criteria`;
    } else if (criteria.district || criteria.school) {
      searchStrategy = 'location';
      message = `Found ${filteredPlayers.length} players in specified district/school`;
    } else {
      searchStrategy = 'general';
      message = `Found ${filteredPlayers.length} players`;
    }
    
    console.log(`Search completed: ${filteredPlayers.length} results using ${searchStrategy} strategy`);
    
    return NextResponse.json({
      players: filteredPlayers,
      total: filteredPlayers.length,
      hasMore: filteredPlayers.length === (criteria.pageSize || 25),
      searchStrategy,
      message
    });

  } catch (error: any) {
    console.error('Search error:', error);
    
    // Handle specific Firestore errors
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
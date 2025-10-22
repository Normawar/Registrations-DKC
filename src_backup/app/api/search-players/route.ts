import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const db = getDb();
    const criteria = await request.json();
    console.log('Searching players with criteria:', criteria);
    
    const playersRef = db.collection('players');
    let q: FirebaseFirestore.Query = playersRef;

    // Build query with Firebase Admin SDK syntax
    if (criteria.uscfId?.trim()) {
      // Exact USCF ID match - highest priority
      q = q.where('uscfId', '==', criteria.uscfId.trim());
    } else {
      // District filter
      if (criteria.district && criteria.district !== 'all') {
        if (criteria.district === 'Unassigned') {
          q = q.where('district', 'in', ['', 'Unassigned', 'None']);
        } else {
          q = q.where('district', '==', criteria.district);
        }
      }
      
      // School filter
      if (criteria.school && criteria.school !== 'all') {
        if (criteria.school === 'Unassigned') {
          q = q.where('school', 'in', ['', 'Unassigned', 'None']);
        } else {
          q = q.where('school', '==', criteria.school);
        }
      }
      
      // Name filters with range queries
      if (criteria.lastName?.trim()) {
        const lastName = criteria.lastName.trim();
        q = q.where('lastName', '>=', lastName);
        q = q.where('lastName', '<=', lastName + '\uf8ff');
      } else if (criteria.firstName?.trim()) {
        const firstName = criteria.firstName.trim();
        q = q.where('firstName', '>=', firstName);
        q = q.where('firstName', '<=', firstName + '\uf8ff');
      }
      
      // State filter
      if (criteria.state?.trim()) {
        q = q.where('state', '==', criteria.state.trim());
      }
      
      // Rating filters
      if (criteria.minRating) {
        q = q.where('regularRating', '>=', criteria.minRating);
      }
      if (criteria.maxRating) {
        q = q.where('regularRating', '<=', criteria.maxRating);
      }
    }
    
    // Add ordering
    if (criteria.uscfId?.trim()) {
      // No ordering needed for unique ID
    } else if (criteria.lastName?.trim()) {
      q = q.orderBy('lastName');
    } else if (criteria.firstName?.trim() && !criteria.lastName?.trim()) {
      q = q.orderBy('firstName');
    } else if (criteria.minRating || criteria.maxRating) {
      q = q.orderBy('regularRating');
      q = q.orderBy('lastName'); // Secondary sort
    } else {
      q = q.orderBy('lastName');
    }

    // Add limit
    q = q.limit(criteria.pageSize || 50);

    console.log('Executing query...');
    const snapshot = await q.get();
    
    let players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Query returned ${players.length} players before additional filtering`);
    
    // Additional client-side filtering
    let filteredPlayers = players.filter(player => {
      if (criteria.firstName?.trim() && criteria.lastName?.trim()) {
        const firstName = (player.firstName || '').toLowerCase();
        const searchFirst = criteria.firstName.toLowerCase().trim();
        if (!firstName.includes(searchFirst)) {
          return false;
        }
      }
      return true;
    });

    // Generate message
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
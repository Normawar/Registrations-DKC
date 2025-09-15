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
    let q;
    
    // Strategy: Use single-field queries to avoid complex composite indexes
    // Priority order: uscfId (exact match) > lastName (text search) > district/school (filters)
    
    if (criteria.uscfId) {
      // Most specific search - USCF ID exact match
      q = query(
        playersRef,
        where('uscfId', '==', criteria.uscfId),
        limit(criteria.pageSize || 25)
      );
    } else if (criteria.lastName) {
      // Text search on lastName with optional additional filters
      const constraints = [
        where('lastName', '>=', criteria.lastName),
        where('lastName', '<=', criteria.lastName + '\uf8ff'),
        orderBy('lastName'),
        limit(criteria.pageSize || 25)
      ];
      q = query(playersRef, ...constraints as any);
    } else if (criteria.firstName) {
      // Text search on firstName with optional additional filters
      const constraints = [
        where('firstName', '>=', criteria.firstName),
        where('firstName', '<=', criteria.firstName + '\uf8ff'),
        orderBy('firstName'),
        limit(criteria.pageSize || 25)
      ];
      q = query(playersRef, ...constraints as any);
    } else if (criteria.district && criteria.district !== 'all') {
      // District-based search
      if (criteria.district === 'Unassigned') {
        // Search for unassigned players - need to handle this carefully
        q = query(
          playersRef,
          where('district', 'in', ['', 'Unassigned', 'None']),
          orderBy('lastName'),
          limit(criteria.pageSize || 25)
        );
      } else {
        q = query(
          playersRef,
          where('district', '==', criteria.district),
          orderBy('lastName'),
          limit(criteria.pageSize || 25)
        );
      }
    } else if (criteria.school && criteria.school !== 'all') {
      // School-based search
      if (criteria.school === 'Unassigned') {
        q = query(
          playersRef,
          where('school', 'in', ['', 'Unassigned', 'None']),
          orderBy('lastName'),
          limit(criteria.pageSize || 25)
        );
      } else {
        q = query(
          playersRef,
          where('school', '==', criteria.school),
          orderBy('lastName'),
          limit(criteria.pageSize || 25)
        );
      }
    } else if (criteria.state) {
      // State-based search
      q = query(
        playersRef,
        where('state', '==', criteria.state),
        orderBy('lastName'),
        limit(criteria.pageSize || 25)
      );
    } else {
      // No specific criteria - get all players (with limits)
      q = query(
        playersRef,
        orderBy('lastName'),
        limit(criteria.pageSize || 25)
      );
    }

    // Execute the query
    const snapshot = await getDocs(q);
    
    let players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    // Apply client-side filtering for additional criteria that couldn't be done in the query
    // This is less efficient but avoids complex indexing requirements
    if (players.length > 0) {
      // Filter by multiple criteria client-side if needed
      players = players.filter(player => {
        // Apply secondary filters
        if (criteria.firstName && !criteria.lastName && !player.firstName?.toLowerCase().includes(criteria.firstName.toLowerCase())) {
          return false;
        }
        if (criteria.lastName && !criteria.firstName && !player.lastName?.toLowerCase().includes(criteria.lastName.toLowerCase())) {
          return false;
        }
        
        // School filter (if not primary search criteria)
        if (criteria.school && criteria.school !== 'all' && criteria.district) {
          if (criteria.school === 'Unassigned') {
            if (player.school && player.school !== '' && player.school !== 'Unassigned' && player.school !== 'None') {
              return false;
            }
          } else if (player.school !== criteria.school) {
            return false;
          }
        }
        
        // District filter (if not primary search criteria)
        if (criteria.district && criteria.district !== 'all' && criteria.school) {
          if (criteria.district === 'Unassigned') {
            if (player.district && player.district !== '' && player.district !== 'Unassigned' && player.district !== 'None') {
              return false;
            }
          } else if (player.district !== criteria.district) {
            return false;
          }
        }
        
        // Rating filters
        if (criteria.minRating && (!player.regularRating || player.regularRating < criteria.minRating)) {
          return false;
        }
        if (criteria.maxRating && (!player.regularRating || player.regularRating > criteria.maxRating)) {
          return false;
        }
        
        return true;
      });
    }
    
    // Handle null districts/schools for unassigned search
    if ((criteria.district === 'Unassigned' || criteria.school === 'Unassigned') && players.length < 10) {
      // Also search for null values - requires a separate query
      try {
        const nullField = criteria.district === 'Unassigned' ? 'district' : 'school';
        const nullQuery = query(
          playersRef,
          where(nullField, '==', null),
          orderBy('lastName'),
          limit(10)
        );
        const nullSnapshot = await getDocs(nullQuery);
        
        nullSnapshot.forEach(doc => {
          const playerData = { id: doc.id, ...doc.data() };
          // Avoid duplicates
          if (!players.find(p => p.id === playerData.id)) {
            players.push(playerData);
          }
        });
      } catch (nullError) {
        // Ignore null query errors - some databases don't support null queries
        console.log('Null query not supported, skipping...');
      }
    }
    
    return NextResponse.json({
      players: players.slice(0, criteria.pageSize || 25), // Ensure we don't exceed page size
      total: players.length,
      hasMore: players.length === (criteria.pageSize || 25),
      searchStrategy: criteria.uscfId ? 'uscfId' : criteria.lastName ? 'lastName' : criteria.firstName ? 'firstName' : criteria.district ? 'district' : criteria.school ? 'school' : 'all'
    });

  } catch (error: any) {
    console.error('Search error:', error);
    
    // Handle specific Firestore errors
    let errorMessage = `Search failed: ${error.message}`;
    
    if (error.message.includes('requires an index')) {
      errorMessage = `Search temporarily unavailable: Database index required. Try searching with fewer criteria or contact administrator.`;
    } else if (error.message.includes('inequality filter')) {
      errorMessage = `Search too complex: Try using fewer search criteria at once.`;
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const criteria = await request.json();
    
    console.log('Search criteria:', criteria);
    
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('players');
    const conditions = [];
    
    // Apply filters based on criteria
    if (criteria.uscfId && criteria.uscfId.trim()) {
      query = query.where('uscfId', '==', criteria.uscfId.trim());
      conditions.push(`uscfId: ${criteria.uscfId}`);
    }
    
    if (criteria.district && criteria.district !== 'all') {
      query = query.where('district', '==', criteria.district);
      conditions.push(`district: ${criteria.district}`);
    }
    
    if (criteria.school && criteria.school !== 'all') {
      query = query.where('school', '==', criteria.school);
      conditions.push(`school: ${criteria.school}`);
    }
    
    if (criteria.state && criteria.state.trim()) {
      query = query.where('state', '==', criteria.state);
      conditions.push(`state: ${criteria.state}`);
    }
    
    const limit = criteria.pageSize || 100;
    query = query.limit(limit);
    
    const snapshot = await query.get();
    const players: any[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      players.push({ 
        id: doc.id, 
        ...data 
      });
    });
    
    // Client-side filtering for name searches (since Firestore text search is limited)
    let filteredPlayers = players;
    
    if (criteria.firstName && criteria.firstName.trim()) {
      const firstName = criteria.firstName.toLowerCase().trim();
      filteredPlayers = filteredPlayers.filter(player => 
        player.firstName && player.firstName.toLowerCase().includes(firstName)
      );
    }
    
    if (criteria.lastName && criteria.lastName.trim()) {
      const lastName = criteria.lastName.toLowerCase().trim();
      filteredPlayers = filteredPlayers.filter(player => 
        player.lastName && player.lastName.toLowerCase().includes(lastName)
      );
    }
    
    // Apply rating filters
    if (criteria.minRating) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.regularRating && player.regularRating >= criteria.minRating
      );
    }
    
    if (criteria.maxRating) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.regularRating && player.regularRating <= criteria.maxRating
      );
    }
    
    console.log(`Found ${filteredPlayers.length} players matching criteria: ${conditions.join(', ')}`);
    
    const result = {
      players: filteredPlayers,
      total: filteredPlayers.length,
      message: filteredPlayers.length === limit ? `Showing first ${limit} results` : null
    };
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.
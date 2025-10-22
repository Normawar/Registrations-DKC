import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  console.log('API Route Hit');
  const { searchParams } = new URL(request.url);
  const school = searchParams.get('school');
  const district = searchParams.get('district');
  const playerIdsParam = searchParams.get('playerIds');

  console.log(`Query Params: school=${school}, district=${district}, playerIds=${playerIdsParam}`);

  try {
    console.log('Getting Firestore instance...');
    const db = getDb();
    console.log('Firestore instance obtained, fetching players...');
    
    const playersRef = db.collection('players');
    let players: any[] = [];

    if (playerIdsParam) {
      console.log('Fetching players by ID');
      const playerIds = playerIdsParam.split(',').filter(id => id.trim() !== '');
      if (playerIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < playerIds.length; i += 30) {
          chunks.push(playerIds.slice(i, i + 30));
        }
        
        const queryPromises = chunks.map(chunk => {
          const q = playersRef.where(FieldPath.documentId(), 'in', chunk);
          return q.get();
        });

        const snapshots = await Promise.all(queryPromises);
        snapshots.forEach(snapshot => {
          const chunkPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          players.push(...chunkPlayers);
        });
        console.log(`Fetched ${players.length} players by ID`);
      }
    } else if (district || school) {
        console.log('Fetching players by district or school');
        let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = playersRef;
        
        if (district) {
            console.log(`Applying district filter: ${district}`);
            q = q.where('district', '==', district);
        }
        if (school) {
            console.log(`Applying school filter: ${school}`);
            q = q.where('school', '==', school);
        }

        console.log('Executing Firestore query...');
        const snapshot = await q.get();
        console.log(`Query returned ${snapshot.docs.length} documents`);
        players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Fetched ${players.length} players by district/school`);
    } else {
      console.warn('No valid parameters specified');
      return NextResponse.json({ error: 'A school, district, or playerIds must be specified.' }, { status: 400 });
    }

    console.log('Successfully fetched players');
    return NextResponse.json(players);

  } catch (error: any) {
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error stack:', error?.stack);
    
    return NextResponse.json(
      { 
        error: `Failed to fetch roster.`,
        detailedError: error?.message || 'Unknown error',
        errorCode: error?.code || 'unknown',
        errorType: error?.constructor?.name || typeof error
      },
      { status: 500 }
    );
  }
}

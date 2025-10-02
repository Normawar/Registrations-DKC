import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const school = searchParams.get('school');
  const district = searchParams.get('district');
  const playerIdsParam = searchParams.get('playerIds');

  if (!db) {
    return NextResponse.json({ error: 'Firestore is not initialized' }, { status: 500 });
  }

  try {
    const playersRef = db.collection('players');
    let players: any[] = [];

    if (playerIdsParam) {
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
      }
    } else if (district || school) {
        let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = playersRef;
        
        if (district) {
            q = q.where('district', '==', district);
        }
        if (school) {
            q = q.where('school', '==', school);
        }

        const snapshot = await q.get();
        players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      return NextResponse.json({ error: 'A school, district, or playerIds must be specified.' }, { status: 400 });
    }

    return NextResponse.json(players);

  } catch (error: any) {
    console.error('Error fetching roster:', error);
    return NextResponse.json(
      { error: `Failed to fetch roster: ${error.message}` },
      { status: 500 }
    );
  }
}

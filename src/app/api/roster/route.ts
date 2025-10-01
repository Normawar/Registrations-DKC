import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-admin';

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
    const playersRef = collection(db, 'players');
    let players: any[] = [];

    if (school && district) {
      const q = query(playersRef, where('district', '==', district), where('school', '==', school));
      const snapshot = await getDocs(q);
      players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (district) {
        const q = query(playersRef, where('district', '==', district));
        const snapshot = await getDocs(q);
        players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (playerIdsParam) {
      const playerIds = playerIdsParam.split(',');
      if (playerIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < playerIds.length; i += 30) {
          chunks.push(playerIds.slice(i, i + 30));
        }
        
        const queryPromises = chunks.map(chunk => {
          const q = query(playersRef, where(documentId(), 'in', chunk));
          return getDocs(q);
        });

        const snapshots = await Promise.all(queryPromises);
        snapshots.forEach(snapshot => {
          const chunkPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          players.push(...chunkPlayers);
        });
      }
    } else {
      return NextResponse.json({ error: 'A school/district or playerIds must be specified.' }, { status: 400 });
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

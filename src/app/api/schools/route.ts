import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  if (!db) {
    console.error('Firestore admin not initialized');
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    
    console.log('Fetching schools for district from admin SDK:', district);
    
    let playersRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('players');
    
    if (district && district !== 'all') {
      playersRef = playersRef.where('district', '==', district);
    }
    
    const snapshot = await playersRef.get();
    const schools = new Set<string>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.school && data.school.trim()) {
        schools.add(data.school.trim());
      }
    });
    
    const sortedSchools = [...schools].sort();
    
    console.log(`Found ${sortedSchools.length} unique schools for district: ${district || 'all'}`);
    
    return NextResponse.json(sortedSchools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schools' }, 
      { status: 500 }
    );
  }
}

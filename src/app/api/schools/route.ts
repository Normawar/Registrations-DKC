import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

export async function GET(request: NextRequest) {
  if (!db) {
    console.error('Firestore not initialized');
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    
    console.log('Fetching schools for district:', district);
    
    const constraints = [];
    if (district && district !== 'all') {
      constraints.push(where('district', '==', district));
    }
    
    const playersRef = collection(db, 'players');
    const q = query(playersRef, ...constraints);
    
    const snapshot = await getDocs(q);
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

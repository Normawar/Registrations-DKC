import { NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Using client-side SDK
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: 'Firestore is not initialized' },
      { status: 500 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    
    console.log('Fetching schools for district:', district);
    
    const constraints = [];
    if (district && district !== 'all') {
      constraints.push(where('district', '==', district));
    }
    
    const q = query(collection(db, 'players'), ...constraints);
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch schools';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

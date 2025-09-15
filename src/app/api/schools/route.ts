import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    
    console.log('Fetching schools for district:', district);
    
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('players');
    
    if (district && district !== 'all') {
      query = query.where('district', '==', district);
    }
    
    const snapshot = await query.get();
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
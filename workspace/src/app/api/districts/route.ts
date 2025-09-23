
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  if (!db) {
    console.error('Firestore admin not initialized');
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    const schoolsRef = db.collection('schools');
    const snapshot = await schoolsRef.get();
    
    const districts = new Set<string>();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.district && data.district.trim()) {
        districts.add(data.district.trim());
      }
    });
    
    const sortedDistricts = ['Homeschool', ...[...districts].filter(d => d !== 'Homeschool').sort()];
    
    return NextResponse.json(sortedDistricts);
  } catch (error) {
    console.error('Error fetching districts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}

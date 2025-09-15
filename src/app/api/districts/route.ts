import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

export async function GET() {
  if (!db) {
    console.error('Firestore not initialized');
    return NextResponse.json({ error: 'Firestore is not configured' }, { status: 500 });
  }

  try {
    console.log('Fetching districts from client SDK...');
    
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    const districts = new Set<string>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.district && data.district.trim()) {
        districts.add(data.district.trim());
      }
    });
    
    const sortedDistricts = [...districts].sort();
    
    console.log(`Found ${sortedDistricts.length} unique districts`);
    
    return NextResponse.json(sortedDistricts);
  } catch (error) {
    console.error('Error fetching districts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}

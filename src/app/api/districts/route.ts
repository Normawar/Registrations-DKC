import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    console.log('Fetching districts...');
    
    // Query the players collection to get unique districts
    const playersRef = db.collection('players');
    const snapshot = await playersRef.get();
    
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
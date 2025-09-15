// This file is no longer used for data fetching in the main application flow.
// The EnhancedPlayerSearchDialog now fetches district data directly from the client.
// This route can be kept for debugging or removed.

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    console.log('Fetching districts from admin SDK...');
    
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

// src/app/api/districts/route.ts
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

export async function GET() {
  try {
    const db = admin.firestore();
    const schoolsRef = db.collection('schools');
    const snapshot = await schoolsRef.get();
    
    const districts = new Set<string>();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.district && data.district.trim()) {
        districts.add(data.district.trim());
      }
    });
    
    const sortedDistricts = [...districts].sort();
    
    return NextResponse.json(sortedDistricts);
  } catch (error) {
    console.error('Error fetching districts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}// Cache bust

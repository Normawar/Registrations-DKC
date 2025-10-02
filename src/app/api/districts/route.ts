import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function GET() {
  console.log('DISTRICTS API - DEPLOYED FRESH v3');
  try {
    const db = admin.firestore();
    const schoolsRef = db.collection('schools');
    const snapshot = await schoolsRef.get();

    const districts = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.district && data.district.trim()) {
        districts.add(data.district.trim());
      }
    });

    const sortedDistricts = [...districts].sort();
    return NextResponse.json(sortedDistricts);
  } catch (error: any) {
    console.error('DISTRICTS API ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}

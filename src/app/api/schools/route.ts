import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function GET() {
  console.log('SCHOOLS API - DEPLOYED FRESH v3');
  try {
    const db = admin.firestore();
    const schoolsRef = db.collection('schools');
    const snapshot = await schoolsRef.get();

    const schools = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.school && data.school.trim()) {
        schools.add(data.school.trim());
      }
    });

    const sortedSchools = [...schools].sort();
    return NextResponse.json(sortedSchools);
  } catch (error: any) {
    console.error('SCHOOLS API ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch schools' },
      { status: 500 }
    );
  }
}

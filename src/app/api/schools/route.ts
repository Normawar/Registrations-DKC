// src/app/api/schools/route.ts
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

export async function GET(request: NextRequest) {
  console.log('Schools API called - NEW VERSION 2');
  try {
    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    
    let schoolsRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('schools');
    
    if (district && district !== 'all') {
      schoolsRef = schoolsRef.where('district', '==', district);
    }
    
    const snapshot = await schoolsRef.get();
    const schools = new Set<string>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.schoolName && data.schoolName.trim()) {
        schools.add(data.schoolName.trim());
      }
    });
    
    const sortedSchools = [...schools].sort();
    
    return NextResponse.json(sortedSchools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schools' }, 
      { status: 500 }
    );
  }
}

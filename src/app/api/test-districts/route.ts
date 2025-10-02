import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

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
    
    return NextResponse.json([...districts].sort());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

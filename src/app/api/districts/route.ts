import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('=== DISTRICTS API CALLED ===');
    
    // Test if we can import firebase-admin
    console.log('Testing firebase-admin import...');
    const admin = await import('firebase-admin/app');
    console.log('Firebase-admin imported successfully');
    
    // Test environment variables
    console.log('CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'EXISTS' : 'MISSING');
    console.log('PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'EXISTS' : 'MISSING');
    
    // Try to import our firebase-admin config
    const { db } = await import('@/lib/firebase-admin');
    console.log('Firebase admin config imported');
    
    const playersRef = db.collection('players');
    const snapshot = await playersRef.get();
    
    console.log('Snapshot size:', snapshot.size);
    
    return NextResponse.json(['test-district']);
  } catch (error: any) {
    console.error('=== DETAILED ERROR ===');
    console.error('Error name:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch districts', 
        details: error.message,
        type: error.constructor.name 
      },
      { status: 500 }
    );
  }
}

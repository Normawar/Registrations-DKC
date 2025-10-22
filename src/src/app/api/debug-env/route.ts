import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasFirebaseSecret: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    secretLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    allEnvVars: Object.keys(process.env).filter(key => 
      key.includes('FIREBASE') || key.includes('GOOGLE')
    )
  });
}

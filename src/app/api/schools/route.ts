// src/app/api/schools/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET() {
  console.log("SCHOOLS API - DEPLOYED FRESH v3");

  // DEBUG INFO
  const debugInfo = {
    hasFirebaseSecret: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    secretLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
    secretPreview: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 50) + "...",
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    envVarsWithFirebase: Object.keys(process.env).filter(key => 
      key.includes('FIREBASE') || key.includes('GOOGLE')
    ),
  };

  console.log("DEBUG INFO:", debugInfo);

  try {
    const db = getDb();
    const schoolsRef = db.collection("schools");
    const snapshot = await schoolsRef.get();

    const schools = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.school?.trim()) schools.add(data.school.trim());
    });

    const sortedSchools = [...schools].sort();
    return NextResponse.json(sortedSchools);
  } catch (error: any) {
    console.error("SCHOOLS API ERROR:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to fetch schools",
        debug: debugInfo  // Include debug info in error response
      },
      { status: 500 }
    );
  }
}
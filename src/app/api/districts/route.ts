export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from "next/server";

export async function GET() {
  console.log("DISTRICTS API - DEPLOYED FRESH v3");
  try {
    const { db } = await import("@/lib/firebase-admin");
    const schoolsRef = db.collection("schools");
    const snapshot = await schoolsRef.get();
    const districts = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.district?.trim()) districts.add(data.district.trim());
    });
    const sortedDistricts = [...districts].sort();
    return NextResponse.json(sortedDistricts);
  } catch (error: any) {
    console.error("DISTRICTS API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch districts" },
      { status: 500 }
    );
  }
}
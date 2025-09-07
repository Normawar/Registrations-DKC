// app/api/uscf-lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';

const USCF_SERVICE_URL = process.env.USCF_SERVICE_URL || 'https://your-cloud-run-service-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.uscfId) {
      return NextResponse.json({ error: 'USCF ID is required' }, { status: 400 });
    }

    const response = await fetch(`${USCF_SERVICE_URL}/uscf-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uscf_id: body.uscfId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Player not found' }, 
        { status: response.status }
      );
    }

    const player = await response.json();
    return NextResponse.json(player);

  } catch (error) {
    console.error('USCF lookup error:', error);
    return NextResponse.json(
      { error: 'Service unavailable' }, 
      { status: 503 }
    );
  }
}

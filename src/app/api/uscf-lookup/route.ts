import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.uscfId) {
      return NextResponse.json({ error: 'USCF ID is required' }, { status: 400 });
    }

    if (!/^\d{7,8}$/.test(body.uscfId.trim())) {
      return NextResponse.json({ error: 'Invalid USCF ID format' }, { status: 400 });
    }

    const response = await fetch('http://localhost:8000/uscf-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uscf_id: body.uscfId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Player not found' }, { status: response.status });
    }

    const player = await response.json();
    return NextResponse.json(player);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

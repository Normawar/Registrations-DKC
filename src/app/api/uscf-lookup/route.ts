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

    // Mock data for testing
    const mockPlayer = {
      uscf_id: body.uscfId.trim(),
      name: "MORENO, RYAN",
      rating_regular: 602,
      rating_quick: 605,
      state: "TX",
      expiration_date: "2025-09-30"
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json(mockPlayer);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
